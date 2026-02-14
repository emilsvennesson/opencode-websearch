// ── Shared Types ───────────────────────────────────────────────────────

/**
 * Credentials needed to call the Anthropic API.
 * Resolved from any Anthropic provider in the OpenCode config.
 */
interface AnthropicCredentials {
  apiKey: string;
  baseURL?: string;
}

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
 * The result of scanning all providers at startup:
 * - `credentials`: API key + optional base URL from the first Anthropic provider
 * - `lockedModel`: model ID if a model has `websearch: "always"` (hard lock)
 * - `fallbackModel`: model ID if a model has `"websearch": "auto"` (soft fallback)
 */
interface ProviderResolution {
  credentials: AnthropicCredentials;
  fallbackModel?: string;
  lockedModel?: string;
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

// ── Anthropic Response Types ───────────────────────────────────────────

interface WebSearchResult {
  title: string;
  type: "web_search_result";
  url: string;
}

interface WebSearchToolResult {
  content: WebSearchResult[] | { error_code: string; type: "web_search_tool_result_error" };
  tool_use_id: string;
  type: "web_search_tool_result";
}

interface ServerToolUse {
  id: string;
  input: { query: string };
  name: string;
  type: "server_tool_use";
}

type ContentBlock = { text: string; type: "text" } | ServerToolUse | WebSearchToolResult;

export {
  ActiveModel,
  AnthropicCredentials,
  ContentBlock,
  ProviderResolution,
  SearchConfig,
  ServerToolUse,
  WebSearchResult,
  WebSearchToolResult,
};
