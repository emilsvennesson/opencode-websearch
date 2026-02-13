import { ENV_VAR_CAPTURE_GROUP, MONTH_OFFSET, PAD_LENGTH } from "./constants.js";

// ── Helpers ────────────────────────────────────────────────────────────

const getTodayDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + MONTH_OFFSET).padStart(PAD_LENGTH, "0");
  const day = String(now.getDate()).padStart(PAD_LENGTH, "0");
  return `${year}-${month}-${day}`;
};

const resolveEnvVar = (value: string): string => {
  const match = value.match(/^\{env:(\w+)\}$/);
  if (match?.[ENV_VAR_CAPTURE_GROUP]) {
    return process.env[match[ENV_VAR_CAPTURE_GROUP]] ?? "";
  }
  return value;
};

const normalizeBaseURL = (url: string): string => url.replace(/\/v1\/?$/, "");

export { getTodayDate, normalizeBaseURL, resolveEnvVar };
