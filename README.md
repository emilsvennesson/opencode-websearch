# opencode-websearch

Web search for [OpenCode](https://opencode.ai) using your model provider's built-in search. Adds a `native` backend to OpenCode's `websearch` tool, so no separate search service is needed.

> [!NOTE]
> Versions 0.7 and later require OpenCode V2. Use 0.6 or earlier for OpenCode V1.

## Example

Each source comes back with its title, URL, publication date when known, and a summary of the relevant findings:

```md
## [Releases · oven-sh/bun](https://github.com/oven-sh/bun/releases)

Published: 2026-10-22T00:00:00.000Z

The latest release is Bun v1.4.4, marked "Latest" and tagged bun-v1.4.4. Earlier releases: v1.4.3, v1.4.2, v1.4.1, v1.4, v1.3.14. Install with `curl -fsSL https://bun.com/install | bash`, or upgrade with `bun upgrade`.
```

## Supported providers

| Provider         | Search                                                            |
| ---------------- | ----------------------------------------------------------------- |
| Anthropic        | `web_search_20260318`, falling back to `web_search_20250305`      |
| OpenAI / ChatGPT | Responses API `web_search`                                        |
| GitHub Copilot   | Responses API `web_search`                                        |
| xAI (Grok)       | Responses API `web_search`                                        |
| Moonshot (Kimi)  | Web Search Pro API                                                |
| Z.ai (GLM)       | Web Search API, with an API key or the Coding Plan                |
| DeepSeek         | Search API                                                        |
| OpenCode Go      | Claude, GPT, Grok, and Kimi models only ([details](#opencode-go)) |

## Install

Add the plugin to `opencode.jsonc`:

<!-- x-release-please-start-version -->

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["opencode-websearch@0.7.0"],
}
```

<!-- x-release-please-end -->

OpenCode doesn't update plugins on its own, and a pinned version stays put. To upgrade, change the version and save; OpenCode reloads the plugin.

It becomes the default `websearch` provider, unless you've chosen another provider or turned web search off. To select it explicitly:

```jsonc
{
  "websearch": { "provider": "native" },
}
```

## Model selection

Searches use your default model when its provider is supported. The current session's model is never used.

To search with a specific model instead, set `"websearch": "always"` in its options. This is useful when:

- Your default model can't search, for example because its provider isn't supported or it's an OpenCode Go model without web search.
- You want searches to run on a cheaper or faster model than the one you code with.
- You switch default models often and want searches to behave the same.

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "opencode-go": {
      "models": {
        "gpt-6-luna": {
          "options": {
            "websearch": "always",
          },
        },
      },
    },
  },
}
```

### OpenCode Go

OpenCode Go serves each model through its own upstream, and only Claude, GPT, Grok, and Kimi models search the web. GLM, DeepSeek, Qwen, MiniMax, and the other Go models ignore the search tool, so the plugin returns an error instead of an unsearched answer.

Searches count toward your Go usage limits. `gpt-6-luna` and `claude-haiku-5-5` are inexpensive choices; Grok searches cost many times more. Kimi on Go uses Moonshot's `$web_search` tool, which Moonshot has deprecated, so it may stop working without notice.

## Development

```sh
git clone https://github.com/emilsvennesson/opencode-websearch.git
cd opencode-websearch
bun install
bun run build
```

Point `plugins` at the local checkout (`"plugins": ["/absolute/path/opencode-websearch"]`), then rebuild and run `/reload` in OpenCode after changes. Run `bun run check` before opening a PR.

## License

MIT
