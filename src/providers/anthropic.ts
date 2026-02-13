import Anthropic, { APIError } from "@anthropic-ai/sdk";
import {
  AnthropicConfig,
  ContentBlock,
  SearchUsage,
  WebSearchResult,
  WebSearchToolResult,
} from "../types.js";
import { DEFAULT_SEARCH_USES, EMPTY_LENGTH, MAX_RESPONSE_TOKENS } from "../constants.js";

// ── Response formatting ────────────────────────────────────────────────

const formatSearchResult = (result: WebSearchResult): string => {
  if (result.page_age) {
    return `- [${result.title}](${result.url}) (Updated: ${result.page_age})`;
  }
  return `- [${result.title}](${result.url})`;
};

const processSearchToolResult = (block: WebSearchToolResult, results: string[]): void => {
  if (Array.isArray(block.content)) {
    const searchResults = block.content as WebSearchResult[];
    if (searchResults.length === EMPTY_LENGTH) {
      results.push("No results found.");
    } else {
      results.push(`\nFound ${searchResults.length} results:\n`);
      for (const result of searchResults) {
        results.push(formatSearchResult(result));
      }
    }
  } else if (block.content?.type === "web_search_tool_result_error") {
    results.push(`Search error: ${block.content.error_code}`);
  }
};

const processBlock = (block: ContentBlock, results: string[]): void => {
  if (block.type === "server_tool_use" && block.name === "web_search") {
    results.push(`Search query: "${block.input.query}"`);
    return;
  }

  if (block.type === "web_search_tool_result") {
    processSearchToolResult(block, results);
    return;
  }

  if (block.type === "text" && block.text) {
    results.push(`\n${block.text}`);
  }
};

// ── Search tool construction ───────────────────────────────────────────

const buildWebSearchTool = (args: {
  allowed_domains?: string[];
  blocked_domains?: string[];
  max_uses?: number;
}): Record<string, unknown> => {
  const searchTool: Record<string, unknown> = {
    max_uses: args.max_uses ?? DEFAULT_SEARCH_USES,
    name: "web_search",
    type: "web_search_20250305",
  };

  if (args.allowed_domains?.length) {
    searchTool.allowed_domains = args.allowed_domains;
  }
  if (args.blocked_domains?.length) {
    searchTool.blocked_domains = args.blocked_domains;
  }

  return searchTool;
};

// ── Error formatting ───────────────────────────────────────────────────

const formatErrorMessage = (error: unknown): string => {
  if (error instanceof APIError) {
    return `Anthropic API error: ${error.message} (status: ${error.status})`;
  }
  if (error instanceof Error) {
    return `Error performing web search: ${error.message}`;
  }
  return `Error performing web search: ${String(error)}`;
};

// ── Client and execution ───────────────────────────────────────────────

const createAnthropicClient = (config: AnthropicConfig): Anthropic => {
  const options: { apiKey: string; baseURL?: string } = {
    apiKey: config.apiKey,
  };
  if (config.baseURL) {
    options.baseURL = config.baseURL;
  }
  return new Anthropic(options);
};

const appendUsageInfo = (usage: SearchUsage, results: string[]): void => {
  if (usage.server_tool_use?.web_search_requests) {
    results.push(`\n---\nSearches performed: ${usage.server_tool_use.web_search_requests}`);
  }
};

const executeSearch = async (
  config: AnthropicConfig,
  args: {
    allowed_domains?: string[];
    blocked_domains?: string[];
    max_uses?: number;
    query: string;
  },
): Promise<string> => {
  const client = createAnthropicClient(config);
  const webSearchTool = buildWebSearchTool(args);

  const response = await client.messages.create({
    max_tokens: MAX_RESPONSE_TOKENS,
    messages: [
      {
        content: `Perform a web search for: ${args.query}`,
        role: "user",
      },
    ],
    model: config.model,
    tools: [webSearchTool as unknown as Anthropic.Tool],
  });

  const results: string[] = [];
  const content = response.content as ContentBlock[];

  for (const block of content) {
    processBlock(block, results);
  }

  appendUsageInfo(response.usage as SearchUsage, results);

  return results.join("\n") || "No results returned from web search.";
};

export { executeSearch, formatErrorMessage };
