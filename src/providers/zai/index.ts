import { WebSearch } from "@opencode/plugin";

import { normalizeResults } from "../shared/search.js";
import { SearchConfig } from "../../types.js";
import { throwResponseError } from "../shared/errors.js";

// ── Types ──────────────────────────────────────────────────────────────

interface ZaiSearchResult {
  content?: unknown;
  link?: unknown;
  publish_date?: unknown;
  title?: unknown;
}

interface ZaiSearchResponse {
  search_result?: ZaiSearchResult[];
}

// ── Constants ──────────────────────────────────────────────────────────

const RESULT_COUNT = 10;
const SEARCH_ENGINE = "search-prime";
const ZAI_DEFAULT_ORIGIN = "https://api.z.ai";
const ZAI_SEARCH_PATH = "/api/paas/v4/web_search";

// ── Helpers ────────────────────────────────────────────────────────────

/** The general and Coding Plan APIs share a host; the search API lives on the general path. */
const searchURL = (baseURL: string | undefined): string =>
  `${baseURL ? new URL(baseURL).origin : ZAI_DEFAULT_ORIGIN}${ZAI_SEARCH_PATH}`;

const toResultShape = (result: ZaiSearchResult): Record<string, unknown> => ({
  content: result.content,
  time: { published: result.publish_date },
  title: result.title,
  url: result.link,
});

// ── Execution ──────────────────────────────────────────────────────────

/** Search with Z.ai's Web Search API. */
const executeSearch = async (
  config: SearchConfig,
  query: string,
  signal: AbortSignal,
): Promise<readonly WebSearch.Result[]> => {
  const response = await fetch(searchURL(config.baseURL), {
    body: JSON.stringify({
      count: RESULT_COUNT,
      search_engine: SEARCH_ENGINE,
      search_query: query,
    }),
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    method: "POST",
    signal,
  });
  if (!response.ok) {
    return throwResponseError(response);
  }

  const body = (await response.json()) as ZaiSearchResponse;
  return normalizeResults((body.search_result ?? []).map(toResultShape));
};

export { executeSearch };
