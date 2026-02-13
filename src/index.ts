import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { tool } from "@opencode-ai/plugin";
// oxlint-disable-next-line sort-imports -- default+named import cannot precede named-only imports
import Anthropic, { APIError } from "@anthropic-ai/sdk";
// oxlint-disable-next-line no-duplicate-imports -- type import must be separate (verbatimModuleSyntax)
import type { Plugin } from "@opencode-ai/plugin";

// ── Types ──────────────────────────────────────────────────────────────

interface AnthropicConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
}

interface OpenCodeProvider {
  models?: Record<string, { name?: string }>;
  npm?: string;
  options?: {
    apiKey?: string;
    baseURL?: string;
  };
}

interface OpenCodeConfig {
  provider?: Record<string, OpenCodeProvider>;
}

interface ConfigResult {
  config: AnthropicConfig | null;
  error?: string;
}

interface WebSearchResult {
  page_age?: string;
  title: string;
  type: "web_search_result";
  url: string;
}

interface WebSearchToolResult {
  content:
    | WebSearchResult[]
    | { error_code: string; type: "web_search_tool_result_error" };
  tool_use_id: string;
  type: "web_search_tool_result";
}

interface ServerToolUse {
  id: string;
  input: { query: string };
  name: string;
  type: "server_tool_use";
}

interface SearchUsage {
  input_tokens: number;
  output_tokens: number;
  server_tool_use?: { web_search_requests?: number };
}

interface ProviderContext {
  configPath: string;
  errors: string[];
  providerName: string;
}

type ContentBlock =
  | { text: string; type: "text" }
  | ServerToolUse
  | WebSearchToolResult;

// ── Constants ──────────────────────────────────────────────────────────

const DEFAULT_MODEL = "claude-sonnet-4-5";
const MONTH_OFFSET = 1;
const PAD_LENGTH = 2;
const ENV_VAR_CAPTURE_GROUP = 1;
const FIRST_MODEL_INDEX = 0;
const EMPTY_LENGTH = 0;
const MIN_QUERY_LENGTH = 2;
const MIN_SEARCH_USES = 1;
const MAX_SEARCH_USES = 10;
const DEFAULT_SEARCH_USES = 5;
const MAX_RESPONSE_TOKENS = 16_000;

// ── Helpers ────────────────────────────────────────────────────────────

const getTodayDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + MONTH_OFFSET).padStart(PAD_LENGTH, "0");
  const day = String(now.getDate()).padStart(PAD_LENGTH, "0");
  return `${year}-${month}-${day}`;
};

const resolveEnvVar = (value: string): string => {
  const match = value.match(/^\{env:(\w+)\}$/);
  if (match?.[ENV_VAR_CAPTURE_GROUP]) {
    return process.env[match[ENV_VAR_CAPTURE_GROUP]] ?? "";
  }
  return value;
};

const normalizeBaseURL = (url: string): string =>
  url.replace(/\/v1\/?$/, "");

// ── Config resolution ──────────────────────────────────────────────────

const CONFIG_PATHS = [
  join(process.cwd(), "opencode.json"),
  join(process.cwd(), ".opencode", "opencode.json"),
  join(homedir(), ".config", "opencode", "opencode.json"),
];

const parseConfigFile = (configPath: string): OpenCodeConfig | string => {
  try {
    return JSON.parse(readFileSync(configPath, "utf8")) as OpenCodeConfig;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return `Failed to parse ${configPath}: ${error.message}`;
    }
    return `Failed to parse ${configPath}: ${String(error)}`;
  }
};

const resolveProviderApiKey = (
  ctx: ProviderContext,
  rawApiKey: string,
): string | undefined => {
  const apiKey = resolveEnvVar(rawApiKey);
  if (apiKey) {
    return apiKey;
  }

  const envMatch = rawApiKey.match(/^\{env:(\w+)\}$/);
  if (envMatch) {
    ctx.errors.push(
      `${ctx.configPath}: Environment variable ${envMatch[ENV_VAR_CAPTURE_GROUP]} is not set`,
    );
  } else {
    ctx.errors.push(
      `${ctx.configPath}: Provider "${ctx.providerName}" has empty apiKey`,
    );
  }
  return undefined;
};

const resolveModelName = (provider: OpenCodeProvider): string => {
  if (!provider.models) {
    return DEFAULT_MODEL;
  }
  const models = Object.keys(provider.models);
  return models[FIRST_MODEL_INDEX] ?? DEFAULT_MODEL;
};

const resolveBaseURL = (provider: OpenCodeProvider): string | undefined => {
  if (!provider.options?.baseURL) {
    return undefined;
  }
  return normalizeBaseURL(resolveEnvVar(provider.options.baseURL));
};

const resolveProviderConfig = (
  ctx: ProviderContext,
  provider: OpenCodeProvider,
): AnthropicConfig | undefined => {
  if (provider.npm !== "@ai-sdk/anthropic") {
    return undefined;
  }

  if (!provider.options?.apiKey) {
    ctx.errors.push(
      `${ctx.configPath}: Provider "${ctx.providerName}" has no apiKey configured`,
    );
    return undefined;
  }

  const apiKey = resolveProviderApiKey(ctx, provider.options.apiKey);
  if (!apiKey) {
    return undefined;
  }

  return {
    apiKey,
    baseURL: resolveBaseURL(provider),
    model: resolveModelName(provider),
  };
};

const scanProviders = (
  configPath: string,
  providers: Record<string, OpenCodeProvider>,
  errors: string[],
): AnthropicConfig | undefined => {
  for (const [providerName, provider] of Object.entries(providers)) {
    const ctx: ProviderContext = { configPath, errors, providerName };
    const resolved = resolveProviderConfig(ctx, provider);
    if (resolved) {
      return resolved;
    }
  }
  return undefined;
};

const scanConfigFile = (
  configPath: string,
  errors: string[],
): AnthropicConfig | undefined => {
  if (!existsSync(configPath)) {
    return undefined;
  }

  const parsed = parseConfigFile(configPath);
  if (typeof parsed === "string") {
    errors.push(parsed);
    return undefined;
  }

  if (!parsed.provider) {
    errors.push(`${configPath}: No "provider" field found`);
    return undefined;
  }

  return scanProviders(configPath, parsed.provider, errors);
};

const scanAllConfigFiles = (errors: string[]): AnthropicConfig | undefined => {
  for (const configPath of CONFIG_PATHS) {
    const resolved = scanConfigFile(configPath, errors);
    if (resolved) {
      return resolved;
    }
  }
  return undefined;
};

const getEnvFallback = (): ConfigResult | undefined => {
  const envApiKey = process.env.ANTHROPIC_API_KEY;
  if (envApiKey) {
    return {
      config: {
        apiKey: envApiKey,
        model: DEFAULT_MODEL,
      },
    };
  }
  return undefined;
};

/**
 * Resolve Anthropic configuration from multiple sources:
 * 1. opencode.json config files (project-level, then global)
 * 2. ANTHROPIC_API_KEY environment variable (fallback)
 */
const getAnthropicConfig = (): ConfigResult => {
  const errors: string[] = [];

  const fromConfig = scanAllConfigFiles(errors);
  if (fromConfig) {
    return { config: fromConfig };
  }

  const fromEnv = getEnvFallback();
  if (fromEnv) {
    return fromEnv;
  }

  if (errors.length > EMPTY_LENGTH) {
    return { config: null, error: errors.join("\n") };
  }
  return { config: null };
};

// ── Response formatting ────────────────────────────────────────────────

const formatSearchResult = (result: WebSearchResult): string => {
  if (result.page_age) {
    return `- [${result.title}](${result.url}) (Updated: ${result.page_age})`;
  }
  return `- [${result.title}](${result.url})`;
};

const processSearchToolResult = (
  block: WebSearchToolResult,
  results: string[],
): void => {
  if (Array.isArray(block.content)) {
    const searchResults = block.content as WebSearchResult[];
    if (searchResults.length === EMPTY_LENGTH) {
      results.push("No results found.");
    } else {
      results.push(`\nFound ${searchResults.length} results:\n`);
      for (const result of searchResults) {
        results.push(formatSearchResult(result));
      }
    }
  } else if (block.content?.type === "web_search_tool_result_error") {
    results.push(`Search error: ${block.content.error_code}`);
  }
};

const processBlock = (block: ContentBlock, results: string[]): void => {
  if (block.type === "server_tool_use" && block.name === "web_search") {
    results.push(`Search query: "${block.input.query}"`);
    return;
  }

  if (block.type === "web_search_tool_result") {
    processSearchToolResult(block, results);
    return;
  }

  if (block.type === "text" && block.text) {
    results.push(`\n${block.text}`);
  }
};

const buildWebSearchTool = (args: {
  allowed_domains?: string[];
  blocked_domains?: string[];
  max_uses?: number;
}): Record<string, unknown> => {
  const searchTool: Record<string, unknown> = {
    max_uses: args.max_uses ?? DEFAULT_SEARCH_USES,
    name: "web_search",
    type: "web_search_20250305",
  };

  if (args.allowed_domains?.length) {
    searchTool.allowed_domains = args.allowed_domains;
  }
  if (args.blocked_domains?.length) {
    searchTool.blocked_domains = args.blocked_domains;
  }

  return searchTool;
};

const formatConfigError = (error?: string): string => {
  let hint = "";
  if (error) {
    hint = `\n\n${error}`;
  }

  return `Error: web-search requires an Anthropic API key.

Set the ANTHROPIC_API_KEY environment variable, or add an Anthropic provider to your opencode.json:

{
  "provider": {
    "anthropic": {
      "npm": "@ai-sdk/anthropic",
      "options": {
        "apiKey": "{env:ANTHROPIC_API_KEY}"
      },
      "models": {
        "claude-sonnet-4-5": { "name": "Claude Sonnet 4.5" }
      }
    }
  }
}${hint}`;
};

const formatErrorMessage = (error: unknown): string => {
  if (error instanceof APIError) {
    return `Anthropic API error: ${error.message} (status: ${error.status})`;
  }
  if (error instanceof Error) {
    return `Error performing web search: ${error.message}`;
  }
  return `Error performing web search: ${String(error)}`;
};

const createAnthropicClient = (config: AnthropicConfig): Anthropic => {
  const options: { apiKey: string; baseURL?: string } = {
    apiKey: config.apiKey,
  };
  if (config.baseURL) {
    options.baseURL = config.baseURL;
  }
  return new Anthropic(options);
};

const appendUsageInfo = (
  usage: SearchUsage,
  results: string[],
): void => {
  if (usage.server_tool_use?.web_search_requests) {
    results.push(
      `\n---\nSearches performed: ${usage.server_tool_use.web_search_requests}`,
    );
  }
};

const executeSearch = async (
  config: AnthropicConfig,
  args: {
    allowed_domains?: string[];
    blocked_domains?: string[];
    max_uses?: number;
    query: string;
  },
): Promise<string> => {
  const client = createAnthropicClient(config);
  const webSearchTool = buildWebSearchTool(args);

  const response = await client.messages.create({
    max_tokens: MAX_RESPONSE_TOKENS,
    messages: [
      {
        content: `Perform a web search for: ${args.query}`,
        role: "user",
      },
    ],
    model: config.model,
    tools: [webSearchTool as unknown as Anthropic.Tool],
  });

  const results: string[] = [];
  const content = response.content as ContentBlock[];

  for (const block of content) {
    processBlock(block, results);
  }

  appendUsageInfo(response.usage as SearchUsage, results);

  return results.join("\n") || "No results returned from web search.";
};

// ── Plugin ─────────────────────────────────────────────────────────────

// eslint-disable-next-line import/no-default-export
export default (async () => ({
  tool: {
    "web-search": tool({
      args: {
        allowed_domains: tool.schema
          .array(tool.schema.string())
          .optional()
          .describe("Only include results from these domains"),
        blocked_domains: tool.schema
          .array(tool.schema.string())
          .optional()
          .describe("Exclude results from these domains"),
        max_uses: tool.schema
          .number()
          .min(MIN_SEARCH_USES)
          .max(MAX_SEARCH_USES)
          .optional()
          .describe("Maximum number of searches to perform (default: 5)"),
        query: tool.schema
          .string()
          .min(MIN_QUERY_LENGTH)
          .describe("The search query to execute"),
      },
      description: `Search the web using Anthropic's server-side web_search API.

- Provides up-to-date information for current events and recent data
- Returns search results with links as markdown hyperlinks
- Use this for accessing information beyond the knowledge cutoff

CRITICAL: After answering, you MUST include a "Sources:" section with URLs as markdown hyperlinks.

Today's date: ${getTodayDate()}. Use the current year when searching for recent information.`,

      async execute(args) {
        const { config, error } = getAnthropicConfig();

        if (!config) {
          return formatConfigError(error);
        }

        if (args.allowed_domains && args.blocked_domains) {
          return "Error: Cannot specify both allowed_domains and blocked_domains.";
        }

        try {
          return await executeSearch(config, args);
        } catch (error) {
          return formatErrorMessage(error);
        }
      },
    }),
  },
})) satisfies Plugin;
