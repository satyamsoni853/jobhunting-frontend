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

  const totalQueries = categories
    .filter((c) => selected.includes(c.key))
    .reduce((n, c) => n + c.queries.length, 0);

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>🎯 Job Targets</h2>
      <p style={{ opacity: 0.7, fontSize: '13px', marginTop: 0 }}>
        Select one or more. The LinkedIn extension searches all keywords of the selected targets.
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
