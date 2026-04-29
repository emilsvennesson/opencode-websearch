import { ActiveModel, ProviderResolution } from "./types.js";
import { Plugin, PluginInput, tool } from "@opencode-ai/plugin";
import {
  ProviderData,
  formatNoProviderError,
  formatUnsupportedProviderError,
  scanProviders,
} from "./config.js";
import { dispatchErrorMessage, dispatchSearch } from "./providers/index.js";
import { getCurrentMonthYear } from "./helpers.js";
import { resolveChatGPTCredentials } from "./providers/chatgpt/auth.js";
import { resolveCopilotCredentials } from "./providers/copilot/auth.js";

// ── Constants ──────────────────────────────────────────────────────────

const CANONICAL_COPILOT_ID = "github-copilot";
const CANONICAL_OPENAI_ID = "openai";
const MIN_QUERY_LENGTH = 2;
const NO_RESOLUTIONS = 0;

// ── Types ──────────────────────────────────────────────────────────────

interface PickedModel {
  modelID: string;
  resolution: ProviderResolution;
}

// ── Lookup ─────────────────────────────────────────────────────────────

const findActive = (
  active: ActiveModel,
  resolutions: ProviderResolution[],
): ProviderResolution | null =>
  resolutions.find((resolution) => resolution.providerID === active.providerID) ?? null;

const findFirstWithKey = (
  resolutions: ProviderResolution[],
  key: "fallbackModel" | "lockedModel",
): ProviderResolution | null => resolutions.find((resolution) => Boolean(resolution[key])) ?? null;

/**
 * Pick the (model, resolution) pair to use for a web search call.
 *
 * Priority:
 * 1. Locked model (`"websearch": "always"`) on any provider
 * 2. Active model if its provider is in the resolution list
 * 3. Fallback model (`"websearch": "auto"`) on any provider
 *
 * Within a tier, providers are walked in OpenCode config insertion order.
 */
const pickModel = (
  resolutions: ProviderResolution[],
  active: ActiveModel | undefined,
): PickedModel | null => {
  const locked = findFirstWithKey(resolutions, "lockedModel");
  if (locked?.lockedModel) {
    return { modelID: locked.lockedModel, resolution: locked };
  }

  if (active) {
    const direct = findActive(active, resolutions);
    if (direct) {
      return { modelID: active.modelID, resolution: direct };
    }
  }

  const fallback = findFirstWithKey(resolutions, "fallbackModel");
  if (fallback?.fallbackModel) {
    return { modelID: fallback.fallbackModel, resolution: fallback };
  }

  return null;
};

// ── Resolution loading ─────────────────────────────────────────────────

const loadResolutions = async (
  client: PluginInput["client"],
  directory: string,
): Promise<ProviderResolution[]> => {
  const { data } = await client.config.providers();
  if (!data) {
    return [];
  }

  const resolutions = scanProviders(data.providers as ProviderData[]);

  /*
   * ChatGPT OAuth shadows the canonical `openai` provider when no custom
   * baseURL is set. Custom-renamed openai-typed providers keep their own
   * credentials because their explicit baseURL would not authenticate
   * against ChatGPT OAuth tokens.
   */
  const chatgpt = await resolveChatGPTCredentials(client, directory);
  if (chatgpt) {
    const canonical = resolutions.find(
      (resolution) => resolution.providerID === CANONICAL_OPENAI_ID,
    );
    if (canonical && !canonical.credentials.baseURL) {
      canonical.credentials = chatgpt;
      canonical.type = "chatgpt";
    }
  }

  /*
   * Copilot OAuth replaces credentials on the canonical `github-copilot`
   * resolution if present, otherwise appends a synthetic resolution so
   * the user can still web-search via Copilot without a config entry.
   */
  const copilot = await resolveCopilotCredentials(client, directory);
  if (copilot) {
    const canonical = resolutions.find(
      (resolution) => resolution.providerID === CANONICAL_COPILOT_ID,
    );
    if (canonical) {
      canonical.credentials = copilot;
    } else {
      resolutions.push({
        credentials: copilot,
        providerID: CANONICAL_COPILOT_ID,
        type: "copilot",
      });
    }
  }

  return resolutions;
};

// ── Plugin ─────────────────────────────────────────────────────────────

// oxlint-disable-next-line import/no-default-export -- plugin entry point requires default export
export default (async (input) => {
  let resolutions: ProviderResolution[] | null = null;
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
          const picked = pickModel(resolutions, active);

          if (!picked) {
            return resolutions.length === NO_RESOLUTIONS
              ? formatNoProviderError()
              : formatUnsupportedProviderError(active?.modelID ?? "unknown");
          }

          try {
            return await dispatchSearch(
              picked.resolution.type,
              { ...picked.resolution.credentials, model: picked.modelID },
              args.query,
            );
          } catch (error) {
            return dispatchErrorMessage(picked.resolution.type, error);
          }
        },
      }),
    },
  };
}) satisfies Plugin;
