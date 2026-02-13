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
