# opencode-websearch

Native web search for [OpenCode](https://opencode.ai), powered by your model's built-in search capability. No extra API keys or search services required. If you're on a supported provider, it works without any extra setup.

Inspired by Claude Code's WebSearch tool.

## Supported providers

| Provider         | What you need                                                            |
| ---------------- | ------------------------------------------------------------------------ |
| Anthropic        | An Anthropic provider/model in OpenCode with built-in web search support |
| OpenAI / ChatGPT | OpenAI configured in OpenCode (API key or ChatGPT connected)             |
| GitHub Copilot   | GitHub Copilot connected in OpenCode                                     |

Model-level web search support depends on the provider and model you use.

## Install

Add the plugin to your `opencode.json` and OpenCode will install it automatically on startup.

```json
{
  "plugin": ["opencode-websearch"]
}
```

## Configuration (optional)

By default the plugin uses your active model. The optional `"websearch"` flag lets you pin or provide a fallback model for search:

- `"always"`: always use this model for web search
- `"auto"`: use this model as fallback when your active provider is not supported

### Selection order

1. A model tagged `"websearch": "always"`
2. Your active model (if on a supported provider)
3. A model tagged `"websearch": "auto"`
4. Otherwise, the tool returns an error

### Example

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

### Local development

Clone the repo and symlink the source entry into your OpenCode plugin directory:

```sh
git clone https://github.com/emilsvennesson/opencode-websearch ~/.config/opencode/opencode-websearch
cd ~/.config/opencode/opencode-websearch
bun install
mkdir -p ~/.config/opencode/plugin
ln -sf ~/.config/opencode/opencode-websearch/src/index.ts ~/.config/opencode/plugin/websearch.ts
```

OpenCode loads the plugin directly from source at startup.

> When using this symlink setup, remove `"opencode-websearch"` from the `plugin` array in `opencode.json` to avoid loading it twice.

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
