// ── Error helpers ──────────────────────────────────────────────────────

const formatUnhandledSearchError = (error: unknown): string => {
  if (error instanceof Error) {
    return `Error performing web search: ${error.message}`;
  }

  return `Error performing web search: ${String(error)}`;
};

export { formatUnhandledSearchError };
