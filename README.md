# opencode-websearch

Web search plugin for [OpenCode](https://opencode.ai), powered by Anthropic's server-side `web_search` API. A port of the Claude Code WebSearch tool to OpenCode.

## Install

Add the plugin to your `opencode.json`:

```json
{
  "plugin": ["opencode-websearch"]
}
```

OpenCode will install it automatically at startup.

## Configuration

The plugin looks for an Anthropic provider (`@ai-sdk/anthropic`) with `"websearch": true` set on at least one model. It picks up credentials however you've configured them in OpenCode -- via `/connect`, environment variables, or `options.apiKey` in your config.

Add `"websearch": true` to the model you want the plugin to use for searches:

```json
{
  "provider": {
    "anthropic": {
      "models": {
        "claude-sonnet-4-5": {
          "options": {
            "websearch": true
          }
        }
      }
    }
  }
}
```

This also works with custom providers that use `@ai-sdk/anthropic`, such as a LiteLLM proxy:

```json
{
  "provider": {
    "my-anthropic": {
      "npm": "@ai-sdk/anthropic",
      "options": {
        "baseURL": "http://localhost:4000/v1/",
        "apiKey": "{env:MY_API_KEY}"
      },
      "models": {
        "claude-sonnet-4-5": {
          "options": {
            "websearch": true
          }
        }
      }
    }
  }
}
```

## Usage

Once configured, the `web-search` tool is available to the AI agent. It accepts:

| Argument | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | Yes | The search query |
| `allowed_domains` | `string[]` | No | Restrict results to these domains |
| `blocked_domains` | `string[]` | No | Exclude results from these domains |
| `max_uses` | `number` (1-10) | No | Max searches per invocation (default: 5) |

You cannot specify both `allowed_domains` and `blocked_domains` at the same time.

Results are returned as formatted markdown with source links.

## Development

### Local Development

To develop or customize the plugin locally, clone the repo and symlink the
source entry point into your OpenCode plugin directory:

```sh
git clone https://github.com/emilsvennesson/opencode-websearch ~/.config/opencode/opencode-websearch
cd ~/.config/opencode/opencode-websearch
bun install
mkdir -p ~/.config/opencode/plugin
ln -sf ~/.config/opencode/opencode-websearch/src/index.ts ~/.config/opencode/plugin/websearch.ts
```

OpenCode will load the plugin directly from source on startup. Any edits to the
files in `src/` take effect next time you start OpenCode.

> **Note:** When using the symlink approach, remove `"opencode-websearch"` from
> the `plugin` array in your `opencode.json` to avoid loading the plugin twice.

### Commands

```sh
bun install            # install dependencies
bun run format         # auto-format source files
bun run format:check   # verify formatting (no changes)
bun run lint           # run oxlint
bun run lint:fix       # auto-fix lint issues
bun run typecheck      # type check with tsc
bun run check          # format:check + lint + typecheck (full quality gate)
bun run build          # ESM bundle + declaration files → dist/
```

## License

MIT
