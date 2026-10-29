import { useState, useEffect, useMemo } from 'react';

// Jobs from public job boards that only give an apply link (no recruiter email). Open them and apply by hand.
// Each job is scored against the resume on the server, the best fits come first.
const SOURCES = ['Remote OK', 'Remotive', 'We Work Remotely', 'Himalayas'];

const ago = (iso) => {
  const t = new Date(iso).getTime();
  if (!t) return '';
  const d = Math.floor((Date.now() - t) / 86400000);
  return d <= 0 ? 'today' : d === 1 ? '1 day ago' : `${d} days ago`;
};

export default function JobsBoard({ apiBaseUrl }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [q, setQ] = useState('');
  const [source, setSource] = useState('');
  const [min, setMin] = useState(0.45);

  useEffect(() => {
    let live = true;
    fetch(`${apiBaseUrl}/api/jobs?limit=120&minFit=${min}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (live) {
          setData(d);
          setStatus('ready');
        }
      })
      .catch(() => live && setStatus('error'));
    return () => {
      live = false;
    };
  }, [apiBaseUrl, min]);

  const jobs = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.jobs.filter(
      (j) =>
        (!source || j.source === source) &&
        (!needle || `${j.title} ${j.company} ${j.skills.join(' ')}`.toLowerCase().includes(needle))
    );
  }, [data, q, source]);

  return (
    <div className="card" id="jobs">
      <h2 style={{ marginTop: 0 }}>🧭 Jobs to apply</h2>
      <p className="card-sub">
        Remote developer jobs from public job boards, scored against your resume. These boards give an apply link,
        not an email, so open a job and apply yourself.
      </p>

      <div className="jobs-filters">
        <input
          className="input-field"
          placeholder="Search title, company or skill..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input-field" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select className="input-field" value={min} onChange={(e) => {
            setStatus('loading');
            setMin(Number(e.target.value));
          }}
          aria-label="Minimum fit"
        >
          <option value={0.3}>Fit 30%+</option>
          <option value={0.45}>Fit 45%+</option>
          <option value={0.7}>Fit 70%+</option>
        </select>
      </div>

      {status === 'loading' && <p className="card-sub">Loading jobs... the server may take a minute to wake up.</p>}
      {status === 'error' && <p className="tailor-error">⚠️ Could not load jobs from the server.</p>}

      {status === 'ready' && (
        <>
          <p className="jobs-count">
            {jobs.length} job{jobs.length === 1 ? '' : 's'} shown · {data.scanned} scanned
            {data.errors.length > 0 && ` · ${data.errors.length} source(s) unavailable`}
          </p>
          <ul className="jobs-list">
            {jobs.map((j) => (
              <li key={j.id} className="job">
                <div className="job-main">
                  <div className="job-title">{j.title}</div>
                  <div className="job-meta">
                    {j.company && <span>{j.company}</span>}
                    <span>{j.location}</span>
                    <span>{ago(j.postedAt)}</span>
                    <span className="job-src">{j.source}</span>
                  </div>
                  <div className="tag-list">
                    <span className="tag">{j.role}</span>
                    {j.skills.slice(0, 4).map((s) => (
                      <span key={s} className="tag good">
                        {s}
                      </span>
                    ))}
                    {j.gaps.slice(0, 2).map((g) => (
                      <span key={g} className="tag warn" title="Asked for, not on your resume">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="job-side">
                  <span className={`fit-badge ${j.fit >= 0.45 ? 'good' : 'low'}`}>{Math.round(j.fit * 100)}%</span>
                  <a className="btn btn-secondary" href={j.url} target="_blank" rel="noopener noreferrer">
                    Open ↗
                  </a>
                </div>
              </li>
            ))}
          </ul>
          {jobs.length === 0 && <p className="card-sub">No jobs match. Try a lower fit or clear the search.</p>}
          <p className="jobs-credit">Listings from Remote OK, Remotive, We Work Remotely and Himalayas. Links open the original site.</p>
        </>
      )}
    </div>
  );
}
