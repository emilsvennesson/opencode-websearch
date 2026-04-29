import {
  ProviderCredentials,
  ProviderResolution,
  ProviderResolutionMap,
  ProviderType,
} from "./types.js";
import { detectProviderTypeFromModel } from "./providers/registry.js";

// ── Types ──────────────────────────────────────────────────────────────

interface ProviderData {
  id: string;
  key?: string;
  models: Record<string, ProviderModel>;
  options: Record<string, unknown>;
}

interface ProviderModel {
  api: {
    npm: string;
    url?: string;
  };
  id: string;
  options: Record<string, unknown>;
}

interface ProviderModelOverrides {
  fallbackModel?: string;
  lockedModel?: string;
}

interface ScanResult {
  credentials: ProviderCredentials | null;
  fallbackModel?: string;
  lockedModel?: string;
}

interface ScanState {
  anthropic: ScanResult;
  copilot: ScanResult;
  moonshot: ScanResult;
  openai: ScanResult;
}

type ScannableProviderType = Exclude<ProviderType, "chatgpt">;

// ── Constants ──────────────────────────────────────────────────────────

const WEBSEARCH_ALWAYS = "always";
const WEBSEARCH_AUTO = "auto";

// ── Helpers ────────────────────────────────────────────────────────────

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

const extractConfiguredBaseURL = (options: Record<string, unknown>): string | undefined => {
  if (typeof options.baseURL !== "string") {
    return undefined;
  }

  return options.baseURL;
};

const normalizeProviderBaseURL = (providerType: ProviderType, baseURL: string): string => {
  if (providerType === "anthropic") {
    return normalizeBaseURL(baseURL);
  }

  return baseURL;
};

const extractModelBaseURL = (model: ProviderModel): string | undefined => {
  if (typeof model.api.url !== "string") {
    return undefined;
  }

  return model.api.url;
};

const resolveBaseURL = (
  provider: ProviderData,
  providerType: ProviderType,
  model: ProviderModel,
): string | undefined => {
  const configuredBaseURL = extractConfiguredBaseURL(provider.options);
  if (configuredBaseURL) {
    return normalizeProviderBaseURL(providerType, configuredBaseURL);
  }

  const modelBaseURL = extractModelBaseURL(model);
  if (!modelBaseURL) {
    return undefined;
  }

  if (providerType === "anthropic") {
    return normalizeBaseURL(modelBaseURL);
  }

  return modelBaseURL;
};

const extractCredentials = (
  provider: ProviderData,
  providerType: ProviderType,
  model: ProviderModel,
): ProviderCredentials | null => {
  const apiKey = provider.key ?? extractApiKey(provider.options);
  if (!apiKey) {
    return null;
  }

  return { apiKey, baseURL: resolveBaseURL(provider, providerType, model) };
};

const createInitialScanState = (): ScanState => ({
  anthropic: { credentials: null },
  copilot: { credentials: null },
  moonshot: { credentials: null },
  openai: { credentials: null },
});

const isScannableProviderType = (
  providerType: ProviderType,
): providerType is ScannableProviderType => {
  if (providerType === "chatgpt") {
    return false;
  }

  return true;
};

const updateModelsFromWebsearchOption = (scan: ScanResult, model: ProviderModel): void => {
  const option = getWebsearchOption(model);
  if (option === WEBSEARCH_ALWAYS && !scan.lockedModel) {
    scan.lockedModel = model.id;
  }

  if (option === WEBSEARCH_AUTO && !scan.fallbackModel) {
    scan.fallbackModel = model.id;
  }
};

const processProviderModel = (
  provider: ProviderData,
  model: ProviderModel,
  state: ScanState,
): void => {
  const providerType = detectProviderTypeFromModel({
    model,
    providerID: provider.id,
  });
  if (!providerType) {
    return;
  }

  if (!isScannableProviderType(providerType)) {
    return;
  }

  const scan = state[providerType];
  const candidate = extractCredentials(provider, providerType, model);
  if (!scan.credentials) {
    scan.credentials = candidate;
  } else if (!scan.credentials.baseURL && candidate?.baseURL) {
    scan.credentials = { ...scan.credentials, baseURL: candidate.baseURL };
  }

  updateModelsFromWebsearchOption(scan, model);
};

const scanProvider = (provider: ProviderData, state: ScanState): void => {
  for (const model of Object.values(provider.models)) {
    processProviderModel(provider, model, state);
  }
};

const scanProviders = (providers: ProviderData[]): ScanState => {
  const state = createInitialScanState();

  for (const provider of providers) {
    scanProvider(provider, state);
  }

  return state;
};

const buildResolution = (
  scan: ScanResult,
  providerType: ScannableProviderType,
): ProviderResolution | null => {
  if (!scan.credentials) {
    return null;
  }

  return {
    credentials: scan.credentials,
    fallbackModel: scan.fallbackModel,
    lockedModel: scan.lockedModel,
    providerType,
  };
};

const buildResolutionMap = (state: ScanState): ProviderResolutionMap => {
  const result: ProviderResolutionMap = {};

  const anthropic = buildResolution(state.anthropic, "anthropic");
  if (anthropic) {
    result.anthropic = anthropic;
  }

  const openai = buildResolution(state.openai, "openai");
  if (openai) {
    result.openai = openai;
  }

  const moonshot = buildResolution(state.moonshot, "moonshot");
  if (moonshot) {
    result.moonshot = moonshot;
  }

  const copilot = buildResolution(state.copilot, "copilot");
  if (copilot) {
    result.copilot = copilot;
  }

  return result;
};

const buildModelOverrides = (scan: ScanResult): ProviderModelOverrides => ({
  fallbackModel: scan.fallbackModel,
  lockedModel: scan.lockedModel,
});

// ── Config resolution ──────────────────────────────────────────────────

const resolveModelOverrides = (
  providers: ProviderData[],
  providerType: ScannableProviderType,
): ProviderModelOverrides => {
  const state = scanProviders(providers);

  return buildModelOverrides(state[providerType]);
};

/**
 * Scan providers for Anthropic, OpenAI, Moonshot, and GitHub Copilot credentials
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
  const state = scanProviders(providers);

  return buildResolutionMap(state);
};

// ── Error formatting ───────────────────────────────────────────────────

const resolveGeneralModelHint = (): string =>
  "claude-sonnet-4-6, claude-opus-4-6, gpt-5.4, gpt-5.4-mini, kimi-k2.6";

const resolveCopilotModelHint = (): string =>
  "gpt-5.3-codex, gpt-5.2-codex, gpt-5.2, gpt-5.1, gpt-5.4-mini";

const formatNoProviderError = (): string =>
  `Error: web-search requires an Anthropic, OpenAI (API key or ChatGPT OAuth), Moonshot, or GitHub Copilot provider.

No supported provider credentials (API key or OAuth) were found.

To fix this, add an Anthropic, OpenAI, or Moonshot provider to your opencode.json:

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

Or:

{
  "provider": {
    "moonshot": {
      "options": {
        "apiKey": "{env:MOONSHOT_API_KEY}"
      }
    }
  }
}

Steps:
1. Open your opencode.json (project root, .opencode/, or ~/.config/opencode/)
2. Ensure you have an Anthropic/OpenAI/Moonshot provider configured with a valid API key, or active OpenAI ChatGPT OAuth/Copilot auth
3. Restart OpenCode to pick up the configuration change`;

const formatUnsupportedProviderError = (activeModelID: string): string =>
  `Error: your current model (${activeModelID}) does not support web search.

Web search requires an Anthropic, OpenAI, Moonshot, or GitHub Copilot web-search-capable model.

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
