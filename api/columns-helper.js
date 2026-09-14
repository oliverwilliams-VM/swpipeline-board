const MONDAY_API_URL = 'https://api.monday.com/v2';

const BOARDS = [
  { id: '5678025992', name: 'Sign Up \u2192 Ready to Go', country: 'All' },
  { id: '5678172488', name: 'Install \u2192 BAU', country: 'UK' },
  { id: '7519472262', name: 'Install \u2192 BAU', country: 'IE' },
  { id: '5757397415', name: 'Install \u2192 BAU', country: 'NL' },
  { id: '5757508504', name: 'Install \u2192 BAU', country: 'DE' },
  { id: '5756651462', name: 'Install \u2192 BAU', country: 'FI' }
];

export default async function handler(req, res) {
  const token = process.env.MONDAY_API_TOKEN;

  if (!token) {
    res.status(500).json({ error: 'MONDAY_API_TOKEN is not set \u2014 add it in Vercel Project Settings > Environment Variables.' });
    return;
  }

  try {
    const results = [];
    for (const b of BOARDS) {
      const response = await fetch(MONDAY_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({
          query: `query ($boardId: [ID!]) {
            boards(ids: $boardId) {
              name
              columns { id title type settings_str }
              groups { id title }
            }
          }`,
          variables: { boardId: [b.id] }
        })
      });
      const json = await response.json();
      if (json.errors) {
        results.push({ ...b, error: json.errors.map((e) => e.message).join('; ') });
        continue;
      }
      if (!json.data.boards || json.data.boards.length === 0) {
        results.push({ ...b, error: `No board found for id ${b.id}` });
        continue;
      }
      const board = json.data.boards[0];

      const columns = board.columns.map((col) => {
        if ((col.type === 'status' || col.type === 'dropdown') && col.settings_str) {
          try {
            const settings = JSON.parse(col.settings_str);
            const labels = settings.labels
              ? Object.values(settings.labels)
              : (settings.options || []).map((o) => o.name);
            return { id: col.id, title: col.title, type: col.type, labels };
          } catch {
            return { id: col.id, title: col.title, type: col.type };
          }
        }
        return { id: col.id, title: col.title, type: col.type };
      });

      results.push({ ...b, boardName: board.name, columns, groups: board.groups });
    }
    res.status(200).json({ boards: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
