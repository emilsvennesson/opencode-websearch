import OpenAI from "openai";

import { EMPTY_LENGTH } from "./search.js";
import { SearchConfig, SearchHit } from "../../types.js";

// ── Types ──────────────────────────────────────────────────────────────

type ResponseFunctionWebSearch = OpenAI.Responses.ResponseFunctionWebSearch;
type ResponseOutputItem = OpenAI.Responses.ResponseOutputItem;
type ResponseOutputMessage = OpenAI.Responses.ResponseOutputMessage;
type ResponseOutputText = OpenAI.Responses.ResponseOutputText;

// ── Client creation ────────────────────────────────────────────────────

const createOpenAICompatibleClient = (
  config: SearchConfig,
  defaultHeaders?: Record<string, string>,
): OpenAI => {
  const options: {
    apiKey: string;
    baseURL?: string;
    defaultHeaders?: Record<string, string>;
  } = {
    apiKey: config.apiKey,
  };

  if (config.baseURL) {
    options.baseURL = config.baseURL;
  }

  if (defaultHeaders) {
    options.defaultHeaders = defaultHeaders;
  }

  return new OpenAI(options);
};

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

// ── Search hit extraction ──────────────────────────────────────────────

const pushUniqueHit = (seen: Set<string>, hits: SearchHit[], title: string, url: string): void => {
  if (seen.has(url)) {
    return;
  }

  seen.add(url);
  hits.push({ title, url });
};

const appendAnnotationHits = (
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
      for (const annotation of outputText.annotations) {
        if (annotation.type !== "url_citation") {
          continue;
        }

        pushUniqueHit(seen, hits, annotation.title, annotation.url);
      }
    }
  }
};

const appendWebSearchSourceHits = (
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
      pushUniqueHit(seen, hits, source.url, source.url);
    }
  }
};

const collectUniqueAnnotationHits = (items: ResponseOutputItem[]): SearchHit[] => {
  const seen = new Set<string>();
  const hits: SearchHit[] = [];

  appendAnnotationHits(items, seen, hits);

  return hits;
};

const collectUniqueAnnotationAndSourceHits = (items: ResponseOutputItem[]): SearchHit[] => {
  const seen = new Set<string>();
  const hits: SearchHit[] = [];

  appendAnnotationHits(items, seen, hits);
  appendWebSearchSourceHits(items, seen, hits);

  return hits;
};

export {
  collectUniqueAnnotationAndSourceHits,
  collectUniqueAnnotationHits,
  createOpenAICompatibleClient,
  resolveOutputText,
};
