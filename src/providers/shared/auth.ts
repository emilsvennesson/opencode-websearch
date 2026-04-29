import { existsSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────

interface PathClient {
  path: {
    get: (options?: { query?: { directory?: string } }) => Promise<{ data?: { state?: string } }>;
  };
}

// ── Constants ──────────────────────────────────────────────────────────

const AUTH_FILE_NAME = "auth.json";
const OPENCODE_DIR = "opencode";
const PATH_START = 0;
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
  const dataPath = `${statePath.slice(PATH_START, -stateMarker.length)}${dataMarker}`;

  return join(dataPath, AUTH_FILE_NAME);
};

const resolveAuthPath = async (client: PathClient, directory: string): Promise<string | null> => {
  const response = await client.path.get({ query: { directory } });

  return resolveAuthPathFromStatePath(response.data?.state);
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

/**
 * Read OpenCode's `auth.json` file and return the entry stored under `key`,
 * or `null` if the file is missing, unparseable, or doesn't contain that key.
 *
 * The `Entry` type parameter describes the expected entry shape; the caller
 * is responsible for validating the entry's fields.
 */
const readAuthEntry = async <Entry>(
  client: PathClient,
  directory: string,
  key: string,
): Promise<Entry | null> => {
  const authPath = await resolveAuthPath(client, directory);
  if (!authPath || !existsSync(authPath)) {
    return null;
  }

  const store = parseAuthStore(readFileSync(authPath, "utf8"));
  const candidate = store?.[key];
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  return candidate as Entry;
};

export { PathClient, readAuthEntry };
