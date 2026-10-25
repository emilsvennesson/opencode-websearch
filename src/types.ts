// ── OpenCode V2 data shapes ────────────────────────────────────────────

/** Provider fields used by the web-search router. */
interface ProviderData {
  canonical?: string;
  id: string;
  integrationID?: string;
  package: string;
  settings?: Record<string, unknown>;
}

/** Model fields used by the web-search router. */
interface ProviderModel {
  enabled: boolean;
  modelID: string;
  package?: string;
  providerID: string;
  settings?: Record<string, unknown>;
}

/** Default model fields used during route selection. */
interface DefaultModel {
  modelID: string;
  providerID: string;
}

// ── Shared Types ───────────────────────────────────────────────────────

/** Provider settings before credentials have been resolved. */
interface ProviderSettings {
  apiKey?: string;
  baseURL?: string;
}

/** Credentials needed to call a provider API. */
interface ProviderCredentials {
  accountId?: string;
  apiKey: string;
  baseURL?: string;
}

/** Identifies which provider adapter should handle a search. */
type ProviderType = "anthropic" | "chatgpt" | "copilot" | "moonshot" | "openai" | "xai";

/** Provider types detectable from OpenCode provider metadata. */
type ScannableProviderType = Exclude<ProviderType, "chatgpt">;

/** Fully resolved configuration for one provider search call. */
interface SearchConfig extends ProviderCredentials {
  model: string;
}

/** One provider that can serve web-search requests. */
interface ProviderResolution {
  credentials: ProviderCredentials;
  fallbackModel?: string;
  lockedModel?: string;
  providerID: string;
  type: ProviderType;
}

/** The selected model and its provider resolution. */
interface PickedModel {
  modelID: string;
  resolution: ProviderResolution;
}

export {
  DefaultModel,
  PickedModel,
  ProviderCredentials,
  ProviderData,
  ProviderModel,
  ProviderResolution,
  ProviderSettings,
  ProviderType,
  ScannableProviderType,
  SearchConfig,
};
