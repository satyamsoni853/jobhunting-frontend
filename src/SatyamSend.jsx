import { useState, useEffect, useCallback, useRef } from 'react';

// The simple screen: press Satyam, enter your password, paste the emails, press Send.
// The sender Gmail and the resume live on the server and are never shown or asked for here.
const TOKEN_KEY = 'satyam_token';

const readToken = () => {
  try {
    const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null');
    return t && t.exp > Date.now() ? t.token : '';
  } catch {
    return '';
  }
};

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;
const LABEL = { success: 'Sent', 'dry-run': 'Test', followup: 'Follow-up', skipped: 'Skipped', failed: 'Failed' };
const TONE = { success: 'good', 'dry-run': 'good', followup: 'good', skipped: 'low', failed: 'bad' };

export default function SatyamSend({ apiBaseUrl }) {
  const [phase, setPhase] = useState('idle'); // idle | pin | checking | ready
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);
  const [recipients, setRecipients] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [status, setStatus] = useState(null);
  const fileRef = useRef(null);

  const lock = useCallback((message = '') => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage blocked */
    }
    setPhase('idle');
    setProfile(null);
    setError(message);
  }, []);

  const call = useCallback(
    async (path, options = {}) => {
      const res = await fetch(`${apiBaseUrl}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', 'X-Profile-Token': readToken(), ...(options.headers || {}) },
      });
      if (res.status === 401 && readToken() === '') throw new Error('Verification needed.');
      return res;
    },
    [apiBaseUrl]
  );

  // Fill the message from the server once the screen is unlocked
  const open = useCallback(async () => {
    try {
      const res = await call('/api/profile/satyam');
      if (res.status === 401) return lock('Your verification expired. Press Satyam again.');
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const p = await res.json();
      setProfile(p);
      setSubject((s) => s || p.subject);
      setBody((b) => b || p.body);
      setPhase('ready');
      setError('');
    } catch (e) {
      setError(e.message);
      setPhase('idle');
    }
  }, [call, lock]);

  // A token from earlier in this tab skips the code
  useEffect(() => {
    if (!readToken()) return undefined;
    const t = setTimeout(open, 0);
    return () => clearTimeout(t);
  }, [open]);

  // A token from earlier in this tab opens the screen at once, otherwise the password is asked
  const askPin = () => {
    if (readToken()) return open();
    setCode('');
    setError('');
    setPhase('pin');
  };

  const verify = async () => {
    setPhase('checking');
    setError('');
    try {
      const res = await fetch(`${apiBaseUrl}/api/profile/satyam/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `Server returned ${res.status}`);
      try {
        sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token: d.token, exp: Date.now() + d.expiresIn * 1000 }));
      } catch {
        /* storage blocked: the code is asked again next time */
      }
      await open();
    } catch (e) {
      setError(e.message);
      setPhase('pin');
    }
  };

  const addFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const found = (await file.text()).match(EMAIL_RE) || [];
    setRecipients((r) => [...new Set([...(r.match(EMAIL_RE) || []), ...found])].join('\n'));
    e.target.value = '';
  };

  const refresh = useCallback(async () => {
    try {
      const res = await call('/api/satyam/status');
      if (res.ok) setStatus(await res.json());
    } catch {
      /* the status is a convenience, ignore a failed refresh */
    }
  }, [call]);

  // While mails are waiting, keep the progress fresh
  useEffect(() => {
    if (phase !== 'ready') return undefined;
    const first = setTimeout(refresh, 0);
    const t = setInterval(refresh, status?.queueLength > 0 ? 5000 : 20000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [phase, refresh, status?.queueLength]);

  const count = (recipients.match(EMAIL_RE) || []).length;

  const send = async () => {
    setBusy(true);
    setError('');
    setResult('');
    try {
      const res = await call('/api/satyam/send', { method: 'POST', body: JSON.stringify({ recipients, subject, body }) });
      const d = await res.json();
      if (res.status === 401) return lock('Your verification expired. Press Satyam again.');
      if (!res.ok) throw new Error(d.error || `Server returned ${res.status}`);
      setResult(
        `Queued ${d.queued} of ${d.total}.${d.blockedOrSkipped ? ` ${d.blockedOrSkipped} left out (already mailed, blocked or invalid).` : ''} They go out one by one with a short gap.`
      );
      setRecipients('');
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card satyam-card" id="send">
      {phase !== 'ready' ? (
        <>
          <h2 style={{ marginTop: 0 }}>👤 Send my applications</h2>
          <p className="card-sub">
            Press Satyam, enter your password, then paste the addresses and send. Your Gmail and resume are already set on the
            server.
          </p>

          {phase === 'idle' && (
            <button type="button" className="btn satyam-cta" onClick={askPin}>
              👤 Satyam
            </button>
          )}

          {(phase === 'pin' || phase === 'checking') && (
            <div className="otp-box" role="group" aria-label="Password">
              <p>Enter your password.</p>
              <div className="otp-row">
                <input
                  className="input-field otp-input"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  placeholder="Password"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && code.trim() && verify()}
                />
                <button type="button" className="btn" onClick={verify} disabled={!code.trim() || phase === 'checking'}>
                  {phase === 'checking' ? 'Checking...' : 'Unlock'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setPhase('idle')}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {error && <p className="smtp-msg err">{error}</p>}
        </>
      ) : (
        <>
          <div className="card-head">
            <div>
              <h2>✉️ Send my applications</h2>
              <p className="card-sub" style={{ margin: 0 }}>
                From <b>{profile?.email}</b> · resume <b>Satyam_Soni_Resume.pdf</b> is added automatically
              </p>
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => lock()}>
              Lock
            </button>
          </div>

          <label htmlFor="sat-to" className="tailor-label" style={{ display: 'block' }}>
            Send to ({count} address{count === 1 ? '' : 'es'})
          </label>
          <textarea
            id="sat-to"
            className="input-field textarea-field"
            rows={6}
            placeholder={'hr@company.com\njobs@startup.io\n(one per line, or upload a file)'}
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
          />

          <details className="msg-edit">
            <summary>Edit subject and message (already filled)</summary>
            <input className="input-field" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" />
            <textarea className="input-field textarea-field" rows={9} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Message" />
          </details>

          <div className="btn-row">
            <button type="button" className="btn" onClick={send} disabled={busy || count === 0}>
              {busy ? 'Queuing...' : `🚀 Send${count ? ` to ${count}` : ''}`}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
              Add from file
            </button>
            <input ref={fileRef} type="file" accept=".csv,.txt" hidden onChange={addFile} />
          </div>

          {result && <p className="smtp-msg ok">{result}</p>}
          {error && <p className="smtp-msg err">{error}</p>}

          {status && (
            <div className="satyam-status">
              <div className="status-settings">
                {status.queueLength > 0 ? `${status.queueLength} waiting · ` : ''}Sent today {status.sentToday}/{status.dailyLimit}
                {!status.connected && ' · Gmail not set up on the server'}
              </div>
              {status.recent.length > 0 && (
                <ul className="recent-list">
                  {status.recent.slice(0, 8).map((h, i) => (
                    <li key={`${h.email}-${h.at}-${i}`}>
                      <span className={`fit-badge ${TONE[h.status] || 'low'}`}>{LABEL[h.status] || h.status}</span>
                      <span className="recent-mail">{h.email}</span>
                      <span className="recent-note">{h.reason || h.error || h.subject || ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
