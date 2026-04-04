import { existsSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";

import { COPILOT_DEFAULT_BASE_URL } from "../constants.js";

// ── Types ──────────────────────────────────────────────────────────────

interface CopilotAuthEntry {
  enterpriseUrl?: string;
  refresh?: string;
  type?: string;
}

interface CopilotCredentials {
  apiKey: string;
  baseURL?: string;
}

interface PathClient {
  path: {
    get: (options?: { query?: { directory?: string } }) => Promise<{ data?: { state?: string } }>;
  };
}

// ── Constants ──────────────────────────────────────────────────────────

const AUTH_FILE_NAME = "auth.json";
const COPILOT_AUTH_KEY = "github-copilot";
const EMPTY_LENGTH = 0;
const OPENCODE_DIR = "opencode";
const REMOVE_LAST_CHARACTER = -1;
const SHARE_DIR = "share";
const STATE_DIR = "state";

// ── Helpers ────────────────────────────────────────────────────────────

const normalizeDomain = (value: string): string => {
  let domain = value.trim();

  if (domain.startsWith("https://")) {
    domain = domain.slice("https://".length);
  } else if (domain.startsWith("http://")) {
    domain = domain.slice("http://".length);
  }

  if (domain.endsWith("/")) {
    domain = domain.slice(EMPTY_LENGTH, REMOVE_LAST_CHARACTER);
  }

  return domain;
};

const buildCopilotBaseURL = (enterpriseUrl: string | undefined): string => {
  if (!enterpriseUrl) {
    return COPILOT_DEFAULT_BASE_URL;
  }

  const domain = normalizeDomain(enterpriseUrl);
  if (domain.length === EMPTY_LENGTH) {
    return COPILOT_DEFAULT_BASE_URL;
  }

  return `https://copilot-api.${domain}`;
};

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

const readCopilotEntry = (authPath: string): CopilotAuthEntry | null => {
  if (!existsSync(authPath)) {
    return null;
  }

  const content = readFileSync(authPath, "utf8");
  const authStore = parseAuthStore(content);
  if (!authStore) {
    return null;
  }

  const candidate = authStore[COPILOT_AUTH_KEY];
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  return candidate as CopilotAuthEntry;
};

const buildCredentials = (entry: CopilotAuthEntry): CopilotCredentials | null => {
  if (entry.type !== "oauth") {
    return null;
  }
  if (typeof entry.refresh !== "string" || entry.refresh.length === EMPTY_LENGTH) {
    return null;
  }

  return {
    apiKey: entry.refresh,
    baseURL: buildCopilotBaseURL(entry.enterpriseUrl),
  };
};

const resolveCopilotCredentials = async (
  client: PathClient,
  directory: string,
): Promise<CopilotCredentials | null> => {
  const authPath = await resolveAuthPath(client, directory);
  if (!authPath) {
    return null;
  }

  const entry = readCopilotEntry(authPath);
  if (!entry) {
    return null;
  }

  return buildCredentials(entry);
};

export { resolveCopilotCredentials };
