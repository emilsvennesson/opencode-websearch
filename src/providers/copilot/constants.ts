// ── Constants ──────────────────────────────────────────────────────────

import { SearchEngine } from "../../types";

const COPILOT_API_VERSION = "2026-08-01";
const COPILOT_DEFAULT_BASE_URL = "https://api.githubcopilot.com";
const COPILOT_DEFAULT_SEARCH_ENGINE = "responses";
const COPILOT_INITIATOR = "user";
const COPILOT_INTENT = "conversation-edits";
const COPILOT_MCP_PATH = "/mcp/readonly";
const COPILOT_MCP_TOOLSET = "web_search";
const COPILOT_USER_AGENT = "opencode-websearch";

const SUPPORTED_SEARCH_ENGINES: SearchEngine[] = ["native", "bing", "auto"];

const COPILOT_RESPONSES_HEADERS = {
  "Openai-Intent": COPILOT_INTENT,
  "User-Agent": COPILOT_USER_AGENT,
  "X-GitHub-Api-Version": COPILOT_API_VERSION,
  "x-initiator": COPILOT_INITIATOR,
} as const;

const COPILOT_MCP_CLIENT_INFO = { name: COPILOT_USER_AGENT, version: "1.0.0" } as const;

const HTTP_STATUS_CODE = {
  BAD_REQUEST: 400,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export {
  COPILOT_API_VERSION,
  COPILOT_DEFAULT_BASE_URL,
  COPILOT_DEFAULT_SEARCH_ENGINE,
  COPILOT_INITIATOR,
  COPILOT_INTENT,
  COPILOT_MCP_CLIENT_INFO,
  COPILOT_MCP_PATH,
  COPILOT_MCP_TOOLSET,
  COPILOT_RESPONSES_HEADERS,
  COPILOT_USER_AGENT,
  HTTP_STATUS_CODE,
  SUPPORTED_SEARCH_ENGINES,
};
