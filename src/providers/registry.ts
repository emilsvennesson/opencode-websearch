import { ScannableProviderType } from "../types.js";

// ── Types ──────────────────────────────────────────────────────────────

interface ProviderModelLike {
  api: { npm: string };
}

interface ProviderDataLike {
  id: string;
  models: Record<string, ProviderModelLike>;
}

// ── Constants ──────────────────────────────────────────────────────────

/**
 * Map of canonical OpenCode provider IDs to the web-search provider type
 * that handles them. The IDs match the well-known identifiers used by
 * OpenCode and models.dev (see `packages/opencode/src/provider/schema.ts`).
 */
const PROVIDER_TYPES_BY_ID: Record<string, ScannableProviderType> = {
  anthropic: "anthropic",
  "github-copilot": "copilot",
  moonshotai: "moonshot",
  "moonshotai-cn": "moonshot",
  openai: "openai",
};

/**
 * Unambiguous SDK-package-to-type mappings. Used to detect custom-renamed
 * providers (e.g. `openai-prod`, `openai-staging`) so they can be handled
 * as their underlying type with their own credentials and baseURL.
 *
 * Moonshot is intentionally omitted: `@ai-sdk/openai-compatible` is shared
 * by many unrelated providers and cannot be auto-detected by npm alone.
 */
const NPM_TO_TYPE: Record<string, ScannableProviderType> = {
  "@ai-sdk/anthropic": "anthropic",
  "@ai-sdk/github-copilot": "copilot",
  "@ai-sdk/openai": "openai",
};

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Identify which adapter type should serve a given provider.
 *
 * 1. Match the canonical OpenCode provider ID (covers the common case).
 * 2. Fall back to matching any model's `api.npm` against the unambiguous
 *    SDK packages (covers custom-renamed providers like `openai-prod`).
 *
 * Returns `null` if neither matches; the provider will be ignored.
 */
const detectProviderType = (provider: ProviderDataLike): ScannableProviderType | null => {
  const byID = PROVIDER_TYPES_BY_ID[provider.id];
  if (byID) {
    return byID;
  }

  for (const model of Object.values(provider.models)) {
    const byNpm = NPM_TO_TYPE[model.api.npm];
    if (byNpm) {
      return byNpm;
    }
  }

  return null;
};

export { detectProviderType };
