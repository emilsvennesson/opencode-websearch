// ── Shared Types ───────────────────────────────────────────────────────

interface AnthropicConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
}

interface OpenCodeProvider {
  models?: Record<string, { name?: string }>;
  npm?: string;
  options?: {
    apiKey?: string;
    baseURL?: string;
  };
}

interface OpenCodeConfig {
  provider?: Record<string, OpenCodeProvider>;
}

interface ConfigResult {
  config: AnthropicConfig | null;
  error?: string;
}

interface ProviderContext {
  configPath: string;
  errors: string[];
  providerName: string;
}

// ── Anthropic Response Types ───────────────────────────────────────────

interface WebSearchResult {
  page_age?: string;
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

interface SearchUsage {
  input_tokens: number;
  output_tokens: number;
  server_tool_use?: { web_search_requests?: number };
}

type ContentBlock = { text: string; type: "text" } | ServerToolUse | WebSearchToolResult;

export {
  AnthropicConfig,
  ConfigResult,
  ContentBlock,
  OpenCodeConfig,
  OpenCodeProvider,
  ProviderContext,
  SearchUsage,
  ServerToolUse,
  WebSearchResult,
  WebSearchToolResult,
};
