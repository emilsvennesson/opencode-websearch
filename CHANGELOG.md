# Changelog

## [0.7.0](https://github.com/emilsvennesson/opencode-websearch/compare/v0.6.0...v0.7.0) (2026-10-25)


### ⚠ BREAKING CHANGES

* the "auto" websearch model option is removed. Searches use the model marked "websearch": "always", otherwise the default model when its provider is supported. Replace "auto" with "always".
* port to OpenCode V2 native websearch backend with structured results ([#27](https://github.com/emilsvennesson/opencode-websearch/issues/27))

### Features

* add OpenCode Go, Z.ai, and DeepSeek web search providers ([#31](https://github.com/emilsvennesson/opencode-websearch/issues/31)) ([d1958ec](https://github.com/emilsvennesson/opencode-websearch/commit/d1958ecb1bef9c054ad94a5756863bfaf9851cca))
* add xAI web search provider ([#25](https://github.com/emilsvennesson/opencode-websearch/issues/25)) ([775eac4](https://github.com/emilsvennesson/opencode-websearch/commit/775eac481fcf778080ef1effedb32988dd10974a))
* port to OpenCode V2 native websearch backend with structured results ([#27](https://github.com/emilsvennesson/opencode-websearch/issues/27)) ([a32debe](https://github.com/emilsvennesson/opencode-websearch/commit/a32debe51b398747dc6a1b56f792d1e3bacc7cc7))
* remove "websearch": "auto" ([#32](https://github.com/emilsvennesson/opencode-websearch/issues/32)) ([39642ad](https://github.com/emilsvennesson/opencode-websearch/commit/39642ad390178a810289fd3b97877bc5f216d465))


### Documentation

* merge the OpenCode Go section into model selection ([#33](https://github.com/emilsvennesson/opencode-websearch/issues/33)) ([820ecd4](https://github.com/emilsvennesson/opencode-websearch/commit/820ecd4989ece0b5e96594d8cd8462b092f342ad))
* rewrite AGENTS.md and trim README ([#30](https://github.com/emilsvennesson/opencode-websearch/issues/30)) ([5576cc4](https://github.com/emilsvennesson/opencode-websearch/commit/5576cc445c2f46fd5bee68dc96f9a0e37b30a774))
