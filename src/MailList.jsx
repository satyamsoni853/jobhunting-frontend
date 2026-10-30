import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from './toastBus.js';

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
  const seen = useRef(null); // keys of mails already announced; null until the first load
  const lastQueue = useRef(0);
  const lastToday = useRef(0);

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

  // toast every new mail sent, every failure and every new batch queued (nothing on the first load)
  const announce = (d) => {
    const sent = (d.sent || []).map((s) => ({ key: `${s.email}|${s.at}`, ...s }));
    const failed = (d.skipped || []).filter((h) => h.status === 'failed').map((h) => ({ key: `${h.email}|${h.at}`, ...h }));
    if (seen.current) {
      const newSent = sent.filter((s) => !seen.current.has(s.key));
      if (newSent.length > 3) toast('ok', `${newSent.length} mails sent`);
      else for (const s of newSent) toast('ok', `Mail sent to ${s.email}${s.company ? ` (${s.company})` : ''}`);
      for (const h of failed.filter((x) => !seen.current.has(x.key)).slice(0, 3)) toast('err', `Mail to ${h.email} failed: ${h.error || h.reason || 'unknown error'}`);
      const q = (d.queue || []).length;
      if (q > lastQueue.current) toast('info', `${q - lastQueue.current} new email${q - lastQueue.current === 1 ? '' : 's'} queued`);
    }
    const today = sent.filter((s) => new Date(s.at).toDateString() === new Date().toDateString()).length;
    if (seen.current && lastToday.current < 20 && today >= 20) toast('ok', '🎯 Daily target reached: 20 mails sent today');
    lastToday.current = today;
    seen.current = new Set([...sent, ...failed].map((x) => x.key));
    lastQueue.current = (d.queue || []).length;
  };

  const load = useCallback(async () => {
    try {
      const d = await call('/api/mail/overview');
      announce(d);
      setData(d);
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
      toast('ok', label === 'all' ? 'All waiting mails cancelled.' : label.startsWith('now-') ? 'Moved to sending now.' : 'Mail cancelled.');
    } catch (e) {
      setError(e.message);
      toast('err', e.message);
    } finally {
      setBusy('');
    }
  };

  // every address ever found, as a CSV (the file request carries the key, so it is fetched, not linked)
  const downloadAll = async () => {
    setBusy('csv');
    try {
      const res = await fetch(`${apiBaseUrl}/api/mail/leads.csv`, { headers: { 'X-API-Key': readKey() } });
      if (!res.ok) throw new Error(res.status === 401 ? 'Wrong access key.' : `Server error ${res.status}`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = 'all-emails.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast('ok', 'CSV downloaded.');
    } catch (e) {
      setError(e.message);
      toast('err', e.message);
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

      {data && (
        <div className="ml-bar">
          <span>
            {data.leadsTotal} email{data.leadsTotal === 1 ? '' : 's'} saved for good. Nobody gets a second mail within 7 days.
          </span>
          <button type="button" className="btn btn-secondary" disabled={busy === 'csv'} onClick={downloadAll}>
            ⬇ All emails (CSV)
          </button>
        </div>
      )}

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
