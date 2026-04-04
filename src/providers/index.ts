import { ProviderType, SearchArgs, SearchConfig } from "../types.js";
import {
  executeSearch as executeAnthropicSearch,
  formatErrorMessage as formatAnthropicError,
} from "./anthropic/index.js";
import {
  executeSearch as executeCopilotSearch,
  formatErrorMessage as formatCopilotError,
} from "./copilot/index.js";
import {
  executeSearch as executeOpenAISearch,
  formatErrorMessage as formatOpenAIError,
} from "./openai/index.js";

// ── Types ──────────────────────────────────────────────────────────────

interface ProviderAdapter {
  executeSearch: (config: SearchConfig, args: SearchArgs) => Promise<string>;
  formatErrorMessage: (error: unknown) => string;
}

// ── Provider map ───────────────────────────────────────────────────────

const PROVIDER_ADAPTERS: Record<ProviderType, ProviderAdapter> = {
  anthropic: {
    executeSearch: executeAnthropicSearch,
    formatErrorMessage: formatAnthropicError,
  },
  copilot: {
    executeSearch: executeCopilotSearch,
    formatErrorMessage: formatCopilotError,
  },
  openai: {
    executeSearch: executeOpenAISearch,
    formatErrorMessage: formatOpenAIError,
  },
};

// ── Dispatch ───────────────────────────────────────────────────────────

const dispatchSearch = async (
  providerType: ProviderType,
  config: SearchConfig,
  query: string,
): Promise<string> => {
  const adapter = PROVIDER_ADAPTERS[providerType];

  return adapter.executeSearch(config, { query });
};

const dispatchErrorMessage = (providerType: ProviderType, error: unknown): string => {
  const adapter = PROVIDER_ADAPTERS[providerType];

  return adapter.formatErrorMessage(error);
};

export { dispatchErrorMessage, dispatchSearch };
