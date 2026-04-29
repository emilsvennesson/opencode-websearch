import {
  collectUniqueAnnotationAndSourceHits,
  createOpenAICompatibleClient,
  resolveOutputText,
} from "../shared/openai-compatible.js";
import {
  MAX_RESPONSE_TOKENS,
  SEARCH_SYSTEM_PROMPT,
  buildSearchInput,
  buildStructuredResponse,
} from "../shared/search.js";
import { formatUnhandledSearchError } from "../shared/errors.js";
import OpenAI, { APIError } from "openai";
import { SearchConfig } from "../../types.js";
import { COPILOT_INITIATOR, COPILOT_INTENT, COPILOT_USER_AGENT } from "./constants.js";

// ── Constants ──────────────────────────────────────────────────────────

const WEB_SEARCH_INCLUDE: OpenAI.Responses.ResponseIncludable[] = [
  "web_search_call.action.sources",
];
const WEB_SEARCH_TOOL: OpenAI.Responses.WebSearchTool = { type: "web_search" };

// ── Error formatting ───────────────────────────────────────────────────

const formatErrorMessage = (error: unknown): string => {
  if (error instanceof APIError) {
    return `GitHub Copilot API error: ${error.message} (status: ${error.status})`;
  }

  return formatUnhandledSearchError(error);
};

// ── Client and execution ───────────────────────────────────────────────

const executeSearch = async (config: SearchConfig, query: string): Promise<string> => {
  const client = createOpenAICompatibleClient(config, {
    "Openai-Intent": COPILOT_INTENT,
    "User-Agent": COPILOT_USER_AGENT,
    "x-initiator": COPILOT_INITIATOR,
  });

  const response = await client.responses.create({
    include: WEB_SEARCH_INCLUDE,
    input: buildSearchInput(query),
    instructions: SEARCH_SYSTEM_PROMPT,
    max_output_tokens: MAX_RESPONSE_TOKENS,
    model: config.model,
    tool_choice: "auto",
    tools: [WEB_SEARCH_TOOL],
  });

  const outputText = resolveOutputText(response.output_text, response.output);
  const hits = collectUniqueAnnotationAndSourceHits(response.output);
  const structured = buildStructuredResponse(query, outputText, hits);

  return JSON.stringify(structured);
};

export { executeSearch, formatErrorMessage };
