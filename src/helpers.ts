// ── Helpers ────────────────────────────────────────────────────────────

const getCurrentMonthYear = (): string =>
  new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

export { getCurrentMonthYear };
