import { ProviderType, SearchConfig } from "../types.js";
import {
  executeSearch as executeAnthropicSearch,
  formatErrorMessage as formatAnthropicError,
} from "./anthropic/index.js";
import {
  executeSearch as executeChatGPTSearch,
  formatErrorMessage as formatChatGPTError,
} from "./chatgpt/index.js";
import {
  executeSearch as executeCopilotSearch,
  formatErrorMessage as formatCopilotError,
} from "./copilot/index.js";
import {
  executeSearch as executeMoonshotSearch,
  formatErrorMessage as formatMoonshotError,
} from "./moonshot/index.js";
import {
  executeSearch as executeOpenAISearch,
  formatErrorMessage as formatOpenAIError,
} from "./openai/index.js";

// ── Types ──────────────────────────────────────────────────────────────

interface ProviderAdapter {
  executeSearch: (config: SearchConfig, query: string) => Promise<string>;
  formatErrorMessage: (error: unknown) => string;
}

// ── Provider map ───────────────────────────────────────────────────────

const PROVIDER_ADAPTERS: Record<ProviderType, ProviderAdapter> = {
  anthropic: {
    executeSearch: executeAnthropicSearch,
    formatErrorMessage: formatAnthropicError,
  },
  chatgpt: {
    executeSearch: executeChatGPTSearch,
    formatErrorMessage: formatChatGPTError,
  },
  copilot: {
    executeSearch: executeCopilotSearch,
    formatErrorMessage: formatCopilotError,
  },
  moonshot: {
    executeSearch: executeMoonshotSearch,
    formatErrorMessage: formatMoonshotError,
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
): Promise<string> => PROVIDER_ADAPTERS[providerType].executeSearch(config, query);

const dispatchErrorMessage = (providerType: ProviderType, error: unknown): string =>
  PROVIDER_ADAPTERS[providerType].formatErrorMessage(error);

export { dispatchErrorMessage, dispatchSearch };
