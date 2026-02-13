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

The plugin needs an Anthropic API key. It resolves credentials in this order:

1. **opencode.json** -- looks for an `@ai-sdk/anthropic` provider in your project or global config
2. **Environment variable** -- falls back to `ANTHROPIC_API_KEY`

### Option 1: opencode.json provider (recommended)

If you already have an Anthropic provider configured, the plugin will use it automatically:

```json
{
  "provider": {
    "anthropic": {
      "npm": "@ai-sdk/anthropic",
      "options": {
        "apiKey": "{env:ANTHROPIC_API_KEY}"
      },
      "models": {
        "claude-sonnet-4-5": { "name": "Claude Sonnet 4.5" }
      }
    }
  }
}
```

The model used for search is the first model listed in the provider config.

### Option 2: environment variable

```sh
export ANTHROPIC_API_KEY=sk-ant-...
```

When using the env var fallback, `claude-sonnet-4-5` is used as the default model.

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

```sh
# Install dependencies
bun install

# Type check
bun run typecheck

# Build
bun run build
```

## License

MIT
