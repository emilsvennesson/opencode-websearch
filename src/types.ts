// ── Shared Types ───────────────────────────────────────────────────────

/**
 * Credentials needed to call a provider API.
 * Resolved from provider configuration and/or OpenCode auth state.
 */
interface ProviderCredentials {
  accountId?: string;
  apiKey: string;
  baseURL?: string;
}

/**
 * Identifies which provider type a resolution belongs to.
 */
type ProviderType = "anthropic" | "chatgpt" | "copilot" | "moonshot" | "openai";

/**
 * Provider types that come from scanning OpenCode provider config.
 * `chatgpt` is excluded because it is derived from OAuth credentials
 * read separately from `auth.json`, not from a provider entry.
 */
type ScannableProviderType = Exclude<ProviderType, "chatgpt">;

/**
 * Fully resolved config for a single web search call:
 * credentials + the specific model to use.
 */
interface SearchConfig {
  accountId?: string;
  apiKey: string;
  baseURL?: string;
  model: string;
}

/**
 * The result of scanning a single provider at startup:
 * - `credentials`: API key + optional base URL
 * - `lockedModel`: model ID if a model has `websearch: "always"` (hard lock)
 * - `fallbackModel`: model ID if a model has `"websearch": "auto"` (soft fallback)
 */
interface ProviderResolution {
  credentials: ProviderCredentials;
  fallbackModel?: string;
  lockedModel?: string;
}

/**
 * Map of provider resolutions, one per supported provider type.
 */
type ProviderResolutionMap = Partial<Record<ProviderType, ProviderResolution>>;

// ── Active Model ───────────────────────────────────────────────────────

/**
 * Tracks the model the user is currently chatting with,
 * as reported by the `chat.message` hook.
 */
interface ActiveModel {
  modelID: string;
  providerID: string;
}

// ── Structured Result Types ────────────────────────────────────────────

/**
 * A single search result hit with a title and URL.
 * Used by Anthropic, OpenAI, and Copilot providers.
 */
interface SearchHit {
  title: string;
  url: string;
}

/**
 * Structured response returned by a web search execution.
 * Contains the original query and an array of results (text or citation hits).
 */
interface StructuredSearchResponse {
  query: string;
  results: (SearchHit[] | string)[];
}

export {
  ActiveModel,
  ProviderCredentials,
  ProviderResolution,
  ProviderResolutionMap,
  ProviderType,
  ScannableProviderType,
  SearchConfig,
  SearchHit,
  StructuredSearchResponse,
};
