# AGENTS.md

OpenCode plugin that provides web search via Anthropic's server-side `web_search` API.
Single-file TypeScript project built with Bun, linted with oxlint.

## Commands

```sh
bun install          # install dependencies
bun run lint         # oxlint (with tsconfig, unicorn/typescript/import/oxc plugins)
bun run typecheck    # tsc --noEmit
bun run check        # lint + typecheck (the full quality gate)
bun run build        # bun build (ESM bundle) + tsc (declaration files) → dist/
```

There are no tests yet. When adding tests, use `bun:test` (built into Bun).

## Project structure

```
src/index.ts      # entire plugin implementation (single file)
dist/             # build output (gitignored)
.oxlintrc.json    # oxlint configuration
tsconfig.json     # TypeScript config (strict, ESNext, verbatimModuleSyntax)
package.json      # Bun-based project, ESM module
```

## Code style

### Functions

- Use **arrow functions** assigned to `const`. No `function` declarations.
- Keep functions small: **10 statements max** per function (`max-statements` rule).
  Break larger logic into focused helper functions.
- **3 parameters max** per function (`max-params` rule). Group related params
  into a context/options interface when you need more.

### Variables and constants

- **No magic numbers.** Extract every numeric literal to a named `UPPER_SNAKE_CASE`
  constant (e.g. `EMPTY_LENGTH = 0`, `PAD_LENGTH = 2`, `MAX_RESPONSE_TOKENS = 16_000`).
- Local variables: `camelCase`.
- Module-level constants: `UPPER_SNAKE_CASE`.

### Types and interfaces

- Use `interface` for object shapes. PascalCase, no `I` prefix.
- Sort interface properties alphabetically (enforced by `sort-keys`).
- Use `satisfies` for type-safe inference where possible (e.g. `satisfies Plugin`).
- TypeScript strict mode is enabled. Do not use `any`; prefer `unknown` and narrow.

### Imports

- `verbatimModuleSyntax` is on: type-only imports **must** use `import type` on
  a separate line, not inline `import { type Foo }`.
- Use `node:` prefix for Node.js builtins (`node:fs`, `node:os`, `node:path`).
- Sort imports: named/multiple imports (`{ ... }`) before default imports.
  Alphabetize members within an import (`{ existsSync, readFileSync }`).
- Do not duplicate import sources. If the linter rules conflict (e.g. separate
  `import type` from the same module), use an `oxlint-disable-next-line` comment
  with an explanation.

### Control flow

- **No `continue` statements.** Restructure loops to use early returns from
  extracted helper functions instead.
- **No ternary expressions.** Use `if`/`else` blocks.
- Always use **braces** with `if`/`else`/`for`/`while` (enforced by `curly`).

### Strings

- Double quotes for strings.
- Use template literals for interpolation.
- Use `"utf8"` (not `"utf-8"`) for encoding identifiers (unicorn rule).

### Object literals

- Sort keys alphabetically (enforced by `sort-keys`).

### Error handling

- Catch variables must be named `error` (unicorn `catch-error-name` rule).
- Use `instanceof` to narrow error types: check specific classes first
  (`APIError`, `SyntaxError`), then `Error`, then fall back to `String(error)`.
- Return error strings from tool `execute()` rather than throwing.

### Exports

- Single `export default` at the bottom of the file.
- The plugin export is an async arrow function returning the hooks/tools object,
  typed with `satisfies Plugin`.

### Comments

- Use `// ── Section Name ──────...` divider comments to separate logical sections
  (Types, Constants, Helpers, Config resolution, Response formatting, Plugin).
- Use `oxlint-disable-next-line <rule> -- <reason>` when suppressing a lint rule.
  Always include the reason.

## Linter configuration

oxlint with plugins: `unicorn`, `typescript`, `import`, `oxc`.

| Category     | Level |
|--------------|-------|
| correctness  | error |
| suspicious   | warn  |
| perf         | warn  |
| style        | warn  |

Key rules that shape the code:
- `no-magic-numbers`, `max-statements` (10), `max-params` (3)
- `no-continue`, `no-ternary`, `curly`, `sort-keys`, `sort-imports`
- `func-style` (expressions only), `init-declarations`, `id-length` (min 2)
- `unicorn/catch-error-name`, `unicorn/text-encoding-identifier-case`
- `typescript/no-unused-vars` (error)

Disabled rules (with rationale):
- `unicorn/no-null` -- null is used intentionally alongside undefined
- `unicorn/prefer-top-level-await` -- plugin is a function export, not a script
- `unicorn/filename-case` -- PascalCase not enforced on filenames
- `unicorn/prevent-abbreviations` -- short names like `ctx`, `env`, `url` are clear
- `unicorn/prefer-ternary` -- conflicts with `no-ternary`
- `import/no-nodejs-modules` -- this is a Node.js plugin; fs/os/path are required

## Dependencies

- **Runtime:** `@anthropic-ai/sdk` -- Anthropic API client
- **Peer:** `@opencode-ai/plugin` -- OpenCode plugin SDK (provides `Plugin` type and `tool` helper)
- **Dev:** `oxlint`, `typescript`, `@types/bun`
