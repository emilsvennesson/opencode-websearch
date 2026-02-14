import { ANTHROPIC_NPM_PACKAGE, MIN_QUERY_LENGTH } from "./constants.js";
import { ActiveModel, ProviderResolution, SearchConfig } from "./types.js";
import { Plugin, tool } from "@opencode-ai/plugin";
import {
  ProviderData,
  formatNoProviderError,
  formatNonAnthropicError,
  resolveFromProviders,
} from "./config.js";
import { executeSearch, formatErrorMessage } from "./providers/anthropic.js";

import { getCurrentMonthYear } from "./helpers.js";

// ── Model resolution ───────────────────────────────────────────────────

/**
 * Determine the model to use for a web search call.
 *
 * Priority:
 * 1. Locked model (`"websearch": "always"`) — always wins
 * 2. Active model if it's Anthropic — use the model the user is chatting with
 * 3. Fallback model (`"websearch": "auto"`) — when the active model is non-Anthropic
 * 4. Error — active model is non-Anthropic and no fallback configured
 */
const resolveSearchModel = (
  resolution: ProviderResolution,
  active: ActiveModel | undefined,
): string | null => {
  if (resolution.lockedModel) {
    return resolution.lockedModel;
  }

  if (active) {
    return active.modelID;
  }

  if (resolution.fallbackModel) {
    return resolution.fallbackModel;
  }

  return null;
};

const isAnthropicActive = (active: ActiveModel | undefined, providers: ProviderData[]): boolean => {
  if (!active) {
    return false;
  }

  for (const provider of providers) {
    for (const model of Object.values(provider.models)) {
      if (model.id === active.modelID && model.api.npm === ANTHROPIC_NPM_PACKAGE) {
        return true;
      }
    }
  }

  return false;
};

// ── Lazy provider resolution ───────────────────────────────────────────

interface ProviderState {
  list: ProviderData[];
  resolution: ProviderResolution | null;
}

const resolveProviderState = async (client: {
  config: { providers: () => Promise<{ data?: { providers: unknown[] } }> };
}): Promise<ProviderState> => {
  const { data } = await client.config.providers();
  if (!data) {
    return { list: [], resolution: null };
  }
  const list = data.providers as ProviderData[];
  return { list, resolution: resolveFromProviders(list) };
};

// ── Search execution ───────────────────────────────────────────────────

const buildSearchConfig = (resolution: ProviderResolution, modelID: string): SearchConfig => ({
  apiKey: resolution.credentials.apiKey,
  baseURL: resolution.credentials.baseURL,
  model: modelID,
});

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
          allowed_domains: tool.schema
            .array(tool.schema.string())
            .optional()
            .describe("Only include search results from these domains"),
          blocked_domains: tool.schema
            .array(tool.schema.string())
            .optional()
            .describe("Never include search results from these domains"),
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
  - Domain filtering is supported to include or block specific websites

IMPORTANT - Use the correct year in search queries:
  - It is currently ${getCurrentMonthYear()}. You MUST use this when searching for recent information, documentation, or current events.
  - Example: If the user asks for "latest React docs", search for "React documentation" with the current year, NOT last year`,

        async execute(args, context) {
          if (!state) {
            state = await resolveProviderState(input.client);
          }

          if (!state.resolution) {
            return formatNoProviderError();
          }

          if (args.allowed_domains && args.blocked_domains) {
            return "Error: Cannot specify both allowed_domains and blocked_domains.";
          }

          const active = activeModels.get(context.sessionID);
          let effectiveActive: ActiveModel | undefined = undefined;
          if (isAnthropicActive(active, state.list)) {
            effectiveActive = active;
          }
          const modelID = resolveSearchModel(state.resolution, effectiveActive);

          if (!modelID) {
            return formatNonAnthropicError(active?.modelID ?? "unknown");
          }

          try {
            return await executeSearch(buildSearchConfig(state.resolution, modelID), args);
          } catch (error) {
            return formatErrorMessage(error);
          }
        },
      }),
    },
  };
}) satisfies Plugin;
