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

// ── Constants ──────────────────────────────────────────────────────────

const RESOLUTION_PRIORITY: ProviderType[] = ["anthropic", "chatgpt", "openai", "copilot"];

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

const detectProviderTypeFromNpm = (npmPackage: string): ProviderType | null => {
  for (const rule of PROVIDER_RULES) {
    if (rule.npmPackage === npmPackage) {
      return rule.type;
    }
  }

  return null;
};

const detectProviderTypeFromProviderID = (providerID: string): ProviderType | null => {
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

const detectProviderTypeFromModel = (model: ProviderModelLike): ProviderType | null =>
  detectProviderTypeFromNpm(model.api.npm);

export {
  detectProviderTypeFromModel,
  detectProviderTypeFromNpm,
  detectProviderTypeFromProviderID,
  RESOLUTION_PRIORITY,
};
