import {
  ANTHROPIC_NPM_PACKAGE,
  OPENAI_NPM_PACKAGE,
  WEBSEARCH_ALWAYS,
  WEBSEARCH_AUTO,
} from "./constants.js";
import {
  ProviderCredentials,
  ProviderResolution,
  ProviderResolutionMap,
  ProviderType,
} from "./types.js";

// ── Types ──────────────────────────────────────────────────────────────

interface ProviderData {
  id: string;
  key?: string;
  models: Record<string, { api: { npm: string }; id: string; options: Record<string, unknown> }>;
  options: Record<string, unknown>;
}

// ── Helpers ────────────────────────────────────────────────────────────

const isAnthropicProvider = (model: { api: { npm: string } }): boolean =>
  model.api.npm === ANTHROPIC_NPM_PACKAGE;

const isOpenAIProvider = (model: { api: { npm: string } }): boolean =>
  model.api.npm === OPENAI_NPM_PACKAGE;

const detectProviderType = (model: { api: { npm: string } }): ProviderType | null => {
  if (isAnthropicProvider(model)) {
    return "anthropic";
  }
  if (isOpenAIProvider(model)) {
    return "openai";
  }
  return null;
};

const getWebsearchOption = (model: { options: Record<string, unknown> }): string | null => {
  const value = model.options.websearch;
  if (value === WEBSEARCH_ALWAYS || value === WEBSEARCH_AUTO) {
    return value;
  }
  return null;
};

const normalizeBaseURL = (url: string): string => url.replace(/\/v1\/?$/, "");

const extractApiKey = (options: Record<string, unknown>): string | undefined => {
  if (typeof options.apiKey !== "string") {
    return undefined;
  }
  return options.apiKey;
};

const extractBaseURL = (options: Record<string, unknown>): string | undefined => {
  if (typeof options.baseURL !== "string") {
    return undefined;
  }
  return normalizeBaseURL(options.baseURL);
};

// ── Config resolution ──────────────────────────────────────────────────

const extractCredentials = (provider: ProviderData): ProviderCredentials | null => {
  const apiKey = provider.key ?? extractApiKey(provider.options);
  if (!apiKey) {
    return null;
  }
  return { apiKey, baseURL: extractBaseURL(provider.options) };
};

interface ScanResult {
  credentials: ProviderCredentials | null;
  fallbackModel?: string;
  lockedModel?: string;
}

interface ScanState {
  anthropic: ScanResult;
  openai: ScanResult;
}

const processProviderModel = (
  provider: ProviderData,
  model: { api: { npm: string }; id: string; options: Record<string, unknown> },
  state: ScanState,
): void => {
  const pt = detectProviderType(model);
  if (!pt) {
    return;
  }

  const accumulated = state[pt];

  if (!accumulated.credentials) {
    accumulated.credentials = extractCredentials(provider);
  }

  const option = getWebsearchOption(model);
  if (option === WEBSEARCH_ALWAYS && !accumulated.lockedModel) {
    accumulated.lockedModel = model.id;
  }
  if (option === WEBSEARCH_AUTO && !accumulated.fallbackModel) {
    accumulated.fallbackModel = model.id;
  }
};

const scanProviderModels = (provider: ProviderData, state: ScanState): void => {
  for (const model of Object.values(provider.models)) {
    processProviderModel(provider, model, state);
  }
};

const buildResolution = (scan: ScanResult, pt: ProviderType): ProviderResolution | null => {
  if (!scan.credentials) {
    return null;
  }
  return {
    credentials: scan.credentials,
    fallbackModel: scan.fallbackModel,
    lockedModel: scan.lockedModel,
    providerType: pt,
  };
};

/**
 * Scan providers for Anthropic and OpenAI credentials and any websearch-tagged models.
 *
 * Resolution priority (per provider):
 * - `lockedModel`:   first model with `"websearch": "always"` (hard lock)
 * - `fallbackModel`: first model with `"websearch": "auto"`   (soft fallback)
 * - `credentials`:   API key + optional baseURL from the first matching provider
 *
 * Returns a map with optional entries for each supported provider type.
 */
const resolveFromProviders = (providers: ProviderData[]): ProviderResolutionMap => {
  const state: ScanState = {
    anthropic: { credentials: null },
    openai: { credentials: null },
  };

  for (const provider of providers) {
    scanProviderModels(provider, state);
  }

  const result: ProviderResolutionMap = {};
  const anthropic = buildResolution(state.anthropic, "anthropic");
  if (anthropic) {
    result.anthropic = anthropic;
  }
  const openai = buildResolution(state.openai, "openai");
  if (openai) {
    result.openai = openai;
  }

  return result;
};

// ── Error formatting ───────────────────────────────────────────────────

const formatNoProviderError = (): string =>
  `Error: web-search requires an Anthropic or OpenAI provider.

No supported provider with a valid API key was found in your opencode.json configuration.

To fix this, add an Anthropic or OpenAI provider to your opencode.json:

{
  "provider": {
    "anthropic": {
      "options": {
        "apiKey": "{env:ANTHROPIC_API_KEY}"
      }
    }
  }
}

Or:

{
  "provider": {
    "openai": {
      "options": {
        "apiKey": "{env:OPENAI_API_KEY}"
      }
    }
  }
}

Steps:
1. Open your opencode.json (project root, .opencode/, or ~/.config/opencode/)
2. Ensure you have an Anthropic or OpenAI provider configured with a valid API key
3. Restart OpenCode to pick up the configuration change`;

const formatUnsupportedProviderError = (activeModelID: string): string =>
  `Error: your current model (${activeModelID}) does not support web search.

Web search requires an Anthropic or OpenAI model.

You can either:
1. Switch to a supported model (e.g. claude-sonnet-4-5 or gpt-4o)
2. Set \`"websearch": "auto"\` on a supported model to use it as a fallback:

{
  "provider": {
    "anthropic": {
      "models": {
        "claude-sonnet-4-5": {
          "options": {
            "websearch": "auto"
          }
        }
      }
    }
  }
}

Or set \`"websearch": "always"\` to always use that model for web search regardless of your active model.`;

export {
  formatNoProviderError,
  formatUnsupportedProviderError,
  ProviderData,
  resolveFromProviders,
};
