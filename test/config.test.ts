import { describe, expect, test } from "bun:test";

import { pickModel, resolveSearchEngine, scanProviders, withModelRuntime } from "../src/config.js";
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
  test("prefers a locked model over the default", () => {
    const picked = pickModel(
      [
        resolution("openai"),
        resolution("anthropic", { lockedModel: "claude-search", type: "anthropic" }),
      ],
      { modelID: "gpt-default", providerID: "openai" },
    );

    expect(picked?.modelID).toBe("claude-search");
    expect(picked?.resolution.providerID).toBe("anthropic");
  });

  test("uses the V2 default model when its provider is supported", () => {
    const picked = pickModel([resolution("openai")], {
      modelID: "gpt-default",
      providerID: "openai",
    });

    expect(picked?.modelID).toBe("gpt-default");
  });

  test("picks nothing when the default provider is unsupported and no model is locked", () => {
    const picked = pickModel([resolution("openai")], {
      modelID: "other-default",
      providerID: "other",
    });

    expect(picked).toBeNull();
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
          modelID: "gpt-second-upstream",
          providerID: "openai",
          settings: { websearch: "always" },
        },
      ],
    );

    const [first] = scanned;
    expect(scanned).toHaveLength(SINGLE_RESULT);
    expect(first?.lockedModel).toBe("gpt-upstream");
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

describe("search engine setting", () => {
  const copilot = { id: "github-copilot", package: "aisdk:@ai-sdk/github-copilot" };
  const openai = { id: "openai", package: "@opencode/ai/providers/openai" };

  test("defaults to native", () => {
    expect(resolveSearchEngine(copilot, "copilot")).toBe("native");
    expect(resolveSearchEngine({ ...copilot, settings: { websearch: {} } }, "copilot")).toBe(
      "native",
    );
    expect(resolveSearchEngine(openai, "openai")).toBe("native");
  });

  test("accepts every engine on GitHub Copilot", () => {
    for (const engine of ["native", "bing", "auto"] as const) {
      expect(
        resolveSearchEngine({ ...copilot, settings: { websearch: { engine } } }, "copilot"),
      ).toBe(engine);
    }
  });

  test("accepts only native on other providers", () => {
    expect(
      resolveSearchEngine({ ...openai, settings: { websearch: { engine: "native" } } }, "openai"),
    ).toBe("native");
    expect(() =>
      resolveSearchEngine({ ...openai, settings: { websearch: { engine: "bing" } } }, "openai"),
    ).toThrow(
      '"websearch" setting of provider "openai" is invalid. Expected { "engine": "native" }.',
    );
    expect(() =>
      resolveSearchEngine({ ...openai, settings: { websearch: { engine: "auto" } } }, "openai"),
    ).toThrow('"websearch" setting of provider "openai" is invalid');
  });

  test("rejects unknown engines and malformed settings", () => {
    expect(() =>
      resolveSearchEngine({ ...copilot, settings: { websearch: { engine: "google" } } }, "copilot"),
    ).toThrow('Expected { "engine": "native" | "bing" | "auto" }.');
    expect(() =>
      resolveSearchEngine({ ...copilot, settings: { websearch: { engine: 1 } } }, "copilot"),
    ).toThrow('"websearch" setting of provider "github-copilot" is invalid');
    expect(() =>
      resolveSearchEngine({ ...copilot, settings: { websearch: "bing" } }, "copilot"),
    ).toThrow('"websearch" setting of provider "github-copilot" is invalid');
  });

  test("is validated while scanning providers", () => {
    const [first] = scanProviders(
      [{ ...copilot, settings: { websearch: { engine: "bing" } } }],
      [],
    );
    expect(first?.settings.searchEngine).toBe("bing");

    expect(() =>
      scanProviders([{ ...openai, settings: { websearch: { engine: "bing" } } }], []),
    ).toThrow('"websearch" setting of provider "openai" is invalid');
  });
});

describe("picked model runtime", () => {
  test("attaches the picked model's own base URL", () => {
    const picked = withModelRuntime(
      {
        modelID: "claude-haiku-5-5",
        resolution: resolution("opencode-go", { type: "opencode-go" }),
      },
      [
        {
          enabled: true,
          modelID: "claude-haiku-5-5",
          providerID: "other",
          settings: { baseURL: "https://other.example.com" },
        },
        {
          enabled: true,
          modelID: "claude-haiku-5-5",
          providerID: "opencode-go",
          settings: { baseURL: "https://opencode.ai/inference/go/anthropic/v1" },
        },
      ],
    );

    expect(picked.modelBaseURL).toBe("https://opencode.ai/inference/go/anthropic/v1");
  });
});
