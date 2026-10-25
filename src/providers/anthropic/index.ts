import Anthropic, { APIError } from "@anthropic-ai/sdk";

import {
  MAX_RESPONSE_TOKENS,
  SEARCH_RESULTS_SCHEMA,
  SEARCH_SYSTEM_PROMPT,
  buildSearchInput,
} from "../shared/search.js";
import { SearchConfig } from "../../types.js";

// ── Types ──────────────────────────────────────────────────────────────

type SearchTool = Anthropic.WebSearchTool20250305 | Anthropic.WebSearchTool20260318;

// ── Constants ──────────────────────────────────────────────────────────

const BAD_REQUEST = 400;
const FIRST_TURN = 0;
const MAX_CONTINUATIONS = 4;
const MAX_SEARCH_USES = 8;
const NEXT_TURN = 1;

/** Latest tool, with dynamic filtering through code execution (Claude 4.6+ on Anthropic-hosted APIs). */
const DYNAMIC_SEARCH_TOOL: Anthropic.WebSearchTool20260318 = {
  max_uses: MAX_SEARCH_USES,
  name: "web_search",
  response_inclusion: "excluded",
  type: "web_search_20260318",
};

/** Basic tool for older models and platforms without dynamic filtering. */
const BASIC_SEARCH_TOOL: Anthropic.WebSearchTool20250305 = {
  max_uses: MAX_SEARCH_USES,
  name: "web_search",
  type: "web_search_20250305",
};

// ── Execution ──────────────────────────────────────────────────────────

const runSearch = async (
  client: Anthropic,
  config: SearchConfig,
  query: string,
  tool: SearchTool,
  signal: AbortSignal,
): Promise<string> => {
  const messages: Anthropic.MessageParam[] = [{ content: buildSearchInput(query), role: "user" }];

  for (let turn = FIRST_TURN; turn <= MAX_CONTINUATIONS; turn += NEXT_TURN) {
    // oxlint-disable-next-line no-await-in-loop -- a paused turn must be resumed before continuing
    const response = await client.messages.create(
      {
        max_tokens: MAX_RESPONSE_TOKENS,
        messages,
        model: config.model,
        output_config: { format: { schema: SEARCH_RESULTS_SCHEMA, type: "json_schema" } },
        system: SEARCH_SYSTEM_PROMPT,
        tools: [tool],
      },
      { signal },
    );

    if (response.stop_reason !== "pause_turn") {
      const text = response.content.findLast((block) => block.type === "text");
      return text?.type === "text" ? text.text : "";
    }

    messages.push({ content: response.content, role: "assistant" });
  }

  throw new Error(`search did not finish after ${MAX_CONTINUATIONS} continuations`);
};

const executeSearch = async (
  config: SearchConfig,
  query: string,
  signal: AbortSignal,
): Promise<string> => {
  const client = new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    defaultHeaders: config.headers,
  });

  try {
    return await runSearch(client, config, query, DYNAMIC_SEARCH_TOOL, signal);
  } catch (error) {
    if (!(error instanceof APIError) || error.status !== BAD_REQUEST) {
      throw error;
    }
    return runSearch(client, config, query, BASIC_SEARCH_TOOL, signal);
  }
};

export { executeSearch };
