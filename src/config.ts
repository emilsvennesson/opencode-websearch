import { Plugin } from "@opencode/plugin";

import { resolveCredentials } from "./auth.js";
import { detectProviderType } from "./providers/registry.js";
import {
  DefaultModel,
  PickedModel,
  ProviderData,
  ProviderModel,
  ProviderResolution,
  ProviderSettings,
  ScannableProviderType,
} from "./types.js";

// ── Types ──────────────────────────────────────────────────────────────

interface ScannedResolution {
  lockedModel?: string;
  provider: ProviderData;
  settings: ProviderSettings;
  type: ScannableProviderType;
}

// ── Constants ──────────────────────────────────────────────────────────

const NO_RESOLUTIONS = 0;
const UNKNOWN_MODEL = "unknown";
const WEBSEARCH_ALWAYS = "always";

// ── Provider scanning ──────────────────────────────────────────────────

const extractStringOption = (
  options: Record<string, unknown> | undefined,
  key: string,
): string | undefined => {
  const value = options?.[key];
  return typeof value === "string" && value ? value : undefined;
};

const stripV1Suffix = (url: string): string => url.replace(/\/v1\/?$/, "");

const normalizeBaseURL = (type: ScannableProviderType, baseURL: string): string =>
  type === "anthropic" ? stripV1Suffix(baseURL) : baseURL;

const resolveSettings = (provider: ProviderData, type: ScannableProviderType): ProviderSettings => {
  const apiKey = extractStringOption(provider.settings, "apiKey");
  const configuredURL = extractStringOption(provider.settings, "baseURL");

  return {
    apiKey,
    baseURL: configuredURL ? normalizeBaseURL(type, configuredURL) : undefined,
  };
};

const findLockedModel = (models: ProviderModel[]): string | undefined =>
  models.find((model) => model.enabled && model.settings?.websearch === WEBSEARCH_ALWAYS)?.modelID;

const scanProvider = (
  provider: ProviderData,
  models: ProviderModel[],
): ScannedResolution | null => {
  const type = detectProviderType(provider, models);
  if (!type) {
    return null;
  }

  return {
    lockedModel: findLockedModel(models),
    provider,
    settings: resolveSettings(provider, type),
    type,
  };
};

const scanProviders = (providers: ProviderData[], models: ProviderModel[]): ScannedResolution[] => {
  const resolutions: ScannedResolution[] = [];

  for (const provider of providers) {
    const providerModels = models.filter((model) => model.providerID === provider.id);
    const resolution = scanProvider(provider, providerModels);
    if (resolution) {
      resolutions.push(resolution);
    }
  }

  return resolutions;
};

// ── Route selection ────────────────────────────────────────────────────

/**
 * Pick a model using the V2 default model instead of session-specific state:
 * a model locked with `"websearch": "always"`, then the default model on a supported provider.
 */
const pickModel = (
  resolutions: ProviderResolution[],
  defaultModel: DefaultModel | null,
): PickedModel | null => {
  const locked = resolutions.find((resolution) => resolution.lockedModel);
  if (locked?.lockedModel) {
    return { modelID: locked.lockedModel, resolution: locked };
  }

  const direct = resolutions.find(
    (resolution) => resolution.providerID === defaultModel?.providerID,
  );
  if (direct && defaultModel) {
    return { modelID: defaultModel.modelID, resolution: direct };
  }

  return null;
};

// ── Credential resolution ──────────────────────────────────────────────

const hasResolution = (resolution: ProviderResolution | null): resolution is ProviderResolution =>
  resolution !== null;

const loadResolutions = async (
  ctx: Plugin.Context,
  providers: ProviderData[],
  models: ProviderModel[],
): Promise<ProviderResolution[]> => {
  const scanned = scanProviders(providers, models);
  const resolutions = await Promise.all(
    scanned.map(async (current): Promise<ProviderResolution | null> => {
      const resolved = await resolveCredentials(
        ctx,
        current.provider,
        current.type,
        current.settings,
      );
      if (!resolved) {
        return null;
      }

      return {
        credentials: resolved.credentials,
        headers: current.provider.headers,
        lockedModel: current.lockedModel,
        providerID: current.provider.id,
        type: resolved.type,
      };
    }),
  );

  return resolutions.filter(hasResolution);
};

// ── Errors ─────────────────────────────────────────────────────────────

const formatNoProviderError = (): string =>
  `Error: websearch requires an Anthropic, OpenAI, Moonshot, xAI, Z.ai, DeepSeek, OpenCode Go, or GitHub Copilot provider.

No supported provider credentials were found. Connect a supported provider with /connect, or configure its API key and reload OpenCode.`;

const formatUnsupportedProviderError = (defaultModelID: string): string =>
  `Error: the default model (${defaultModelID}) is not on a supported web-search provider.

Change the default model, or set "websearch" to "always" in a supported model's settings to use it for every search.`;

// ── Public API ─────────────────────────────────────────────────────────

/** Attach the picked model's endpoint, which can differ per model on multi-API providers. */
const withModelRuntime = (picked: PickedModel, models: ProviderModel[]): PickedModel => {
  const model = models.find(
    (candidate) =>
      candidate.providerID === picked.resolution.providerID && candidate.modelID === picked.modelID,
  );

  return { ...picked, modelBaseURL: extractStringOption(model?.settings, "baseURL") };
};

const resolveSearchRoute = async (ctx: Plugin.Context): Promise<PickedModel> => {
  const [providers, models, defaultModel] = await Promise.all([
    ctx.provider.list(),
    ctx.model.list(),
    ctx.model.default(),
  ]);
  const resolutions = await loadResolutions(ctx, providers.data, models.data);
  const picked = pickModel(resolutions, defaultModel.data);
  if (picked) {
    return withModelRuntime(picked, models.data);
  }

  if (resolutions.length === NO_RESOLUTIONS) {
    throw new Error(formatNoProviderError());
  }

  throw new Error(formatUnsupportedProviderError(defaultModel.data?.modelID ?? UNKNOWN_MODEL));
};

export { pickModel, resolveSearchRoute, scanProviders, withModelRuntime };
