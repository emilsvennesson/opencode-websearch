import { afterEach, describe, expect, test } from "bun:test";
import { Credential, Plugin } from "@opencode/plugin";

import plugin from "../src/index.js";
import { buildSearchInput, SEARCH_RESULTS_SCHEMA } from "../src/providers/shared/search.js";

const originalFetch = globalThis.fetch;
const { signal } = new AbortController();
const EXPIRES = 0;
const RESULT_TEXT =
  '{"results":[{"url":"https://example.com","title":"Source","content":"Findings","time":{"published":null}}]}';
const TOKEN_SHARING = "chatgpt-token-sharing";
type Search = (input: { query: string }, context: { signal: AbortSignal }) => Promise<unknown>;

const createSearch = async (methodID: string): Promise<Search> => {
  let search: Search | undefined = undefined;
  const credential: Credential.OAuth = {
    access: "access-token",
    expires: EXPIRES,
    metadata: methodID === TOKEN_SHARING ? {} : { accountID: "account-id" },
    methodID,
    refresh: "refresh-token",
    type: "oauth",
  };
  const ctx = {
    integration: {
      connection: {
        active: async () => ({ type: "credential" }),
        resolve: async () => credential,
      },
    },
    model: {
      default: async () => ({ data: { modelID: "gpt-search", providerID: "openai" } }),
      list: async () => ({ data: [] }),
    },
    provider: {
      list: async () => ({
        data: [
          {
            id: "openai",
            integrationID: "openai",
            package: "@opencode/ai/providers/openai/responses",
            settings: { baseURL: "https://api.openai.com/v1" },
          },
        ],
      }),
    },
    websearch: {
      transform: async (transform: (editor: unknown) => void) =>
        transform({
          add: (backend: { execute: Search }) => {
            search = backend.execute;
          },
          default: { get: () => undefined, set: () => {} },
        }),
    },
  } as unknown as Plugin.Context;
  await plugin.setup(ctx);
  if (!search) {
    throw new Error("Native search backend was not registered");
  }
  return search;
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("ChatGPT native search", () => {
  test.each([
    [TOKEN_SHARING, "https://api.openai.com/v1/responses"],
    ["chatgpt-browser", "https://chatgpt.com/backend-api/codex/responses"],
  ])("sends %s search to %s", async (methodID, endpoint) => {
    const search = await createSearch(methodID);
    let called = false;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      called = true;
      expect(url).toBe(endpoint);
      expect(init.signal).toBe(signal);
      expect(init.headers).toMatchObject({ Authorization: "Bearer access-token" });
      const headers = new Headers(init.headers);
      expect(headers.get("chatgpt-account-id")).toBe(
        methodID === TOKEN_SHARING ? null : "account-id",
      );
      const body = JSON.parse(String(init.body));
      expect(body).toMatchObject({
        input: [
          { content: [{ text: buildSearchInput("query"), type: "input_text" }], role: "user" },
        ],
        model: "gpt-search",
        store: false,
        stream: true,
        text: { format: { schema: SEARCH_RESULTS_SCHEMA, type: "json_schema" } },
        tools: [{ type: "web_search" }],
      });
      expect(body).not.toHaveProperty("max_output_tokens");
      return new Response(
        new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","del'));
            controller.enqueue(
              encoder.encode(`ta":${JSON.stringify(RESULT_TEXT)}}\n\ndata: [DONE]\n\n`),
            );
            controller.close();
          },
        }),
      );
    }) as typeof fetch;

    expect(await search({ query: "query" }, { signal })).toEqual([
      { content: "Findings", time: {}, title: "Source", url: "https://example.com" },
    ]);
    expect(called).toBe(true);
  });
});
