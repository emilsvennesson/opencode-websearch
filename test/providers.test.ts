import { afterEach, describe, expect, test } from "bun:test";

import { executeSearch as executeDeepSeekSearch } from "../src/providers/deepseek/index.js";
import { executeKimiSearch } from "../src/providers/opencode-go/kimi.js";
import {
  executeSearch as executeOpenCodeGoSearch,
  findRoute,
} from "../src/providers/opencode-go/index.js";
import { executeSearch as executeZaiSearch } from "../src/providers/zai/index.js";

// ── Helpers ────────────────────────────────────────────────────────────

interface CapturedRequest {
  body: Record<string, unknown>;
  headers: Record<string, string>;
  url: string;
}

const FIRST = 0;
const LONG_QUERY_LENGTH = 200;
const MAX_QUERY_LENGTH = 128;
const SECOND = 1;
const TWO_REQUESTS = 2;
const PUBLISHED = Date.parse("2026-10-22");
const originalFetch = globalThis.fetch;

/** Replace fetch with a queue of JSON responses and capture each request. */
const mockFetch = (...responses: unknown[]): CapturedRequest[] => {
  const requests: CapturedRequest[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    requests.push({
      body: JSON.parse(String(init.body)) as Record<string, unknown>,
      headers: init.headers as Record<string, string>,
      url,
    });
    return Response.json(responses.shift());
  }) as typeof fetch;
  return requests;
};

const { signal } = new AbortController();

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ── OpenCode Go ────────────────────────────────────────────────────────

describe("OpenCode Go routing", () => {
  test("routes only model families with provider-side search", () => {
    expect(findRoute("claude-haiku-5-5")).toBeDefined();
    expect(findRoute("gpt-6-luna")).toBeDefined();
    expect(findRoute("grok-4.7")).toBeDefined();
    expect(findRoute("kimi-k3")).toBeDefined();
    expect(findRoute("glm-5.3")).toBeUndefined();
    expect(findRoute("deepseek-v4.1-flash")).toBeUndefined();
    expect(findRoute("qwen3.8-flash")).toBeUndefined();
  });

  test("rejects models that ignore the search tool", async () => {
    await expect(
      executeOpenCodeGoSearch({ apiKey: "key", model: "glm-5.3" }, "query", signal),
    ).rejects.toThrow(
      'glm-5.3 cannot search the web through OpenCode Go. Only Claude, GPT, Grok, and Kimi models support web search on Go. Set "websearch": "always"',
    );
  });

  test("sends Kimi requests to the model endpoint with Go headers", async () => {
    const requests = mockFetch({
      choices: [
        {
          finish_reason: "stop",
          message: {
            content:
              '{"results":[{"url":"https://bun.sh","title":"Bun","content":"x","time":{"published":null}}]}',
          },
        },
      ],
    });

    const results = await executeOpenCodeGoSearch(
      {
        apiKey: "key",
        model: "kimi-k3",
        modelBaseURL: "https://opencode.ai/inference/go/openai/v1",
        providerHeaders: { "x-opencode-org-id": "org-id" },
      },
      "query",
      signal,
    );

    const headers = requests[FIRST]?.headers;
    expect(results).toEqual([{ content: "x", time: {}, title: "Bun", url: "https://bun.sh" }]);
    expect(requests[FIRST]?.url).toBe(
      "https://opencode.ai/inference/go/openai/v1/chat/completions",
    );
    expect(headers?.["x-opencode-org-id"]).toBe("org-id");
    expect(headers?.["User-Agent"]).toBe("opencode-websearch");
    expect(headers?.["x-opencode-session"]).toBeString();
  });
});

describe("Kimi $web_search", () => {
  test("echoes the search tool call arguments back to run the search", async () => {
    const toolCall = {
      function: { arguments: '{"search_result":{"search_id":"id"}}', name: "$web_search" },
      id: "call-1",
      type: "builtin_function",
    };
    const requests = mockFetch(
      {
        choices: [
          { finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [toolCall] } },
        ],
      },
      { choices: [{ finish_reason: "stop", message: { content: "final" } }] },
    );

    const text = await executeKimiSearch(
      { apiKey: "key", baseURL: "https://example.com/v1", model: "kimi-k3" },
      "query",
      signal,
    );

    expect(text).toBe("final");
    expect(requests).toHaveLength(TWO_REQUESTS);
    expect(requests[FIRST]?.body.tools).toEqual([
      { function: { name: "$web_search" }, type: "builtin_function" },
    ]);
    expect(requests[SECOND]?.body.messages).toContainEqual({
      content: toolCall.function.arguments,
      name: "$web_search",
      role: "tool",
      tool_call_id: "call-1",
    });
  });
});

// ── REST search APIs ───────────────────────────────────────────────────

describe("Z.ai web search", () => {
  test("uses the general search path for Coding Plan base URLs", async () => {
    const requests = mockFetch({
      search_result: [
        { content: "Summary", link: "https://bun.sh", publish_date: "2026-10-22", title: "Bun" },
      ],
    });

    const results = await executeZaiSearch(
      { apiKey: "key", baseURL: "https://api.z.ai/api/coding/paas/v4", model: "glm-5.3" },
      "query",
      signal,
    );

    expect(requests[FIRST]?.url).toBe("https://api.z.ai/api/paas/v4/web_search");
    expect(requests[FIRST]?.body).toMatchObject({
      search_engine: "search-prime",
      search_query: "query",
    });
    expect(results).toEqual([
      { content: "Summary", time: { published: PUBLISHED }, title: "Bun", url: "https://bun.sh" },
    ]);
  });
});

describe("DeepSeek web search", () => {
  test("maps the long summary and truncates long queries", async () => {
    const requests = mockFetch({
      results: [
        {
          date: "2026-10-22T00:00:00Z",
          snippet: "Short",
          summary: "Long summary",
          title: "Bun",
          url: "https://bun.sh",
        },
      ],
    });

    const results = await executeDeepSeekSearch(
      { apiKey: "key", baseURL: "https://api.deepseek.com/v1/", model: "deepseek-v4-pro" },
      "q".repeat(LONG_QUERY_LENGTH),
      signal,
    );

    expect(requests[FIRST]?.url).toBe("https://api.deepseek.com/v1/tools/search");
    expect(requests[FIRST]?.body.query).toBe("q".repeat(MAX_QUERY_LENGTH));
    expect(results).toEqual([
      {
        content: "Long summary",
        time: { published: PUBLISHED },
        title: "Bun",
        url: "https://bun.sh",
      },
    ]);
  });
});
