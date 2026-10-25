import { WebSearch } from "@opencode/plugin";

// ── Types ──────────────────────────────────────────────────────────────

interface MutableResult {
  content?: string;
  time: { published?: number };
  title?: string;
  url: string;
}

// ── Constants ──────────────────────────────────────────────────────────

const EMPTY_LENGTH = 0;
const INVALID_RESPONSE = "The search model did not return the expected JSON results.";
const JSON_END_OFFSET = 1;
const MAX_RESPONSE_TOKENS = 16_000;
const NOT_FOUND = -1;
const WEB_PROTOCOLS = new Set(["http:", "https:"]);

const SEARCH_RESULTS_SCHEMA_NAME = "web_search_results";

const SEARCH_SYSTEM_PROMPT = `You are the web search backend for a coding agent. Use your web search tool to research the user's query, then report what you found.

Respond with only a JSON object, with no Markdown code fences and no other text, in exactly this shape:
{"results":[{"url":"https://example.com/page","title":"Page title","content":"Detailed findings from this page.","time":{"published":"2026-01-31"}}]}

For each result:
- "url": the exact URL of a page your web search returned. Never invent or guess URLs.
- "title": the page's title.
- "content": a self-contained, detailed summary of everything on the page that is relevant to the query. Include specific facts, figures, dates, version numbers, API names, code, commands, and short direct quotes where useful. The agent reads only this text, not the page itself.
- "time.published": the page's publication or last-updated date in ISO 8601 format when the page states it, otherwise null.

List results from most to least relevant. Include every relevant source you found and never repeat a URL. If nothing relevant was found, respond with {"results":[]}.`;

/** Strict JSON schema mirroring WebSearch.Result, with an ISO date instead of epoch milliseconds. */
const SEARCH_RESULTS_SCHEMA = {
  additionalProperties: false,
  properties: {
    results: {
      items: {
        additionalProperties: false,
        properties: {
          content: {
            description: "Detailed, self-contained findings from the page relevant to the query.",
            type: "string",
          },
          time: {
            additionalProperties: false,
            properties: {
              published: {
                description: "Publication or last-updated date in ISO 8601 format, or null.",
                type: ["string", "null"],
              },
            },
            required: ["published"],
            type: "object",
          },
          title: { description: "The page title.", type: "string" },
          url: { description: "The exact URL returned by web search.", type: "string" },
        },
        required: ["url", "title", "content", "time"],
        type: "object",
      },
      type: "array",
    },
  },
  required: ["results"],
  type: "object",
} satisfies Record<string, unknown>;

// ── Request helpers ────────────────────────────────────────────────────

const buildSearchInput = (query: string): string => `Search the web for: ${query}`;

// ── Response parsing ───────────────────────────────────────────────────

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > EMPTY_LENGTH ? value.trim() : undefined;

const isWebURL = (value: string): boolean => {
  try {
    return WEB_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
};

const parsePublished = (time: unknown): number | undefined => {
  const published = isRecord(time) ? time.published : undefined;
  const timestamp = typeof published === "string" ? Date.parse(published) : published;
  return typeof timestamp === "number" && Number.isFinite(timestamp) ? timestamp : undefined;
};

const toResult = (item: unknown): MutableResult | null => {
  if (!isRecord(item)) {
    return null;
  }

  const url = nonEmptyString(item.url);
  if (!url || !isWebURL(url)) {
    return null;
  }

  const result: MutableResult = { time: {}, url };
  const title = nonEmptyString(item.title);
  const content = nonEmptyString(item.content);
  const published = parsePublished(item.time);
  if (title) {
    result.title = title;
  }
  if (content) {
    result.content = content;
  }
  if (published !== undefined) {
    result.time.published = published;
  }
  return result;
};

const parseResultItems = (text: string): unknown[] => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === NOT_FOUND || end < start) {
    throw new Error(INVALID_RESPONSE);
  }

  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + JSON_END_OFFSET));
    if (isRecord(parsed) && Array.isArray(parsed.results)) {
      return parsed.results;
    }
  } catch (error) {
    throw new Error(INVALID_RESPONSE, { cause: error });
  }

  throw new Error(INVALID_RESPONSE);
};

/** Validate result-shaped items into native web search results, dropping invalid and duplicate URLs. */
const normalizeResults = (items: readonly unknown[]): readonly WebSearch.Result[] => {
  const results: WebSearch.Result[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const result = toResult(item);
    if (!result || seen.has(result.url)) {
      continue;
    }

    seen.add(result.url);
    results.push(result);
  }

  return results;
};

/** Parse a model's structured JSON response into native web search results. */
const parseSearchResults = (text: string): readonly WebSearch.Result[] =>
  normalizeResults(parseResultItems(text));

export {
  buildSearchInput,
  MAX_RESPONSE_TOKENS,
  normalizeResults,
  parseSearchResults,
  SEARCH_RESULTS_SCHEMA,
  SEARCH_RESULTS_SCHEMA_NAME,
  SEARCH_SYSTEM_PROMPT,
};
