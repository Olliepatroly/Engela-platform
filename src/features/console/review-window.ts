/**
 * The Monday-to-Sunday window a weekly review covers. Pure date maths, UTC
 * throughout, matching the programmes calendar convention (weeks start Monday).
 * Kept out of the server-action module so it can be unit tested.
 */

/** ISO date (YYYY-MM-DD) of the Monday on or before `iso`. */
export function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  // getUTCDay: 0 = Sunday, so Sunday steps back six days, not none.
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** ISO date `days` after `iso`. */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The seven-day window a review covers, from any date inside it. */
export function reviewWindow(iso: string): { windowStart: string; windowEnd: string } {
  const windowStart = mondayOf(iso);
  return { windowStart, windowEnd: addDays(windowStart, 6) };
}
