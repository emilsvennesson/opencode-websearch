import {
  AnthropicConfig,
  ConfigResult,
  OpenCodeConfig,
  OpenCodeProvider,
  ProviderContext,
} from "./types.js";
import {
  DEFAULT_MODEL,
  EMPTY_LENGTH,
  ENV_VAR_CAPTURE_GROUP,
  FIRST_MODEL_INDEX,
} from "./constants.js";
import { existsSync, readFileSync } from "node:fs";
import { normalizeBaseURL, resolveEnvVar } from "./helpers.js";
import { homedir } from "node:os";
import { join } from "node:path";

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

const resolveProviderApiKey = (ctx: ProviderContext, rawApiKey: string): string | undefined => {
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
    ctx.errors.push(`${ctx.configPath}: Provider "${ctx.providerName}" has empty apiKey`);
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
    ctx.errors.push(`${ctx.configPath}: Provider "${ctx.providerName}" has no apiKey configured`);
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

const scanConfigFile = (configPath: string, errors: string[]): AnthropicConfig | undefined => {
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

export { formatConfigError, getAnthropicConfig };
