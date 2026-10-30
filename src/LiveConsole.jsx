import { useState, useEffect, useRef } from 'react';

// Live view of the automatic mailer, shown in the Operational Console when no manual campaign is running:
// who is waiting in the queue, who was mailed, who failed or was skipped, and a log stream of every event.
// Refreshes every 4 seconds while the tab is visible. Needs the Access Key from Auto Hunter (Step 2).

const readKey = () => {
  try {
    return (localStorage.getItem('jobhunting_key') || '').trim();
  } catch {
    return '';
  }
};

const hhmm = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();

// one history entry from the server -> one log line
const toLog = (h) => {
  const who = `${h.email}${h.company ? ` (${h.company})` : ''}`;
  if (h.status === 'success') return { type: 'success', text: `✅ Sent to ${who}${h.subject ? ` - ${h.subject}` : ''}` };
  if (h.status === 'dry-run') return { type: 'info', text: `🧪 Dry run for ${who}` };
  if (h.status === 'failed') return { type: 'error', text: `❌ Failed: ${who} - ${h.error || 'unknown error'}` };
  return { type: 'warning', text: `⏭ Skipped ${h.email}: ${h.reason || 'not mailed'}` };
};

export default function LiveConsole({ apiBaseUrl }) {
  const [status, setStatus] = useState(null);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    let live = true;
    const load = async () => {
      const key = readKey();
      if (!key) {
        if (live) setError('Enter the Access Key in Auto Hunter (Step 2) to see the live mailer.');
        return;
      }
      if (document.hidden) return;
      try {
        const h = { 'X-API-Key': key };
        const [a, o] = await Promise.all([fetch(`${apiBaseUrl}/api/auto-status`, { headers: h }), fetch(`${apiBaseUrl}/api/mail/overview`, { headers: h })]);
        if (a.status === 401 || o.status === 401) throw new Error('Wrong access key.');
        if (!a.ok || !o.ok) throw new Error('Server error, retrying...');
        const [as, ov] = await Promise.all([a.json(), o.json()]);
        if (!live) return;
        setStatus(as);
        setOverview(ov);
        setUpdated(new Date().toISOString());
        setError('');
      } catch (e) {
        if (live) setError(e.message);
      }
    };
    load();
    const t = setInterval(load, 4000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [apiBaseUrl]);

  const history = status?.recent || [];
  const logs = [...history].reverse(); // oldest first, newest at the bottom
  const failedToday = history.filter((h) => h.status === 'failed' && isToday(h.at)).length;
  const queue = overview?.queue || [];
  const sentToday = status?.sentToday ?? 0;
  const limit = status?.dailyLimit || 0;
  const pct = limit ? Math.min(100, (sentToday / limit) * 100) : 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [logs.length]);

  return (
    <div className="dispatch-dashboard" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="stats-circle-container">
        <div className="stat-circle-card">
          <div className="stat-label">In queue</div>
          <div className="stat-number total">{status ? queue.length : '-'}</div>
        </div>
        <div className="stat-circle-card">
          <div className="stat-label">Sent today</div>
          <div className="stat-number success">{status ? sentToday : '-'}</div>
        </div>
        <div className="stat-circle-card">
          <div className="stat-label">Failed</div>
          <div className="stat-number failed">{status ? failedToday : '-'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px' }}>
        <div className="progress-header">
          <span>{queue.length > 0 ? '⚡ Mailing automatically' : '✅ Queue is empty'}</span>
          <span>{limit ? `${sentToday} / ${limit} today` : ''}</span>
        </div>
        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%)' }}></div>
        </div>
        {queue.length > 0 && (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {queue.slice(0, 5).map((j, i) => (
              <div key={j.email} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {i === 0 ? '▶ Next: ' : `${i + 1}. `}
                {j.email}
                {j.company ? ` (${j.company})` : ''}
                {j.waiting ? ` - ${j.waiting}` : ''}
              </div>
            ))}
            {queue.length > 5 && <div>+ {queue.length - 5} more waiting</div>}
          </div>
        )}
      </div>

      <div className="terminal" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: '200px' }}>
        <div className="terminal-header">
          <div className="terminal-dots">
            <span className="t-dot red"></span>
            <span className="t-dot yellow"></span>
            <span className="t-dot green"></span>
          </div>
          <span className="terminal-title">LIVE MAILER STREAM{updated ? ` · updated ${hhmm(updated)}` : ''}</span>
        </div>
        <div className="terminal-body" style={{ flexGrow: 1 }}>
          {error && <div className="log-entry log-error">{error}</div>}
          {logs.length > 0
            ? logs.map((h, i) => {
                const l = toLog(h);
                return (
                  <div key={`${h.email}-${h.at}-${i}`} className={`log-entry log-${l.type}`}>
                    <span className="log-time">[{hhmm(h.at)}]</span>
                    <span>{l.text}</span>
                  </div>
                );
              })
            : !error && (
                <div className="terminal-empty">
                  <span>Nothing mailed yet. Every mail sent, failed or skipped will print here live.</span>
                </div>
              )}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  );
}
