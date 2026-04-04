# opencode-websearch

Web search plugin for [OpenCode](https://opencode.ai) that provides web search functionality using each provider's native APIs, inspired by Claude Code's WebSearch tool.

## Supported providers

| Provider       | SDK package              | Search mechanism                                                                                                          | Notes                                                                                                                                                       |
| -------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anthropic      | `@ai-sdk/anthropic`      | [Web search tool](https://docs.anthropic.com/en/docs/build-with-claude/tool-use/web-search-tool)                          | This plugin uses Anthropic tool type `web_search_20250305`; model compatibility follows that tool version.                                                     |
| OpenAI         | `@ai-sdk/openai`         | [Responses API web search](https://platform.openai.com/docs/guides/tools-web-search)                                      | Known unsupported: `gpt-4.1-nano`, and `gpt-5` with `reasoning.effort: "minimal"`.                                                                        |
| GitHub Copilot | `@ai-sdk/github-copilot` | [Copilot model-native web search](https://github.blog/changelog/2026-02-25-improved-web-search-in-copilot-on-github-com/) | Requires `Copilot can search the web using model native search` to be enabled in GitHub Copilot settings. OpenAI-family models are working here; Claude models do not appear to work with Copilot built-in model-native search capabilities. |

These limitations are based on current provider docs and can change over time.

## Install

Add the plugin to your `opencode.json`:

```json
{
  "plugin": ["opencode-websearch"]
}
```

OpenCode will install it automatically at startup.

## Configuration (optional)

No configuration is needed if your active chat model supports the provider's native web search capability used by this plugin. To customize which model handles web searches, tag a model with `"websearch": "auto"` or `"websearch": "always"`.

### Model selection

The plugin chooses which model to use for each search:

| Priority | Condition                                      | Behavior                                                                  |
| -------- | ---------------------------------------------- | ------------------------------------------------------------------------- |
| 1        | A model is tagged `"always"`                   | That model is **always** used, regardless of what you're chatting with    |
| 2        | Your active chat model supports native web search | The active model is used directly -- no extra configuration needed        |
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
