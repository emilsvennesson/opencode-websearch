import {
  COPILOT_INITIATOR,
  COPILOT_INTENT,
  COPILOT_USER_AGENT,
  EMPTY_LENGTH,
  MAX_RESPONSE_TOKENS,
  SEARCH_SYSTEM_PROMPT,
} from "../constants.js";
import OpenAI, { APIError } from "openai";
import { SearchArgs, SearchConfig, SearchHit, StructuredSearchResponse } from "../types.js";

// ── Copilot response types (OpenAI-compatible Responses API) ───────────

type ResponseFunctionWebSearch = OpenAI.Responses.ResponseFunctionWebSearch;
type ResponseOutputItem = OpenAI.Responses.ResponseOutputItem;
type ResponseOutputMessage = OpenAI.Responses.ResponseOutputMessage;
type ResponseOutputText = OpenAI.Responses.ResponseOutputText;

// ── Constants ──────────────────────────────────────────────────────────

const WEB_SEARCH_INCLUDE: OpenAI.Responses.ResponseIncludable[] = [
  "web_search_call.action.sources",
];
const WEB_SEARCH_TOOL: OpenAI.Responses.WebSearchTool = { type: "web_search" };

// ── Text extraction ────────────────────────────────────────────────────

const collectMessageTextParts = (items: ResponseOutputItem[]): string[] => {
  const textParts: string[] = [];

  for (const item of items) {
    if (item.type !== "message") {
      continue;
    }
    const message = item as ResponseOutputMessage;
    for (const part of message.content) {
      if (part.type !== "output_text") {
        continue;
      }
      const textPart = part as ResponseOutputText;
      const text = textPart.text.trim();
      if (text.length > EMPTY_LENGTH) {
        textParts.push(text);
      }
    }
  }

  return textParts;
};

const resolveOutputText = (outputText: string, items: ResponseOutputItem[]): string => {
  const directText = outputText.trim();
  if (directText.length > EMPTY_LENGTH) {
    return directText;
  }

  const textParts = collectMessageTextParts(items);
  if (textParts.length === EMPTY_LENGTH) {
    return "";
  }

  return textParts.join("\n\n");
};

// ── Source extraction ──────────────────────────────────────────────────

const pushUniqueHit = (seen: Set<string>, hits: SearchHit[], title: string, url: string): void => {
  if (seen.has(url)) {
    return;
  }

  seen.add(url);
  hits.push({ title, url });
};

const extractAnnotationHits = (
  annotations: ResponseOutputText["annotations"],
  seen: Set<string>,
  hits: SearchHit[],
): void => {
  for (const annotation of annotations) {
    if (annotation.type !== "url_citation") {
      continue;
    }
    pushUniqueHit(seen, hits, annotation.title, annotation.url);
  }
};

const collectAnnotationHits = (
  items: ResponseOutputItem[],
  seen: Set<string>,
  hits: SearchHit[],
): void => {
  for (const item of items) {
    if (item.type !== "message") {
      continue;
    }
    const message = item as ResponseOutputMessage;
    for (const part of message.content) {
      if (part.type !== "output_text") {
        continue;
      }
      const outputText = part as ResponseOutputText;
      if (outputText.annotations.length > EMPTY_LENGTH) {
        extractAnnotationHits(outputText.annotations, seen, hits);
      }
    }
  }
};

const collectWebSearchSourceHits = (
  items: ResponseOutputItem[],
  seen: Set<string>,
  hits: SearchHit[],
): void => {
  for (const item of items) {
    if (item.type !== "web_search_call") {
      continue;
    }

    const call = item as ResponseFunctionWebSearch;
    const { action } = call;
    if (action.type !== "search") {
      continue;
    }

    const { sources } = action;
    if (!sources || sources.length === EMPTY_LENGTH) {
      continue;
    }

    for (const source of sources) {
      const title = source.url;
      pushUniqueHit(seen, hits, title, source.url);
    }
  }
};

const collectSearchHits = (items: ResponseOutputItem[]): SearchHit[] => {
  const seen = new Set<string>();
  const hits: SearchHit[] = [];

  collectAnnotationHits(items, seen, hits);
  collectWebSearchSourceHits(items, seen, hits);

  return hits;
};

// ── Structured response ────────────────────────────────────────────────

const buildStructuredResponse = (
  query: string,
  outputText: string,
  items: ResponseOutputItem[],
): StructuredSearchResponse => {
  const results: (SearchHit[] | string)[] = [];

  const finalText = resolveOutputText(outputText, items);
  if (finalText.length > EMPTY_LENGTH) {
    results.push(finalText);
  }

  const hits = collectSearchHits(items);
  if (hits.length > EMPTY_LENGTH) {
    results.push(hits);
  }

  return { query, results };
};

// ── Error formatting ───────────────────────────────────────────────────

const formatErrorMessage = (error: unknown): string => {
  if (error instanceof APIError) {
    return `GitHub Copilot API error: ${error.message} (status: ${error.status})`;
  }
  if (error instanceof Error) {
    return `Error performing web search: ${error.message}`;
  }
  return `Error performing web search: ${String(error)}`;
};

// ── Client and execution ───────────────────────────────────────────────

const createCopilotClient = (config: SearchConfig): OpenAI => {
  const options: {
    apiKey: string;
    baseURL?: string;
    defaultHeaders: Record<string, string>;
  } = {
    apiKey: config.apiKey,
    defaultHeaders: {
      "Openai-Intent": COPILOT_INTENT,
      "User-Agent": COPILOT_USER_AGENT,
      "x-initiator": COPILOT_INITIATOR,
    },
  };

  if (config.baseURL) {
    options.baseURL = config.baseURL;
  }

  return new OpenAI(options);
};

const executeSearch = async (config: SearchConfig, args: SearchArgs): Promise<string> => {
  const client = createCopilotClient(config);

  const response = await client.responses.create({
    include: WEB_SEARCH_INCLUDE,
    input: `Perform a web search for the query: ${args.query}`,
    instructions: SEARCH_SYSTEM_PROMPT,
    max_output_tokens: MAX_RESPONSE_TOKENS,
    model: config.model,
    tool_choice: "auto",
    tools: [WEB_SEARCH_TOOL],
  });

  const structured = buildStructuredResponse(args.query, response.output_text, response.output);

  return JSON.stringify(structured);
};

export { executeSearch, formatErrorMessage };
