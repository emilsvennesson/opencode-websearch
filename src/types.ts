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
 * Provider types detectable from OpenCode provider config.
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
 * One scanned provider, ready to answer a web-search call.
 *
 * - `providerID`: the OpenCode provider ID (e.g. `"openai"`,
 *   `"openai-prod"`). Resolutions are matched against the active model's
 *   `providerID` directly, allowing multiple providers of the same type
 *   with different credentials/baseURLs to coexist.
 * - `type`: which adapter to dispatch to. May be mutated after scanning
 *   when ChatGPT OAuth shadows the canonical `openai` provider.
 * - `lockedModel`: model ID if a model has `"websearch": "always"`.
 * - `fallbackModel`: model ID if a model has `"websearch": "auto"`.
 */
interface ProviderResolution {
  credentials: ProviderCredentials;
  fallbackModel?: string;
  lockedModel?: string;
  providerID: string;
  type: ProviderType;
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
  ProviderType,
  ScannableProviderType,
  SearchConfig,
  SearchHit,
  StructuredSearchResponse,
};
