import { useState, useEffect, useCallback } from 'react';

// Connects the sender Gmail for the background mailer. The App Password goes to the server once, which checks it
// with Gmail and keeps it encrypted. It is never shown again. "Remember" keeps a copy in this browser only, so the
// site can reconnect by itself when the free server restarts and forgets it.
const SAVED = 'jobhunting_smtp';

const readKey = () => {
  try {
    return localStorage.getItem('jobhunting_key') || '';
  } catch {
    return '';
  }
};

export default function SmtpSettings({ apiBaseUrl }) {
  const [info, setInfo] = useState(null); // { configured, user, source, defaultUser }
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  const api = useCallback(
    (method, body) =>
      fetch(`${apiBaseUrl}/api/smtp`, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-API-Key': readKey() },
        body: body ? JSON.stringify(body) : undefined,
      }),
    [apiBaseUrl]
  );

  const load = useCallback(async () => {
    if (!readKey()) {
      setMsg({ type: 'warn', text: 'Enter the Access Key in Auto Hunter (Step 2) first.' });
      return;
    }
    try {
      const res = await api('GET');
      if (res.status === 401) throw new Error('Wrong access key.');
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const d = await res.json();
      setInfo(d);
      setUser((u) => u || d.user || d.defaultUser || '');
      setMsg({ type: '', text: '' });

      // The free server forgets the login on restart: send the remembered one again
      if (!d.configured) {
        let saved = null;
        try {
          saved = JSON.parse(localStorage.getItem(SAVED) || 'null');
        } catch {
          saved = null;
        }
        if (saved?.user && saved?.pass) {
          const r = await api('POST', saved);
          if (r.ok) {
            setInfo(await (await api('GET')).json());
            setMsg({ type: 'ok', text: 'Reconnected with the login remembered in this browser.' });
          }
        }
      }
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    }
  }, [api]);

  useEffect(() => {
    const t = setTimeout(load, 0); // not synchronously, the effect itself must not set state
    return () => clearTimeout(t);
  }, [load]);

  const connect = async () => {
    setBusy(true);
    setMsg({ type: '', text: '' });
    try {
      const res = await api('POST', { user, pass });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `Server error ${res.status}`);
      try {
        if (remember) localStorage.setItem(SAVED, JSON.stringify({ user, pass }));
        else localStorage.removeItem(SAVED);
      } catch {
        /* storage blocked: the login just is not remembered */
      }
      setPass('');
      setInfo(await (await api('GET')).json());
      setMsg({ type: 'ok', text: d.dryRun ? 'Connected (dry run, Gmail was not contacted).' : 'Gmail login verified and connected.' });
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await api('DELETE');
      try {
        localStorage.removeItem(SAVED);
      } catch {
        /* nothing saved */
      }
      setInfo(await (await api('GET')).json());
      setMsg({ type: 'ok', text: 'Disconnected. Nothing will be sent until you connect again.' });
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const connected = info?.configured;

  return (
    <div className="card" id="sender">
      <div className="card-head">
        <div>
          <h2>🔐 Sender Gmail</h2>
          <p className="card-sub" style={{ margin: 0 }}>
            The Gmail the background mailer sends from. Set here, not in the server settings.
          </p>
        </div>
        <span className={`fit-badge ${connected ? 'good' : 'low'}`}>
          {connected ? `Connected · ${info.user}` : 'Not connected'}
        </span>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="smtp-user">Gmail address</label>
          <input id="smtp-user" className="input-field" type="email" value={user} onChange={(e) => setUser(e.target.value)} placeholder="you@gmail.com" autoComplete="off" />
        </div>
        <div className="form-group">
          <label htmlFor="smtp-pass">App Password (16 characters)</label>
          <div className="pw-wrap">
            <input
              id="smtp-pass"
              className="input-field"
              type={show ? 'text' : 'password'}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder={connected ? 'Saved on the server, enter to replace' : 'abcd efgh ijkl mnop'}
              autoComplete="new-password"
            />
            <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
      </div>

      <label className="remember">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        Remember on this browser so it reconnects if the server restarts
      </label>
      {remember && (
        <p className="card-sub" style={{ margin: '6px 0 0' }}>
          This keeps the App Password in this browser&apos;s storage. Use it only on your own device.
        </p>
      )}

      <div className="btn-row">
        <button type="button" className="btn" onClick={connect} disabled={busy || !user || pass.replace(/\s/g, '').length < 8}>
          {busy ? 'Checking with Gmail...' : connected ? 'Replace and verify' : 'Verify and connect'}
        </button>
        {connected && (
          <button type="button" className="btn btn-secondary" onClick={disconnect} disabled={busy}>
            Disconnect
          </button>
        )}
      </div>

      {msg.text && <p className={`smtp-msg ${msg.type}`}>{msg.text}</p>}
      {connected && info.source === 'env' && <p className="card-sub">This login comes from the server&apos;s settings. Connect here to override it.</p>}
    </div>
  );
}
