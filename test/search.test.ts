import { describe, expect, test } from "bun:test";

import { normalizeResults, parseSearchResults } from "../src/providers/shared/search.js";

const PUBLISHED = "2026-10-22";

describe("search result parsing", () => {
  test("maps structured JSON into native web search results", () => {
    const text = JSON.stringify({
      results: [
        {
          content: "Bun v1.4.4 fixes 271 issues.",
          time: { published: PUBLISHED },
          title: "Bun v1.4.4",
          url: "https://bun.com/blog/bun-v1.4.4",
        },
        {
          content: "Release list.",
          time: { published: null },
          title: "Releases",
          url: "https://github.com/oven-sh/bun/releases",
        },
      ],
    });

    expect(parseSearchResults(text)).toEqual([
      {
        content: "Bun v1.4.4 fixes 271 issues.",
        time: { published: Date.parse(PUBLISHED) },
        title: "Bun v1.4.4",
        url: "https://bun.com/blog/bun-v1.4.4",
      },
      {
        content: "Release list.",
        time: {},
        title: "Releases",
        url: "https://github.com/oven-sh/bun/releases",
      },
    ]);
  });

  test("tolerates text around the JSON object", () => {
    const text = '```json\n{"results":[{"url":"https://example.com","title":"Example"}]}\n```';

    expect(parseSearchResults(text)).toEqual([
      { time: {}, title: "Example", url: "https://example.com" },
    ]);
  });

  test("drops invalid and duplicate URLs and empty fields", () => {
    expect(
      normalizeResults([
        { title: "First", url: "https://example.com/docs" },
        { title: "Duplicate", url: "https://example.com/docs" },
        { title: "Not web", url: "ftp://example.com/file" },
        { title: "Missing" },
        { content: " ", time: { published: "unknown" }, title: "", url: "https://example.org" },
      ]),
    ).toEqual([
      { time: {}, title: "First", url: "https://example.com/docs" },
      { time: {}, url: "https://example.org" },
    ]);
  });

  test("throws when the response is not the expected JSON", () => {
    expect(() => parseSearchResults("No results.")).toThrow();
    expect(() => parseSearchResults('{"items":[]}')).toThrow();
  });
});
