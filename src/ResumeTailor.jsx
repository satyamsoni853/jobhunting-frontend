import { useState } from 'react';

// Preview of what the server would send for a recruiter's post: role, fit, skills matched, tailored subject
// and note, and the tailored one-page PDF. Rule based, no AI. Needs the Access Key saved in Auto Hunter.
const SAMPLE =
  'Hiring a React developer for our remote team. Skills: React, TypeScript, Redux, Next.js, Tailwind CSS, REST APIs, Node.js. 1-2 years experience. Immediate joiners welcome.';

export default function ResumeTailor({ apiBaseUrl }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const getKey = () => {
    try {
      return localStorage.getItem('jobhunting_key') || '';
    } catch {
      return '';
    }
  };

  const call = async (path) => {
    const key = getKey();
    if (!key) throw new Error('Enter the Access Key in Auto Hunter (Step 2) first.');
    const res = await fetch(`${apiBaseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
      body: JSON.stringify({ text }),
    });
    if (res.status === 401) throw new Error('Wrong access key.');
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Server error ${res.status}`);
    return res;
  };

  const preview = async () => {
    setBusy(true);
    setError('');
    try {
      setResult(await (await call('/api/tailor/preview')).json());
    } catch (e) {
      setError(e.message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    setError('');
    try {
      const blob = await (await call('/api/tailor/pdf')).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Satyam_Soni_Resume_tailored.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const fitPct = result ? Math.round(result.fit * 100) : 0;
  const fitClass = !result ? '' : result.wouldSend ? 'good' : 'low';

  return (
    <div className="card" id="tailor">
      <h2 style={{ marginTop: 0 }}>📄 Resume Tailor</h2>
      <p className="card-sub">
        Paste a recruiter&apos;s job post. The resume, subject and note are rearranged for that role using only
        skills already on your resume. Nothing is invented.
      </p>

      <textarea
        className="input-field textarea-field"
        rows={5}
        placeholder="Paste the job post here..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="btn-row">
        <button type="button" className="btn" onClick={preview} disabled={busy || text.trim().length < 20}>
          {busy ? 'Working...' : '🔍 Preview'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setText(SAMPLE)} disabled={busy}>
          Try a sample
        </button>
        {result && (
          <button type="button" className="btn btn-secondary" onClick={download} disabled={busy}>
            ⬇ Download PDF
          </button>
        )}
      </div>

      {error && <p className="tailor-error">⚠️ {error}</p>}

      {result && (
        <div className="tailor-result">
          <div className="tailor-top">
            <div>
              <div className="tailor-label">Detected role</div>
              <div className="tailor-role">{result.role}</div>
            </div>
            <div className={`fit-badge ${fitClass}`}>
              {result.wouldSend ? 'Would send' : 'Would skip'} · fit {fitPct}%
            </div>
          </div>

          <div className="fit-bar" aria-hidden="true">
            <div className={`fit-fill ${fitClass}`} style={{ width: `${fitPct}%` }} />
            <div className="fit-mark" style={{ left: `${Math.round(result.minFit * 100)}%` }} title="Minimum fit to send" />
          </div>

          {result.reasons.length > 0 && (
            <ul className="tailor-reasons">
              {result.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}

          <div className="tailor-label">Skills matched from your resume</div>
          <div className="tag-list">
            {result.matchedSkills.length ? (
              result.matchedSkills.map((s) => (
                <span key={s} className="tag good">
                  {s}
                </span>
              ))
            ) : (
              <span className="tag">none found</span>
            )}
          </div>

          {result.gaps.length > 0 && (
            <>
              <div className="tailor-label">Asked for but not on your resume (never added)</div>
              <div className="tag-list">
                {result.gaps.map((g) => (
                  <span key={g} className="tag warn">
                    {g}
                  </span>
                ))}
              </div>
            </>
          )}

          <div className="tailor-label">Subject</div>
          <div className="tailor-box">{result.subject}</div>
          <div className="tailor-label">Resume headline</div>
          <div className="tailor-box">{result.title}</div>
          <div className="tailor-label">Cover note</div>
          <pre className="tailor-box tailor-pre">{result.body}</pre>
        </div>
      )}
    </div>
  );
}
