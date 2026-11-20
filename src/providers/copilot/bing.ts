import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { WebSearch } from "@opencode/plugin";
import { z } from "zod/mini";

import { normalizeResults } from "../shared/search.js";
import { SearchConfig } from "../../types.js";
import {
  COPILOT_DEFAULT_BASE_URL,
  COPILOT_MCP_CLIENT_INFO,
  COPILOT_MCP_PATH,
  COPILOT_MCP_TOOLSET,
} from "./constants.js";

// ── Schemas ────────────────────────────────────────────────────────────

const BingSearchItem = z.object({
  last_updated_date: z.nullish(z.string()),
  snippets: z.nullish(z.array(z.string())),
  title: z.nullish(z.string()),
  url: z.string(),
});

const BingSearchPayload = z.object({
  error_message: z.nullish(z.string()),
  search_result_groups: z.nullish(z.array(z.object({ items: z.nullish(z.array(BingSearchItem)) }))),
});

type BingSearchItem = z.infer<typeof BingSearchItem>;

// ── Helpers ────────────────────────────────────────────────────────────

const createTransport = (config: SearchConfig): StreamableHTTPClientTransport =>
  new StreamableHTTPClientTransport(
    new URL(COPILOT_MCP_PATH, config.baseURL ?? COPILOT_DEFAULT_BASE_URL),
    {
      authProvider: { token: async () => config.apiKey },
      requestInit: {
        headers: {
          ...config.providerHeaders,
          ...config.headers,
          "X-MCP-Toolsets": COPILOT_MCP_TOOLSET,
        },
      },
    },
  );

const toUTCDate = (value: string | null | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  const HAS_UTC_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i;
  return HAS_UTC_OFFSET.test(value) ? value : `${value}Z`;
};

const toResultShape = (item: BingSearchItem): Record<string, unknown> => ({
  content: item.snippets?.join("\n\n"),
  time: { published: toUTCDate(item.last_updated_date) },
  title: item.title,
  url: item.url,
});

const parseResults = (text: string): readonly WebSearch.Result[] => {
  const payload = BingSearchPayload.parse(JSON.parse(text));
  if (payload.error_message) {
    throw new Error(payload.error_message);
  }

  const items = payload.search_result_groups?.flatMap((group) => group.items ?? []) ?? [];
  return normalizeResults(items.map(toResultShape));
};

// ── Execution ──────────────────────────────────────────────────────────

const executeBingSearch = async (
  config: SearchConfig,
  query: string,
  signal: AbortSignal,
): Promise<readonly WebSearch.Result[]> => {
  const client = new Client(COPILOT_MCP_CLIENT_INFO, { versionNegotiation: { mode: "auto" } });

  try {
    await client.connect(createTransport(config), { signal });
    const result = await client.callTool(
      { arguments: { query }, name: COPILOT_MCP_TOOLSET },
      { signal },
    );
    const text = result.content.find((block) => block.type === "text")?.text ?? "";
    if (result.isError) {
      throw new Error(text || "Copilot MCP web_search failed.");
    }
    return parseResults(text);
  } finally {
    await client.close();
  }
};

export { executeBingSearch, parseResults };
