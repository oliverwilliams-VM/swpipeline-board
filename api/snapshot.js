// Stores and retrieves weekly PipelineBoard snapshots on a dedicated
// Monday board \u2014 deliberately reusing the same Monday integration this
// whole app already relies on, rather than standing up a separate
// database just for this one feature.

const MONDAY_API_URL = 'https://api.monday.com/v2';
const BOARD_ID = '18431507120';

const COLUMNS = {
  date: 'date4',
  estateTotal: 'numeric_mm79ht8b',
  interrupt: 'numeric_mm792y1',
  disrupt: 'numeric_mm79wa96',
  smallFormat: 'numeric_mm79afq3',
  retrofitTotal: 'numeric_mm79z6g5',
  remodelNroTotal: 'numeric_mm79y4w',
  prioritySites: 'numeric_mm79xf2t'
};

async function mondayGraphQL(token, query, variables) {
  const res = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({ query, variables })
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }
  return json.data;
}

export default async function handler(req, res) {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'MONDAY_API_TOKEN is not set.' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const data = await mondayGraphQL(
        token,
        `query ($boardId: [ID!], $columnIds: [String!]) {
          boards(ids: $boardId) {
            items_page(limit: 100) {
              items {
                id
                name
                column_values(ids: $columnIds) { id text }
              }
            }
          }
        }`,
        { boardId: [BOARD_ID], columnIds: Object.values(COLUMNS) }
      );

      const snapshots = data.boards[0].items_page.items.map((item) => {
        const values = {};
        item.column_values.forEach((cv) => { values[cv.id] = cv.text; });
        return {
          id: item.id,
          date: values[COLUMNS.date] || item.name,
          estateTotal: Number(values[COLUMNS.estateTotal]) || 0,
          interrupt: Number(values[COLUMNS.interrupt]) || 0,
          disrupt: Number(values[COLUMNS.disrupt]) || 0,
          smallFormat: Number(values[COLUMNS.smallFormat]) || 0,
          retrofitTotal: Number(values[COLUMNS.retrofitTotal]) || 0,
          remodelNroTotal: Number(values[COLUMNS.remodelNroTotal]) || 0,
          prioritySites: Number(values[COLUMNS.prioritySites]) || 0
        };
      });

      res.status(200).json({ snapshots });
      return;
    }

    if (req.method === 'POST') {
      const {
        date, estateTotal, interrupt, disrupt, smallFormat,
        retrofitTotal, remodelNroTotal, prioritySites
      } = req.body;

      if (!date) {
        res.status(400).json({ error: 'A date is required.' });
        return;
      }

      const columnValues = {
        [COLUMNS.date]: { date },
        [COLUMNS.estateTotal]: String(estateTotal ?? 0),
        [COLUMNS.interrupt]: String(interrupt ?? 0),
        [COLUMNS.disrupt]: String(disrupt ?? 0),
        [COLUMNS.smallFormat]: String(smallFormat ?? 0),
        [COLUMNS.retrofitTotal]: String(retrofitTotal ?? 0),
        [COLUMNS.remodelNroTotal]: String(remodelNroTotal ?? 0),
        [COLUMNS.prioritySites]: String(prioritySites ?? 0)
      };

      const data = await mondayGraphQL(
        token,
        `mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
          create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) { id }
        }`,
        { boardId: BOARD_ID, itemName: date, columnValues: JSON.stringify(columnValues) }
      );

      res.status(200).json({ id: data.create_item.id });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
