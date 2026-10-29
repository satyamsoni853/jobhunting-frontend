import { useState, useEffect, useCallback } from 'react';

// The full mail list: who is waiting (can be cancelled or sent now), who was mailed, who was skipped and why.
// Needs the Access Key from Auto Hunter. Refreshes every 8 seconds.
const ago = (t) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
};

const readKey = () => {
  try {
    return (localStorage.getItem('jobhunting_key') || '').trim();
  } catch {
    return '';
  }
};

export default function MailList({ apiBaseUrl }) {
  const [tab, setTab] = useState('queue'); // queue | sent | skipped
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const call = useCallback(
    async (path, body) => {
      const key = readKey();
      if (!key) throw new Error('Enter the Access Key in Auto Hunter (Step 2) to see the mail list.');
      const res = await fetch(`${apiBaseUrl}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { 'X-API-Key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 401) throw new Error('Wrong access key.');
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Server error ${res.status}`);
      return res.json();
    },
    [apiBaseUrl]
  );

  const load = useCallback(async () => {
    try {
      setData(await call('/api/mail/overview'));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [call]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 8000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  const act = async (label, path, body, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(label);
    try {
      await call(path, body);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const queue = data?.queue || [];
  const firsts = queue.filter((j) => j.type === 'first');

  return (
    <div className="card" id="maillist">
      <div className="card-head">
        <div>
          <h2>📋 Mail list</h2>
          <p className="card-sub" style={{ margin: 0 }}>Who is waiting, who got a mail, who was skipped.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={load}>
          ↻ Refresh
        </button>
      </div>

      <div className="ml-tabs" role="tablist">
        {[
          ['queue', `Waiting (${queue.length})`],
          ['sent', `Sent (${data?.sent.length ?? 0})`],
          ['skipped', `Skipped (${data?.skipped.length ?? 0})`],
        ].map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'ml-tab on' : 'ml-tab'} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {error && <p className="tailor-error">⚠️ {error}</p>}

      {tab === 'queue' && data && (
        <>
          <div className="ml-bar">
            <span>
              {queue.length === 0
                ? 'Nothing is waiting.'
                : `${queue.length} waiting. Mails go out 30–60 s apart, inside the recruiter's office hours.`}
            </span>
            {firsts.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={Boolean(busy)}
                onClick={() => act('all', '/api/mail/cancel', { all: true }, `Cancel all ${queue.length} waiting mails? They will not be sent.`)}
              >
                ✕ Cancel all
              </button>
            )}
          </div>
          <ul className="ml-list">
            {queue.map((j) => (
              <li key={`${j.type}-${j.email}`}>
                <div className="ml-main">
                  <b>{j.email}</b>
                  <span className="ml-sub">
                    {[j.type === 'followup' ? 'follow-up' : '', j.company, j.role, j.fit != null ? `fit ${Math.round(j.fit * 100)}%` : '', j.query && `from "${j.query}"`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span className="ml-sub">
                    queued {ago(j.queuedAt)}
                    {j.waiting ? ` · ${j.waiting}` : ' · next in line'}
                    {j.postUrl && (
                      <>
                        {' · '}
                        <a href={j.postUrl} target="_blank" rel="noopener noreferrer">
                          post ↗
                        </a>
                      </>
                    )}
                  </span>
                </div>
                {j.type === 'first' && (
                  <div className="ml-actions">
                    {j.waiting && (
                      <button type="button" className="btn btn-secondary" disabled={Boolean(busy)} onClick={() => act(`now-${j.email}`, '/api/mail/sendnow', { email: j.email })}>
                        Send now
                      </button>
                    )}
                    <button type="button" className="btn btn-secondary" disabled={Boolean(busy)} onClick={() => act(`c-${j.email}`, '/api/mail/cancel', { emails: [j.email] })}>
                      ✕ Cancel
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === 'sent' && data && (
        <ul className="ml-list">
          {data.sent.length === 0 && <li className="ml-empty">No mail sent yet.</li>}
          {data.sent.map((r) => (
            <li key={r.email}>
              <div className="ml-main">
                <b>{r.email}</b>
                <span className="ml-sub">{[r.company, r.role, r.subject].filter(Boolean).join(' · ')}</span>
                <span className="ml-sub">
                  sent {ago(r.at)}
                  {r.followUps > 0 && ` · ${r.followUps} follow-up${r.followUps > 1 ? 's' : ''}`}
                  {r.replied && ' · replied ✅'}
                  {r.bounced && ' · bounced ⚠️'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {tab === 'skipped' && data && (
        <ul className="ml-list">
          {data.skipped.length === 0 && <li className="ml-empty">Nothing skipped.</li>}
          {data.skipped.map((h, i) => (
            <li key={`${h.email}-${h.at}-${i}`}>
              <div className="ml-main">
                <b>{h.email}</b>
                <span className="ml-sub">{h.reason || h.error || ''}</span>
                <span className="ml-sub">
                  {h.status === 'failed' ? 'failed' : 'skipped'} {ago(h.at)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
