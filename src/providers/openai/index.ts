import {
  MAX_RESPONSE_TOKENS,
  SEARCH_SYSTEM_PROMPT,
  buildSearchInput,
  buildStructuredResponse,
} from "../shared/search.js";
import OpenAI, { APIError } from "openai";
import { SearchArgs, SearchConfig } from "../../types.js";
import {
  collectUniqueAnnotationHits,
  createOpenAICompatibleClient,
} from "../shared/openai-compatible.js";
import { formatUnhandledSearchError } from "../shared/errors.js";

// ── Constants ──────────────────────────────────────────────────────────

const WEB_SEARCH_TOOL: OpenAI.Responses.WebSearchTool = { type: "web_search" };

// ── Error formatting ───────────────────────────────────────────────────

const formatErrorMessage = (error: unknown): string => {
  if (error instanceof APIError) {
    return `OpenAI API error: ${error.message} (status: ${error.status})`;
  }

  return formatUnhandledSearchError(error);
};

// ── Client and execution ───────────────────────────────────────────────

const executeSearch = async (config: SearchConfig, args: SearchArgs): Promise<string> => {
  const client = createOpenAICompatibleClient(config);

  const response = await client.responses.create({
    input: buildSearchInput(args.query),
    instructions: SEARCH_SYSTEM_PROMPT,
    max_output_tokens: MAX_RESPONSE_TOKENS,
    model: config.model,
    tools: [WEB_SEARCH_TOOL],
  });

  const hits = collectUniqueAnnotationHits(response.output);
  const structured = buildStructuredResponse(args.query, response.output_text, hits);

  return JSON.stringify(structured);
};

export { executeSearch, formatErrorMessage };
