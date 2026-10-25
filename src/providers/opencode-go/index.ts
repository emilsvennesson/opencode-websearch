import { WebSearch } from "@opencode/plugin";

import { executeSearch as executeAnthropicSearch } from "../anthropic/index.js";
import { executeSearch as executeOpenAISearch } from "../openai/index.js";
import { executeKimiSearch } from "./kimi.js";
import { parseSearchResults } from "../shared/search.js";
import { SearchConfig } from "../../types.js";

// ── Types ──────────────────────────────────────────────────────────────

interface GoRoute {
  baseURL: (modelBaseURL: string | undefined) => string;
  prefixes: readonly string[];
  search: (config: SearchConfig, query: string, signal: AbortSignal) => Promise<string>;
}

// ── Constants ──────────────────────────────────────────────────────────

const GO_ANTHROPIC_BASE_URL = "https://opencode.ai/inference/go/anthropic";
const GO_OPENAI_BASE_URL = "https://opencode.ai/inference/go/openai/v1";
const USER_AGENT = "opencode-websearch";

const stripV1Suffix = (url: string): string => url.replace(/\/v1\/?$/, "");

/**
 * Go serves each model on its own API family, and only some upstreams run
 * provider-side search. Other models accept the tool but silently ignore it.
 */
const GO_ROUTES: readonly GoRoute[] = [
  {
    baseURL: (url) => (url ? stripV1Suffix(url) : GO_ANTHROPIC_BASE_URL),
    prefixes: ["claude-"],
    search: executeAnthropicSearch,
  },
  {
    baseURL: (url) => url ?? GO_OPENAI_BASE_URL,
    prefixes: ["gpt-", "grok-"],
    search: executeOpenAISearch,
  },
  {
    baseURL: (url) => url ?? GO_OPENAI_BASE_URL,
    prefixes: ["kimi-"],
    search: executeKimiSearch,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────

const findRoute = (model: string): GoRoute | undefined =>
  GO_ROUTES.find((route) => route.prefixes.some((prefix) => model.startsWith(prefix)));

const formatUnsupportedModel = (model: string): string =>
  `${model} cannot search the web through OpenCode Go. Only Claude, GPT, Grok, and Kimi models support web search on Go. Set "websearch": "always" in the settings of one of them, for example gpt-6-luna.`;

// ── Execution ──────────────────────────────────────────────────────────

const executeSearch = async (
  config: SearchConfig,
  query: string,
  signal: AbortSignal,
): Promise<readonly WebSearch.Result[]> => {
  const route = findRoute(config.model);
  if (!route) {
    throw new Error(formatUnsupportedModel(config.model));
  }

  const goConfig: SearchConfig = {
    ...config,
    baseURL: route.baseURL(config.modelBaseURL),
    headers: {
      ...config.providerHeaders,
      "User-Agent": USER_AGENT,
      "x-opencode-session": crypto.randomUUID(),
    },
  };
  return parseSearchResults(await route.search(goConfig, query, signal));
};

export { executeSearch, findRoute };
