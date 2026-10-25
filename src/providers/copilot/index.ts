import { createOpenAICompatibleClient, searchWithResponses } from "../shared/openai-compatible.js";
import { SearchConfig } from "../../types.js";
import {
  COPILOT_API_VERSION,
  COPILOT_INITIATOR,
  COPILOT_INTENT,
  COPILOT_USER_AGENT,
} from "./constants.js";

// ── Execution ──────────────────────────────────────────────────────────

const executeSearch = async (
  config: SearchConfig,
  query: string,
  signal: AbortSignal,
): Promise<string> => {
  const client = createOpenAICompatibleClient(config, {
    "Openai-Intent": COPILOT_INTENT,
    "User-Agent": COPILOT_USER_AGENT,
    "X-GitHub-Api-Version": COPILOT_API_VERSION,
    "x-initiator": COPILOT_INITIATOR,
  });
  return searchWithResponses(client, config, query, signal);
};

export { executeSearch };
