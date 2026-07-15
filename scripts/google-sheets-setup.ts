import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());
  const { initializeGoogleSheet } = await import("../src/lib/googleSheets");
  const result = await initializeGoogleSheet();

  if (!result.ok) {
    console.error(`Google Sheets setup failed: ${result.error ?? "unknown error"}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Google Sheets header ${result.outcome}: ${result.columnCount} columns on tab ${JSON.stringify(result.tab)}.`,
  );
}

void main().catch(() => {
  // Avoid dumping environment-bearing objects or authentication internals.
  console.error("Google Sheets setup failed unexpectedly.");
  process.exitCode = 1;
});

