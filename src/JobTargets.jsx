import { useState, useEffect } from 'react';

// Multiselect of job categories. Each category carries 20 LinkedIn search queries,
// the extension searches the queries of every selected category.
export default function JobTargets({ apiBaseUrl }) {
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState([]);
  const [expanded, setExpanded] = useState(null);
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

  const toggle = async (key) => {
    const next = selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key];
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
    } catch {
      setStatus('error');
    }
  };

  // Start hunt: the server collects leads from Hacker News "Who is hiring?" and queues the mails.
  // Needs the server's access key (same as AUTO_API_KEY), kept only in this browser.
  const [accessKey, setAccessKey] = useState(() => {
    try {
      return localStorage.getItem('jobhunting_key') || '';
    } catch {
      return '';
    }
  });
  const [hunt, setHunt] = useState(null);
  const [huntError, setHuntError] = useState('');

  const keyHeaders = { 'X-API-Key': accessKey };

  const saveKey = (v) => {
    setAccessKey(v);
    try {
      localStorage.setItem('jobhunting_key', v);
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
    } catch (e) {
      setHuntError(e.message);
    }
  };

  useEffect(() => {
    if (!hunt?.running) return undefined;
    const t = setInterval(() => fetchHunt().catch((e) => setHuntError(e.message)), 2000);
    return () => clearInterval(t);
  }, [hunt?.running]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalQueries = categories
    .filter((c) => selected.includes(c.key))
    .reduce((n, c) => n + c.queries.length, 0);

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>🎯 Auto Hunter</h2>
      <p style={{ opacity: 0.7, fontSize: '13px', marginTop: 0 }}>
        Step 1: choose the roles you want. Select one or more, each comes with 20 search keywords.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
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
          <button type="button" className="btn" onClick={startHunt} disabled={!accessKey || hunt?.running}>
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

      {categories
        .filter((c) => selected.includes(c.key))
        .map((c) => (
          <div key={c.key} style={{ marginTop: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '12px' }}
              onClick={() => setExpanded(expanded === c.key ? null : c.key)}
            >
              {expanded === c.key ? '▾' : '▸'} {c.label} keywords ({c.queries.length})
            </button>
            {expanded === c.key && (
              <ul style={{ margin: '8px 0 0', paddingLeft: '20px', fontSize: '12px', opacity: 0.85 }}>
                {c.queries.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
    </div>
  );
}
