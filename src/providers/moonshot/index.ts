import { WebSearch } from "@opencode/plugin";

import { normalizeResults } from "../shared/search.js";
import { SearchConfig } from "../../types.js";
import { throwResponseError } from "../shared/errors.js";

// ── Types ──────────────────────────────────────────────────────────────

interface MoonshotSearchResult {
  chunks?: { text?: unknown }[];
  date?: unknown;
  snippet?: unknown;
  title?: unknown;
  url?: unknown;
}

interface MoonshotSearchResponse {
  search_results?: MoonshotSearchResult[];
}

// ── Constants ──────────────────────────────────────────────────────────

const MOONSHOT_DEFAULT_BASE_URL = "https://api.moonshot.ai/v1";
const NO_PASSAGES = 0;
const RESULT_LIMIT = 10;
const TIMEOUT_SECONDS = 45;

// ── Helpers ────────────────────────────────────────────────────────────

/** Prefer the ranked relevant passages; fall back to the page snippet. */
const resultContent = (result: MoonshotSearchResult): unknown => {
  const passages = (result.chunks ?? [])
    .map((chunk) => chunk.text)
    .filter((text): text is string => typeof text === "string" && text.trim() !== "");
  return passages.length > NO_PASSAGES ? passages.join("\n\n") : result.snippet;
};

const toResultShape = (result: MoonshotSearchResult): Record<string, unknown> => ({
  content: resultContent(result),
  time: { published: result.date },
  title: result.title,
  url: result.url,
});

// ── Execution ──────────────────────────────────────────────────────────

/** Search with Moonshot's Web Search Pro API, which replaced the retired `$web_search` tool. */
const executeSearch = async (
  config: SearchConfig,
  query: string,
  signal: AbortSignal,
): Promise<readonly WebSearch.Result[]> => {
  const baseURL = (config.baseURL ?? MOONSHOT_DEFAULT_BASE_URL).replace(/\/+$/, "");
  const response = await fetch(`${baseURL}/tools/search_pro`, {
    body: JSON.stringify({
      limit: RESULT_LIMIT,
      text_query: query,
      timeout_seconds: TIMEOUT_SECONDS,
    }),
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    method: "POST",
    signal,
  });
  if (!response.ok) {
    return throwResponseError(response);
  }

  const body = (await response.json()) as MoonshotSearchResponse;
  return normalizeResults((body.search_results ?? []).map(toResultShape));
};

export { executeSearch };
