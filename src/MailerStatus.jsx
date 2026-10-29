import { useState, useEffect, useCallback } from 'react';

// Live view of the server's mailer: counts, settings and the last results. Needs the Access Key from Auto Hunter.
const LABEL = { success: 'Sent', 'dry-run': 'Dry run', followup: 'Follow-up', skipped: 'Skipped', failed: 'Failed' };
const TONE = { success: 'good', 'dry-run': 'good', followup: 'good', skipped: 'low', failed: 'bad' };

export default function MailerStatus({ apiBaseUrl }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    let key = '';
    try {
      key = localStorage.getItem('jobhunting_key') || '';
    } catch {
      /* storage blocked */
    }
    if (!key) {
      setError('Enter the Access Key in Auto Hunter (Step 2) to see the mailer status.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/auto-status`, { headers: { 'X-API-Key': key } });
      if (res.status === 401) throw new Error('Wrong access key.');
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setData(await res.json());
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    const first = setTimeout(load, 0); // not synchronously, the effect itself must not set state
    const t = setInterval(load, 30000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  const s = data?.stats;

  return (
    <div className="card" id="status">
      <div className="card-head">
        <div>
          <h2>📬 Mailer Status</h2>
          <p className="card-sub" style={{ margin: 0 }}>What the server has sent, who replied, and what is waiting.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={busy}>
          {busy ? 'Refreshing...' : '↻ Refresh'}
        </button>
      </div>

      {error && <p className="tailor-error">⚠️ {error}</p>}

      {data && (
        <>
          {data.settings.dryRun && <div className="dry-banner">🧪 Dry run is ON: mails are built and logged, nothing is really sent.</div>}

          <div className="status-grid">
            <div><b>{s.contacted}</b><span>Contacted</span></div>
            <div><b>{s.replied}</b><span>Replied</span></div>
            <div><b>{s.bounced + s.invalid}</b><span>Bounced / invalid</span></div>
            <div><b>{s.followUpsSent}</b><span>Follow-ups</span></div>
            <div><b>{data.queueLength}</b><span>In queue</span></div>
            <div><b>{data.sentToday}/{data.dailyLimit}</b><span>Sent today</span></div>
          </div>

          <p className="status-settings">
            Follow-ups: {data.settings.followUps} · Business-hours sending: {data.settings.tzAware ? 'on' : 'off'} · Minimum fit:{' '}
            {Math.round(data.settings.minFit * 100)}%
          </p>

          <div className="tailor-label">Recent</div>
          {data.recent.length === 0 ? (
            <p className="card-sub">Nothing yet.</p>
          ) : (
            <ul className="recent-list">
              {data.recent.slice(0, 12).map((h, i) => (
                <li key={`${h.email}-${h.at}-${i}`}>
                  <span className={`fit-badge ${TONE[h.status] || 'low'}`}>{LABEL[h.status] || h.status}</span>
                  <span className="recent-mail">{h.email}</span>
                  <span className="recent-note">{h.reason || h.error || h.subject || ''}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
