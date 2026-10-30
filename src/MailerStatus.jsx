import { useState, useEffect, useCallback } from 'react';

// Live view of the server's mailer: counts, settings and the last results. Needs the Access Key from Auto Hunter.

export default function MailerStatus({ apiBaseUrl }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    let key = '';
    try {
      key = (localStorage.getItem('jobhunting_key') || '').trim();
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
    const t = setInterval(load, 8000);
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
          <p className="card-sub" style={{ margin: 0 }}>The numbers. The full list is in Mail list below.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={busy}>
          {busy ? 'Refreshing...' : '↻ Refresh'}
        </button>
      </div>

      {error && <p className="tailor-error">⚠️ {error}</p>}

      {data && (
        <>
          {data.settings.enabled === false && <div className="dry-banner">⏸ Auto-send is OFF on the server (AUTO_SEND_ENABLED=false), so nothing is queued. Set it to true in Render env.</div>}
          {data.settings.dryRun && <div className="dry-banner">🧪 Dry run is ON: mails are built and logged, nothing is really sent.</div>}

          <div className="status-grid">
            <div><b>{s.contacted}</b><span>Contacted</span></div>
            <div><b>{s.replied}</b><span>Replied</span></div>
            <div><b>{s.bounced + s.invalid}</b><span>Bounced / invalid</span></div>
            <div><b>{s.followUpsSent}</b><span>Follow-ups</span></div>
            <div><b>{data.queueLength}</b><span>In queue</span></div>
            <div><b>{data.sentToday}/20</b><span>Today (target 20)</span></div>
          </div>

          {(() => {
            const last = (data.recent || []).filter((h) => ['success', 'failed', 'dry-run'].includes(h.status)).slice(0, 6);
            if (!last.length) return null;
            return (
              <div className="status-recent">
                <b>Last mails</b>
                <ul>
                  {last.map((h, i) => (
                    <li key={`${h.email}-${h.at}-${i}`} className={h.status === 'failed' ? 'bad' : ''}>
                      <span>{new Date(h.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>{h.status === 'failed' ? '❌' : '✅'} {h.email}{h.company ? ` (${h.company})` : ''}</span>
                      <span className="sr-sub">{h.status === 'failed' ? h.error : h.subject}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}

          <p className="status-settings">
            Sending via: {data.settings.sendVia || 'SMTP'} · Follow-ups: {data.settings.followUps} · Business-hours sending: {data.settings.tzAware ? 'on' : 'off'} · Minimum fit:{' '}
            {Math.round(data.settings.minFit * 100)}% · Storage:{' '}
            {data.settings.storage === 'database' ? 'database (kept across restarts)' : 'files (lost when the free server restarts)'}
          </p>
        </>
      )}
    </div>
  );
}
