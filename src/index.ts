import { ANTHROPIC_NPM_PACKAGE, MIN_QUERY_LENGTH, OPENAI_NPM_PACKAGE } from "./constants.js";
import {
  ActiveModel,
  ProviderResolution,
  ProviderResolutionMap,
  ProviderType,
  SearchConfig,
} from "./types.js";
import { Plugin, tool } from "@opencode-ai/plugin";
import {
  ProviderData,
  formatNoProviderError,
  formatUnsupportedProviderError,
  resolveFromProviders,
} from "./config.js";
import {
  executeSearch as executeAnthropicSearch,
  formatErrorMessage as formatAnthropicError,
} from "./providers/anthropic.js";
import {
  executeSearch as executeOpenAISearch,
  formatErrorMessage as formatOpenAIError,
} from "./providers/openai.js";

import { getCurrentMonthYear } from "./helpers.js";

// ── Provider detection ─────────────────────────────────────────────────

const detectActiveProviderType = (
  active: ActiveModel | undefined,
  providers: ProviderData[],
): ProviderType | null => {
  if (!active) {
    return null;
  }

  for (const provider of providers) {
    for (const model of Object.values(provider.models)) {
      if (model.id !== active.modelID) {
        continue;
      }
      if (model.api.npm === ANTHROPIC_NPM_PACKAGE) {
        return "anthropic";
      }
      if (model.api.npm === OPENAI_NPM_PACKAGE) {
        return "openai";
      }
    }
  }

  return null;
};

// ── Model resolution ───────────────────────────────────────────────────

interface ResolvedProvider {
  config: SearchConfig;
  providerType: ProviderType;
}

const buildSearchConfig = (resolution: ProviderResolution, modelID: string): SearchConfig => ({
  apiKey: resolution.credentials.apiKey,
  baseURL: resolution.credentials.baseURL,
  model: modelID,
});

/**
 * Resolve the locked model for a given provider resolution.
 * Returns a ResolvedProvider if a locked model is set, otherwise null.
 */
const resolveLockedModel = (resolutions: ProviderResolutionMap): ResolvedProvider | null => {
  if (resolutions.anthropic?.lockedModel) {
    return {
      config: buildSearchConfig(resolutions.anthropic, resolutions.anthropic.lockedModel),
      providerType: "anthropic",
    };
  }
  if (resolutions.openai?.lockedModel) {
    return {
      config: buildSearchConfig(resolutions.openai, resolutions.openai.lockedModel),
      providerType: "openai",
    };
  }
  return null;
};

/**
 * Resolve using the active model's provider directly.
 */
const resolveActiveModel = (
  activeType: ProviderType,
  active: ActiveModel,
  resolutions: ProviderResolutionMap,
): ResolvedProvider | null => {
  const resolution = resolutions[activeType];
  if (!resolution) {
    return null;
  }

  return {
    config: buildSearchConfig(resolution, active.modelID),
    providerType: activeType,
  };
};

/**
 * Resolve a fallback model from any provider with `"websearch": "auto"`.
 */
const resolveFallbackModel = (resolutions: ProviderResolutionMap): ResolvedProvider | null => {
  if (resolutions.anthropic?.fallbackModel) {
    return {
      config: buildSearchConfig(resolutions.anthropic, resolutions.anthropic.fallbackModel),
      providerType: "anthropic",
    };
  }
  if (resolutions.openai?.fallbackModel) {
    return {
      config: buildSearchConfig(resolutions.openai, resolutions.openai.fallbackModel),
      providerType: "openai",
    };
  }
  return null;
};

/**
 * Determine which provider and model to use for a web search call.
 *
 * Priority:
 * 1. Locked model (`"websearch": "always"`) from any provider — always wins
 * 2. Active model if it belongs to a supported provider — use directly
 * 3. Fallback model (`"websearch": "auto"`) from any provider — when active is unsupported
 * 4. null — no usable provider/model found
 */
const resolveSearchProvider = (
  resolutions: ProviderResolutionMap,
  active: ActiveModel | undefined,
  activeType: ProviderType | null,
): ResolvedProvider | null => {
  const locked = resolveLockedModel(resolutions);
  if (locked) {
    return locked;
  }

  if (activeType && active) {
    const resolved = resolveActiveModel(activeType, active, resolutions);
    if (resolved) {
      return resolved;
    }
  }

  return resolveFallbackModel(resolutions);
};

// ── Lazy provider resolution ───────────────────────────────────────────

interface ProviderState {
  list: ProviderData[];
  resolutions: ProviderResolutionMap;
}

const resolveProviderState = async (client: {
  config: { providers: () => Promise<{ data?: { providers: unknown[] } }> };
}): Promise<ProviderState> => {
  const { data } = await client.config.providers();
  if (!data) {
    return { list: [], resolutions: {} };
  }
  const list = data.providers as ProviderData[];
  return { list, resolutions: resolveFromProviders(list) };
};

const hasAnyProvider = (resolutions: ProviderResolutionMap): boolean =>
  resolutions.anthropic !== undefined || resolutions.openai !== undefined;

// ── Search dispatch ────────────────────────────────────────────────────

const dispatchSearch = async (resolved: ResolvedProvider, query: string): Promise<string> => {
  const args = { query };
  if (resolved.providerType === "anthropic") {
    return executeAnthropicSearch(resolved.config, args);
  }
  return executeOpenAISearch(resolved.config, args);
};

const dispatchErrorMessage = (providerType: ProviderType, error: unknown): string => {
  if (providerType === "anthropic") {
    return formatAnthropicError(error);
  }
  return formatOpenAIError(error);
};

// ── Plugin ─────────────────────────────────────────────────────────────

// oxlint-disable-next-line import/no-default-export -- plugin entry point requires default export
export default (async (input) => {
  let state: ProviderState | null = null;
  const activeModels = new Map<string, ActiveModel>();

  return {
    "chat.message": async (hookInput) => {
      if (hookInput.model) {
        activeModels.set(hookInput.sessionID, {
          modelID: hookInput.model.modelID,
          providerID: hookInput.model.providerID,
        });
      }
    },

    tool: {
      "web-search": tool({
        args: {
          query: tool.schema.string().min(MIN_QUERY_LENGTH).describe("The search query to use"),
        },
        description: `- Allows OpenCode to search the web and use the results to inform responses
- Provides up-to-date information for current events and recent data
- Returns search result information formatted as search result blocks, including links as markdown hyperlinks
- Use this tool for accessing information beyond the model's knowledge cutoff
- Searches are performed automatically within a single API call

CRITICAL REQUIREMENT - You MUST follow this:
  - After answering the user's question, you MUST include a "Sources:" section at the end of your response
  - In the Sources section, list all relevant URLs from the search results as markdown hyperlinks: [Title](URL)
  - This is MANDATORY - never skip including sources in your response
  - Example format:

    [Your answer here]

    Sources:
    - [Source Title 1](https://example.com/1)
    - [Source Title 2](https://example.com/2)

Usage notes:
  - Supports Anthropic and OpenAI providers

IMPORTANT - Use the correct year in search queries:
  - It is currently ${getCurrentMonthYear()}. You MUST use this when searching for recent information, documentation, or current events.
  - Example: If the user asks for "latest React docs", search for "React documentation" with the current year, NOT last year`,

        async execute(args, context) {
          if (!state) {
            state = await resolveProviderState(input.client);
          }

          if (!hasAnyProvider(state.resolutions)) {
            return formatNoProviderError();
          }

          const active = activeModels.get(context.sessionID);
          const activeType = detectActiveProviderType(active, state.list);

          const resolved = resolveSearchProvider(state.resolutions, active, activeType);

          if (!resolved) {
            return formatUnsupportedProviderError(active?.modelID ?? "unknown");
          }

          try {
            return await dispatchSearch(resolved, args.query);
          } catch (error) {
            return dispatchErrorMessage(resolved.providerType, error);
          }
        },
      }),
    },
  };
}) satisfies Plugin;
