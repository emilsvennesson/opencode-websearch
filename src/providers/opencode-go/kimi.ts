import { MAX_RESPONSE_TOKENS, SEARCH_SYSTEM_PROMPT, buildSearchInput } from "../shared/search.js";
import { SearchConfig } from "../../types.js";
import { throwResponseError } from "../shared/errors.js";

// ── Types ──────────────────────────────────────────────────────────────

interface ToolCall {
  function: { arguments: string; name: string };
  id: string;
}

interface ChatMessage {
  content?: string | null;
  tool_calls?: ToolCall[];
}

interface ChatResponse {
  choices?: { finish_reason?: string; message?: ChatMessage }[];
}

// ── Constants ──────────────────────────────────────────────────────────

const FIRST_CHOICE = 0;
const FIRST_TURN = 0;
const MAX_TURNS = 4;
const NEXT_TURN = 1;

/** Kimi's built-in search tool, executed by the model host rather than the caller. */
const WEB_SEARCH_TOOL = { function: { name: "$web_search" }, type: "builtin_function" };

// ── Execution ──────────────────────────────────────────────────────────

const requestCompletion = async (
  config: SearchConfig,
  messages: unknown[],
  signal: AbortSignal,
): Promise<ChatResponse> => {
  const baseURL = (config.baseURL ?? "").replace(/\/+$/, "");
  const response = await fetch(`${baseURL}/chat/completions`, {
    body: JSON.stringify({
      max_tokens: MAX_RESPONSE_TOKENS,
      messages,
      model: config.model,
      tools: [WEB_SEARCH_TOOL],
    }),
    headers: {
      ...config.headers,
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    signal,
  });
  if (!response.ok) {
    return throwResponseError(response);
  }

  return (await response.json()) as ChatResponse;
};

/**
 * Search with Kimi's `$web_search` built-in tool. The model returns the search
 * arguments as a tool call; echoing them back makes the host run the search.
 */
const executeKimiSearch = async (
  config: SearchConfig,
  query: string,
  signal: AbortSignal,
): Promise<string> => {
  const messages: unknown[] = [
    { content: SEARCH_SYSTEM_PROMPT, role: "system" },
    { content: buildSearchInput(query), role: "user" },
  ];

  for (let turn = FIRST_TURN; turn < MAX_TURNS; turn += NEXT_TURN) {
    // oxlint-disable-next-line no-await-in-loop -- each turn depends on the previous tool call
    const response = await requestCompletion(config, messages, signal);
    const choice = response.choices?.[FIRST_CHOICE];
    if (choice?.finish_reason !== "tool_calls" || !choice.message) {
      return choice?.message?.content ?? "";
    }

    messages.push(choice.message);
    for (const call of choice.message.tool_calls ?? []) {
      messages.push({
        content: call.function.arguments,
        name: call.function.name,
        role: "tool",
        tool_call_id: call.id,
      });
    }
  }

  throw new Error(`search did not finish after ${MAX_TURNS} turns`);
};

export { executeKimiSearch };
