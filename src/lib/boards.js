// v1 scope: Install Phase, Site Status and Type per country board, plus the
// Sign Up board's own funnel + country breakdown. Column IDs differ per
// board even for the same conceptual field, so each board carries its own
// map.

export const COUNTRY_BOARDS = [
  { id: '5678172488', country: 'UK', columns: { installPhase: 'status', siteStatus: 'status9', installDate: 'date', linkToSignUp: 'board_relation1__1' } },
  { id: '7519472262', country: 'IE', columns: { installPhase: 'status__1', siteStatus: 'status9__1', installDate: 'date1__1', linkToSignUp: 'board_relation_mkmq1n7' } },
  { id: '5757397415', country: 'NL', columns: { installPhase: 'status', siteStatus: 'status1__1', installDate: 'date', linkToSignUp: 'board_relation6__1' } },
  { id: '5757508504', country: 'DE', columns: { installPhase: 'status', siteStatus: 'status__1', installDate: 'date3', linkToSignUp: 'board_relation1__1' } },
  { id: '5756651462', country: 'FI', columns: { installPhase: 'status', siteStatus: 'status__1', installDate: 'date', linkToSignUp: 'board_relation5__1' } }
];

// The Sign Up \u2192 Ready to Go board. Used for the reconciliation check, and
// now also for the Subway Pipeline Forecast table (Layout Type breakdown
// by country) \u2014 both live on this same board.
export const SIGNUP_BOARD = {
  id: '5678025992',
  columns: {
    installPhase: 'status',
    country: 'country',
    linkToInstallBau: 'connect_boards__1',
    layoutType: 'dup__of_layout_type_bau1__1'
  }
};

// Group-name matching is inherently a little fuzzy since each board's group
// titles vary slightly (e.g. "Completed installs" vs "Completed" vs
// "Complete"). These regexes cover the variants seen across all 5 boards.
export const GROUP_PATTERNS = {
  completed: /complete/i,
  postponed: /postponed/i,
  tbd: /^tbd$/i,
  onHold: /on.?hold/i,
  aborted: /aborted/i,
  monthBatch: /^(january|february|march|april|may|june|july|august|september|october|november|december)\b.*\d{2,4}$/i
};

// A site counts as "live" primarily based on its own Install Phase status
// text \u2014 that's trusted as the source of truth whenever it's actually
// set, since Group placement alone isn't reliable (a site can be manually
// filed into a "Completed" group before it's really finished, e.g. a
// satellite/sister site tracked alongside its already-complete parent).
// Group is only used as a fallback when there's no status recorded at all.
const LIVE_STATUS_PATTERN = /complete|hypercare|installed|live/i;
const NOT_LIVE_PATTERN = /not[\s-]*live|not[\s-]*installed|de-?i*install/i;
export function isLiveItem(item) {
  const status = (item.installPhase || '').trim();
  if (status !== '') {
    return LIVE_STATUS_PATTERN.test(status) && !NOT_LIVE_PATTERN.test(status);
  }
  return Boolean(item.group && GROUP_PATTERNS.completed.test(item.group));
}
