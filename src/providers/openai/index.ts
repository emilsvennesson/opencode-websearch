import { createOpenAICompatibleClient, searchWithResponses } from "../shared/openai-compatible.js";
import { SearchConfig } from "../../types.js";

// ── Execution ──────────────────────────────────────────────────────────

const executeSearch = async (
  config: SearchConfig,
  query: string,
  signal: AbortSignal,
): Promise<string> =>
  searchWithResponses(createOpenAICompatibleClient(config), config, query, signal);

export { executeSearch };
