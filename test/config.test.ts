import { describe, expect, test } from "bun:test";

import { pickModel, scanProviders } from "../src/config.js";
import { ProviderResolution } from "../src/types.js";

const SINGLE_RESULT = 1;

const resolution = (
  providerID: string,
  overrides: Partial<ProviderResolution> = {},
): ProviderResolution => ({
  credentials: { apiKey: "key" },
  providerID,
  type: "openai",
  ...overrides,
});

describe("model selection", () => {
  test("prefers a locked model over the default and fallback", () => {
    const picked = pickModel(
      [
        resolution("openai", { fallbackModel: "gpt-fallback" }),
        resolution("anthropic", { lockedModel: "claude-search", type: "anthropic" }),
      ],
      { modelID: "gpt-default", providerID: "openai" },
    );

    expect(picked?.modelID).toBe("claude-search");
    expect(picked?.resolution.providerID).toBe("anthropic");
  });

  test("uses the V2 default model when its provider is supported", () => {
    const picked = pickModel([resolution("openai", { fallbackModel: "gpt-fallback" })], {
      modelID: "gpt-default",
      providerID: "openai",
    });

    expect(picked?.modelID).toBe("gpt-default");
  });

  test("falls back when the default provider is unsupported", () => {
    const picked = pickModel([resolution("openai", { fallbackModel: "gpt-fallback" })], {
      modelID: "other-default",
      providerID: "other",
    });

    expect(picked?.modelID).toBe("gpt-fallback");
  });
});

describe("V2 provider scanning", () => {
  test("reads model settings and uses the upstream model ID", () => {
    const scanned = scanProviders(
      [
        {
          id: "openai",
          package: "@opencode/ai/providers/openai",
          settings: { apiKey: "key", baseURL: "https://api.openai.com/v1" },
        },
      ],
      [
        {
          enabled: true,
          modelID: "gpt-upstream",
          providerID: "openai",
          settings: { websearch: "always" },
        },
        {
          enabled: true,
          modelID: "gpt-fallback-upstream",
          providerID: "openai",
          settings: { websearch: "auto" },
        },
      ],
    );

    const [first] = scanned;
    expect(scanned).toHaveLength(SINGLE_RESULT);
    expect(first?.lockedModel).toBe("gpt-upstream");
    expect(first?.fallbackModel).toBe("gpt-fallback-upstream");
  });

  test("ignores models disabled in V2", () => {
    const scanned = scanProviders(
      [{ id: "openai", package: "@opencode/ai/providers/openai" }],
      [
        {
          enabled: false,
          modelID: "gpt-disabled",
          providerID: "openai",
          settings: { websearch: "always" },
        },
      ],
    );

    const [first] = scanned;
    expect(first?.lockedModel).toBeUndefined();
  });
});
