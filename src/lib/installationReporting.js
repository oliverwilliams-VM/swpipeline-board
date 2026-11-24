// Monthly installation reporting must survive retirement of the BAU boards.
export const INSTALLATION_BOARDS = [
  { id: '18432365825', columnIds: ['date_mm7f8hw6', 'country_mm7fphac'] },
  { id: '18436052644', columnIds: ['date_mm89cbr7', 'country_mm891mag'] },
  { id: '18436233865', columnIds: ['date_mm8ajafx', 'country_mm8a9c0z', 'color_mm8as0pv'] }
];

const MARKETS = { 'United Kingdom': 'UK', Germany: 'DE', Netherlands: 'NL', Ireland: 'IE', Finland: 'FI' };
const value = (item, id) => item.column_values.find((c) => c.id === id)?.text || '';
const dateValue = (item, id) => value(item, id).match(/^\d{4}-\d{2}-\d{2}/)?.[0] || null;

export function reconcileInstallations(results) {
  const boards = new Map(results.map((r) => [String(r.boardId), r.items]));
  for (const board of INSTALLATION_BOARDS) {
    if (!boards.has(board.id)) throw new Error(`Installation reporting source ${board.id} is unavailable`);
  }
  const sites = new Map();
  function put(item, countryColumn, installDate, source, live = false) {
    const country = MARKETS[value(item, countryColumn)];
    const name = item.name.trim();
    if (!country || !name) return;
    const key = `${country}:${name}`;
    const prior = sites.get(key);
    // An incident supplies the original booking when no current booking exists.
    // Multiple incidents for the same restaurant never create duplicate sites.
    if (source === 'Exception' && prior?.installDate) return;
    if (source === 'Live Estate' && prior?.source === source && prior.installDate > installDate) return;
    sites.set(key, { id: item.id, name, country, installDate, source,
      installPhase: live ? 'Live' : 'Imp Readiness', group: item.group?.title || '' });
  }
  boards.get('18432365825').forEach((i) => put(i, 'country_mm7fphac', dateValue(i, 'date_mm7f8hw6'), 'Brian'));
  [...boards.get('18436233865')]
    .sort((a, b) => (dateValue(b, 'date_mm8ajafx') || '').localeCompare(dateValue(a, 'date_mm8ajafx') || ''))
    .filter((i) => value(i, 'color_mm8as0pv') !== 'Not an incident')
    .forEach((i) => put(i, 'country_mm8a9c0z', dateValue(i, 'date_mm8ajafx'), 'Exception'));
  boards.get('18436052644').forEach((i) => put(i, 'country_mm891mag', dateValue(i, 'date_mm89cbr7'), 'Live Estate', true));
  return [...sites.values()];
}
