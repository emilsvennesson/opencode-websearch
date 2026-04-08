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
  resolveModelOverrides,
} from "./config.js";
import { getCurrentMonthYear } from "./helpers.js";
import { resolveChatGPTCredentials } from "./providers/chatgpt/auth.js";
import { resolveCopilotCredentials } from "./providers/copilot/auth.js";
import { dispatchErrorMessage, dispatchSearch } from "./providers/index.js";
import {
  RESOLUTION_PRIORITY,
  detectProviderTypeFromNpm,
  detectProviderTypeFromProviderID,
} from "./providers/registry.js";

// ── Constants ──────────────────────────────────────────────────────────

const MIN_QUERY_LENGTH = 2;

// ── Provider detection ─────────────────────────────────────────────────

const detectUniformProviderType = (models: ProviderData["models"]): ProviderType | null => {
  let detectedType: ProviderType | null = null;

  for (const model of Object.values(models)) {
    const modelType = detectProviderTypeFromNpm(model.api.npm);
    if (!modelType) {
      continue;
    }

    if (!detectedType) {
      detectedType = modelType;
      continue;
    }

    if (detectedType !== modelType) {
      return null;
    }
  }

  return detectedType;
};

const detectProviderTypeFromProviderModels = (
  models: ProviderData["models"],
  activeModelID: string,
): ProviderType | null => {
  for (const model of Object.values(models)) {
    if (model.id !== activeModelID) {
      continue;
    }

    const modelType = detectProviderTypeFromNpm(model.api.npm);
    if (modelType) {
      return modelType;
    }
  }

  return detectUniformProviderType(models);
};

const detectTypeFromActiveProvider = (
  active: ActiveModel,
  providers: ProviderData[],
): ProviderType | null => {
  for (const provider of providers) {
    if (provider.id !== active.providerID) {
      continue;
    }

    const modelsType = detectProviderTypeFromProviderModels(provider.models, active.modelID);
    if (modelsType) {
      return modelsType;
    }

    const providerType = detectProviderTypeFromProviderID(provider.id);
    if (providerType) {
      return providerType;
    }
  }

  return null;
};

const detectTypeFromAnyModelMatch = (
  activeModelID: string,
  providers: ProviderData[],
): ProviderType | null => {
  for (const provider of providers) {
    for (const model of Object.values(provider.models)) {
      if (model.id !== activeModelID) {
        continue;
      }

      const modelType = detectProviderTypeFromNpm(model.api.npm);
      if (modelType) {
        return modelType;
      }
    }
  }

  return null;
};

const detectActiveProviderType = (
  active: ActiveModel | undefined,
  providers: ProviderData[],
): ProviderType | null => {
  if (!active) {
    return null;
  }

  const activeProviderType = detectTypeFromActiveProvider(active, providers);
  if (activeProviderType) {
    return activeProviderType;
  }

  const modelMatchType = detectTypeFromAnyModelMatch(active.modelID, providers);
  if (modelMatchType) {
    return modelMatchType;
  }

  return detectProviderTypeFromProviderID(active.providerID);
};

// ── Model resolution ───────────────────────────────────────────────────

interface ResolvedProvider {
  config: SearchConfig;
  providerType: ProviderType;
}

const buildSearchConfig = (resolution: ProviderResolution, modelID: string): SearchConfig => ({
  accountId: resolution.credentials.accountId,
  apiKey: resolution.credentials.apiKey,
  baseURL: resolution.credentials.baseURL,
  model: modelID,
});

const resolveModelByPriority = (
  resolutions: ProviderResolutionMap,
  modelKey: "fallbackModel" | "lockedModel",
): ResolvedProvider | null => {
  for (const providerType of RESOLUTION_PRIORITY) {
    const resolution = resolutions[providerType];
    if (!resolution) {
      continue;
    }

    const modelID = resolution[modelKey];
    if (!modelID) {
      continue;
    }

    return {
      config: buildSearchConfig(resolution, modelID),
      providerType,
    };
  }

  return null;
};

/**
 * Resolve the locked model for a given provider resolution.
 * Returns a ResolvedProvider if a locked model is set, otherwise null.
 */
const resolveLockedModel = (resolutions: ProviderResolutionMap): ResolvedProvider | null =>
  resolveModelByPriority(resolutions, "lockedModel");

/**
 * Resolve using the active model's provider directly.
 */
const resolveActiveModel = (
  activeType: ProviderType,
  active: ActiveModel,
  resolutions: ProviderResolutionMap,
): ResolvedProvider | null => {
  if (activeType === "openai" && resolutions.chatgpt) {
    return {
      config: buildSearchConfig(resolutions.chatgpt, active.modelID),
      providerType: "chatgpt",
    };
  }

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
const resolveFallbackModel = (resolutions: ProviderResolutionMap): ResolvedProvider | null =>
  resolveModelByPriority(resolutions, "fallbackModel");

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

const resolveProviderState = async (
  client: {
    config: { providers: () => Promise<{ data?: { providers: unknown[] } }> };
    path: {
      get: (options?: { query?: { directory?: string } }) => Promise<{ data?: { state?: string } }>;
    };
  },
  directory: string,
): Promise<ProviderState> => {
  const { data } = await client.config.providers();
  if (!data) {
    return { list: [], resolutions: {} };
  }

  const list = data.providers as ProviderData[];
  const resolutions = resolveFromProviders(list);

  const chatgptCredentials = await resolveChatGPTCredentials(client, directory);
  if (chatgptCredentials) {
    const modelOverrides = resolveModelOverrides(list, "chatgpt");
    resolutions.chatgpt = {
      credentials: {
        accountId: chatgptCredentials.accountId,
        apiKey: chatgptCredentials.apiKey,
        baseURL: chatgptCredentials.baseURL,
      },
      fallbackModel: modelOverrides.fallbackModel,
      lockedModel: modelOverrides.lockedModel,
      providerType: "chatgpt",
    };
  }

  const copilotCredentials = await resolveCopilotCredentials(client, directory);
  if (copilotCredentials) {
    const modelOverrides = resolveModelOverrides(list, "copilot");
    resolutions.copilot = {
      credentials: copilotCredentials,
      fallbackModel: modelOverrides.fallbackModel,
      lockedModel: modelOverrides.lockedModel,
      providerType: "copilot",
    };
  }

  return { list, resolutions };
};

const hasAnyProvider = (resolutions: ProviderResolutionMap): boolean => {
  if (resolutions.anthropic) {
    return true;
  }

  if (resolutions.chatgpt) {
    return true;
  }

  if (resolutions.openai) {
    return true;
  }

  if (resolutions.copilot) {
    return true;
  }

  return false;
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
IMPORTANT - Use the correct year in search queries:
  - It is currently ${getCurrentMonthYear()}. You MUST use this when searching for recent information, documentation, or current events.
  - Example: If the user asks for "latest React docs", search for "React documentation" with the current year, NOT last year`,

        async execute(args, context) {
          if (!state) {
            state = await resolveProviderState(input.client, input.directory);
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
            return await dispatchSearch(resolved.providerType, resolved.config, args.query);
          } catch (error) {
            return dispatchErrorMessage(resolved.providerType, error);
          }
        },
      }),
    },
  };
}) satisfies Plugin;
