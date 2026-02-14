import { Plugin, tool } from "@opencode-ai/plugin";
import { ProviderData, formatConfigError, resolveFromProviders } from "./config.js";
import { executeSearch, formatErrorMessage } from "./providers/anthropic.js";
import { AnthropicConfig } from "./types.js";
import { MIN_QUERY_LENGTH } from "./constants.js";
import { getCurrentMonthYear } from "./helpers.js";

// ── Config resolution (lazy) ───────────────────────────────────────────

/**
 * Resolve config from the SDK at execute-time, not init-time.
 * Calling client.config.providers() during plugin init causes a deadlock
 * because the server is still bootstrapping when plugins are loaded.
 */
const resolveConfig = async (client: {
  config: { providers: () => Promise<{ data?: { providers: unknown[] } }> };
}): Promise<AnthropicConfig | null> => {
  const { data } = await client.config.providers();
  if (data) {
    return resolveFromProviders(data.providers as ProviderData[]);
  }
  return null;
};

// ── Plugin ─────────────────────────────────────────────────────────────

// oxlint-disable-next-line import/no-default-export -- plugin entry point requires default export
export default (async (input) => {
  let config: AnthropicConfig | null = null;

  return {
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

        async execute(args) {
          if (!config) {
            config = await resolveConfig(input.client);
          }

          if (!config) {
            return formatConfigError();
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
  };
}) satisfies Plugin;
