import { MAX_SEARCH_USES, MIN_QUERY_LENGTH, MIN_SEARCH_USES } from "./constants.js";
import { Plugin, tool } from "@opencode-ai/plugin";
import { executeSearch, formatErrorMessage } from "./providers/anthropic.js";
import { formatConfigError, getAnthropicConfig } from "./config.js";
import { getTodayDate } from "./helpers.js";

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
        query: tool.schema.string().min(MIN_QUERY_LENGTH).describe("The search query to execute"),
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
