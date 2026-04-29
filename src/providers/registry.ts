import { ProviderType } from "../types.js";

// ── Types ──────────────────────────────────────────────────────────────

interface ProviderModelLike {
  api: { npm: string };
}

interface ProviderRule {
  idHints: string[];
  npmPackage: string;
  type: ProviderType;
}

interface ProviderModelDetectionContext {
  model: ProviderModelLike;
  providerID: string;
}

// ── Constants ──────────────────────────────────────────────────────────

const MOONSHOT_PROVIDER_ID = "moonshotai";
const OPENAI_COMPATIBLE_PACKAGE = "@ai-sdk/openai-compatible";

const RESOLUTION_PRIORITY: ProviderType[] = [
  "anthropic",
  "chatgpt",
  "moonshot",
  "openai",
  "copilot",
];

const PROVIDER_RULES: ProviderRule[] = [
  {
    idHints: ["anthropic"],
    npmPackage: "@ai-sdk/anthropic",
    type: "anthropic",
  },
  {
    idHints: ["openai"],
    npmPackage: "@ai-sdk/openai",
    type: "openai",
  },
  {
    idHints: ["github-copilot", "copilot"],
    npmPackage: "@ai-sdk/github-copilot",
    type: "copilot",
  },
];

// ── Helpers ────────────────────────────────────────────────────────────

const isMoonshotProviderID = (providerID: string): boolean => {
  const normalizedProviderID = providerID.toLowerCase();

  return normalizedProviderID === MOONSHOT_PROVIDER_ID;
};

const detectProviderTypeFromNpm = (npmPackage: string): ProviderType | null => {
  for (const rule of PROVIDER_RULES) {
    if (rule.npmPackage === npmPackage) {
      return rule.type;
    }
  }

  return null;
};

const detectProviderTypeFromProviderID = (providerID: string): ProviderType | null => {
  if (isMoonshotProviderID(providerID)) {
    return "moonshot";
  }

  const normalizedProviderID = providerID.toLowerCase();

  for (const rule of PROVIDER_RULES) {
    for (const hint of rule.idHints) {
      if (normalizedProviderID.includes(hint)) {
        return rule.type;
      }
    }
  }

  return null;
};

const detectProviderTypeFromModel = (
  context: ProviderModelDetectionContext,
): ProviderType | null => {
  const { model } = context;
  const directType = detectProviderTypeFromNpm(model.api.npm);
  if (directType) {
    return directType;
  }

  if (model.api.npm !== OPENAI_COMPATIBLE_PACKAGE) {
    return null;
  }

  if (isMoonshotProviderID(context.providerID)) {
    return "moonshot";
  }

  return null;
};

export {
  detectProviderTypeFromModel,
  detectProviderTypeFromNpm,
  detectProviderTypeFromProviderID,
  RESOLUTION_PRIORITY,
};
