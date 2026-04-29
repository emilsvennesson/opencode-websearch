import {
  ProviderCredentials,
  ProviderResolution,
  ProviderResolutionMap,
  ScannableProviderType,
} from "./types.js";
import { SCANNABLE_TYPES, detectProviderType } from "./providers/registry.js";

// ── Types ──────────────────────────────────────────────────────────────

interface ProviderData {
  id: string;
  key?: string;
  models: Record<string, ProviderModel>;
  options: Record<string, unknown>;
}

interface ProviderModel {
  api: {
    url?: string;
  };
  id: string;
  options: Record<string, unknown>;
}

interface ScanResult {
  credentials: ProviderCredentials | null;
  fallbackModel?: string;
  lockedModel?: string;
}

type ScanState = Record<ScannableProviderType, ScanResult>;

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

const stripV1Suffix = (url: string): string => url.replace(/\/v1\/?$/, "");

const extractApiKey = (options: Record<string, unknown>): string | undefined =>
  typeof options.apiKey === "string" ? options.apiKey : undefined;

const extractStringOption = (options: Record<string, unknown>, key: string): string | undefined =>
  typeof options[key] === "string" ? (options[key] as string) : undefined;

const normalizeBaseURL = (providerType: ScannableProviderType, baseURL: string): string =>
  providerType === "anthropic" ? stripV1Suffix(baseURL) : baseURL;

const resolveBaseURL = (
  provider: ProviderData,
  providerType: ScannableProviderType,
  model: ProviderModel,
): string | undefined => {
  const configured = extractStringOption(provider.options, "baseURL");
  if (configured) {
    return normalizeBaseURL(providerType, configured);
  }

  const modelURL = model.api.url;
  if (typeof modelURL !== "string") {
    return undefined;
  }

  return normalizeBaseURL(providerType, modelURL);
};

const extractCredentials = (
  provider: ProviderData,
  providerType: ScannableProviderType,
  model: ProviderModel,
): ProviderCredentials | null => {
  const apiKey = provider.key ?? extractApiKey(provider.options);
  if (!apiKey) {
    return null;
  }

  return { apiKey, baseURL: resolveBaseURL(provider, providerType, model) };
};

const createInitialScanState = (): ScanState =>
  Object.fromEntries(SCANNABLE_TYPES.map((type) => [type, { credentials: null }])) as ScanState;

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
  providerType: ScannableProviderType,
  state: ScanState,
): void => {
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
  const providerType = detectProviderType(provider.id);
  if (!providerType) {
    return;
  }

  for (const model of Object.values(provider.models)) {
    processProviderModel(provider, model, providerType, state);
  }
};

const buildResolution = (scan: ScanResult): ProviderResolution | null => {
  if (!scan.credentials) {
    return null;
  }

  return {
    credentials: scan.credentials,
    fallbackModel: scan.fallbackModel,
    lockedModel: scan.lockedModel,
  };
};

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Scan all providers in one pass, recording credentials and any
 * `websearch`-tagged models per scannable provider type.
 */
const scanProviders = (providers: ProviderData[]): ScanState => {
  const state = createInitialScanState();

  for (const provider of providers) {
    scanProvider(provider, state);
  }

  return state;
};

/**
 * Build the resolution map from a previously computed scan state.
 * Only providers with credentials are emitted.
 */
const buildResolutionMap = (state: ScanState): ProviderResolutionMap => {
  const result: ProviderResolutionMap = {};

  for (const type of SCANNABLE_TYPES) {
    const resolution = buildResolution(state[type]);
    if (resolution) {
      result[type] = resolution;
    }
  }

  return result;
};

// ── Error formatting ───────────────────────────────────────────────────

const GENERAL_MODEL_HINT = "claude-sonnet-4-6, claude-opus-4-6, gpt-5.4, gpt-5.4-mini, kimi-k2.6";
const COPILOT_MODEL_HINT = "gpt-5.3-codex, gpt-5.2-codex, gpt-5.2, gpt-5.1, gpt-5.4-mini";

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

Known Copilot models that work with web search today include: ${COPILOT_MODEL_HINT}.

You can either:
1. Switch to a supported model (e.g. ${GENERAL_MODEL_HINT})
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
  buildResolutionMap,
  formatNoProviderError,
  formatUnsupportedProviderError,
  ProviderData,
  ScanState,
  scanProviders,
};
