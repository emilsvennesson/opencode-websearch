import { existsSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";

import { CHATGPT_DEFAULT_BASE_URL } from "./constants.js";

// ── Types ──────────────────────────────────────────────────────────────

interface ChatGPTAuthEntry {
  access?: string;
  accountId?: string;
  type?: string;
}

interface ChatGPTCredentials {
  accountId: string;
  apiKey: string;
  baseURL: string;
}

interface PathClient {
  path: {
    get: (options?: { query?: { directory?: string } }) => Promise<{ data?: { state?: string } }>;
  };
}

// ── Constants ──────────────────────────────────────────────────────────

const AUTH_FILE_NAME = "auth.json";
const EMPTY_LENGTH = 0;
const OPENAI_AUTH_KEY = "openai";
const OPENCODE_DIR = "opencode";
const SHARE_DIR = "share";
const STATE_DIR = "state";

// ── Helpers ────────────────────────────────────────────────────────────

const resolveAuthPathFromStatePath = (statePath: string | undefined): string | null => {
  if (!statePath) {
    return null;
  }

  const stateMarker = `${sep}${STATE_DIR}${sep}${OPENCODE_DIR}`;
  if (!statePath.endsWith(stateMarker)) {
    return null;
  }

  const dataMarker = `${sep}${SHARE_DIR}${sep}${OPENCODE_DIR}`;
  const dataPath = `${statePath.slice(EMPTY_LENGTH, -stateMarker.length)}${dataMarker}`;
  return join(dataPath, AUTH_FILE_NAME);
};

const resolveAuthPath = async (client: PathClient, directory: string): Promise<string | null> => {
  const response = await client.path.get({ query: { directory } });
  if (!response.data) {
    return null;
  }

  const statePath = response.data.state;
  if (typeof statePath !== "string") {
    return null;
  }

  return resolveAuthPathFromStatePath(statePath);
};

const parseAuthStore = (content: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
};

const readOpenAIEntry = (authPath: string): ChatGPTAuthEntry | null => {
  if (!existsSync(authPath)) {
    return null;
  }

  const content = readFileSync(authPath, "utf8");
  const authStore = parseAuthStore(content);
  if (!authStore) {
    return null;
  }

  const candidate = authStore[OPENAI_AUTH_KEY];
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  return candidate as ChatGPTAuthEntry;
};

const buildCredentials = (entry: ChatGPTAuthEntry): ChatGPTCredentials | null => {
  if (entry.type !== "oauth") {
    return null;
  }

  if (typeof entry.access !== "string" || entry.access.length === EMPTY_LENGTH) {
    return null;
  }

  if (typeof entry.accountId !== "string" || entry.accountId.length === EMPTY_LENGTH) {
    return null;
  }

  return {
    accountId: entry.accountId,
    apiKey: entry.access,
    baseURL: CHATGPT_DEFAULT_BASE_URL,
  };
};

const resolveChatGPTCredentials = async (
  client: PathClient,
  directory: string,
): Promise<ChatGPTCredentials | null> => {
  const authPath = await resolveAuthPath(client, directory);
  if (!authPath) {
    return null;
  }

  const entry = readOpenAIEntry(authPath);
  if (!entry) {
    return null;
  }

  return buildCredentials(entry);
};

export { ChatGPTCredentials, resolveChatGPTCredentials };
