import { describe, expect, test } from "bun:test";

import { detectProviderType } from "../src/providers/registry.js";

describe("xAI provider detection", () => {
  test("detects the canonical xAI provider", () => {
    expect(detectProviderType({ id: "xai", models: {} })).toBe("xai");
  });

  test("detects a renamed xAI provider from its SDK package", () => {
    expect(
      detectProviderType({
        id: "xai-proxy",
        models: {
          "grok-4.6": { api: { npm: "@ai-sdk/xai" } },
        },
      }),
    ).toBe("xai");
  });
});
