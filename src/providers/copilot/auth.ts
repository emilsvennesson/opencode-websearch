import { COPILOT_DEFAULT_BASE_URL } from "./constants.js";
import { PathClient, readAuthEntry } from "../shared/auth.js";

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

// ── Constants ──────────────────────────────────────────────────────────

const COPILOT_AUTH_KEY = "github-copilot";
const HTTP_PREFIX = "http://";
const HTTPS_PREFIX = "https://";
const STRIP_LAST_CHAR = -1;
const STRING_START = 0;

// ── Helpers ────────────────────────────────────────────────────────────

const stripScheme = (value: string): string => {
  if (value.startsWith(HTTPS_PREFIX)) {
    return value.slice(HTTPS_PREFIX.length);
  }
  if (value.startsWith(HTTP_PREFIX)) {
    return value.slice(HTTP_PREFIX.length);
  }
  return value;
};

const normalizeDomain = (value: string): string => {
  const stripped = stripScheme(value.trim());
  return stripped.endsWith("/") ? stripped.slice(STRING_START, STRIP_LAST_CHAR) : stripped;
};

const buildCopilotBaseURL = (enterpriseUrl: string | undefined): string => {
  if (!enterpriseUrl) {
    return COPILOT_DEFAULT_BASE_URL;
  }

  const domain = normalizeDomain(enterpriseUrl);

  return domain ? `https://copilot-api.${domain}` : COPILOT_DEFAULT_BASE_URL;
};

const buildCredentials = (entry: CopilotAuthEntry): CopilotCredentials | null => {
  if (entry.type !== "oauth") {
    return null;
  }

  if (typeof entry.refresh !== "string" || !entry.refresh) {
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
  const entry = await readAuthEntry<CopilotAuthEntry>(client, directory, COPILOT_AUTH_KEY);

  return entry ? buildCredentials(entry) : null;
};

export { resolveCopilotCredentials };
