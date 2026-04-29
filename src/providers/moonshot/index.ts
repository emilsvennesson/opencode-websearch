import {
  EMPTY_LENGTH,
  SEARCH_SYSTEM_PROMPT,
  buildSearchInput,
  buildStructuredResponse,
} from "../shared/search.js";
import OpenAI, { APIError } from "openai";

import { SearchConfig } from "../../types.js";
import { formatUnhandledSearchError } from "../shared/errors.js";
import {
  collectUniqueChatCompletionAnnotationHits,
  createOpenAICompatibleClient,
  resolveChatCompletionOutputText,
} from "../shared/openai-compatible.js";

// ── Types ──────────────────────────────────────────────────────────────

interface MoonshotBuiltinFunctionTool {
  function: { name: string };
  type: "builtin_function";
}

interface MoonshotChatCompletionRequest {
  messages: OpenAI.ChatCompletionMessageParam[];
  model: string;
  thinking: { type: "disabled" };
  tool_choice: "auto";
  tools: MoonshotBuiltinFunctionTool[];
}

interface MoonshotFunctionToolCall {
  arguments: string;
  id: string;
  name: string;
}

interface MoonshotToolCallLike {
  function?: {
    arguments?: string;
    name?: string;
  };
  id?: string;
}

// ── Constants ──────────────────────────────────────────────────────────

const INITIAL_TURN = 0;
const MAX_SEARCH_TURNS = 8;
const TURN_INCREMENT = 1;
const TOOL_CALL_FINISH_REASON = "tool_calls";
const TOOL_ROLE = "tool";
const USER_ROLE = "user";
const WEB_SEARCH_FUNCTION_NAME = "$web_search";
const WEB_SEARCH_TOOL: MoonshotBuiltinFunctionTool = {
  function: { name: WEB_SEARCH_FUNCTION_NAME },
  type: "builtin_function",
};

// ── Error formatting ───────────────────────────────────────────────────

const formatErrorMessage = (error: unknown): string => {
  if (error instanceof APIError) {
    return `Moonshot API error: ${error.message} (status: ${error.status})`;
  }

  return formatUnhandledSearchError(error);
};

// ── Request helpers ────────────────────────────────────────────────────

const buildMessages = (query: string): OpenAI.ChatCompletionMessageParam[] => [
  {
    content: SEARCH_SYSTEM_PROMPT,
    role: "system",
  },
  {
    content: buildSearchInput(query),
    role: USER_ROLE,
  },
];

const buildRequestBody = (
  model: string,
  messages: OpenAI.ChatCompletionMessageParam[],
): MoonshotChatCompletionRequest => ({
  messages,
  model,
  thinking: { type: "disabled" },
  tool_choice: "auto",
  tools: [WEB_SEARCH_TOOL],
});

const createCompletion = async (
  client: OpenAI,
  model: string,
  messages: OpenAI.ChatCompletionMessageParam[],
): Promise<OpenAI.ChatCompletion> =>
  client.post<OpenAI.ChatCompletion>("/chat/completions", {
    body: buildRequestBody(model, messages),
  });

const toMoonshotFunctionToolCall = (
  toolCall: OpenAI.ChatCompletionMessageToolCall,
): MoonshotFunctionToolCall | null => {
  const candidate = toolCall as unknown as MoonshotToolCallLike;
  if (typeof candidate.id !== "string") {
    return null;
  }

  if (!candidate.function) {
    return null;
  }

  const { arguments: callArguments, name } = candidate.function;
  if (typeof callArguments !== "string") {
    return null;
  }

  if (typeof name !== "string") {
    return null;
  }

  return {
    arguments: callArguments,
    id: candidate.id,
    name,
  };
};

const extractFunctionToolCalls = (
  message: OpenAI.ChatCompletionMessage,
): MoonshotFunctionToolCall[] => {
  if (!message.tool_calls) {
    return [];
  }

  const toolCalls: MoonshotFunctionToolCall[] = [];
  for (const toolCall of message.tool_calls) {
    const parsed = toMoonshotFunctionToolCall(toolCall);
    if (!parsed) {
      continue;
    }

    toolCalls.push(parsed);
  }

  return toolCalls;
};

const appendAssistantToolCallMessage = (
  messages: OpenAI.ChatCompletionMessageParam[],
  message: OpenAI.ChatCompletionMessage,
): void => {
  messages.push({
    content: message.content,
    role: "assistant",
    tool_calls: message.tool_calls,
  });
};

const parseToolArguments = (toolCall: MoonshotFunctionToolCall): unknown => {
  try {
    return JSON.parse(toolCall.arguments) as unknown;
  } catch {
    return { error: "Invalid tool arguments JSON" };
  }
};

const resolveToolResult = (toolCall: MoonshotFunctionToolCall): unknown => {
  if (toolCall.name !== WEB_SEARCH_FUNCTION_NAME) {
    return `Error: unable to find tool by name '${toolCall.name}'`;
  }

  return parseToolArguments(toolCall);
};

const appendToolResultMessage = (
  messages: OpenAI.ChatCompletionMessageParam[],
  toolCall: MoonshotFunctionToolCall,
): void => {
  const content = JSON.stringify(resolveToolResult(toolCall));
  messages.push({
    content,
    name: toolCall.name,
    role: TOOL_ROLE,
    tool_call_id: toolCall.id,
  } as unknown as OpenAI.ChatCompletionMessageParam);
};

// ── Client and execution ───────────────────────────────────────────────

const buildEmptyResponse = (query: string): string =>
  JSON.stringify(buildStructuredResponse(query, "", []));

const buildFinalResponse = (query: string, message: OpenAI.ChatCompletionMessage): string => {
  const hits = collectUniqueChatCompletionAnnotationHits(message);
  const outputText = resolveChatCompletionOutputText(message);
  const structured = buildStructuredResponse(query, outputText, hits);

  return JSON.stringify(structured);
};

const buildMaxTurnsResponse = (query: string): string => {
  const errorText = `Error: Moonshot web search exceeded the maximum of ${MAX_SEARCH_TURNS} tool-call turns without producing a final answer.`;

  return JSON.stringify(buildStructuredResponse(query, errorText, []));
};

const runSearchLoop = async (
  client: OpenAI,
  model: string,
  messages: OpenAI.ChatCompletionMessageParam[],
  query: string,
): Promise<string> => {
  for (let turn = INITIAL_TURN; turn < MAX_SEARCH_TURNS; turn += TURN_INCREMENT) {
    // oxlint-disable-next-line no-await-in-loop -- each turn depends on the previous response
    const completion = await createCompletion(client, model, messages);
    const [choice] = completion.choices;
    if (!choice) {
      return buildEmptyResponse(query);
    }

    const toolCalls = extractFunctionToolCalls(choice.message);
    if (choice.finish_reason !== TOOL_CALL_FINISH_REASON || toolCalls.length === EMPTY_LENGTH) {
      return buildFinalResponse(query, choice.message);
    }

    appendAssistantToolCallMessage(messages, choice.message);
    for (const toolCall of toolCalls) {
      appendToolResultMessage(messages, toolCall);
    }
  }

  return buildMaxTurnsResponse(query);
};

const executeSearch = async (config: SearchConfig, query: string): Promise<string> => {
  const client = createOpenAICompatibleClient(config);
  const messages = buildMessages(query);

  return runSearchLoop(client, config.model, messages, query);
};

export { executeSearch, formatErrorMessage };
