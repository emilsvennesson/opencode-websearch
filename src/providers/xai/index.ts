import {
  EMPTY_LENGTH,
  MAX_RESPONSE_TOKENS,
  SEARCH_SYSTEM_PROMPT,
  buildSearchInput,
  buildStructuredResponse,
} from "../shared/search.js";
import OpenAI, { APIError } from "openai";
import { SearchConfig, SearchHit } from "../../types.js";
import {
  collectUniqueAnnotationHits,
  createOpenAICompatibleClient,
} from "../shared/openai-compatible.js";
import { formatUnhandledSearchError } from "../shared/errors.js";

// ── Types ──────────────────────────────────────────────────────────────

interface XAIResponseExtensions {
  citations?: unknown;
}

// ── Constants ──────────────────────────────────────────────────────────

const CITATION_NUMBER_PATTERN = /^\d+$/;
const XAI_DEFAULT_BASE_URL = "https://api.x.ai/v1";
const WEB_SEARCH_TOOL: OpenAI.Responses.WebSearchTool = { type: "web_search" };

// ── Citation handling ──────────────────────────────────────────────────

const titleFromURL = (url: string): string => {
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
};

const normalizeHit = (hit: SearchHit): SearchHit => {
  const title = hit.title.trim();
  if (title.length > EMPTY_LENGTH && !CITATION_NUMBER_PATTERN.test(title)) {
    return hit;
  }

  return { title: titleFromURL(hit.url), url: hit.url };
};

const mergeCitationHits = (annotationHits: SearchHit[], citations: unknown): SearchHit[] => {
  const hits = annotationHits.map(normalizeHit);
  if (!Array.isArray(citations)) {
    return hits;
  }

  const seen = new Set(hits.map((hit) => hit.url));
  for (const citation of citations) {
    if (typeof citation !== "string" || seen.has(citation)) {
      continue;
    }

    seen.add(citation);
    hits.push({ title: titleFromURL(citation), url: citation });
  }

  return hits;
};

const resolveCitations = (response: OpenAI.Responses.Response): unknown =>
  (response as OpenAI.Responses.Response & XAIResponseExtensions).citations;

// ── Error formatting ───────────────────────────────────────────────────

const formatErrorMessage = (error: unknown): string => {
  if (error instanceof APIError) {
    return `xAI API error: ${error.message} (status: ${error.status})`;
  }

  return formatUnhandledSearchError(error);
};

// ── Client and execution ───────────────────────────────────────────────

const executeSearch = async (config: SearchConfig, query: string): Promise<string> => {
  const client = createOpenAICompatibleClient({
    ...config,
    baseURL: config.baseURL ?? XAI_DEFAULT_BASE_URL,
  });

  const response = await client.responses.create({
    input: buildSearchInput(query),
    instructions: SEARCH_SYSTEM_PROMPT,
    max_output_tokens: MAX_RESPONSE_TOKENS,
    model: config.model,
    store: false,
    tools: [WEB_SEARCH_TOOL],
  });

  const annotationHits = collectUniqueAnnotationHits(response.output);
  const hits = mergeCitationHits(annotationHits, resolveCitations(response));
  const structured = buildStructuredResponse(query, response.output_text, hits);

  return JSON.stringify(structured);
};

export { executeSearch, formatErrorMessage, mergeCitationHits };
