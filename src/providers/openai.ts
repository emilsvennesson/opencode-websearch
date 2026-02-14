import { EMPTY_LENGTH, MAX_RESPONSE_TOKENS, SEARCH_SYSTEM_PROMPT } from "../constants.js";
import OpenAI, { APIError } from "openai";
import { SearchArgs, SearchConfig, SearchHit, StructuredSearchResponse } from "../types.js";

// ── OpenAI response types (from public namespace) ───────────────────────

type ResponseOutputItem = OpenAI.Responses.ResponseOutputItem;
type ResponseOutputMessage = OpenAI.Responses.ResponseOutputMessage;
type ResponseOutputText = OpenAI.Responses.ResponseOutputText;

// ── Response processing ─────────────────────────────────────────────────

const extractCitations = (
  annotations: ResponseOutputText["annotations"],
  seen: Set<string>,
  hits: SearchHit[],
): void => {
  for (const annotation of annotations) {
    if (annotation.type !== "url_citation") {
      continue;
    }
    if (!seen.has(annotation.url)) {
      seen.add(annotation.url);
      hits.push({ title: annotation.title, url: annotation.url });
    }
  }
};

const collectCitations = (items: ResponseOutputItem[]): SearchHit[] => {
  const seen = new Set<string>();
  const hits: SearchHit[] = [];

  for (const item of items) {
    if (item.type !== "message") {
      continue;
    }
    const message = item as ResponseOutputMessage;
    for (const part of message.content) {
      if (part.type === "output_text" && part.annotations.length > EMPTY_LENGTH) {
        extractCitations(part.annotations, seen, hits);
      }
    }
  }

  return hits;
};

const buildStructuredResponse = (
  query: string,
  outputText: string,
  items: ResponseOutputItem[],
): StructuredSearchResponse => {
  const results: (SearchHit[] | string)[] = [];

  if (outputText.length > EMPTY_LENGTH) {
    results.push(outputText);
  }

  const citations = collectCitations(items);
  if (citations.length > EMPTY_LENGTH) {
    results.push(citations);
  }

  return { query, results };
};

// ── Error formatting ───────────────────────────────────────────────────

const formatErrorMessage = (error: unknown): string => {
  if (error instanceof APIError) {
    return `OpenAI API error: ${error.message} (status: ${error.status})`;
  }
  if (error instanceof Error) {
    return `Error performing web search: ${error.message}`;
  }
  return `Error performing web search: ${String(error)}`;
};

// ── Client and execution ───────────────────────────────────────────────

const createOpenAIClient = (config: SearchConfig): OpenAI => {
  const options: { apiKey: string; baseURL?: string } = {
    apiKey: config.apiKey,
  };
  if (config.baseURL) {
    options.baseURL = config.baseURL;
  }
  return new OpenAI(options);
};

const WEB_SEARCH_TOOL: OpenAI.Responses.WebSearchTool = { type: "web_search" };

const executeSearch = async (config: SearchConfig, args: SearchArgs): Promise<string> => {
  const client = createOpenAIClient(config);

  const response = await client.responses.create({
    input: `Perform a web search for the query: ${args.query}`,
    instructions: SEARCH_SYSTEM_PROMPT,
    max_output_tokens: MAX_RESPONSE_TOKENS,
    model: config.model,
    tools: [WEB_SEARCH_TOOL],
  });

  const structured = buildStructuredResponse(args.query, response.output_text, response.output);

  return JSON.stringify(structured);
};

export { executeSearch, formatErrorMessage };
