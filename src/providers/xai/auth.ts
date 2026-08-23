import { PluginInput } from "@opencode-ai/plugin";

import { FetchFunction, FetchInput, ProviderCredentials } from "../../types.js";
import { readAuthEntry } from "../shared/auth.js";

// ── Types ──────────────────────────────────────────────────────────────

interface TokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
}

interface XAIAuthEntry {
  access?: string;
  expires?: number;
  refresh?: string;
  type?: string;
}

interface XAIOAuthEntry {
  access: string;
  expires: number;
  refresh: string;
  type: "oauth";
}

interface XAIOAuthCredentials extends ProviderCredentials {
  fetch: FetchFunction;
}

// ── Constants ──────────────────────────────────────────────────────────

const ACCESS_TOKEN_REFRESH_SKEW_MS = 120_000;
const CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
const DEFAULT_EXPIRES_SECONDS = 3600;
const MILLISECONDS_PER_SECOND = 1000;
const TOKEN_URL = "https://auth.x.ai/oauth2/token";
const XAI_AUTH_KEY = "xai";

// ── Auth state ─────────────────────────────────────────────────────────

const isOAuthEntry = (entry: XAIAuthEntry | null): entry is XAIOAuthEntry =>
  entry?.type === "oauth" &&
  typeof entry.access === "string" &&
  Boolean(entry.access) &&
  typeof entry.refresh === "string" &&
  Boolean(entry.refresh) &&
  typeof entry.expires === "number";

const readOAuthEntry = async (
  client: PluginInput["client"],
  directory: string,
): Promise<XAIOAuthEntry | null> => {
  const entry = await readAuthEntry<XAIAuthEntry>(client, directory, XAI_AUTH_KEY);

  return isOAuthEntry(entry) ? entry : null;
};

const refreshAccessToken = async (refreshToken: string): Promise<TokenResponse> => {
  const response = await fetch(TOKEN_URL, {
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`xAI token refresh failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }

  return response.json() as Promise<TokenResponse>;
};

const persistTokens = async (
  client: PluginInput["client"],
  current: XAIOAuthEntry,
  tokens: TokenResponse,
): Promise<XAIOAuthEntry> => {
  const updated: XAIOAuthEntry = {
    access: tokens.access_token,
    expires: Date.now() + (tokens.expires_in ?? DEFAULT_EXPIRES_SECONDS) * MILLISECONDS_PER_SECOND,
    refresh: tokens.refresh_token || current.refresh,
    type: "oauth",
  };

  await client.auth
    .set({
      body: updated,
      path: { id: XAI_AUTH_KEY },
    })
    .catch(() => undefined);

  return updated;
};

const needsRefresh = (entry: XAIOAuthEntry): boolean =>
  entry.expires - Date.now() <= ACCESS_TOKEN_REFRESH_SKEW_MS;

// ── Authenticated fetch ────────────────────────────────────────────────

const mergeHeaders = (input: FetchInput, init?: RequestInit): Headers => {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  if (init?.headers) {
    for (const [key, value] of new Headers(init.headers).entries()) {
      headers.set(key, value);
    }
  }

  return headers;
};

const createOAuthFetch = (
  client: PluginInput["client"],
  directory: string,
  initial: XAIOAuthEntry,
): FetchFunction => {
  let current = initial;
  let refreshPromise: Promise<XAIOAuthEntry> | undefined = undefined;

  return async (input, init) => {
    current = (await readOAuthEntry(client, directory)) ?? current;
    if (needsRefresh(current)) {
      refreshPromise ??= refreshAccessToken(current.refresh)
        .then((tokens) => persistTokens(client, current, tokens))
        .finally(() => {
          refreshPromise = undefined;
        });
      current = await refreshPromise;
    }

    const headers = mergeHeaders(input, init);
    headers.set("authorization", `Bearer ${current.access}`);

    return fetch(input, { ...init, headers });
  };
};

// ── Resolution ─────────────────────────────────────────────────────────

const resolveXAIOAuthCredentials = async (
  client: PluginInput["client"],
  directory: string,
): Promise<XAIOAuthCredentials | null> => {
  const entry = await readOAuthEntry(client, directory);
  if (!entry) {
    return null;
  }

  return {
    apiKey: entry.access,
    fetch: createOAuthFetch(client, directory, entry),
  };
};

export { resolveXAIOAuthCredentials };
