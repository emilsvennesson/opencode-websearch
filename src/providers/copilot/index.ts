import { APIError } from "openai";
import { WebSearch } from "@opencode/plugin";

import { createOpenAICompatibleClient, searchWithResponses } from "../shared/openai-compatible.js";
import { parseSearchResults } from "../shared/search.js";
import { SearchConfig } from "../../types.js";
import { executeBingSearch } from "./bing.js";
import {
  COPILOT_DEFAULT_BASE_URL,
  COPILOT_RESPONSES_HEADERS,
  HTTP_STATUS_CODE,
} from "./constants.js";

// ── Types ──────────────────────────────────────────────────────────────

type SearchExecutor = (
  config: SearchConfig,
  query: string,
  signal: AbortSignal,
) => Promise<readonly WebSearch.Result[]>;

// ── Helpers ────────────────────────────────────────────────────────────

const isPermanentResponsesFailure = (error: unknown): boolean =>
  error instanceof APIError &&
  error.status !== undefined &&
  error.status >= HTTP_STATUS_CODE.BAD_REQUEST &&
  error.status < HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR;

// ── Search engines ─────────────────────────────────────────────────────

const fallbackCache = new Set<string>();
const clearFallbackCache = () => fallbackCache.clear();

/** Try the Responses API first and fall back to Bing, skipping models known to be unsupported. */
const executeAutoSearch: SearchExecutor = async (config, query, signal) => {
  const modelKey = `${config.baseURL ?? COPILOT_DEFAULT_BASE_URL}/${config.model}`;
  if (fallbackCache.has(modelKey)) {
    return executeBingSearch(config, query, signal);
  }

  try {
    const client = createOpenAICompatibleClient(config, COPILOT_RESPONSES_HEADERS);
    return parseSearchResults(await searchWithResponses(client, config, query, signal));
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }
    if (isPermanentResponsesFailure(error)) {
      fallbackCache.add(modelKey);
    }
    return executeBingSearch(config, query, signal);
  }
};

// ── Execution ──────────────────────────────────────────────────────────

const executeSearch: SearchExecutor = async (config, query, signal) => {
  const engine = config.searchEngine;
  if (engine === "bing") {
    return executeBingSearch(config, query, signal);
  }
  if (engine === "auto") {
    return executeAutoSearch(config, query, signal);
  }

  const client = createOpenAICompatibleClient(config, COPILOT_RESPONSES_HEADERS);
  return parseSearchResults(await searchWithResponses(client, config, query, signal));
};

export { clearFallbackCache, executeSearch };
