import { ANTHROPIC_NPM_PACKAGE, WEBSEARCH_ALWAYS, WEBSEARCH_AUTO } from "./constants.js";
import { AnthropicCredentials, ProviderResolution } from "./types.js";

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

const extractCredentials = (provider: ProviderData): AnthropicCredentials | null => {
  const apiKey = provider.key ?? extractApiKey(provider.options);
  if (!apiKey) {
    return null;
  }
  return { apiKey, baseURL: extractBaseURL(provider.options) };
};

interface ScanResult {
  credentials: AnthropicCredentials | null;
  fallbackModel?: string;
  lockedModel?: string;
}

const processProviderModel = (
  provider: ProviderData,
  model: { api: { npm: string }; id: string; options: Record<string, unknown> },
  accumulated: ScanResult,
): void => {
  if (!isAnthropicProvider(model)) {
    return;
  }

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

const scanProviderModels = (provider: ProviderData, accumulated: ScanResult): void => {
  for (const model of Object.values(provider.models)) {
    processProviderModel(provider, model, accumulated);
  }
};
/**
 * Scan providers for Anthropic credentials and any websearch-tagged models.
 *
 * Resolution priority:
 * - `lockedModel`:   first model with `"websearch": "always"` (hard lock)
 * - `fallbackModel`: first model with `"websearch": "auto"`   (soft fallback)
 * - `credentials`:   API key + optional baseURL from the first Anthropic provider
 *
 * Returns `null` if no Anthropic provider with a valid API key is found.
 */
const resolveFromProviders = (providers: ProviderData[]): ProviderResolution | null => {
  const result: ScanResult = { credentials: null };

  for (const provider of providers) {
    scanProviderModels(provider, result);
  }

  if (!result.credentials) {
    return null;
  }

  return {
    credentials: result.credentials,
    fallbackModel: result.fallbackModel,
    lockedModel: result.lockedModel,
  };
};

// ── Error formatting ───────────────────────────────────────────────────

const formatNoProviderError = (): string =>
  `Error: web-search requires an Anthropic provider.

No Anthropic provider with a valid API key was found in your opencode.json configuration.

To fix this, add an Anthropic provider to your opencode.json:

{
  "provider": {
    "anthropic": {
      "options": {
        "apiKey": "{env:ANTHROPIC_API_KEY}"
      }
    }
  }
}

Steps:
1. Open your opencode.json (project root, .opencode/, or ~/.config/opencode/)
2. Ensure you have an Anthropic provider configured with a valid API key
3. Restart OpenCode to pick up the configuration change`;

const formatNonAnthropicError = (activeModelID: string): string =>
  `Error: your current model (${activeModelID}) does not support web search.

Web search uses Anthropic's server-side web_search tool, which only works with Anthropic models.

You can either:
1. Switch to an Anthropic model (e.g. claude-sonnet-4-5)
2. Set \`"websearch": "auto"\` on an Anthropic model to use it as a fallback:

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

export { formatNoProviderError, formatNonAnthropicError, ProviderData, resolveFromProviders };
