// ── Shared Types ───────────────────────────────────────────────────────

interface AnthropicConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
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

export { AnthropicConfig, ContentBlock, ServerToolUse, WebSearchResult, WebSearchToolResult };
