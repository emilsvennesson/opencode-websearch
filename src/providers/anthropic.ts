import Anthropic, { APIError } from "@anthropic-ai/sdk";
import { ContentBlock, SearchConfig, WebSearchResult } from "../types.js";
import {
  DEFAULT_SEARCH_USES,
  EMPTY_LENGTH,
  MAX_RESPONSE_TOKENS,
  SEARCH_SYSTEM_PROMPT,
} from "../constants.js";

// ── Structured result types ─────────────────────────────────────────────

interface SearchHit {
  title: string;
  url: string;
}

interface StructuredSearchResponse {
  query: string;
  results: (SearchHit[] | string)[];
}

// ── Response processing ─────────────────────────────────────────────────

const processBlock = (block: ContentBlock): SearchHit[] | string | null => {
  if (block.type === "text" && block.text.trim().length > EMPTY_LENGTH) {
    return block.text.trim();
  }

  if (block.type === "web_search_tool_result") {
    if (!Array.isArray(block.content)) {
      return `Web search error: ${block.content.error_code}`;
    }
    return (block.content as WebSearchResult[]).map((sr) => ({
      title: sr.title,
      url: sr.url,
    }));
  }

  return null;
};

const processResponseBlocks = (
  query: string,
  content: ContentBlock[],
): StructuredSearchResponse => {
  const results: (SearchHit[] | string)[] = [];

  for (const block of content) {
    const result = processBlock(block);
    if (result !== null) {
      results.push(result);
    }
  }

  return { query, results };
};

// ── Search tool construction ───────────────────────────────────────────

const buildWebSearchTool = (args: {
  allowed_domains?: string[];
  blocked_domains?: string[];
}): Record<string, unknown> => {
  const searchTool: Record<string, unknown> = {
    max_uses: DEFAULT_SEARCH_USES,
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

const createAnthropicClient = (config: SearchConfig): Anthropic => {
  const options: { apiKey: string; baseURL?: string } = {
    apiKey: config.apiKey,
  };
  if (config.baseURL) {
    options.baseURL = config.baseURL;
  }
  return new Anthropic(options);
};

const executeSearch = async (
  config: SearchConfig,
  args: {
    allowed_domains?: string[];
    blocked_domains?: string[];
    query: string;
  },
): Promise<string> => {
  const client = createAnthropicClient(config);
  const webSearchTool = buildWebSearchTool(args);

  const response = await client.messages.create({
    max_tokens: MAX_RESPONSE_TOKENS,
    messages: [
      {
        content: `Perform a web search for the query: ${args.query}`,
        role: "user",
      },
    ],
    model: config.model,
    system: SEARCH_SYSTEM_PROMPT,
    tools: [webSearchTool as unknown as Anthropic.Tool],
  });

  const content = response.content as ContentBlock[];
  const structured = processResponseBlocks(args.query, content);

  return JSON.stringify(structured);
};

export { executeSearch, formatErrorMessage };
