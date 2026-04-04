import {
  ANTHROPIC_NPM_PACKAGE,
  COPILOT_NPM_PACKAGE,
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

interface ProviderModel {
  api: { npm: string };
  id: string;
  options: Record<string, unknown>;
}

// ── Helpers ────────────────────────────────────────────────────────────

const isAnthropicProvider = (model: ProviderModel): boolean =>
  model.api.npm === ANTHROPIC_NPM_PACKAGE;

const isOpenAIProvider = (model: ProviderModel): boolean => model.api.npm === OPENAI_NPM_PACKAGE;

const isCopilotProvider = (model: ProviderModel): boolean => model.api.npm === COPILOT_NPM_PACKAGE;

const detectProviderType = (model: ProviderModel): ProviderType | null => {
  if (isAnthropicProvider(model)) {
    return "anthropic";
  }
  if (isOpenAIProvider(model)) {
    return "openai";
  }
  if (isCopilotProvider(model)) {
    return "copilot";
  }
  return null;
};

const getWebsearchOption = (model: ProviderModel): string | null => {
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

const extractBaseURL = (options: Record<string, unknown>, pt: ProviderType): string | undefined => {
  if (typeof options.baseURL !== "string") {
    return undefined;
  }
  if (pt === "anthropic") {
    return normalizeBaseURL(options.baseURL);
  }
  return options.baseURL;
};

// ── Config resolution ──────────────────────────────────────────────────

const extractCredentials = (
  provider: ProviderData,
  pt: ProviderType,
): ProviderCredentials | null => {
  const apiKey = provider.key ?? extractApiKey(provider.options);
  if (!apiKey) {
    return null;
  }
  return { apiKey, baseURL: extractBaseURL(provider.options, pt) };
};

interface ScanResult {
  credentials: ProviderCredentials | null;
  fallbackModel?: string;
  lockedModel?: string;
}

interface ScanState {
  anthropic: ScanResult;
  copilot: ScanResult;
  openai: ScanResult;
}

interface ProviderModelOverrides {
  fallbackModel?: string;
  lockedModel?: string;
}

const processProviderModel = (
  provider: ProviderData,
  model: ProviderModel,
  state: ScanState,
): void => {
  const pt = detectProviderType(model);
  if (!pt) {
    return;
  }

  const accumulated = state[pt];

  if (!accumulated.credentials) {
    accumulated.credentials = extractCredentials(provider, pt);
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

const resolveModelOverrides = (
  providers: ProviderData[],
  pt: ProviderType,
): ProviderModelOverrides => {
  const overrides: ProviderModelOverrides = {};

  for (const provider of providers) {
    for (const model of Object.values(provider.models)) {
      if (detectProviderType(model) !== pt) {
        continue;
      }
      const option = getWebsearchOption(model);
      if (option === WEBSEARCH_ALWAYS && !overrides.lockedModel) {
        overrides.lockedModel = model.id;
      }
      if (option === WEBSEARCH_AUTO && !overrides.fallbackModel) {
        overrides.fallbackModel = model.id;
      }
    }
  }

  return overrides;
};

const resolveCopilotModelHint = (): string =>
  "gpt-5.3-codex, gpt-5.2-codex, gpt-5.2, gpt-5.1, gpt-5.4-mini";

const resolveGeneralModelHint = (): string =>
  "claude-sonnet-4-6, claude-opus-4-6, gpt-5.4, gpt-5.4-mini";

/**
 * Scan providers for Anthropic, OpenAI, and GitHub Copilot credentials
 * and any websearch-tagged models.
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
    copilot: { credentials: null },
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
  const copilot = buildResolution(state.copilot, "copilot");
  if (copilot) {
    result.copilot = copilot;
  }

  return result;
};

// ── Error formatting ───────────────────────────────────────────────────

const formatNoProviderError = (): string =>
  `Error: web-search requires an Anthropic, OpenAI, or GitHub Copilot provider.

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

Or, if you use GitHub Copilot, ensure you're signed in to Copilot in OpenCode.

Steps:
1. Open your opencode.json (project root, .opencode/, or ~/.config/opencode/)
2. Ensure you have an Anthropic/OpenAI provider configured with a valid API key, or active GitHub Copilot auth
3. Restart OpenCode to pick up the configuration change`;

const formatUnsupportedProviderError = (activeModelID: string): string =>
  `Error: your current model (${activeModelID}) does not support web search.

Web search requires an Anthropic, OpenAI, or GitHub Copilot web-search-capable model.

Known Copilot models that work with web search today include: ${resolveCopilotModelHint()}.

You can either:
1. Switch to a supported model (e.g. ${resolveGeneralModelHint()})
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
  resolveModelOverrides,
  resolveFromProviders,
};
