// One-off presentation window: 24–25 November 2026, Europe/London (GMT).
export const BOOKED_OVERRIDE_START = Date.parse('2026-11-24T17:09:03Z');
export const BOOKED_OVERRIDE_END = Date.parse('2026-11-25T17:00:00Z');

export function isBookedOverrideActive(now = Date.now()) {
  return now >= BOOKED_OVERRIDE_START && now < BOOKED_OVERRIDE_END;
}

export function displayedBookedTotal(ym, liveTotal, now = Date.now()) {
  return ym === '2026-11' && isBookedOverrideActive(now) ? 101 : liveTotal;
}
