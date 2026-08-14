import { describe, expect, test } from "bun:test";

import { mergeCitationHits } from "../src/providers/xai/index.js";

describe("xAI citations", () => {
  test("normalizes numeric titles and merges top-level citations", () => {
    const hits = mergeCitationHits(
      [
        { title: "1", url: "https://docs.x.ai/developers/tools/web-search" },
        { title: "xAI", url: "https://x.ai" },
      ],
      [
        "https://docs.x.ai/developers/tools/web-search",
        "https://github.com/emilsvennesson/opencode-websearch",
      ],
    );

    expect(hits).toEqual([
      { title: "docs.x.ai", url: "https://docs.x.ai/developers/tools/web-search" },
      { title: "xAI", url: "https://x.ai" },
      {
        title: "github.com",
        url: "https://github.com/emilsvennesson/opencode-websearch",
      },
    ]);
  });

  test("ignores malformed citation collections", () => {
    expect(mergeCitationHits([{ title: "", url: "not-a-url" }], null)).toEqual([
      { title: "not-a-url", url: "not-a-url" },
    ]);
  });
});
