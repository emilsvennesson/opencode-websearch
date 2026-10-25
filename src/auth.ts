import { Credential, Plugin } from "@opencode/plugin";

import { CHATGPT_DEFAULT_BASE_URL } from "./providers/chatgpt/constants.js";
import { COPILOT_DEFAULT_BASE_URL } from "./providers/copilot/constants.js";
import { ProviderCredentials, ProviderData, ProviderSettings, ProviderType } from "./types.js";

// ── Constants ──────────────────────────────────────────────────────────

const CANONICAL_COPILOT_ID = "github-copilot";
const CANONICAL_OPENAI_ID = "openai";
const CANONICAL_XAI_ID = "xai";

// ── Types ──────────────────────────────────────────────────────────────

interface CredentialResolution {
  credentials: ProviderCredentials;
  type: ProviderType;
}

// ── Credential helpers ─────────────────────────────────────────────────

const configuredResolution = (
  settings: ProviderSettings,
  type: ProviderType,
): CredentialResolution | null =>
  settings.apiKey
    ? { credentials: { apiKey: settings.apiKey, baseURL: settings.baseURL }, type }
    : null;

const metadataString = (
  metadata: Readonly<Record<string, unknown>> | undefined,
  key: string,
): string | undefined => {
  const value = metadata?.[key];
  return typeof value === "string" && value ? value : undefined;
};

const normalizeDomain = (value: string): string =>
  value
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

const normalizeBaseURL = (value: string): string => value.replace(/\/+$/, "");

const isChatGPTEndpoint = (baseURL: string | undefined): boolean =>
  !baseURL || normalizeBaseURL(baseURL) === CHATGPT_DEFAULT_BASE_URL;

const isCopilotEndpoint = (baseURL: string | undefined): boolean =>
  !baseURL || normalizeBaseURL(baseURL) === COPILOT_DEFAULT_BASE_URL;

const resolveCopilotBaseURL = (metadata: Readonly<Record<string, unknown>> | undefined): string => {
  const endpoint = metadataString(metadata, "apiEndpoint");
  if (endpoint) {
    return normalizeBaseURL(endpoint);
  }

  const enterpriseUrl = metadataString(metadata, "enterpriseUrl");
  if (!enterpriseUrl) {
    return COPILOT_DEFAULT_BASE_URL;
  }

  const domain = normalizeDomain(enterpriseUrl);
  return domain ? `https://copilot-api.${domain}` : COPILOT_DEFAULT_BASE_URL;
};

// ── OAuth resolution ───────────────────────────────────────────────────

const resolveOAuthCredentials = (
  provider: ProviderData,
  type: ProviderType,
  credential: Credential.OAuth,
  settings: ProviderSettings,
): CredentialResolution | null => {
  if (
    provider.id === CANONICAL_OPENAI_ID &&
    type === "openai" &&
    isChatGPTEndpoint(settings.baseURL)
  ) {
    return {
      credentials: {
        accountId: metadataString(credential.metadata, "accountID"),
        apiKey: credential.access,
        baseURL: CHATGPT_DEFAULT_BASE_URL,
      },
      type: "chatgpt",
    };
  }

  if (
    provider.id === CANONICAL_COPILOT_ID &&
    type === "copilot" &&
    isCopilotEndpoint(settings.baseURL)
  ) {
    return {
      credentials: {
        apiKey: credential.refresh,
        baseURL: resolveCopilotBaseURL(credential.metadata),
      },
      type,
    };
  }

  if (provider.id === CANONICAL_XAI_ID && type === "xai") {
    return {
      credentials: { apiKey: credential.access, baseURL: settings.baseURL },
      type,
    };
  }

  return configuredResolution(settings, type);
};

// ── Public API ─────────────────────────────────────────────────────────

/** Resolve the active V2 integration connection into provider credentials. */
const resolveCredentials = async (
  ctx: Plugin.Context,
  provider: ProviderData,
  type: ProviderType,
  settings: ProviderSettings,
): Promise<CredentialResolution | null> => {
  if (!provider.integrationID) {
    return configuredResolution(settings, type);
  }

  const connection = await ctx.integration.connection.active(provider.integrationID);
  const credential = connection ? await ctx.integration.connection.resolve(connection) : undefined;
  if (!credential) {
    return configuredResolution(settings, type);
  }

  if (credential.type === "key") {
    return {
      credentials: { apiKey: credential.key, baseURL: settings.baseURL },
      type,
    };
  }

  if (credential.type === "oauth") {
    return resolveOAuthCredentials(provider, type, credential, settings);
  }

  return configuredResolution(settings, type);
};

export { resolveCredentials };
