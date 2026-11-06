import { describe, expect, test } from "bun:test";
import { Credential, Plugin } from "@opencode/plugin";

import { resolveCredentials } from "../src/auth.js";

const EXPIRES = 0;

const createContext = (credential: Credential.Value): Plugin.Context =>
  ({
    integration: {
      connection: {
        active: async () => ({ type: "credential" }),
        resolve: async () => credential,
      },
    },
  }) as unknown as Plugin.Context;

const oauth = (metadata?: Record<string, unknown>): Credential.OAuth => ({
  access: "access-token",
  expires: EXPIRES,
  metadata,
  methodID: "device",
  refresh: "refresh-token",
  type: "oauth",
});

describe("V2 credential resolution", () => {
  test("uses configured API keys without an integration", async () => {
    const result = await resolveCredentials(
      createContext({ key: "unused", type: "key" }),
      { id: "anthropic", package: "@opencode/ai/providers/anthropic" },
      "anthropic",
      { apiKey: "configured" },
    );

    expect(result).toEqual({
      credentials: { apiKey: "configured", baseURL: undefined },
      type: "anthropic",
    });
  });

  test("maps OpenAI OAuth to ChatGPT credentials and account metadata", async () => {
    const result = await resolveCredentials(
      createContext(oauth({ accountID: "account-id" })),
      {
        id: "openai",
        integrationID: "openai",
        package: "@opencode/ai/providers/openai",
      },
      "openai",
      {},
    );

    expect(result).toEqual({
      credentials: {
        accountId: "account-id",
        apiKey: "access-token",
        baseURL: "https://chatgpt.com/backend-api/codex",
      },
      type: "chatgpt",
    });
  });

  test.each(["chatgpt-browser", "chatgpt-headless", "chatgpt-token-sharing"])(
    "routes %s OAuth with the resolved default API URL",
    async (methodID) => {
      const result = await resolveCredentials(
        createContext({ ...oauth(), methodID }),
        {
          id: "openai",
          integrationID: "openai",
          package: "@opencode/ai/providers/openai/responses",
        },
        "openai",
        { baseURL: "https://api.openai.com/v1/" },
      );

      expect(result).toEqual({
        credentials: {
          accountId: undefined,
          apiKey: "access-token",
          baseURL:
            methodID === "chatgpt-token-sharing"
              ? "https://api.openai.com/v1"
              : "https://chatgpt.com/backend-api/codex",
        },
        type: "chatgpt",
      });
    },
  );

  test("routes token-sharing OAuth to the API when no base URL is set", async () => {
    const result = await resolveCredentials(
      createContext({ ...oauth(), methodID: "chatgpt-token-sharing" }),
      { id: "openai", integrationID: "openai", package: "@opencode/ai/providers/openai/responses" },
      "openai",
      {},
    );

    expect(result).toMatchObject({
      credentials: { apiKey: "access-token", baseURL: "https://api.openai.com/v1" },
      type: "chatgpt",
    });
  });

  test.each(["chatgpt-browser", "chatgpt-token-sharing"])(
    "preserves custom endpoint handling for %s OAuth",
    async (methodID) => {
      const ctx = createContext({ ...oauth(), methodID });
      const provider = {
        id: "openai",
        integrationID: "openai",
        package: "@opencode/ai/providers/openai/responses",
      };
      const baseURL = "https://proxy.example.com/v1";

      expect(await resolveCredentials(ctx, provider, "openai", { baseURL })).toBeNull();
      expect(
        await resolveCredentials(ctx, provider, "openai", {
          apiKey: "proxy-key",
          baseURL,
        }),
      ).toEqual({
        credentials: { apiKey: "proxy-key", baseURL },
        type: "openai",
      });
    },
  );

  test("keeps OpenAI API-key connections on the OpenAI adapter", async () => {
    const result = await resolveCredentials(
      createContext({ key: "api-key", type: "key" }),
      { id: "openai", integrationID: "openai", package: "@opencode/ai/providers/openai/responses" },
      "openai",
      { baseURL: "https://api.openai.com/v1" },
    );

    expect(result).toEqual({
      credentials: { apiKey: "api-key", baseURL: "https://api.openai.com/v1" },
      type: "openai",
    });
  });

  test("uses the Copilot refresh token and discovered API endpoint", async () => {
    const result = await resolveCredentials(
      createContext(oauth({ apiEndpoint: "https://copilot.example.com/" })),
      {
        id: "github-copilot",
        integrationID: "github-copilot",
        package: "aisdk:@ai-sdk/github-copilot",
      },
      "copilot",
      {},
    );

    expect(result).toEqual({
      credentials: {
        apiKey: "refresh-token",
        baseURL: "https://copilot.example.com",
      },
      type: "copilot",
    });
  });

  test("treats the default Copilot base URL from V2 settings as non-custom", async () => {
    const result = await resolveCredentials(
      createContext(oauth()),
      {
        id: "github-copilot",
        integrationID: "github-copilot",
        package: "@opencode/ai/providers/openai-compatible",
      },
      "copilot",
      { baseURL: "https://api.githubcopilot.com" },
    );

    expect(result).toEqual({
      credentials: { apiKey: "refresh-token", baseURL: "https://api.githubcopilot.com" },
      type: "copilot",
    });
  });

  test("uses the current xAI access token", async () => {
    const result = await resolveCredentials(
      createContext(oauth()),
      { id: "xai", integrationID: "xai", package: "@opencode/ai/providers/xai" },
      "xai",
      {},
    );

    expect(result).toMatchObject({
      credentials: { apiKey: "access-token" },
      type: "xai",
    });
  });

  test("uses the OpenCode Go access token from the OpenCode login", async () => {
    const result = await resolveCredentials(
      createContext(oauth({ orgID: "org-id" })),
      {
        id: "opencode-go",
        integrationID: "opencode",
        package: "@opencode/ai/providers/openai-compatible",
      },
      "opencode-go",
      { baseURL: "https://opencode.ai/inference/go/openai/v1" },
    );

    expect(result).toEqual({
      credentials: {
        apiKey: "access-token",
        baseURL: "https://opencode.ai/inference/go/openai/v1",
      },
      type: "opencode-go",
    });
  });
});
