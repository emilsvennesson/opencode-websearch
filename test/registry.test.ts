import { describe, expect, test } from "bun:test";

import { detectProviderType } from "../src/providers/registry.js";

describe("V2 provider detection", () => {
  test("detects a canonical provider ID", () => {
    expect(detectProviderType({ id: "xai", package: "" })).toBe("xai");
  });

  test("detects a renamed provider from its canonical ID", () => {
    expect(detectProviderType({ canonical: "openai", id: "openai-prod", package: "" })).toBe(
      "openai",
    );
  });

  test("detects a renamed provider from its V2 AI SDK package", () => {
    expect(detectProviderType({ id: "xai-proxy", package: "aisdk:@ai-sdk/xai" })).toBe("xai");
  });

  test("detects a provider from a model runtime override", () => {
    expect(
      detectProviderType({ id: "copilot-proxy", package: "" }, [
        { package: "@ai-sdk/github-copilot" },
      ]),
    ).toBe("copilot");
  });

  test("does not infer a provider from a generic compatible package", () => {
    expect(
      detectProviderType({
        id: "custom",
        package: "@opencode/ai/providers/openai-compatible",
      }),
    ).toBeNull();
  });
});
