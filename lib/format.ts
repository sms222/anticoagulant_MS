/**
 * All dates are stored as ISO (YYYY-MM-DD) in the database — that's what
 * sorting/comparison logic throughout the app relies on. This is only for
 * DISPLAY: renders as DD/MM/YY (Malaysia convention) wherever a date is
 * shown as plain text rather than a native date input.
 */
export function formatDateDisplay(iso: string | null | undefined): string {
  if (!iso) return "\u2014";
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year.slice(2)}`;
}

/** Same idea for a full timestamp (date + time), e.g. added_at columns. */
export function formatDateTimeDisplay(iso: string | null | undefined): string {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(2);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hh}:${mm}`;
}

/** 15-minute slots, 07:00-19:00, for appointment/visit time selects — a
 *  clinic books to a schedule, not an arbitrary minute, so a dropdown beats
 *  a free-typed time field. */
export const TIME_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let h = 7; h <= 19; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 19 && m > 0) break;
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
})();
