import { COUNTRY_BOARDS, SIGNUP_BOARD } from './boards';

async function callApi(action, payload = {}) {
  const res = await fetch('/api/monday', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Connect-boards / board-relation columns need their `display_value`
// field, not the generic `text` field, to reliably return the linked
// item's name(s) \u2014 `text` often comes back empty for this column type even
// when Monday's UI clearly shows a linked item. Falls back to `text` for
// any other column type where display_value isn't populated.
function parseLinkedNames(rawItem, columnId) {
  if (!columnId) return [];
  const cv = rawItem.column_values.find((c) => c.id === columnId);
  if (!cv) return [];
  const raw = cv.display_value || cv.text;
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function shapeCountryItem(rawItem, board) {
  const valuesById = {};
  rawItem.column_values.forEach((cv) => { valuesById[cv.id] = cv.text; });
  return {
    id: rawItem.id,
    name: rawItem.name,
    country: board.country,
    group: rawItem.group?.title ?? null,
    installPhase: valuesById[board.columns.installPhase] ?? null,
    siteStatus: valuesById[board.columns.siteStatus] ?? null,
    installDate: valuesById[board.columns.installDate] ?? null,
    linkedSignUpNames: parseLinkedNames(rawItem, board.columns.linkToSignUp)
  };
}

function shapeSignUpItem(rawItem) {
  const valuesById = {};
  rawItem.column_values.forEach((cv) => { valuesById[cv.id] = cv.text; });
  return {
    id: rawItem.id,
    name: rawItem.name,
    group: rawItem.group?.title ?? null,
    installPhase: valuesById[SIGNUP_BOARD.columns.installPhase] ?? null,
    country: valuesById[SIGNUP_BOARD.columns.country] ?? null,
    layoutType: valuesById[SIGNUP_BOARD.columns.layoutType] ?? null,
    storeOpeningType: valuesById[SIGNUP_BOARD.columns.storeOpeningType] ?? null,
    hkShippingDate: valuesById[SIGNUP_BOARD.columns.hkShippingDate] ?? null,
    linkedInstallBauNames: parseLinkedNames(rawItem, SIGNUP_BOARD.columns.linkToInstallBau)
  };
}

// Fetches all 5 country boards in one request, returns a single flat,
// normalized array (installPhase/siteStatus/type mean the same thing
// across every row, regardless of each board's underlying column IDs).
export async function fetchCountryItems() {
  const { results } = await callApi('multiItems', {
    boards: COUNTRY_BOARDS.map((b) => ({ id: b.id, columnIds: Object.values(b.columns) }))
  });

  const items = [];
  results.forEach((result) => {
    const board = COUNTRY_BOARDS.find((b) => b.id === result.boardId);
    result.items.forEach((raw) => items.push(shapeCountryItem(raw, board)));
  });
  return items;
}

// Used only by the reconciliation view, not the main dashboard.
export async function fetchSignUpItems() {
  const { results } = await callApi('multiItems', {
    boards: [{ id: SIGNUP_BOARD.id, columnIds: Object.values(SIGNUP_BOARD.columns) }]
  });
  return results[0].items.map(shapeSignUpItem);
}

