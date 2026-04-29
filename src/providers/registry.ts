import { ProviderType, ScannableProviderType } from "../types.js";

// ── Constants ──────────────────────────────────────────────────────────

/**
 * Map of canonical OpenCode provider IDs to the web-search provider type
 * that handles them. The IDs match the well-known identifiers used by
 * OpenCode and models.dev (see `packages/opencode/src/provider/schema.ts`).
 *
 * Custom-renamed providers in `opencode.json` are intentionally not
 * supported here — users must use the canonical provider ID.
 */
const PROVIDER_TYPES_BY_ID: Record<string, ScannableProviderType> = {
  anthropic: "anthropic",
  "github-copilot": "copilot",
  moonshotai: "moonshot",
  "moonshotai-cn": "moonshot",
  openai: "openai",
};

/**
 * Provider types that are scannable from OpenCode provider config,
 * in the order they should be preferred when multiple providers offer
 * a `lockedModel` or `fallbackModel`.
 */
const SCANNABLE_TYPES: ScannableProviderType[] = ["anthropic", "copilot", "moonshot", "openai"];

/**
 * Order in which we resolve `lockedModel` / `fallbackModel` candidates
 * across providers when picking which one wins.
 */
const RESOLUTION_PRIORITY: ProviderType[] = [
  "anthropic",
  "chatgpt",
  "moonshot",
  "openai",
  "copilot",
];

// ── Helpers ────────────────────────────────────────────────────────────

const detectProviderType = (providerID: string): ScannableProviderType | null =>
  PROVIDER_TYPES_BY_ID[providerID] ?? null;

export { detectProviderType, RESOLUTION_PRIORITY, SCANNABLE_TYPES };
