// All "what day/time is it" logic for the clinic goes through here.
// The app runs on Vercel (server clock = UTC). Malaysia is UTC+8 with no
// DST, so naive `new Date().toISOString().slice(0, 10)` calls are wrong for
// roughly 8 hours a day (KL midnight–8am is still "yesterday" in UTC) —
// that's not just a cosmetic display bug, it changes which calendar day
// appointments/labs/encounters get filed under.

export const KL_TIME_ZONE = "Asia/Kuala_Lumpur";

/** Any Date, expressed as a YYYY-MM-DD calendar date in Kuala Lumpur time. */
export function toKLDateString(d: Date = new Date()): string {
  // en-CA locale formats as YYYY-MM-DD, which is what every date column/query in this app expects.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** "Today" in Kuala Lumpur, as YYYY-MM-DD. Use this anywhere the old code did `new Date().toISOString().slice(0, 10)`. */
export function todayKL(): string {
  return toKLDateString(new Date());
}

/** A KL calendar date offset by N days (can be negative), as YYYY-MM-DD. */
export function addDaysKL(days: number, from: Date = new Date()): string {
  const base = toKLDateString(from);
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Start of the current week (Sunday) in KL, as YYYY-MM-DD. */
export function startOfWeekKL(from: Date = new Date()): string {
  const base = toKLDateString(from);
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - dt.getUTCDay());
  return dt.toISOString().slice(0, 10);
}

/** Start of the current month in KL, as YYYY-MM-DD. */
export function startOfMonthKL(from: Date = new Date()): string {
  const base = toKLDateString(from);
  const [y, m] = base.split("-").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

/** Display string for the header clock / "today" labels, always in KL time. */
export function formatKLDateTime(d: Date = new Date(), opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("en-MY", { timeZone: KL_TIME_ZONE, ...opts }).format(d);
}
