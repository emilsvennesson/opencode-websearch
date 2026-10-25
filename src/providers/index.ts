import { WebSearch } from "@opencode/plugin";

import { ProviderType, SearchConfig } from "../types.js";
import { executeSearch as executeAnthropicSearch } from "./anthropic/index.js";
import { executeSearch as executeChatGPTSearch } from "./chatgpt/index.js";
import { executeSearch as executeCopilotSearch } from "./copilot/index.js";
import { executeSearch as executeMoonshotSearch } from "./moonshot/index.js";
import { executeSearch as executeOpenAISearch } from "./openai/index.js";
import { executeSearch as executeXAISearch } from "./xai/index.js";
import { formatSearchError } from "./shared/errors.js";
import { parseSearchResults } from "./shared/search.js";

// ── Types ──────────────────────────────────────────────────────────────

type ResultSearch = (
  config: SearchConfig,
  query: string,
  signal: AbortSignal,
) => Promise<readonly WebSearch.Result[]>;

type TextSearch = (config: SearchConfig, query: string, signal: AbortSignal) => Promise<string>;

interface ProviderAdapter {
  label: string;
  search: ResultSearch;
}

// ── Provider map ───────────────────────────────────────────────────────

/** Adapt a model search that returns structured JSON text. */
const modelSearch =
  (search: TextSearch): ResultSearch =>
  async (config, query, signal) =>
    parseSearchResults(await search(config, query, signal));

const PROVIDER_ADAPTERS: Record<ProviderType, ProviderAdapter> = {
  anthropic: { label: "Anthropic", search: modelSearch(executeAnthropicSearch) },
  chatgpt: { label: "ChatGPT", search: modelSearch(executeChatGPTSearch) },
  copilot: { label: "GitHub Copilot", search: modelSearch(executeCopilotSearch) },
  moonshot: { label: "Moonshot", search: executeMoonshotSearch },
  openai: { label: "OpenAI", search: modelSearch(executeOpenAISearch) },
  xai: { label: "xAI", search: modelSearch(executeXAISearch) },
};

// ── Dispatch ───────────────────────────────────────────────────────────

const dispatchSearch = async (
  providerType: ProviderType,
  config: SearchConfig,
  query: string,
  signal: AbortSignal,
): Promise<readonly WebSearch.Result[]> => {
  const adapter = PROVIDER_ADAPTERS[providerType];
  try {
    return await adapter.search(config, query, signal);
  } catch (error) {
    throw new Error(formatSearchError(adapter.label, error), { cause: error });
  }
};

export { dispatchSearch };
