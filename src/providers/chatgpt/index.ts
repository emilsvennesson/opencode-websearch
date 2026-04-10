import { formatUnhandledSearchError } from "../shared/errors.js";
import {
  MAX_RESPONSE_TOKENS,
  buildSearchInput,
  buildStructuredResponse,
  EMPTY_LENGTH,
  SEARCH_SYSTEM_PROMPT,
} from "../shared/search.js";
import { SearchArgs, SearchConfig, SearchHit } from "../../types.js";
import { CHATGPT_DEFAULT_BASE_URL, CHATGPT_USER_AGENT } from "./constants.js";

// ── Types ──────────────────────────────────────────────────────────────

interface ChatGPTErrorBody {
  detail?: string;
  error?: { message?: string };
}

interface ChatGPTEventData {
  delta?: string;
  item?: ChatGPTOutputItem;
}

interface ChatGPTOutputItem {
  action?: ChatGPTSearchAction;
  type?: string;
}

interface ChatGPTSearchAction {
  sources?: ChatGPTSource[];
  type?: string;
}

interface ChatGPTSource {
  url: string;
}

interface ParsedSSEEvent {
  data: string;
  type: string;
}

interface StreamState {
  hits: SearchHit[];
  outputText: string;
  seenURLs: Set<string>;
}

// ── Constants ──────────────────────────────────────────────────────────

const DATA_PREFIX = "data: ";
const EMPTY_RESPONSE_BODY = "ChatGPT API returned an empty response body";
const EVENT_DELIMITER = "\n\n";
const EVENT_PREFIX = "event: ";
const NOT_FOUND = -1;
const SSE_ACCEPT = "text/event-stream";
const STREAM_ENABLED = true;
const STORE_DISABLED = false;
const USER_ROLE = "user";
const WEB_SEARCH_INCLUDE = ["web_search_call.action.sources"];
const WEB_SEARCH_TOOL = { type: "web_search" };

// ── Error formatting ───────────────────────────────────────────────────

const formatErrorMessage = (error: unknown): string => {
  if (error instanceof Error && "status" in error && typeof error.status === "number") {
    return `ChatGPT API error: ${error.message} (status: ${error.status})`;
  }

  return formatUnhandledSearchError(error);
};

// ── Request helpers ────────────────────────────────────────────────────

const buildDefaultHeaders = (
  accountId: string | undefined,
  apiKey: string,
): Record<string, string> => {
  const headers: Record<string, string> = {
    Accept: SSE_ACCEPT,
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "User-Agent": CHATGPT_USER_AGENT,
  };

  if (accountId) {
    headers["chatgpt-account-id"] = accountId;
  }

  return headers;
};

const resolveResponsesURL = (baseURL: string | undefined): string => {
  const resolvedBaseURL = (baseURL ?? CHATGPT_DEFAULT_BASE_URL).replace(/\/$/, "");

  return `${resolvedBaseURL}/responses`;
};

const buildRequestBody = (config: SearchConfig, query: string): Record<string, unknown> => ({
  include: WEB_SEARCH_INCLUDE,
  input: [
    {
      content: [{ text: buildSearchInput(query), type: "input_text" }],
      role: USER_ROLE,
    },
  ],
  instructions: SEARCH_SYSTEM_PROMPT,
  max_output_tokens: MAX_RESPONSE_TOKENS,
  model: config.model,
  store: STORE_DISABLED,
  stream: STREAM_ENABLED,
  tool_choice: "auto",
  tools: [WEB_SEARCH_TOOL],
});

const parseErrorBody = (text: string): string => {
  if (text.length === EMPTY_LENGTH) {
    return "no body";
  }

  try {
    const parsed = JSON.parse(text) as ChatGPTErrorBody;
    if (typeof parsed.detail === "string" && parsed.detail.length > EMPTY_LENGTH) {
      return parsed.detail;
    }

    if (
      parsed.error &&
      typeof parsed.error.message === "string" &&
      parsed.error.message.length > EMPTY_LENGTH
    ) {
      return parsed.error.message;
    }
  } catch {
    return text;
  }

  return text;
};

const throwAPIError = async (response: Response): Promise<never> => {
  const text = await response.text();
  const message = parseErrorBody(text);
  const error = Object.assign(new Error(message), { status: response.status });

  throw error;
};

// ── SSE parsing ────────────────────────────────────────────────────────

const createStreamState = (): StreamState => ({
  hits: [],
  outputText: "",
  seenURLs: new Set<string>(),
});

const parseEventBlock = (block: string): ParsedSSEEvent | null => {
  const lines = block.split("\n");
  let data = "";
  let type = "";

  for (const line of lines) {
    if (line.startsWith(DATA_PREFIX)) {
      data += line.slice(DATA_PREFIX.length);
    }

    if (line.startsWith(EVENT_PREFIX)) {
      type = line.slice(EVENT_PREFIX.length);
    }
  }

  if (type.length === EMPTY_LENGTH || data.length === EMPTY_LENGTH) {
    return null;
  }

  return { data, type };
};

const parseEventData = (data: string): ChatGPTEventData | null => {
  try {
    return JSON.parse(data) as ChatGPTEventData;
  } catch {
    return null;
  }
};

const pushUniqueHit = (state: StreamState, url: string): void => {
  if (state.seenURLs.has(url)) {
    return;
  }

  state.seenURLs.add(url);
  state.hits.push({ title: url, url });
};

const appendSearchSources = (item: ChatGPTOutputItem | undefined, state: StreamState): void => {
  if (!item || item.type !== "web_search_call") {
    return;
  }

  const { action } = item;
  if (!action || action.type !== "search" || !action.sources) {
    return;
  }

  for (const source of action.sources) {
    pushUniqueHit(state, source.url);
  }
};

const applyEventData = (event: ParsedSSEEvent, state: StreamState): void => {
  const parsed = parseEventData(event.data);
  if (!parsed) {
    return;
  }

  if (event.type === "response.output_text.delta" && typeof parsed.delta === "string") {
    state.outputText += parsed.delta;
  }

  if (event.type === "response.output_item.done") {
    appendSearchSources(parsed.item, state);
  }
};

const consumeBuffer = (buffer: string, state: StreamState): string => {
  let remaining = buffer;

  while (true) {
    const delimiterIndex = remaining.indexOf(EVENT_DELIMITER);
    if (delimiterIndex === NOT_FOUND) {
      return remaining;
    }

    const block = remaining.slice(EMPTY_LENGTH, delimiterIndex);
    remaining = remaining.slice(delimiterIndex + EVENT_DELIMITER.length);

    const event = parseEventBlock(block);
    if (!event) {
      continue;
    }

    applyEventData(event, state);
  }
};

const readStreamResponse = async (response: Response): Promise<StreamState> => {
  const { body } = response;
  if (!body) {
    throw new Error(EMPTY_RESPONSE_BODY);
  }

  const state = createStreamState();
  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    buffer = consumeBuffer(buffer, state);
  }

  buffer += decoder.decode();
  consumeBuffer(buffer, state);

  return state;
};

// ── Execution ──────────────────────────────────────────────────────────

const executeSearch = async (config: SearchConfig, args: SearchArgs): Promise<string> => {
  const response = await fetch(resolveResponsesURL(config.baseURL), {
    body: JSON.stringify(buildRequestBody(config, args.query)),
    headers: buildDefaultHeaders(config.accountId, config.apiKey),
    method: "POST",
  });

  if (!response.ok) {
    return throwAPIError(response);
  }

  const streamState = await readStreamResponse(response);
  const structured = buildStructuredResponse(args.query, streamState.outputText, streamState.hits);

  return JSON.stringify(structured);
};

export { executeSearch, formatErrorMessage };
