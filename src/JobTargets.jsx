import { useState, useEffect, useRef } from 'react';
import { toast } from './toastBus.js';

// Multiselect of job categories. Each category carries 20 LinkedIn search queries,
// the extension searches the queries of every selected category.
export default function JobTargets({ apiBaseUrl }) {
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'saving' | 'saved' | 'error'

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/job-categories`)
      .then((r) => r.json())
      .then((data) => {
        setCategories(data.categories);
        setSelected(data.selected);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [apiBaseUrl]);

  const toggle = (key) => save(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);

  const save = async (next) => {
    setSelected(next);
    setStatus('saving');
    try {
      const res = await fetch(`${apiBaseUrl}/api/job-categories/selection`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected: next }),
      });
      if (!res.ok) throw new Error();
      setStatus('saved');
      window.dispatchEvent(new Event('jh-selection')); // the Jobs list follows the chosen roles
    } catch {
      setStatus('error');
    }
  };

  // Start hunt: the server collects leads from Hacker News "Who is hiring?" and queues the mails.
  // Needs the server's access key (same as AUTO_API_KEY), kept only in this browser.
  const [accessKey, setAccessKey] = useState(() => {
    try {
      return (localStorage.getItem('jobhunting_key') || '').trim();
    } catch {
      return '';
    }
  });
  const [hunt, setHunt] = useState(null);
  const [huntError, setHuntError] = useState('');

  const keyHeaders = { 'X-API-Key': accessKey.trim() };

  const saveKey = (v) => {
    setAccessKey(v);
    try {
      localStorage.setItem('jobhunting_key', v.trim());
    } catch {
      /* storage blocked, key just stays in memory */
    }
  };

  const fetchHunt = async () => {
    const res = await fetch(`${apiBaseUrl}/api/hunt/status`, { headers: keyHeaders });
    if (res.status === 401) throw new Error('Wrong access key');
    if (!res.ok) throw new Error('Server error');
    setHunt(await res.json());
  };

  const startHunt = async () => {
    setHuntError('');
    try {
      const res = await fetch(`${apiBaseUrl}/api/hunt/start`, { method: 'POST', headers: keyHeaders });
      if (res.status === 401) throw new Error('Wrong access key');
      if (!res.ok) throw new Error('Server error');
      setHunt((await res.json()).state);
      toast('ok', 'Hunt started. Emails will be queued as they are found.');
    } catch (e) {
      setHuntError(e.message);
      toast('err', `Hunt did not start: ${e.message}`);
    }
  };

  useEffect(() => {
    if (!hunt?.running) return undefined;
    const t = setInterval(() => fetchHunt().catch((e) => setHuntError(e.message)), 2000);
    return () => clearInterval(t);
  }, [hunt?.running]); // eslint-disable-line react-hooks/exhaustive-deps

  // tell when the hunt finishes
  const huntWasRunning = useRef(false);
  useEffect(() => {
    if (huntWasRunning.current && hunt && !hunt.running) {
      if (hunt.error) toast('err', `Hunt stopped: ${hunt.error}`);
      else toast('ok', `Hunt finished: ${hunt.scanned} posts scanned, ${hunt.queued} queued for mail`);
    }
    huntWasRunning.current = Boolean(hunt?.running);
  }, [hunt]);

  // LinkedIn agent: the Chrome extension (bridge.js) runs the searches in the user's own logged-in browser.
  // The site only sends Start/Stop and shows progress. No key or LinkedIn data passes through this page.
  const [agent, setAgent] = useState(null); // null = extension not found
  const pinged = useRef(false);

  useEffect(() => {
    const onMsg = (e) => {
      const d = e.data;
      if (e.source !== window || !d || d.src !== 'jh-agent') return;
      setAgent(d.state);
    };
    window.addEventListener('message', onMsg);
    const ping = () => window.postMessage({ src: 'jh-site', type: 'PING' }, window.location.origin);
    ping();
    const t = setInterval(() => !pinged.current && ping(), 3000);
    return () => {
      window.removeEventListener('message', onMsg);
      clearInterval(t);
    };
  }, []);
  useEffect(() => {
    pinged.current = agent !== null;
  }, [agent]);

  // toasts for the extension: found, started, finished, and any message it shows (login needed, daily cap...)
  const agentSeen = useRef({ found: false, running: false, message: '' });
  useEffect(() => {
    if (!agent) return;
    const prev = agentSeen.current;
    if (!prev.found) toast('ok', 'Chrome extension connected');
    if (!prev.running && agent.running) toast('ok', 'LinkedIn agent started');
    if (prev.running && !agent.running) toast(agent.message ? 'err' : 'ok', `LinkedIn agent stopped: ${agent.posts} posts read, ${agent.emails} emails sent to the mailer`);
    if (agent.message && agent.message !== prev.message) toast('info', agent.message);
    agentSeen.current = { found: true, running: Boolean(agent.running), message: agent.message || '' };
  }, [agent]);

  // hand the Access Key (typed in Step 2) to the extension, so config.js needs no editing
  useEffect(() => {
    if (accessKey) window.postMessage({ src: 'jh-site', type: 'SET_KEY', key: accessKey.trim() }, window.location.origin);
  }, [accessKey, agent === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const agentCmd = (type) => window.postMessage({ src: 'jh-site', type }, window.location.origin);

  const totalQueries = categories
    .filter((c) => selected.includes(c.key))
    .reduce((n, c) => n + c.queries.length, 0);

  return (
    <div className="card" id="hunter">
      <h2 style={{ marginTop: 0 }}>🎯 Auto Hunter</h2>
      <p style={{ opacity: 0.7, fontSize: '13px', marginTop: 0 }}>
        Step 1: choose the roles you want. Select one or more, each comes with 20 search keywords.
      </p>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ fontSize: '12px' }}
          onClick={() => save(categories.map((c) => c.key))}
        >
          Select all
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ fontSize: '12px' }}
          onClick={() => save([])}
          disabled={selected.length === 0}
        >
          Clear
        </button>
      </div>

      <div className="target-chips">
        {categories.map((c) => {
          const on = selected.includes(c.key);
          return (
            <button
              key={c.key}
              type="button"
              className={on ? 'btn' : 'btn btn-secondary'}
              onClick={() => toggle(c.key)}
              aria-pressed={on}
            >
              {on ? '✓ ' : ''}
              {c.label}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: '12px', marginTop: '10px', opacity: 0.8 }}>
        {status === 'loading' && 'Loading...'}
        {status === 'error' && '⚠️ Could not reach the server.'}
        {status === 'saving' && 'Saving...'}
        {(status === 'ready' || status === 'saved') &&
          `${selected.length} selected • ${totalQueries} search keywords${status === 'saved' ? ' • saved' : ''}`}
      </div>

      {selected.length > 0 && (
        <div
          style={{
            marginTop: '14px',
            padding: '12px',
            background: 'var(--bg-terminal)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            maxHeight: '260px',
            overflowY: 'auto',
          }}
        >
          <h3 style={{ margin: '0 0 8px', fontSize: '14px' }}>🔍 Keywords that will be searched ({totalQueries})</h3>
          {categories
            .filter((c) => selected.includes(c.key))
            .map((c) => (
              <div key={c.key} style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)', marginBottom: '4px' }}>
                  {c.label} ({c.queries.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {c.queries.map((q) => (
                    <span
                      key={q}
                      style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '9999px',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {q}
                    </span>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '15px' }}>▶ Step 2: Start hunting</h3>
        <p style={{ opacity: 0.7, fontSize: '13px', margin: '0 0 10px' }}>
          Enter your access key, then press Start. You can close this tab, mails keep going out from the server.
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            type="password"
            placeholder="Access key"
            value={accessKey}
            onChange={(e) => saveKey(e.target.value)}
            style={{
              flex: 1,
              minWidth: '140px',
              padding: '10px 12px',
              background: 'var(--bg-terminal)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              fontFamily: 'inherit',
            }}
          />
          <button type="button" className="btn hunt-start" onClick={startHunt} disabled={!accessKey || hunt?.running}>
            {hunt?.running ? 'Hunting...' : '▶ Start'}
          </button>
        </div>
        <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.85 }}>
          {huntError && `⚠️ ${huntError}`}
          {!huntError && hunt && (
            <>
              {hunt.scanned} posts scanned • {hunt.matched} with email • {hunt.queued} queued for mail
              {hunt.error && ` • error: ${hunt.error}`}
              {!hunt.running && hunt.finishedAt && !hunt.error && ' • done'}
            </>
          )}
          {!huntError && !hunt && 'Source: Hacker News "Who is hiring?" (public). Mails go out in the background.'}
        </div>
      </div>

      <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '15px' }}>💼 Step 3: LinkedIn agent</h3>
        <p style={{ opacity: 0.7, fontSize: '13px', margin: '0 0 10px' }}>
          Your Chrome extension searches the keywords above on LinkedIn (a small separate window, slow scrolling), reads the posts and
          sends the emails it finds to the mailer. Stays logged in as you. Limit: 1 hour of LinkedIn a day.
        </p>
        {agent === null ? (
          <div style={{ fontSize: '13px', opacity: 0.85 }}>
            ⚠️ Extension not detected. Install it from the Guide (zip), reload it at chrome://extensions, then reload this page.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn hunt-start"
                onClick={() => window.postMessage({ src: 'jh-site', type: 'START', maxQueries: 8, steps: 14 }, window.location.origin)}
                disabled={agent.running || selected.length === 0}
              >
                {agent.running ? 'Agent running...' : '▶ Start LinkedIn agent'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => agentCmd('STOP')} disabled={!agent.running}>
                ■ Stop
              </button>
            </div>
            <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.85 }}>
              {selected.length === 0 && 'Choose at least one role above. '}
              {agent.running && `Search ${agent.index}/${agent.total}: "${agent.query}" • `}
              {agent.status !== 'idle' && !agent.running && !agent.message && `Finished • `}
              {agent.status !== 'idle' && `${agent.posts} posts read • ${agent.emails} emails sent to the mailer`}
              {agent.minutesLeft !== null && ` • ${agent.minutesLeft} min left today`}
              {agent.message && ` • ${agent.message}`}
              {agent.status === 'idle' && selected.length > 0 && 'Extension connected. Press Start.'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
