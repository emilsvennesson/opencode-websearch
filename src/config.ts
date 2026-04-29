import { ProviderCredentials, ProviderType, ScannableProviderType } from "./types.js";
import { detectProviderType } from "./providers/registry.js";

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
  };
  id: string;
  options: Record<string, unknown>;
}

/**
 * A scan result that may not yet have credentials.
 *
 * Distinct from `ProviderResolution` because we want to preserve the
 * `websearch` flags configured on a provider even when its API key is
 * missing — the OAuth attachment step in `loadResolutions` can fill
 * those credentials in afterwards (e.g. for `github-copilot` configured
 * only with `"websearch": "always"` flags and authenticated via OAuth).
 *
 * Resolutions still missing credentials after OAuth attachment are
 * filtered out before the public `ProviderResolution[]` is returned.
 */
interface ScannedResolution {
  credentials: ProviderCredentials | null;
  fallbackModel?: string;
  lockedModel?: string;
  providerID: string;
  type: ProviderType;
}

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

const extractStringOption = (options: Record<string, unknown>, key: string): string | undefined =>
  typeof options[key] === "string" ? (options[key] as string) : undefined;

const normalizeBaseURL = (type: ScannableProviderType, baseURL: string): string =>
  type === "anthropic" ? stripV1Suffix(baseURL) : baseURL;

const resolveBaseURL = (
  provider: ProviderData,
  type: ScannableProviderType,
): string | undefined => {
  const configured = extractStringOption(provider.options, "baseURL");

  return configured ? normalizeBaseURL(type, configured) : undefined;
};

const collectWebsearchModels = (
  provider: ProviderData,
): { fallbackModel?: string; lockedModel?: string } => {
  let lockedModel: string | undefined = undefined;
  let fallbackModel: string | undefined = undefined;

  for (const model of Object.values(provider.models)) {
    const flag = getWebsearchOption(model);
    if (flag === WEBSEARCH_ALWAYS && !lockedModel) {
      lockedModel = model.id;
    }
    if (flag === WEBSEARCH_AUTO && !fallbackModel) {
      fallbackModel = model.id;
    }
  }

  return { fallbackModel, lockedModel };
};

const scanProvider = (provider: ProviderData): ScannedResolution | null => {
  const type = detectProviderType(provider);
  if (!type) {
    return null;
  }

  const apiKey = provider.key ?? extractStringOption(provider.options, "apiKey");
  const { fallbackModel, lockedModel } = collectWebsearchModels(provider);

  // Skip providers that contribute nothing: no credentials and no flags.
  if (!apiKey && !lockedModel && !fallbackModel) {
    return null;
  }

  const credentials = apiKey ? { apiKey, baseURL: resolveBaseURL(provider, type) } : null;

  return {
    credentials,
    fallbackModel,
    lockedModel,
    providerID: provider.id,
    type,
  };
};

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Scan all providers, emitting one scan result per detected provider.
 *
 * Each result preserves OpenCode's config insertion order, which is
 * the order used to break ties when multiple providers expose
 * `websearch` flags. Some entries may have null credentials at this
 * stage; the OAuth attachment phase fills them in (and any still-null
 * entries are filtered out before being returned to callers).
 */
const scanProviders = (providers: ProviderData[]): ScannedResolution[] => {
  const result: ScannedResolution[] = [];

  for (const provider of providers) {
    const resolution = scanProvider(provider);
    if (resolution) {
      result.push(resolution);
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
    "moonshotai": {
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
  formatNoProviderError,
  formatUnsupportedProviderError,
  ProviderData,
  ScannedResolution,
  scanProviders,
};
