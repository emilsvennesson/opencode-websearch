import { createOpenAICompatibleClient, searchWithResponses } from "../shared/openai-compatible.js";
import { SearchConfig } from "../../types.js";

// ── Constants ──────────────────────────────────────────────────────────

const XAI_DEFAULT_BASE_URL = "https://api.x.ai/v1";

// ── Execution ──────────────────────────────────────────────────────────

const executeSearch = async (
  config: SearchConfig,
  query: string,
  signal: AbortSignal,
): Promise<string> => {
  const client = createOpenAICompatibleClient({
    ...config,
    baseURL: config.baseURL ?? XAI_DEFAULT_BASE_URL,
  });
  return searchWithResponses(client, config, query, signal);
};

export { executeSearch };
