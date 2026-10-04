/** Thin client for /api/leaderboard. Every call degrades gracefully when offline or unconfigured. */

export async function fetchBoard(period = 'week') {
  try {
    const r = await fetch(`/api/leaderboard?period=${period}`);
    if (r.status === 503) return { status: 'soon', entries: [] };
    if (!r.ok) return { status: 'error', entries: [] };
    const data = await r.json();
    return { status: 'ok', entries: data.entries ?? [] };
  } catch {
    return { status: 'offline', entries: [] };
  }
}

export async function submitScore(entry) {
  try {
    const r = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, status: r.status, error: data.error };
    return { ok: true, rank: data.rank ?? null };
  } catch {
    return { ok: false, status: 0 };
  }
}
