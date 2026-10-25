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

| Provider         | Search                                                                   |
| ---------------- | ------------------------------------------------------------------------ |
| Anthropic        | `web_search_20260318` with dynamic filtering, falling back to `20250305` |
| OpenAI / ChatGPT | Responses API `web_search`                                               |
| GitHub Copilot   | Responses API `web_search`                                               |
| xAI (Grok)       | Responses API `web_search`                                               |
| Moonshot (Kimi)  | Web Search Pro API (`/v1/tools/search_pro`)                              |

## Install

Add the plugin to `opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["opencode-websearch"],
}
```

The plugin becomes the default `websearch` provider unless you've already selected another one or set `websearch: false`. To select it explicitly, set `"websearch": { "provider": "native" }`.

## Model selection

Each search uses the first match of:

1. A model with `"websearch": "always"` in its options.
2. The default model, if its provider is supported.
3. A model with `"websearch": "auto"` in its options.

The current session's model is not used.

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "openai": {
      "models": {
        "gpt-5.2": {
          "options": {
            "websearch": "always",
          },
        },
      },
    },
  },
}
```

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
