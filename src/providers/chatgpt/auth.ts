import { CHATGPT_DEFAULT_BASE_URL } from "./constants.js";
import { PathClient, readAuthEntry } from "../shared/auth.js";

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

// ── Constants ──────────────────────────────────────────────────────────

const OPENAI_AUTH_KEY = "openai";

// ── Helpers ────────────────────────────────────────────────────────────

const buildCredentials = (entry: ChatGPTAuthEntry): ChatGPTCredentials | null => {
  if (entry.type !== "oauth") {
    return null;
  }

  if (typeof entry.access !== "string" || !entry.access) {
    return null;
  }

  if (typeof entry.accountId !== "string" || !entry.accountId) {
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
  const entry = await readAuthEntry<ChatGPTAuthEntry>(client, directory, OPENAI_AUTH_KEY);

  return entry ? buildCredentials(entry) : null;
};

export { ChatGPTCredentials, resolveChatGPTCredentials };
