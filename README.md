# opencode-websearch

Web search plugin for [OpenCode](https://opencode.ai). Gives any OpenCode model access to real-time web results with source citations using server-side web search tools.

## Supported providers

| Provider  | SDK package        | Search mechanism                                                                                                               |
| --------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Anthropic | `@ai-sdk/anthropic` | [Server-side `web_search` tool](https://docs.anthropic.com/en/docs/build-with-claude/tool-use/web-search-tool)                 |
| OpenAI    | `@ai-sdk/openai`    | [Responses API web search](https://platform.openai.com/docs/guides/tools-web-search)                                          |

## Install

Add the plugin to your `opencode.json`:

```json
{
  "plugin": ["opencode-websearch"]
}
```

OpenCode will install it automatically at startup.

## Configuration

The plugin scans your OpenCode providers for any that use a supported SDK package and picks up credentials however you've configured them -- via `/connect`, environment variables, or `options.apiKey` in your config.

Tag a model with `"websearch": "auto"` or `"websearch": "always"` to control how web search selects its model.

### Model selection

The plugin dynamically chooses which model to use for each search:

| Priority | Condition                                    | Behavior                                                                   |
| -------- | -------------------------------------------- | -------------------------------------------------------------------------- |
| 1        | A model is tagged `"always"`                 | That model is **always** used, regardless of what you're chatting with     |
| 2        | Your active chat model is a supported provider | The active model is used directly -- no extra configuration needed        |
| 3        | A model is tagged `"auto"`                   | That model is used as a **fallback** when the active model is unsupported |
| 4        | None of the above                            | An error is returned                                                       |

### `"auto"` mode (recommended)

Use `"auto"` when you want web search to work seamlessly regardless of your active model. When your active model belongs to a supported provider, it's used directly; otherwise the tagged model kicks in as a fallback.

```json
{
  "provider": {
    "anthropic": {
      "models": {
        "claude-sonnet-4-5": {
          "options": {
            "websearch": "auto"
          }
        }
      }
    }
  }
}
```

### `"always"` mode

Use `"always"` to hard-lock web search to a specific model. This is useful when you want a cheaper or faster model to always handle searches, no matter what you're chatting with.

```json
{
  "provider": {
    "openai": {
      "models": {
        "gpt-4o-mini": {
          "options": {
            "websearch": "always"
          }
        }
      }
    }
  }
}
```

### Custom providers

This also works with custom providers that use a supported SDK package, such as a LiteLLM proxy:

```json
{
  "provider": {
    "my-proxy": {
      "npm": "@ai-sdk/anthropic",
      "options": {
        "baseURL": "http://localhost:4000/v1/",
        "apiKey": "{env:MY_API_KEY}"
      },
      "models": {
        "claude-sonnet-4-5": {
          "options": {
            "websearch": "auto"
          }
        }
      }
    }
  }
}
```

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
