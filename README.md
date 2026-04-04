# opencode-websearch

Web search plugin for [OpenCode](https://opencode.ai) that provides web search functionality using each provider's native APIs, inspired by Claude Code's WebSearch tool.

## Supported providers

| Provider | SDK package | Search mechanism | Supported models |
| -------- | ----------- | ---------------- | ---------------- |
| Anthropic | `@ai-sdk/anthropic` | [Web search tool](https://docs.anthropic.com/en/docs/build-with-claude/tool-use/web-search-tool) | `claude-haiku-4-5`, `claude-sonnet-4-6`, `claude-opus-4-6` |
| OpenAI | `@ai-sdk/openai` | [Responses API web search](https://platform.openai.com/docs/guides/tools-web-search) | `gpt-5.4`, _gpt-5.4-mini\*_, _gpt-5.4-nano\*_, _gpt-5\*_, _gpt-5-mini\*_, _gpt-4.1\*_, _gpt-4.1-mini\*_ |
| GitHub Copilot | `@ai-sdk/github-copilot` | [Copilot model-native web search](https://github.blog/changelog/2026-02-25-improved-web-search-in-copilot-on-github-com/) | `gpt-5.3-codex`, `gpt-5.2-codex`, `gpt-5.2`, `gpt-5.1`, `gpt-5.4-mini`, _gpt-5-mini\*_, _gpt-5.4\*_ |

Models marked with \* are expected but currently untested in this repository.

This model list is not exhaustive and can change as providers add, remove, or update model support.

## Install

Add the plugin to your `opencode.json`:

```json
{
  "plugin": ["opencode-websearch"]
}
```

OpenCode will install it automatically at startup.

## Configuration (optional)

No configuration is needed if your active chat model belongs to a supported provider. To customize which model handles web searches, tag a model with `"websearch": "auto"` or `"websearch": "always"`.

### Model selection

The plugin chooses which model to use for each search:

| Priority | Condition                                      | Behavior                                                                  |
| -------- | ---------------------------------------------- | ------------------------------------------------------------------------- |
| 1        | A model is tagged `"always"`                   | That model is **always** used, regardless of what you're chatting with    |
| 2        | Your active chat model is a supported provider | The active model is used directly -- no extra configuration needed        |
| 3        | A model is tagged `"auto"`                     | That model is used as a **fallback** when the active model is unsupported |
| 4        | None of the above                              | An error is returned                                                      |

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

Use `"always"` to lock web search to a specific model, regardless of what you're chatting with.

```json
{
  "provider": {
    "openai": {
      "models": {
        "gpt-5.2": {
          "options": {
            "websearch": "always"
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
