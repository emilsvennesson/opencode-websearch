import { ProviderData, ProviderModel, ScannableProviderType } from "../types.js";

// ── Constants ──────────────────────────────────────────────────────────

const PROVIDER_TYPES_BY_ID: Record<string, ScannableProviderType> = {
  anthropic: "anthropic",
  "github-copilot": "copilot",
  moonshotai: "moonshot",
  "moonshotai-cn": "moonshot",
  openai: "openai",
  xai: "xai",
};

/** Unambiguous V2 provider packages that identify the API dialect. */
const PACKAGE_TO_TYPE: Record<string, ScannableProviderType> = {
  "@ai-sdk/anthropic": "anthropic",
  "@ai-sdk/github-copilot": "copilot",
  "@ai-sdk/openai": "openai",
  "@ai-sdk/xai": "xai",
  "@opencode/ai/providers/anthropic": "anthropic",
  "@opencode/ai/providers/anthropic-compatible": "anthropic",
  "@opencode/ai/providers/moonshot": "moonshot",
  "@opencode/ai/providers/openai": "openai",
  "@opencode/ai/providers/xai": "xai",
  "aisdk:@ai-sdk/anthropic": "anthropic",
  "aisdk:@ai-sdk/github-copilot": "copilot",
  "aisdk:@ai-sdk/openai": "openai",
  "aisdk:@ai-sdk/xai": "xai",
};

// ── Helpers ────────────────────────────────────────────────────────────

const detectByID = (id: string | undefined): ScannableProviderType | null =>
  id ? (PROVIDER_TYPES_BY_ID[id] ?? null) : null;

const detectByPackage = (packageName: string | undefined): ScannableProviderType | null =>
  packageName ? (PACKAGE_TO_TYPE[packageName] ?? null) : null;

/** Identify the adapter for a V2 provider and its model runtime overrides. */
const detectProviderType = (
  provider: Pick<ProviderData, "canonical" | "id" | "package">,
  models: Pick<ProviderModel, "package">[] = [],
): ScannableProviderType | null => {
  const direct = detectByID(provider.id) ?? detectByID(provider.canonical);
  if (direct) {
    return direct;
  }

  const providerPackage = detectByPackage(provider.package);
  if (providerPackage) {
    return providerPackage;
  }

  for (const model of models) {
    const modelPackage = detectByPackage(model.package);
    if (modelPackage) {
      return modelPackage;
    }
  }

  return null;
};

export { detectProviderType };
