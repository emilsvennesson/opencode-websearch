import Anthropic, { APIError } from "@anthropic-ai/sdk";

import {
  EMPTY_LENGTH,
  MAX_RESPONSE_TOKENS,
  SEARCH_SYSTEM_PROMPT,
  buildSearchInput,
} from "../shared/search.js";
import { SearchConfig, SearchHit, StructuredSearchResponse } from "../../types.js";
import { formatUnhandledSearchError } from "../shared/errors.js";

// ── Anthropic-specific types ────────────────────────────────────────────

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

// ── Constants ──────────────────────────────────────────────────────────

const DEFAULT_SEARCH_USES = 8;

// ── Response processing ─────────────────────────────────────────────────

const processBlock = (block: ContentBlock): SearchHit[] | string | null => {
  if (block.type === "text") {
    const text = block.text.trim();
    if (text.length > EMPTY_LENGTH) {
      return text;
    }
  }

  if (block.type === "web_search_tool_result") {
    if (!Array.isArray(block.content)) {
      return `Web search error: ${block.content.error_code}`;
    }
    return (block.content as WebSearchResult[]).map((searchResult) => ({
      title: searchResult.title,
      url: searchResult.url,
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

const buildWebSearchTool = (): Record<string, unknown> => ({
  max_uses: DEFAULT_SEARCH_USES,
  name: "web_search",
  type: "web_search_20250305",
});

// ── Error formatting ───────────────────────────────────────────────────

const formatErrorMessage = (error: unknown): string => {
  if (error instanceof APIError) {
    return `Anthropic API error: ${error.message} (status: ${error.status})`;
  }

  return formatUnhandledSearchError(error);
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

const executeSearch = async (config: SearchConfig, query: string): Promise<string> => {
  const client = createAnthropicClient(config);
  const webSearchTool = buildWebSearchTool();

  const response = await client.messages.create({
    max_tokens: MAX_RESPONSE_TOKENS,
    messages: [
      {
        content: buildSearchInput(query),
        role: "user",
      },
    ],
    model: config.model,
    system: SEARCH_SYSTEM_PROMPT,
    tools: [webSearchTool as unknown as Anthropic.Tool],
  });

  const content = response.content as ContentBlock[];
  const structured = processResponseBlocks(query, content);

  return JSON.stringify(structured);
};

export { executeSearch, formatErrorMessage };
