import { ANTHROPIC_NPM_PACKAGE } from "./constants.js";
import { AnthropicConfig } from "./types.js";

// ── Types ──────────────────────────────────────────────────────────────

interface ProviderData {
  id: string;
  models: Record<string, { api: { npm: string }; id: string; options: Record<string, unknown> }>;
  options: Record<string, unknown>;
}

// ── Helpers ────────────────────────────────────────────────────────────

const isAnthropicModel = (model: { api: { npm: string } }): boolean =>
  model.api.npm === ANTHROPIC_NPM_PACKAGE;

const hasWebSearch = (model: { options: Record<string, unknown> }): boolean =>
  model.options.websearch === true;

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

/**
 * Scan providers returned by the SDK for the first Anthropic model
 * with `websearch: true` set in its options.
 */
const resolveFromProviders = (providers: ProviderData[]): AnthropicConfig | null => {
  for (const provider of providers) {
    for (const model of Object.values(provider.models)) {
      if (isAnthropicModel(model) && hasWebSearch(model)) {
        const apiKey = extractApiKey(provider.options);
        if (!apiKey) {
          return null;
        }
        return {
          apiKey,
          baseURL: extractBaseURL(provider.options),
          model: model.id,
        };
      }
    }
  }
  return null;
};

// ── Error formatting ───────────────────────────────────────────────────

const formatConfigError = (): string =>
  `Error: web-search requires an Anthropic provider with \`websearch: true\` set on at least one model.

No model with \`"websearch": true\` was found in your opencode.json configuration.

To fix this, add an Anthropic provider to your opencode.json and set \`"websearch": true\` in the options of the model you want to use for web searches:

{
  "provider": {
    "anthropic": {
      "npm": "@ai-sdk/anthropic",
      "options": {
        "apiKey": "{env:ANTHROPIC_API_KEY}"
      },
      "models": {
        "claude-sonnet-4-5": {
          "options": {
            "websearch": true
          }
        }
      }
    }
  }
}

Steps:
1. Open your opencode.json (project root, .opencode/opencode.json, or ~/.config/opencode/opencode.json)
2. Ensure you have an Anthropic provider configured with a valid API key
3. Add \`"websearch": true\` to the \`options\` of the Claude model you want to use for web search
4. Restart OpenCode to pick up the configuration change`;

export { formatConfigError, ProviderData, resolveFromProviders };
