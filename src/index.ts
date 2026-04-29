import { ActiveModel, ProviderResolution, ProviderResolutionMap, ProviderType } from "./types.js";
import { Plugin, PluginInput, tool } from "@opencode-ai/plugin";
import {
  ProviderData,
  buildResolutionMap,
  formatNoProviderError,
  formatUnsupportedProviderError,
  scanProviders,
} from "./config.js";
import { RESOLUTION_PRIORITY, detectProviderType } from "./providers/registry.js";
import { dispatchErrorMessage, dispatchSearch } from "./providers/index.js";
import { getCurrentMonthYear } from "./helpers.js";
import { resolveChatGPTCredentials } from "./providers/chatgpt/auth.js";
import { resolveCopilotCredentials } from "./providers/copilot/auth.js";

// ── Constants ──────────────────────────────────────────────────────────

const MIN_QUERY_LENGTH = 2;
const NO_PROVIDERS = 0;

// ── Types ──────────────────────────────────────────────────────────────

interface PickedModel {
  modelID: string;
  resolution: ProviderResolution;
  type: ProviderType;
}

// ── Provider detection ─────────────────────────────────────────────────

/**
 * Resolve which adapter type to use for the active model. The user is on
 * the canonical OpenCode provider (e.g. `openai`), but if ChatGPT OAuth
 * is present we route OpenAI traffic through the ChatGPT adapter.
 */
const resolveActiveType = (
  active: ActiveModel | undefined,
  resolutions: ProviderResolutionMap,
): ProviderType | null => {
  if (!active) {
    return null;
  }

  const base = detectProviderType(active.providerID);

  return base === "openai" && resolutions.chatgpt ? "chatgpt" : base;
};

// ── Model resolution ───────────────────────────────────────────────────

/**
 * Walk providers in priority order looking for one that has the given
 * model key (`lockedModel` or `fallbackModel`) set.
 */
const findModelByKey = (
  resolutions: ProviderResolutionMap,
  key: "fallbackModel" | "lockedModel",
): PickedModel | null => {
  for (const type of RESOLUTION_PRIORITY) {
    const resolution = resolutions[type];
    const modelID = resolution?.[key];
    if (resolution && modelID) {
      return { modelID, resolution, type };
    }
  }

  return null;
};

/**
 * Pick the model and provider to use for a web search call.
 *
 * Priority:
 * 1. Locked model (`"websearch": "always"`) on any provider
 * 2. Active model if its provider is supported
 * 3. Fallback model (`"websearch": "auto"`) on any provider
 */
const pickModel = (
  resolutions: ProviderResolutionMap,
  active: ActiveModel | undefined,
  activeType: ProviderType | null,
): PickedModel | null => {
  const locked = findModelByKey(resolutions, "lockedModel");
  if (locked) {
    return locked;
  }

  if (active && activeType) {
    const resolution = resolutions[activeType];
    if (resolution) {
      return { modelID: active.modelID, resolution, type: activeType };
    }
  }

  return findModelByKey(resolutions, "fallbackModel");
};

// ── Resolution loading ─────────────────────────────────────────────────

const loadResolutions = async (
  client: PluginInput["client"],
  directory: string,
): Promise<ProviderResolutionMap> => {
  const { data } = await client.config.providers();
  if (!data) {
    return {};
  }

  const list = data.providers as ProviderData[];
  const scan = scanProviders(list);
  const resolutions = buildResolutionMap(scan);

  /*
   * ChatGPT OAuth supersedes the OpenAI provider unless the user has explicitly
   * pointed `openai` at a custom baseURL (e.g. a proxy).
   */
  const chatgpt = await resolveChatGPTCredentials(client, directory);
  const openaiBaseURL = resolutions.openai?.credentials.baseURL?.trim();
  if (chatgpt && !openaiBaseURL) {
    resolutions.chatgpt = {
      credentials: chatgpt,
      fallbackModel: scan.openai.fallbackModel,
      lockedModel: scan.openai.lockedModel,
    };
  }

  /*
   * Copilot credentials live in OpenCode's auth.json, not in opencode.json,
   * but websearch flags can still be set on the `github-copilot` provider.
   */
  const copilot = await resolveCopilotCredentials(client, directory);
  if (copilot) {
    resolutions.copilot = {
      credentials: copilot,
      fallbackModel: scan.copilot.fallbackModel,
      lockedModel: scan.copilot.lockedModel,
    };
  }

  return resolutions;
};

// ── Plugin ─────────────────────────────────────────────────────────────

// oxlint-disable-next-line import/no-default-export -- plugin entry point requires default export
export default (async (input) => {
  let resolutions: ProviderResolutionMap | null = null;
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
          resolutions ??= await loadResolutions(input.client, input.directory);

          const active = activeModels.get(context.sessionID);
          const activeType = resolveActiveType(active, resolutions);
          const picked = pickModel(resolutions, active, activeType);

          if (!picked) {
            return Object.keys(resolutions).length === NO_PROVIDERS
              ? formatNoProviderError()
              : formatUnsupportedProviderError(active?.modelID ?? "unknown");
          }

          try {
            return await dispatchSearch(
              picked.type,
              { ...picked.resolution.credentials, model: picked.modelID },
              args.query,
            );
          } catch (error) {
            return dispatchErrorMessage(picked.type, error);
          }
        },
      }),
    },
  };
}) satisfies Plugin;
