import { SEARCH_SYSTEM_PROMPT, buildSearchInput } from "../shared/search.js";
import { SearchConfig } from "../../types.js";
import { CHATGPT_DEFAULT_BASE_URL, CHATGPT_USER_AGENT } from "./constants.js";
import { RESPONSES_TEXT_FORMAT } from "../shared/openai-compatible.js";
import { throwResponseError } from "../shared/errors.js";

// ── Types ──────────────────────────────────────────────────────────────

interface StreamState {
  outputText: string;
}

// ── Constants ──────────────────────────────────────────────────────────

const DATA_PREFIX = "data: ";
const EMPTY_RESPONSE_BODY = "ChatGPT API returned an empty response body";
const EVENT_DELIMITER = "\n\n";
const NOT_FOUND = -1;
const STRING_START = 0;
const TEXT_DELTA_EVENT = "response.output_text.delta";

// ── Request helpers ────────────────────────────────────────────────────

const buildHeaders = (config: SearchConfig): Record<string, string> => ({
  Accept: "text/event-stream",
  Authorization: `Bearer ${config.apiKey}`,
  "Content-Type": "application/json",
  "User-Agent": CHATGPT_USER_AGENT,
  ...(config.accountId ? { "chatgpt-account-id": config.accountId } : {}),
});

// The ChatGPT Codex endpoint only accepts streamed, unstored Responses requests.
const buildRequestBody = (config: SearchConfig, query: string): Record<string, unknown> => ({
  input: [{ content: [{ text: buildSearchInput(query), type: "input_text" }], role: "user" }],
  instructions: SEARCH_SYSTEM_PROMPT,
  model: config.model,
  store: false,
  stream: true,
  text: { format: RESPONSES_TEXT_FORMAT },
  tools: [{ type: "web_search" }],
});

// ── SSE processing ─────────────────────────────────────────────────────

const applyEvent = (block: string, state: StreamState): void => {
  const data = block
    .split("\n")
    .filter((line) => line.startsWith(DATA_PREFIX))
    .map((line) => line.slice(DATA_PREFIX.length))
    .join("");

  try {
    const event = JSON.parse(data) as { delta?: unknown; type?: unknown };
    if (event.type === TEXT_DELTA_EVENT && typeof event.delta === "string") {
      state.outputText += event.delta;
    }
  } catch {
    // Ignore keep-alives and non-JSON events.
  }
};

const consumeBuffer = (buffer: string, state: StreamState): string => {
  let remaining = buffer;
  let delimiter = remaining.indexOf(EVENT_DELIMITER);

  while (delimiter !== NOT_FOUND) {
    applyEvent(remaining.slice(STRING_START, delimiter), state);
    remaining = remaining.slice(delimiter + EVENT_DELIMITER.length);
    delimiter = remaining.indexOf(EVENT_DELIMITER);
  }

  return remaining;
};

const readStreamText = async (response: Response): Promise<string> => {
  if (!response.body) {
    throw new Error(EMPTY_RESPONSE_BODY);
  }

  const state: StreamState = { outputText: "" };
  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of response.body) {
    buffer = consumeBuffer(buffer + decoder.decode(chunk, { stream: true }), state);
  }

  consumeBuffer(`${buffer}${decoder.decode()}${EVENT_DELIMITER}`, state);
  return state.outputText;
};

// ── Execution ──────────────────────────────────────────────────────────

const executeSearch = async (
  config: SearchConfig,
  query: string,
  signal: AbortSignal,
): Promise<string> => {
  const baseURL = (config.baseURL ?? CHATGPT_DEFAULT_BASE_URL).replace(/\/+$/, "");
  const response = await fetch(`${baseURL}/responses`, {
    body: JSON.stringify(buildRequestBody(config, query)),
    headers: buildHeaders(config),
    method: "POST",
    signal,
  });
  if (!response.ok) {
    return throwResponseError(response);
  }

  return readStreamText(response);
};

export { executeSearch };
