export async function fetchSnapshots() {
  const res = await fetch('/api/snapshot');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load snapshots');
  return data.snapshots;
}

export async function saveSnapshot(values) {
  const res = await fetch('/api/snapshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to save snapshot');
  return data;
}
