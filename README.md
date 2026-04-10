# opencode-websearch

Web search plugin for [OpenCode](https://opencode.ai) that provides web search functionality using each provider's native APIs, inspired by Claude Code's WebSearch tool.

## Supported providers

| Provider                 | SDK package              | Search mechanism                                                                                                          | Notes                                                                                                                                                       |
| ------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anthropic                | `@ai-sdk/anthropic`      | [Web search tool](https://docs.anthropic.com/en/docs/build-with-claude/tool-use/web-search-tool)                        | This plugin uses Anthropic tool type `web_search_20250305`; model compatibility follows that tool version.                                                 |
| OpenAI (API key)         | `@ai-sdk/openai`         | [Responses API web search](https://platform.openai.com/docs/guides/tools-web-search)                                    | Uses OpenAI API billing. Known unsupported: `gpt-4.1-nano`, and `gpt-5` with `reasoning.effort: "minimal"`.                                             |
| OpenAI (ChatGPT OAuth)   | OpenCode OpenAI OAuth    | ChatGPT Codex Responses stream (`https://chatgpt.com/backend-api/codex/responses`)                                      | Uses ChatGPT Plus/Pro OAuth via `/connect`. Preferred over OpenAI API-key routing for OpenAI models when both are available.                              |
| GitHub Copilot           | `@ai-sdk/github-copilot` | [Copilot model-native web search](https://github.blog/changelog/2026-02-25-improved-web-search-in-copilot-on-github-com/) | Requires `Copilot can search the web using model native search` to be enabled in GitHub Copilot settings. OpenAI-family models are working here; Claude models do not appear to work with Copilot built-in model-native search capabilities. |

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

Important: `"auto"` is a provider-level fallback, not a model-level fallback.

### OpenAI auth modes

For OpenAI models, this plugin supports two credential modes:

- OpenAI API key from your OpenCode provider config
- ChatGPT Plus/Pro OAuth from OpenCode `/connect`

If both are available, ChatGPT OAuth is preferred for OpenAI-model web searches.

### Model selection

The plugin chooses which model to use for each search:

| Priority | Condition                                                           | Behavior                                                               |
| -------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1        | A model is tagged `"always"`                                        | That model is **always** used, regardless of what you're chatting with |
| 2        | Active model is on a supported and configured provider              | The active model is used for web search                                |
| 3        | Active model is on an unsupported provider, and a model is `"auto"` | The `"auto"` model is used as fallback                                |
| 4        | None of the above                                                   | An error is returned                                                   |

### `"auto"` mode (fallback)

Use `"auto"` to set a fallback model when your active model is on an unsupported provider.

If your active model is on a supported provider, that active model is used, even if that specific model does not support web search.

If you want one model to always handle web search, use `"always"`.

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
