// ── Types ──────────────────────────────────────────────────────────────

interface ErrorBody {
  detail?: unknown;
  error?: { message?: unknown };
  message?: unknown;
}

// ── Error helpers ──────────────────────────────────────────────────────

const describeErrorBody = (text: string): string => {
  try {
    const body = JSON.parse(text) as ErrorBody;
    const message = body.error?.message ?? body.detail ?? body.message;
    return typeof message === "string" && message ? message : text;
  } catch {
    return text;
  }
};

/** Throw an Error with the HTTP status and the API's error message for a failed fetch. */
const throwResponseError = async (response: Response): Promise<never> => {
  const text = await response.text();
  const message = text ? describeErrorBody(text) : response.statusText;
  throw Object.assign(new Error(`${response.status} ${message}`), { status: response.status });
};

const formatSearchError = (label: string, error: unknown): string =>
  `${label} web search failed: ${error instanceof Error ? error.message : String(error)}`;

export { formatSearchError, throwResponseError };
