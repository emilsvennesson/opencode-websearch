// ── Shared Types ───────────────────────────────────────────────────────

/**
 * Credentials needed to call a provider API (Anthropic or OpenAI).
 * Resolved from the provider's configuration in opencode.json.
 */
interface ProviderCredentials {
  apiKey: string;
  baseURL?: string;
}

/**
 * Identifies which provider type a resolution belongs to.
 */
type ProviderType = "anthropic" | "openai";

/**
 * Fully resolved config for a single web search call:
 * credentials + the specific model to use.
 */
interface SearchConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
}

/**
 * The result of scanning a single provider at startup:
 * - `credentials`: API key + optional base URL
 * - `lockedModel`: model ID if a model has `websearch: "always"` (hard lock)
 * - `fallbackModel`: model ID if a model has `"websearch": "auto"` (soft fallback)
 * - `providerType`: which provider this resolution belongs to
 */
interface ProviderResolution {
  credentials: ProviderCredentials;
  fallbackModel?: string;
  lockedModel?: string;
  providerType: ProviderType;
}

/**
 * Map of provider resolutions, one per supported provider type.
 */
interface ProviderResolutionMap {
  anthropic?: ProviderResolution;
  openai?: ProviderResolution;
}

// ── Active Model ───────────────────────────────────────────────────────

/**
 * Tracks the model the user is currently chatting with,
 * as reported by the `chat.message` hook.
 */
interface ActiveModel {
  modelID: string;
  providerID: string;
}

// ── Tool Args ──────────────────────────────────────────────────────────

/**
 * Arguments accepted by the web-search tool.
 */
interface SearchArgs {
  query: string;
}

// ── Structured Result Types ────────────────────────────────────────────

/**
 * A single search result hit with a title and URL.
 * Used by both Anthropic and OpenAI providers.
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
  SearchArgs,
  SearchConfig,
  SearchHit,
  StructuredSearchResponse,
};
