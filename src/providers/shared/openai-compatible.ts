import OpenAI from "openai";

import {
  MAX_RESPONSE_TOKENS,
  SEARCH_RESULTS_SCHEMA,
  SEARCH_RESULTS_SCHEMA_NAME,
  SEARCH_SYSTEM_PROMPT,
  buildSearchInput,
} from "./search.js";
import { SearchConfig } from "../../types.js";

// ── Constants ──────────────────────────────────────────────────────────

const WEB_SEARCH_TOOL: OpenAI.Responses.WebSearchTool = { type: "web_search" };

/** Responses API structured output format for search results. */
const RESPONSES_TEXT_FORMAT: OpenAI.Responses.ResponseFormatTextJSONSchemaConfig = {
  name: SEARCH_RESULTS_SCHEMA_NAME,
  schema: SEARCH_RESULTS_SCHEMA,
  strict: true,
  type: "json_schema",
};

// ── Client creation ────────────────────────────────────────────────────

const createOpenAICompatibleClient = (
  config: SearchConfig,
  defaultHeaders?: Record<string, string>,
): OpenAI => new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL, defaultHeaders });

// ── Responses API search ───────────────────────────────────────────────

/** Run one web search through a Responses API endpoint and return its JSON text. */
const searchWithResponses = async (
  client: OpenAI,
  config: SearchConfig,
  query: string,
  signal: AbortSignal,
): Promise<string> => {
  const response = await client.responses.create(
    {
      input: buildSearchInput(query),
      instructions: SEARCH_SYSTEM_PROMPT,
      max_output_tokens: MAX_RESPONSE_TOKENS,
      model: config.model,
      store: false,
      text: { format: RESPONSES_TEXT_FORMAT },
      tools: [WEB_SEARCH_TOOL],
    },
    { signal },
  );

  return response.output_text;
};

export { createOpenAICompatibleClient, RESPONSES_TEXT_FORMAT, searchWithResponses };
