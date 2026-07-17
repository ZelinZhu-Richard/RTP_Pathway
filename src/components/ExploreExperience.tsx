"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import type { OpportunityCard } from "@/db/queries";
import {
  DEFAULT_PAGE_SIZE,
  filtersToSearchParams,
  hasActiveFilters,
  parseFilters,
  parsePagination,
  type Filters,
} from "@/lib/search";
import {
  categoryLabel,
  compensationLabel,
  costLabel,
  formatLabel,
  interestLabel,
  scheduleLabel,
  taxonomy,
} from "@/lib/taxonomy";
import {
  costCompText,
  deadlineText,
  eligibilityText,
  fmtDate,
} from "@/lib/display";
import { SaveButton, useSavedIds } from "@/components/SaveCompare";
import styles from "./ExploreExperience.module.css";

interface SearchResponse {
  results: OpportunityCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  appliedFilters: Filters;
}

interface NLSearchResponse {
  results: OpportunityCard[];
  total: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  filters: Filters;
  explanation: {
    summary: string;
    perResult: { id: string; reason: string }[];
  };
  usedClaude: boolean;
  notice?: string;
}

interface PublicOpportunityDetail extends OpportunityCard {
  description: string;
  eligibility: string;
  whatYoullDo?: string | null;
}

interface CategoryCount {
  category: string;
  n: number;
}

interface Props {
  initialResults: OpportunityCard[];
  initialTotal: number;
  initialFilters?: Filters;
  initialPage?: number;
  initialPageSize?: number;
  totalAvailable: number;
  categoryCounts: CategoryCount[];
}

interface RunOptions {
  updateUrl?: boolean;
  recordDemand?: boolean;
  syncDraft?: boolean;
  focusResults?: boolean;
}

interface Interpretation {
  summary: string;
  usedClaude: boolean;
  notice?: string;
}

interface ActiveChip {
  id: string;
  label: string;
  remove: (filters: Filters) => Filters;
}

type ViewMode = "grid" | "list";

const EXAMPLES = [
  "Free summer coding programs for a 15-year-old in Durham",
  "Weekend volunteer opportunities related to animals or nature",
  "Paid internships I can apply to this month",
];

const QUICK_PRESETS: { label: string; description: string; filters: Filters }[] = [
  {
    label: "Closing soon",
    description: "Deadlines in 30 days",
    filters: { deadlineWithinDays: 30, sort: "deadline" },
  },
  { label: "Newest", description: "Fresh additions", filters: { sort: "newest" } },
  { label: "Free", description: "No participation fee", filters: { cost: "free" } },
  {
    label: "Paid / stipend",
    description: "Earn while you learn",
    filters: { compensation: "any_pay" },
  },
  { label: "Weekend", description: "Fits around school", filters: { schedule: "weekend" } },
  { label: "Online", description: "Join from anywhere", filters: { format: "online" } },
];

const RELAX_ORDER: (keyof Filters)[] = [
  "city",
  "deadlineWithinDays",
  "schedule",
  "category",
  "format",
  "cost",
  "compensation",
  "grade",
  "keywords",
  "q",
];

const VIEW_STORAGE_KEY = "rtp:explore-view";

function Icon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function SearchIcon() {
  return (
    <Icon size={21}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </Icon>
  );
}

function SlidersIcon() {
  return (
    <Icon>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </Icon>
  );
}

function GridIcon() {
  return (
    <Icon size={17}>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </Icon>
  );
}

function ListIcon() {
  return (
    <Icon size={17}>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </Icon>
  );
}

function ShareIcon() {
  return (
    <Icon size={17}>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" />
    </Icon>
  );
}

function ArrowIcon() {
  return (
    <Icon size={16}>
      <path d="M5 12h14M14 7l5 5-5 5" />
    </Icon>
  );
}

function filterValueLabel(key: keyof Filters, value: string | number): string {
  switch (key) {
    case "category":
      return categoryLabel(String(value));
    case "format":
      return formatLabel(String(value));
    case "cost":
      return costLabel(String(value));
    case "compensation":
      return value === "any_pay" ? "Paid or stipend" : compensationLabel(String(value));
    case "schedule":
      return scheduleLabel(String(value));
    case "grade":
      return `Grade ${value}`;
    case "deadlineWithinDays":
      return `Due within ${value} days`;
    case "city":
      return String(value);
    case "sort":
      return value === "newest" ? "Newest first" : "Deadline first";
    default:
      return String(value);
  }
}

function activeFilterChips(filters: Filters): ActiveChip[] {
  const chips: ActiveChip[] = [];
  if (filters.q) {
    chips.push({
      id: "q",
      label: `“${filters.q}”`,
      remove: (current) => ({ ...current, q: undefined }),
    });
  }
  filters.keywords?.slice(0, 3).forEach((keyword, index) => {
    chips.push({
      id: `keyword-${index}-${keyword}`,
      label: keyword,
      remove: (current) => ({
        ...current,
        keywords: current.keywords?.filter((_, keywordIndex) => keywordIndex !== index),
      }),
    });
  });
  (
    [
      "category",
      "city",
      "grade",
      "schedule",
      "format",
      "cost",
      "compensation",
      "deadlineWithinDays",
    ] as (keyof Filters)[]
  ).forEach((key) => {
    const value = filters[key];
    if (value !== undefined) {
      chips.push({
        id: key,
        label: filterValueLabel(key, value as string | number),
        remove: (current) => ({ ...current, [key]: undefined }),
      });
    }
  });
  if (filters.sort === "newest") {
    chips.push({
      id: "sort",
      label: "Newest first",
      remove: (current) => ({ ...current, sort: undefined }),
    });
  }
  return chips;
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <span className={styles.selectWrap}>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Any</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span aria-hidden="true">⌄</span>
      </span>
    </label>
  );
}

function FilterControls({ filters, onChange }: { filters: Filters; onChange: (next: Filters) => void }) {
  const set = (key: keyof Filters) => (value: string) => {
    onChange({
      ...filters,
      [key]:
        value === ""
          ? undefined
          : key === "grade" || key === "deadlineWithinDays"
            ? Number(value)
            : value,
    });
  };

  return (
    <>
      <label className={styles.field}>
        <span>Keyword</span>
        <input
          type="search"
          value={filters.q ?? ""}
          onChange={(event) => onChange({ ...filters, q: event.target.value || undefined })}
          placeholder="Coding, health, theater…"
        />
      </label>

      <div className={styles.filterSection}>
        <p className={styles.filterSectionLabel}>Essentials</p>
        <SelectField
          label="Category"
          value={filters.category ?? ""}
          onChange={set("category")}
          options={taxonomy.categories.map((item) => ({
            value: item.id,
            label: item.label ?? item.id,
          }))}
        />
        <SelectField
          label="City"
          value={filters.city ?? ""}
          onChange={set("city")}
          options={taxonomy.cities.map((item) => ({ value: item.id, label: item.label ?? item.id }))}
        />
        <SelectField
          label="Grade"
          value={filters.grade?.toString() ?? ""}
          onChange={set("grade")}
          options={[6, 7, 8, 9, 10, 11, 12].map((grade) => ({
            value: String(grade),
            label: `Grade ${grade}`,
          }))}
        />
        <SelectField
          label="Schedule"
          value={filters.schedule ?? ""}
          onChange={set("schedule")}
          options={taxonomy.schedules.map((item) => ({
            value: item.id,
            label: item.label ?? item.id,
          }))}
        />
      </div>

      <details className={styles.moreFilters} open={Boolean(filters.format || filters.cost || filters.compensation || filters.deadlineWithinDays)}>
        <summary>
          <span>More filters</span>
          <span aria-hidden="true">+</span>
        </summary>
        <div className={styles.moreFiltersBody}>
          <SelectField
            label="Format"
            value={filters.format ?? ""}
            onChange={set("format")}
            options={taxonomy.formats.map((item) => ({
              value: item.id,
              label: item.label ?? item.id,
            }))}
          />
          <SelectField
            label="Cost"
            value={filters.cost ?? ""}
            onChange={set("cost")}
            options={taxonomy.cost_types.map((item) => ({
              value: item.id,
              label: item.label ?? item.id,
            }))}
          />
          <SelectField
            label="Pay"
            value={filters.compensation ?? ""}
            onChange={set("compensation")}
            options={[
              { value: "any_pay", label: "Paid or stipend" },
              ...taxonomy.compensation_types.map((item) => ({
                value: item.id,
                label: item.label ?? item.id,
              })),
            ]}
          />
          <SelectField
            label="Deadline"
            value={filters.deadlineWithinDays?.toString() ?? ""}
            onChange={set("deadlineWithinDays")}
            options={[
              { value: "7", label: "This week" },
              { value: "30", label: "This month" },
              { value: "90", label: "Next 3 months" },
            ]}
          />
        </div>
      </details>
    </>
  );
}

function OpportunityResultCard({
  card,
  matchReason,
  viewMode,
  onQuickView,
}: {
  card: OpportunityCard;
  matchReason?: string;
  viewMode: ViewMode;
  onQuickView: (card: OpportunityCard, trigger: HTMLButtonElement) => void;
}) {
  return (
    <article
      className={`${styles.resultCard} ${viewMode === "list" ? styles.resultCardList : ""}`}
      data-opportunity-id={card.id}
    >
      <div className={styles.cardSignal} aria-hidden="true" />
      <div className={styles.cardMain}>
        <div className={styles.cardTopline}>
          <span>{categoryLabel(card.category)}</span>
          <SaveButton id={card.id} />
        </div>
        <h3>
          <Link href={`/opportunities/${card.slug}`}>{card.title}</Link>
        </h3>
        <p className={styles.orgName}>{card.orgName}</p>

        {matchReason && (
          <p className={styles.matchReason}>
            <span aria-hidden="true">✦</span>
            <span>
              <strong>Why this fits:</strong> {matchReason}
            </span>
          </p>
        )}

        <div className={styles.cardFacts}>
          <span>{card.city}</span>
          <span>{formatLabel(card.format)}</span>
          <span>{eligibilityText(card)}</span>
          {card.schedule && <span>{scheduleLabel(card.schedule)}</span>}
        </div>

        {card.interestTags.length > 0 && (
          <ul className={styles.interestTags} aria-label="Interest areas">
            {card.interestTags.slice(0, 3).map((interest) => (
              <li key={interest}>{interestLabel(interest)}</li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.cardAside}>
        <div className={styles.deadlineBlock}>
          <span>Application</span>
          <strong>{deadlineText(card.applicationDeadline)}</strong>
        </div>
        <div className={styles.costBlock}>
          <span>Cost &amp; pay</span>
          <strong>{costCompText(card)}</strong>
        </div>
        {card.timeCommitment && <p className={styles.commitment}>{card.timeCommitment}</p>}
        <div className={styles.cardActions}>
          <button
            type="button"
            onClick={(event) => onQuickView(card, event.currentTarget)}
            className={styles.quickViewButton}
          >
            Quick view
          </button>
          <Link href={`/opportunities/${card.slug}`} className={styles.detailLink}>
            View details <ArrowIcon />
          </Link>
        </div>
      </div>
    </article>
  );
}

function LoadingOverlay() {
  return (
    <div className={styles.loadingOverlay} role="status" aria-label="Searching opportunities">
      <div className={styles.loadingPill}>
        <span aria-hidden="true" />
        Mapping the best paths…
      </div>
    </div>
  );
}

export function ExploreExperience({
  initialResults,
  initialTotal,
  initialFilters = {},
  initialPage = 1,
  initialPageSize = DEFAULT_PAGE_SIZE,
  totalAvailable,
  categoryCounts,
}: Props) {
  const [draftFilters, setDraftFilters] = useState<Filters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters);
  const [results, setResults] = useState<OpportunityCard[]>(initialResults);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [interpretation, setInterpretation] = useState<Interpretation | null>(null);
  const [matchReasons, setMatchReasons] = useState<Map<string, string>>(new Map());
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [shareStatus, setShareStatus] = useState("");
  const [quickCard, setQuickCard] = useState<OpportunityCard | null>(null);
  const [quickDetail, setQuickDetail] = useState<PublicOpportunityDetail | null>(null);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  const savedIds = useSavedIds();
  const requestSeq = useRef(0);
  const requestAbort = useRef<AbortController | null>(null);
  const quickAbort = useRef<AbortController | null>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const filtersDialogRef = useRef<HTMLDialogElement>(null);
  const quickDialogRef = useRef<HTMLDialogElement>(null);
  const quickTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "grid" || stored === "list") setViewMode(stored);
    return () => {
      requestAbort.current?.abort();
      quickAbort.current?.abort();
    };
  }, []);

  const saveViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    window.localStorage.setItem(VIEW_STORAGE_KEY, mode);
  };

  const focusResults = useCallback(() => {
    window.requestAnimationFrame(() => {
      resultsHeadingRef.current?.focus({ preventScroll: true });
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      resultsHeadingRef.current?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  }, []);

  const runSearch = useCallback(
    async (
      nextFilters: Filters,
      nextPage: number,
      nextPageSize: number,
      options: RunOptions = {},
    ) => {
      requestAbort.current?.abort();
      const controller = new AbortController();
      requestAbort.current = controller;
      const seq = ++requestSeq.current;
      const params = filtersToSearchParams(nextFilters, {
        page: nextPage,
        pageSize: nextPageSize,
      });
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/opportunities?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Search failed (${response.status})`);
        const data = (await response.json()) as SearchResponse;
        if (seq !== requestSeq.current) return;

        setResults(data.results);
        setTotal(data.total);
        setPage(data.page);
        setPageSize(data.pageSize);
        setAppliedFilters(data.appliedFilters);
        setMatchReasons(new Map());
        setInterpretation(null);
        if (options.syncDraft) setDraftFilters(data.appliedFilters);

        if (options.updateUrl) {
          const query = filtersToSearchParams(data.appliedFilters, {
            page: data.page,
            pageSize: data.pageSize,
          }).toString();
          window.history.pushState(
            null,
            "",
            `${window.location.pathname}${query ? `?${query}` : ""}`,
          );
        }

        // Only the explicit Apply action records community demand. Presets,
        // sorting, pagination, chip removal and URL restoration remain silent.
        if (options.recordDemand) {
          void fetch("/api/search-events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filters: data.appliedFilters }),
          }).catch(() => undefined);
        }

        if (options.focusResults) focusResults();
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (seq === requestSeq.current) {
          setError(caught instanceof Error ? caught.message : "Search failed");
        }
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [focusResults],
  );

  const runNaturalLanguageSearch = useCallback(
    async (rawQuestion: string) => {
      const trimmed = rawQuestion.trim();
      if (!trimmed) return;
      requestAbort.current?.abort();
      const controller = new AbortController();
      requestAbort.current = controller;
      const seq = ++requestSeq.current;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/nl-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed, pageSize }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Search failed (${response.status})`);
        const data = (await response.json()) as NLSearchResponse;
        if (seq !== requestSeq.current) return;

        const responsePage = data.page ?? 1;
        const responsePageSize = data.pageSize ?? pageSize;
        setResults(data.results);
        setTotal(data.total);
        setPage(responsePage);
        setPageSize(responsePageSize);
        setAppliedFilters(data.filters);
        setDraftFilters(data.filters);
        setMatchReasons(
          new Map(data.explanation.perResult.map((reason) => [reason.id, reason.reason])),
        );
        setInterpretation({
          summary: data.explanation.summary,
          usedClaude: data.usedClaude,
          notice: data.notice,
        });

        const query = filtersToSearchParams(data.filters, {
          page: responsePage,
          pageSize: responsePageSize,
        }).toString();
        window.history.pushState(
          null,
          "",
          `${window.location.pathname}${query ? `?${query}` : ""}`,
        );
        focusResults();
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (seq === requestSeq.current) {
          setError(caught instanceof Error ? caught.message : "Search failed");
        }
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [focusResults, pageSize],
  );

  useEffect(() => {
    const restoreFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const restoredFilters = parseFilters(params);
      const restoredPagination = parsePagination(params);
      setDraftFilters(restoredFilters);
      void runSearch(restoredFilters, restoredPagination.page, restoredPagination.pageSize, {
        syncDraft: true,
      });
    };
    window.addEventListener("popstate", restoreFromUrl);
    return () => window.removeEventListener("popstate", restoreFromUrl);
  }, [runSearch]);

  const applyDraft = (event?: FormEvent) => {
    event?.preventDefault();
    filtersDialogRef.current?.close();
    void runSearch(draftFilters, 1, pageSize, {
      updateUrl: true,
      recordDemand: true,
      syncDraft: true,
      focusResults: true,
    });
  };

  const applyWithoutDemand = (nextFilters: Filters) => {
    setDraftFilters(nextFilters);
    void runSearch(nextFilters, 1, pageSize, {
      updateUrl: true,
      syncDraft: true,
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstResult = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastResult = total === 0 ? 0 : Math.min(page * pageSize, total);
  const chips = useMemo(() => activeFilterChips(appliedFilters), [appliedFilters]);
  const countMap = useMemo(
    () => new Map(categoryCounts.map((item) => [item.category, item.n])),
    [categoryCounts],
  );
  const canClear =
    hasActiveFilters(draftFilters) ||
    hasActiveFilters(appliedFilters) ||
    draftFilters.sort === "newest" ||
    appliedFilters.sort === "newest";

  const relaxedFilters = useMemo(() => {
    const key = RELAX_ORDER.find((candidate) => appliedFilters[candidate] !== undefined);
    if (!key) return null;
    return { key, filters: { ...appliedFilters, [key]: undefined } as Filters };
  }, [appliedFilters]);

  const shareSearch = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "RTP Pathway opportunity search",
          text: `Explore ${total} source-linked opportunities in the Triangle.`,
          url,
        });
        setShareStatus("Search shared");
      } else {
        await navigator.clipboard.writeText(url);
        setShareStatus("Link copied");
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setShareStatus("Couldn’t share — copy the URL from your browser");
    }
    window.setTimeout(() => setShareStatus(""), 2500);
  };

  const openQuickView = async (card: OpportunityCard, trigger: HTMLButtonElement) => {
    quickTriggerRef.current = trigger;
    setQuickCard(card);
    setQuickDetail(null);
    setQuickError(null);
    setQuickLoading(true);
    if (!quickDialogRef.current?.open) quickDialogRef.current?.showModal();
    quickAbort.current?.abort();
    const controller = new AbortController();
    quickAbort.current = controller;
    try {
      const response = await fetch(`/api/opportunities/${encodeURIComponent(card.id)}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(response.status === 404 ? "This listing is no longer public." : "Could not load details.");
      const body = (await response.json()) as
        | PublicOpportunityDetail
        | { opportunity?: PublicOpportunityDetail; result?: PublicOpportunityDetail };
      const detail =
        "opportunity" in body && body.opportunity
          ? body.opportunity
          : "result" in body && body.result
            ? body.result
            : (body as PublicOpportunityDetail);
      setQuickDetail(detail);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setQuickError(caught instanceof Error ? caught.message : "Could not load details.");
    } finally {
      if (!controller.signal.aborted) setQuickLoading(false);
    }
  };

  const closeQuickView = () => {
    quickAbort.current?.abort();
    quickDialogRef.current?.close();
  };

  const displayQuickCard = quickDetail ?? quickCard;

  return (
    <div className={styles.page}>
      <section
        className={styles.hero}
        aria-labelledby="explore-title"
        data-ambient-render-sentinel
      >
        <div className={styles.heroOrbit} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className={styles.heroInner}>
          <div className={styles.eyebrow}>
            <span>Community-powered discovery</span>
            <span aria-hidden="true" />
            <span>Preview directory</span>
          </div>
          <h1 id="explore-title">
            Find the path that
            <br />
            <em>feels like yours.</em>
          </h1>
          <p className={styles.heroCopy}>
            Describe what you care about, how you want to spend your time, or where you want to
            grow. We&apos;ll connect your words to real opportunities around the Triangle.
          </p>

          <form
            className={styles.naturalSearch}
            onSubmit={(event) => {
              event.preventDefault();
              void runNaturalLanguageSearch(question);
            }}
          >
            <span className={styles.searchIcon}>
              <SearchIcon />
            </span>
            <label>
              <span className={styles.srOnly}>Describe the opportunity you are looking for</span>
              <input
                type="text"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                maxLength={500}
                placeholder="Try “free weekend health programs for a 10th grader”"
              />
            </label>
            <button type="submit" disabled={loading || !question.trim()}>
              <span>Find my path</span>
              <ArrowIcon />
            </button>
          </form>

          <div className={styles.examples}>
            <span>Try an idea</span>
            <div>
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => {
                    setQuestion(example);
                    void runNaturalLanguageSearch(example);
                  }}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.heroStats} aria-label="Directory overview">
            <div>
              <strong>{totalAvailable}</strong>
              <span>source-linked {totalAvailable === 1 ? "listing" : "listings"}</span>
            </div>
            <div>
              <strong>{categoryCounts.filter((item) => item.n > 0).length}</strong>
              <span>ways to get started</span>
            </div>
            <div>
              <strong>1</strong>
              <span>connected Triangle</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.resultsSurface} id="opportunity-directory" aria-labelledby="results-heading">
        <div className={styles.surfaceVeil} aria-hidden="true" />
        <div className={styles.resultsInner}>
          <div className={styles.categoryHeader}>
            <div>
              <p className={styles.kicker}>Choose a pathway</p>
              <h2>Start with what pulls you in</h2>
            </div>
            <p>
              Every listing comes from an original source. Save what interests you and compare
              your next moves side by side.
            </p>
          </div>

          <div className={styles.categoryRail} aria-label="Opportunity pathways">
            <button
              type="button"
              className={!appliedFilters.category ? styles.categoryActive : undefined}
              onClick={() => applyWithoutDemand({ ...appliedFilters, category: undefined })}
              aria-pressed={!appliedFilters.category}
            >
              <span aria-hidden="true">✦</span>
              <strong>All paths</strong>
              <small>{totalAvailable} openings</small>
            </button>
            {taxonomy.categories.map((category, index) => {
              const count = countMap.get(category.id) ?? 0;
              return (
                <button
                  type="button"
                  key={category.id}
                  className={appliedFilters.category === category.id ? styles.categoryActive : undefined}
                  onClick={() => applyWithoutDemand({ ...appliedFilters, category: category.id })}
                  aria-pressed={appliedFilters.category === category.id}
                  style={{ "--category-index": index } as CSSProperties}
                >
                  <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <strong>{category.label ?? category.id}</strong>
                  <small>{count} {count === 1 ? "opening" : "openings"}</small>
                </button>
              );
            })}
          </div>

          <div className={styles.presetBar} aria-label="Quick search presets">
            <span>Quick paths</span>
            <div>
              {QUICK_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  title={preset.description}
                  onClick={() => applyWithoutDemand(preset.filters)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {interpretation && (
            <div className={styles.interpretation} aria-live="polite">
              <span aria-hidden="true">✦</span>
              <div>
                <strong>Your words became a search</strong>
                <p>{interpretation.summary}</p>
                {interpretation.notice && <small>{interpretation.notice}</small>}
              </div>
              <button type="button" onClick={() => setInterpretation(null)} aria-label="Dismiss search explanation">
                ×
              </button>
            </div>
          )}

          <div className={styles.mobileControls}>
            <button type="button" onClick={() => filtersDialogRef.current?.showModal()}>
              <SlidersIcon />
              Filters
              {chips.length > 0 && <span>{chips.length}</span>}
            </button>
            <label>
              <span className={styles.srOnly}>Sort results</span>
              <select
                value={appliedFilters.sort ?? "deadline"}
                onChange={(event) => {
                  const next = {
                    ...appliedFilters,
                    sort: event.target.value as Filters["sort"],
                  };
                  applyWithoutDemand(next);
                }}
              >
                <option value="deadline">Deadline first</option>
                <option value="newest">Newest first</option>
              </select>
            </label>
          </div>

          <div className={styles.directoryLayout}>
            <aside className={styles.desktopRail} aria-label="Search filters">
              <form onSubmit={applyDraft}>
                <div className={styles.railHeading}>
                  <div>
                    <span>Refine</span>
                    <strong>Your search</strong>
                  </div>
                  {canClear && (
                    <button type="button" onClick={() => applyWithoutDemand({})}>
                      Clear
                    </button>
                  )}
                </div>
                <FilterControls filters={draftFilters} onChange={setDraftFilters} />
                <button type="submit" className={styles.applyButton} disabled={loading}>
                  {loading ? "Searching…" : "Apply filters"}
                  <ArrowIcon />
                </button>
                <p className={styles.demandNote}>
                  Applied searches anonymously help local organizations see what students need.
                </p>
              </form>
            </aside>

            <div className={styles.resultsColumn}>
              <div className={styles.resultsToolbar}>
                <div>
                  <p className={styles.kicker}>Your directory</p>
                  <h2 id="results-heading" ref={resultsHeadingRef} tabIndex={-1}>
                    {loading
                      ? "Searching pathways…"
                      : total === 0
                        ? "No exact matches yet"
                        : `${total} ${total === 1 ? "opportunity" : "opportunities"}`}
                  </h2>
                  <p className={styles.resultRange} aria-live="polite">
                    {total > 0 ? `Showing ${firstResult}–${lastResult}` : "Try a broader path below"}
                  </p>
                </div>
                <div className={styles.toolbarActions}>
                  <label className={styles.desktopSort}>
                    <span>Sort</span>
                    <select
                      value={appliedFilters.sort ?? "deadline"}
                      onChange={(event) => {
                        const next = {
                          ...appliedFilters,
                          sort: event.target.value as Filters["sort"],
                        };
                        applyWithoutDemand(next);
                      }}
                    >
                      <option value="deadline">Deadline first</option>
                      <option value="newest">Newest first</option>
                    </select>
                  </label>
                  <div className={styles.viewToggle} aria-label="Result view" role="group">
                    <button
                      type="button"
                      aria-pressed={viewMode === "grid"}
                      aria-label="Grid view"
                      onClick={() => saveViewMode("grid")}
                      title="Grid view"
                    >
                      <GridIcon />
                    </button>
                    <button
                      type="button"
                      aria-pressed={viewMode === "list"}
                      aria-label="List view"
                      onClick={() => saveViewMode("list")}
                      title="List view"
                    >
                      <ListIcon />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void shareSearch()}
                    className={styles.shareButton}
                    aria-label="Share this search"
                  >
                    <ShareIcon />
                    <span>Share</span>
                  </button>
                </div>
              </div>

              <p className={styles.shareStatus} role="status">
                {shareStatus}
              </p>

              {chips.length > 0 && (
                <div className={styles.activeFilters} aria-label="Active filters">
                  <ul>
                    {chips.map((chip) => (
                      <li key={chip.id}>
                        <button
                          type="button"
                          onClick={() => applyWithoutDemand(chip.remove(appliedFilters))}
                          aria-label={`Remove ${chip.label} filter`}
                        >
                          {chip.label} <span aria-hidden="true">×</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button type="button" onClick={() => applyWithoutDemand({})}>
                    Clear all
                  </button>
                </div>
              )}

              {error && (
                <div className={styles.error} role="alert">
                  <strong>We couldn&apos;t refresh this search.</strong>
                  <span>{error}. Your previous results are still here.</span>
                  <button
                    type="button"
                    onClick={() => void runSearch(appliedFilters, page, pageSize, { updateUrl: false })}
                  >
                    Try again
                  </button>
                </div>
              )}

              <div className={styles.resultsStage} aria-busy={loading}>
                {results.length === 0 && !loading ? (
                  <div className={styles.emptyState}>
                    <span className={styles.emptyMark} aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                    <p className={styles.kicker}>A useful gap</p>
                    <h3>Nothing matches every detail—yet.</h3>
                    <p>
                      Widen one part of your search, or help the community grow by sharing an
                      opportunity that belongs here.
                    </p>
                    <div>
                      {relaxedFilters && (
                        <button type="button" onClick={() => applyWithoutDemand(relaxedFilters.filters)}>
                          Relax {filterValueLabel(relaxedFilters.key, appliedFilters[relaxedFilters.key] as string | number)}
                        </button>
                      )}
                      <button type="button" onClick={() => applyWithoutDemand({})}>
                        Browse every path
                      </button>
                      <Link href="/submit">Submit an opportunity</Link>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`${styles.resultsGrid} ${viewMode === "list" ? styles.resultsList : ""}`}
                  >
                    {results.map((card) => (
                      <OpportunityResultCard
                        key={card.id}
                        card={card}
                        matchReason={matchReasons.get(card.id)}
                        viewMode={viewMode}
                        onQuickView={(selected, trigger) => void openQuickView(selected, trigger)}
                      />
                    ))}
                  </div>
                )}
                {loading && <LoadingOverlay />}
              </div>

              <div className={styles.paginationBar}>
                <label>
                  <span>Show</span>
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      const nextSize = Number(event.target.value);
                      void runSearch(appliedFilters, 1, nextSize, { updateUrl: true });
                    }}
                  >
                    {[6, 12, 24, 48].map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
                {total > pageSize && (
                  <nav aria-label="Opportunity results pages">
                    <button
                      type="button"
                      aria-label="Previous results page"
                      disabled={loading || page <= 1}
                      onClick={() =>
                        void runSearch(appliedFilters, page - 1, pageSize, {
                          updateUrl: true,
                          focusResults: true,
                        })
                      }
                    >
                      ← <span>Previous</span>
                    </button>
                    <span>
                      <strong>{page}</strong> / {totalPages}
                    </span>
                    <button
                      type="button"
                      aria-label="Next results page"
                      disabled={loading || page >= totalPages}
                      onClick={() =>
                        void runSearch(appliedFilters, page + 1, pageSize, {
                          updateUrl: true,
                          focusResults: true,
                        })
                      }
                    >
                      <span>Next</span> →
                    </button>
                  </nav>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {savedIds.length > 0 && (
        <aside className={styles.savedTray} aria-label="Saved opportunities">
          <span className={styles.savedIcon} aria-hidden="true">⌁</span>
          <div>
            <strong>{savedIds.length} saved</strong>
            <span>Stored on this device</span>
          </div>
          <Link href="/saved">View saved</Link>
          {savedIds.length >= 2 && <Link href="/compare">Compare {Math.min(savedIds.length, 3)}</Link>}
        </aside>
      )}

      <dialog
        ref={filtersDialogRef}
        className={styles.filtersDialog}
        aria-labelledby="mobile-filter-title"
      >
        <form onSubmit={applyDraft}>
          <div className={styles.dialogHeading}>
            <div>
              <span>Refine the directory</span>
              <h2 id="mobile-filter-title">Find your fit</h2>
            </div>
            <button type="button" onClick={() => filtersDialogRef.current?.close()} aria-label="Close filters">
              ×
            </button>
          </div>
          <div className={styles.mobileFilterBody}>
            <FilterControls filters={draftFilters} onChange={setDraftFilters} />
          </div>
          <div className={styles.dialogFooter}>
            <button type="button" onClick={() => setDraftFilters({})} disabled={!canClear}>
              Clear all
            </button>
            <button type="submit" disabled={loading}>
              {loading ? "Searching…" : "Show opportunities"}
            </button>
          </div>
        </form>
      </dialog>

      <dialog
        ref={quickDialogRef}
        className={styles.quickDialog}
        aria-labelledby="quick-view-label"
        onClose={() => {
          setQuickCard(null);
          setQuickDetail(null);
          setQuickError(null);
          quickTriggerRef.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeQuickView();
        }}
      >
        <div className={styles.quickPanel}>
          <div className={styles.quickHeader}>
            <span id="quick-view-label">Opportunity quick view</span>
            <button type="button" onClick={closeQuickView} aria-label="Close quick view">
              ×
            </button>
          </div>
          {quickLoading ? (
            <div className={styles.quickLoading} role="status">
              <span aria-hidden="true" />
              Loading the details…
            </div>
          ) : quickError ? (
            <div className={styles.quickError} role="alert">
              <strong>Details unavailable</strong>
              <p>{quickError}</p>
              <button type="button" onClick={closeQuickView}>Close</button>
            </div>
          ) : displayQuickCard ? (
            <div className={styles.quickContent}>
              <div className={styles.quickTitle}>
                <div>
                  <p>{categoryLabel(displayQuickCard.category)}</p>
                  <h2 id="quick-view-title">{displayQuickCard.title}</h2>
                  <span>{displayQuickCard.orgName}</span>
                </div>
                <SaveButton id={displayQuickCard.id} />
              </div>

              <dl className={styles.quickFacts}>
                <div>
                  <dt>Deadline</dt>
                  <dd>{deadlineText(displayQuickCard.applicationDeadline)}</dd>
                </div>
                <div>
                  <dt>Cost &amp; pay</dt>
                  <dd>{costCompText(displayQuickCard)}</dd>
                </div>
                <div>
                  <dt>Eligibility</dt>
                  <dd>{eligibilityText(displayQuickCard)}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{displayQuickCard.city}</dd>
                </div>
              </dl>

              {quickDetail?.description && (
                <section>
                  <h3>What it is</h3>
                  <p>{quickDetail.description}</p>
                </section>
              )}
              {quickDetail?.eligibility && (
                <section>
                  <h3>Who can apply</h3>
                  <p>{quickDetail.eligibility}</p>
                </section>
              )}
              <section>
                <h3>Commitment</h3>
                <p>
                  {displayQuickCard.timeCommitment ?? "Check with the organization for timing."}
                  {displayQuickCard.schedule ? ` · ${scheduleLabel(displayQuickCard.schedule)}` : ""}
                </p>
              </section>
              {displayQuickCard.sourceUrl && (
                <section>
                  <h3>Original source</h3>
                  <a href={displayQuickCard.sourceUrl} target="_blank" rel="noopener noreferrer">
                    Visit source listing ↗
                  </a>
                </section>
              )}

              <div className={styles.quickActions}>
                <Link href={`/opportunities/${displayQuickCard.slug}`}>
                  View full details <ArrowIcon />
                </Link>
                <button type="button" onClick={closeQuickView}>Keep browsing</button>
              </div>
              {displayQuickCard.lastVerifiedAt && (
                <p className={styles.quickVerified}>
                  Source checked {fmtDate(displayQuickCard.lastVerifiedAt)}. Always confirm details
                  with the organization.
                </p>
              )}
            </div>
          ) : null}
        </div>
      </dialog>
    </div>
  );
}
