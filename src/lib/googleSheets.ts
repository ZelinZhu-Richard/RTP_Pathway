import { GoogleAuth } from "google-auth-library";
import { eq } from "drizzle-orm";
import {
  buildSubmissionSheetRow,
  classifySubmissionSheetHeader,
  planSubmissionSheetWrite,
  SUBMISSION_SHEET_HEADERS,
} from "@/lib/googleSheetsPayload";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const SYNC_TIMEOUT_MS = 5_000;
const MAX_ERROR_LENGTH = 500;

export type SheetSyncStatus = "disabled" | "pending" | "synced" | "failed";

export interface SheetSyncResult {
  status: SheetSyncStatus;
  syncedAt: string | null;
  remoteRange: string | null;
  error: string | null;
}

export interface SheetSetupResult {
  ok: boolean;
  outcome: "initialized" | "validated" | "disabled" | "failed";
  tab: string | null;
  columnCount: number;
  error: string | null;
}

interface SheetConfig {
  spreadsheetId: string;
  tab: string;
  clientEmail: string;
  privateKey: string;
}

class SheetSyncFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SheetSyncFailure";
  }
}

const inFlight = new Map<string, Promise<SheetSyncResult>>();

export function isGoogleSheetsSyncEnabled(): boolean {
  return process.env.GOOGLE_SHEETS_SYNC_ENABLED?.toLowerCase() === "true";
}

function getConfig(): SheetConfig | null {
  if (!isGoogleSheetsSyncEnabled()) return null;

  const values = {
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim(),
    tab: process.env.GOOGLE_SHEETS_TAB?.trim(),
    clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
    privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n").trim(),
  };
  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new SheetSyncFailure("configuration_error", `Missing Google Sheets configuration: ${missing.join(", ")}`);
  }
  return values as SheetConfig;
}

function columnLabel(columnCount: number): string {
  let value = columnCount;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function quotedTab(tab: string): string {
  return `'${tab.replaceAll("'", "''")}'`;
}

function cleanError(error: unknown): string {
  const code = error instanceof SheetSyncFailure ? error.code : "request_error";
  let raw = error instanceof Error ? error.message : "Google Sheets request failed";
  const configuredKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  for (const secret of [configuredKey, configuredKey?.replace(/\\n/g, "\n")]) {
    if (secret && secret.length >= 20) raw = raw.split(secret).join("[redacted]");
  }
  const oneLine = raw.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  return `${code}: ${oneLine || "Google Sheets request failed"}`.slice(0, MAX_ERROR_LENGTH);
}

async function requestJson<T>(
  url: string,
  accessToken: string,
  signal: AbortSignal,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as { error?: { message?: unknown; status?: unknown } };
      const apiMessage = typeof body.error?.message === "string" ? body.error.message : null;
      const apiStatus = typeof body.error?.status === "string" ? body.error.status : null;
      message = [String(response.status), apiStatus, apiMessage].filter(Boolean).join(" ");
    } catch {
      // Keep the bounded status-only fallback; never persist arbitrary HTML.
    }
    throw new SheetSyncFailure(`google_${response.status}`, message);
  }
  return (await response.json()) as T;
}

export async function runWithGoogleSheetsTimeout<T>(
  work: (signal: AbortSignal) => Promise<T>,
  timeoutMs = SYNC_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new SheetSyncFailure("timeout", "Google Sheets did not respond within 5 seconds"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([work(controller.signal), expired]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function accessToken(config: SheetConfig): Promise<string> {
  const auth = new GoogleAuth({
    credentials: { client_email: config.clientEmail, private_key: config.privateKey },
    scopes: [SHEETS_SCOPE],
  });
  const token = await auth.getAccessToken();
  if (!token) throw new SheetSyncFailure("authentication_error", "Could not obtain a Google access token");
  return token;
}

interface SheetState {
  initialized: boolean;
  rows: unknown[][];
  tab: string;
  lastColumn: string;
  valuesUrl: string;
}

async function ensureSheetHeader(
  config: SheetConfig,
  token: string,
  signal: AbortSignal,
): Promise<SheetState> {
  const tab = quotedTab(config.tab);
  const lastColumn = columnLabel(SUBMISSION_SHEET_HEADERS.length);
  const tableRange = `${tab}!A1:${lastColumn}`;
  const valuesUrl = `${SHEETS_API}/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(tableRange)}`;
  const current = await requestJson<{ values?: unknown[][] }>(
    `${valuesUrl}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`,
    token,
    signal,
  );
  const rows = Array.isArray(current.values) ? current.values : [];
  const headerState = classifySubmissionSheetHeader(Array.isArray(rows[0]) ? rows[0] : []);

  if (headerState === "empty") {
    const headerRange = `${tab}!A1:${lastColumn}1`;
    await requestJson(
      `${SHEETS_API}/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(headerRange)}?valueInputOption=RAW`,
      token,
      signal,
      { method: "PUT", body: JSON.stringify({ majorDimension: "ROWS", values: [SUBMISSION_SHEET_HEADERS] }) },
    );
    return { initialized: true, rows, tab, lastColumn, valuesUrl };
  }

  if (headerState === "mismatch") {
    throw new SheetSyncFailure("schema_mismatch", "The configured worksheet header does not match schema version 1");
  }
  return { initialized: false, rows, tab, lastColumn, valuesUrl };
}

/** Validate the configured worksheet and initialize only its empty header row. */
export async function initializeGoogleSheet(): Promise<SheetSetupResult> {
  if (!isGoogleSheetsSyncEnabled()) {
    return {
      ok: false,
      outcome: "disabled",
      tab: null,
      columnCount: SUBMISSION_SHEET_HEADERS.length,
      error: "configuration_error: Google Sheets sync is disabled",
    };
  }
  try {
    const config = getConfig();
    if (!config) throw new SheetSyncFailure("configuration_error", "Google Sheets sync is disabled");
    const state = await runWithGoogleSheetsTimeout(async (signal) => {
      const token = await accessToken(config);
      return ensureSheetHeader(config, token, signal);
    });
    return {
      ok: true,
      outcome: state.initialized ? "initialized" : "validated",
      tab: config.tab,
      columnCount: SUBMISSION_SHEET_HEADERS.length,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      outcome: "failed",
      tab: null,
      columnCount: SUBMISSION_SHEET_HEADERS.length,
      error: cleanError(error),
    };
  }
}

async function upsertRow(config: SheetConfig, submissionId: string, row: (string | number)[]): Promise<string> {
  return runWithGoogleSheetsTimeout(async (signal) => {
    const token = await accessToken(config);
    const { rows, tab, lastColumn, valuesUrl } = await ensureSheetHeader(config, token, signal);

    const writePlan = planSubmissionSheetWrite(rows, submissionId);
    if (writePlan.kind === "update") {
      const { rowNumber } = writePlan;
      const remoteRange = `${tab}!A${rowNumber}:${lastColumn}${rowNumber}`;
      await requestJson(
        `${SHEETS_API}/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(remoteRange)}?valueInputOption=RAW`,
        token,
        signal,
        { method: "PUT", body: JSON.stringify({ majorDimension: "ROWS", values: [row] }) },
      );
      return remoteRange;
    }

    const append = await requestJson<{ updates?: { updatedRange?: string } }>(
      `${valuesUrl}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      token,
      signal,
      { method: "POST", body: JSON.stringify({ majorDimension: "ROWS", values: [row] }) },
    );
    if (!append.updates?.updatedRange) {
      throw new SheetSyncFailure("invalid_response", "Google Sheets did not return the appended row range");
    }
    return append.updates.updatedRange;
  });
}

async function performSync(submissionId: string): Promise<SheetSyncResult> {
  const [{ db }, { submissions }] = await Promise.all([import("@/db/client"), import("@/db/schema")]);
  const submission = db.select().from(submissions).where(eq(submissions.id, submissionId)).get();
  if (!submission) {
    return { status: "failed", syncedAt: null, remoteRange: null, error: "not_found: Submission not found" };
  }

  if (submission.source !== "web_form" || !isGoogleSheetsSyncEnabled()) {
    db.update(submissions)
      .set({ sheetSyncStatus: "disabled", sheetSyncError: null })
      .where(eq(submissions.id, submissionId))
      .run();
    return {
      status: "disabled",
      syncedAt: submission.sheetSyncedAt,
      remoteRange: submission.sheetRemoteRange,
      error: null,
    };
  }

  db.update(submissions)
    .set({ sheetSyncStatus: "pending", sheetSyncError: null })
    .where(eq(submissions.id, submissionId))
    .run();

  try {
    const config = getConfig();
    if (!config) throw new SheetSyncFailure("configuration_error", "Google Sheets sync is disabled");
    const remoteRange = await upsertRow(config, submissionId, buildSubmissionSheetRow(submission));
    const syncedAt = new Date().toISOString();
    db.update(submissions)
      .set({ sheetSyncStatus: "synced", sheetSyncedAt: syncedAt, sheetSyncError: null, sheetRemoteRange: remoteRange })
      .where(eq(submissions.id, submissionId))
      .run();
    return { status: "synced", syncedAt, remoteRange, error: null };
  } catch (error) {
    const message = cleanError(error);
    db.update(submissions)
      .set({ sheetSyncStatus: "failed", sheetSyncError: message })
      .where(eq(submissions.id, submissionId))
      .run();
    return {
      status: "failed",
      syncedAt: submission.sheetSyncedAt,
      remoteRange: submission.sheetRemoteRange,
      error: message,
    };
  }
}

/** Serialize same-submission writes in one process; the remote ID upsert handles crash recovery. */
export function syncSubmissionToGoogleSheet(submissionId: string): Promise<SheetSyncResult> {
  const previous = inFlight.get(submissionId);
  const sync = (async () => {
    if (previous) {
      try {
        await previous;
      } catch {
        // A later request still gets its own attempt with the latest local row.
      }
    }
    return performSync(submissionId);
  })();
  inFlight.set(submissionId, sync);
  const cleanUp = () => {
    if (inFlight.get(submissionId) === sync) inFlight.delete(submissionId);
  };
  void sync.then(cleanUp, cleanUp);
  return sync;
}
