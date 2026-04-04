import { SearchHit, StructuredSearchResponse } from "../../types.js";

// ── Constants ──────────────────────────────────────────────────────────

const EMPTY_LENGTH = 0;
const MAX_RESPONSE_TOKENS = 16_000;
const SEARCH_INPUT_PREFIX = "Perform a web search for the query: ";
const SEARCH_SYSTEM_PROMPT = "You are an assistant for performing a web search tool use";

// ── Helpers ────────────────────────────────────────────────────────────

const buildSearchInput = (query: string): string => `${SEARCH_INPUT_PREFIX}${query}`;

const buildStructuredResponse = (
  query: string,
  outputText: string,
  hits: SearchHit[],
): StructuredSearchResponse => {
  const results: (SearchHit[] | string)[] = [];
  const trimmedOutputText = outputText.trim();

  if (trimmedOutputText.length > EMPTY_LENGTH) {
    results.push(trimmedOutputText);
  }

  if (hits.length > EMPTY_LENGTH) {
    results.push(hits);
  }

  return { query, results };
};

export {
  buildSearchInput,
  buildStructuredResponse,
  EMPTY_LENGTH,
  MAX_RESPONSE_TOKENS,
  SEARCH_SYSTEM_PROMPT,
};
