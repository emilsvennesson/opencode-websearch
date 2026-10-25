import { WebSearch } from "@opencode/plugin";

import { normalizeResults } from "../shared/search.js";
import { SearchConfig } from "../../types.js";
import { throwResponseError } from "../shared/errors.js";

// ── Types ──────────────────────────────────────────────────────────────

interface DeepSeekSearchResult {
  date?: unknown;
  snippet?: unknown;
  summary?: unknown;
  title?: unknown;
  url?: unknown;
}

interface DeepSeekSearchResponse {
  results?: DeepSeekSearchResult[];
}

// ── Constants ──────────────────────────────────────────────────────────

const DEEPSEEK_DEFAULT_BASE_URL = "https://api.deepseek.com";
const MAX_QUERY_LENGTH = 128;
const QUERY_START = 0;
const RESULT_COUNT = 10;

// ── Helpers ────────────────────────────────────────────────────────────

/** The API rejects queries longer than 128 Unicode characters. */
const truncateQuery = (query: string): string =>
  [...query.trim()].slice(QUERY_START, MAX_QUERY_LENGTH).join("");

const searchURL = (baseURL: string | undefined): string =>
  `${(baseURL ?? DEEPSEEK_DEFAULT_BASE_URL).replace(/\/+$/, "").replace(/\/v1$/, "")}/v1/tools/search`;

/** Prefer the model-oriented long summary; fall back to the short snippet. */
const toResultShape = (result: DeepSeekSearchResult): Record<string, unknown> => ({
  content: typeof result.summary === "string" && result.summary ? result.summary : result.snippet,
  time: { published: result.date },
  title: result.title,
  url: result.url,
});

// ── Execution ──────────────────────────────────────────────────────────

/** Search with DeepSeek's Search API. */
const executeSearch = async (
  config: SearchConfig,
  query: string,
  signal: AbortSignal,
): Promise<readonly WebSearch.Result[]> => {
  const response = await fetch(searchURL(config.baseURL), {
    body: JSON.stringify({ count: RESULT_COUNT, query: truncateQuery(query) }),
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    method: "POST",
    signal,
  });
  if (!response.ok) {
    return throwResponseError(response);
  }

  const body = (await response.json()) as DeepSeekSearchResponse;
  return normalizeResults((body.results ?? []).map(toResultShape));
};

export { executeSearch };
