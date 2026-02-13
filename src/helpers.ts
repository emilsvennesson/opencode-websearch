import { MONTH_OFFSET, PAD_LENGTH } from "./constants.js";

// ── Helpers ────────────────────────────────────────────────────────────

const getTodayDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + MONTH_OFFSET).padStart(PAD_LENGTH, "0");
  const day = String(now.getDate()).padStart(PAD_LENGTH, "0");
  return `${year}-${month}-${day}`;
};

const getCurrentMonthYear = (): string =>
  new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

export { getCurrentMonthYear, getTodayDate };
