# opencode-websearch

Model-native web search for [OpenCode V2](https://opencode.ai/v2/docs/), powered by your provider's built-in search capability. The plugin adds a routing backend to OpenCode's built-in `websearch` tool, so no separate search service is required.

## Example

The built-in `websearch` tool receives one result per source, with the page's title, URL, publication date when known, and a detailed summary of the relevant findings:

```md
## [Releases · oven-sh/bun](https://github.com/oven-sh/bun/releases)

Published: 2026-10-22T00:00:00.000Z

The latest release is Bun v1.4.4, marked "Latest" and tagged bun-v1.4.4. Earlier releases: v1.4.3, v1.4.2, v1.4.1, v1.4, v1.3.14. Install with `curl -fsSL https://bun.com/install | bash`, or upgrade with `bun upgrade`.
```

## Supported providers

| Provider         | What you need                                                | Search                                                                   |
| ---------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Anthropic        | An Anthropic provider/model in OpenCode                      | `web_search_20260318` with dynamic filtering, falling back to `20250305` |
| OpenAI / ChatGPT | OpenAI configured in OpenCode (API key or ChatGPT connected) | Responses API `web_search`                                               |
| GitHub Copilot   | GitHub Copilot connected in OpenCode                         | Responses API `web_search`                                               |
| xAI (Grok)       | xAI configured in OpenCode (API key or SuperGrok connected)  | Responses API `web_search`                                               |
| Moonshot (Kimi)  | A Moonshot API key configured in OpenCode                    | Web Search Pro API (`/v1/tools/search_pro`)                              |

## Install

Add the plugin and select its `native` backend in `opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["opencode-websearch"],
  "websearch": {
    "provider": "native",
  },
}
```

The explicit `websearch` selection is optional when no other provider is selected: the plugin makes itself the default on installation. Existing provider selections and `websearch: false` are respected.

## Model selection

The backend selects a model for each query in this order:

1. A model with `"websearch": "always"` in its V2 model settings.
2. OpenCode's configured default model, when its provider is supported.
3. A model with `"websearch": "auto"` in its V2 model settings.

The selected session model is not used. Providers, models, and credentials are resolved at query time so configuration and account changes take effect on later searches.

### Example

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

Use `"auto"` instead of `"always"` for a fallback model.

## Development

### Local development

Clone the repository, install dependencies, and build it:

```sh
git clone https://github.com/emilsvennesson/opencode-websearch.git
cd opencode-websearch
bun install
bun run build
```

Load the local package directory and select the backend:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["/absolute/path/opencode-websearch"],
  "websearch": {
    "provider": "native",
  },
}
```

After changing source files, run `bun run build` again and reload OpenCode with `/reload`. If an unwatched local dependency remains cached, restart the service with `opencode service restart`.

### Commands

```sh
bun install
bun run format
bun run format:check
bun run lint
bun run lint:fix
bun run typecheck
bun run check
bun run build
```

## License

MIT
