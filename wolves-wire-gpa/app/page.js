'use client';

import { useState } from 'react';

const GRADE_SCALE = {
  'A+': 4.0, A: 4.0, 'A-': 3.7,
  'B+': 3.3, B: 3.0, 'B-': 2.7,
  'C+': 2.3, C: 2.0, 'C-': 1.7,
  'D+': 1.3, D: 1.0, 'D-': 0.7,
  F: 0.0,
};

const DEFAULT_EXCLUDES = ['citizenship'];

function percentToLetter(pct) {
  if (pct >= 97) return 'A+';
  if (pct >= 93) return 'A';
  if (pct >= 90) return 'A-';
  if (pct >= 87) return 'B+';
  if (pct >= 83) return 'B';
  if (pct >= 80) return 'B-';
  if (pct >= 77) return 'C+';
  if (pct >= 73) return 'C';
  if (pct >= 70) return 'C-';
  if (pct >= 67) return 'D+';
  if (pct >= 63) return 'D';
  if (pct >= 60) return 'D-';
  return 'F';
}

function gradeColor(letter) {
  if (letter.startsWith('A')) return '#4ade80';
  if (letter.startsWith('B')) return '#facc15';
  if (letter.startsWith('C')) return '#fb923c';
  return '#f87171';
}

function gradeColorBg(letter) {
  if (letter.startsWith('A')) return 'rgba(74,222,128,0.12)';
  if (letter.startsWith('B')) return 'rgba(250,204,21,0.12)';
  if (letter.startsWith('C')) return 'rgba(251,146,60,0.12)';
  return 'rgba(248,113,113,0.12)';
}

function gpaToLetter(gpa) {
  if (gpa >= 3.85) return 'A';
  if (gpa >= 3.5) return 'A-';
  if (gpa >= 3.15) return 'B+';
  if (gpa >= 2.85) return 'B';
  if (gpa >= 2.5) return 'B-';
  if (gpa >= 2.15) return 'C+';
  if (gpa >= 1.85) return 'C';
  if (gpa >= 1.5) return 'C-';
  if (gpa >= 1.15) return 'D+';
  if (gpa >= 0.85) return 'D';
  if (gpa >= 0.5) return 'D-';
  return 'F';
}

function parseRenWebText(text) {
  const parsed = [];
  const lines = text.split('\n');
  let currentTeacher = null;
  let currentCourse = null;
  let currentSubject = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const headerMatch = line.match(/^[\w]+,\s*[\w]+\s+\d{4}-\d{4}\s+(.+)$/);
    if (headerMatch) {
      currentTeacher = headerMatch[1].trim();
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        const courseMatch = nextLine.match(/^(.+?)\s+Sem\s+\d/);
        if (courseMatch) currentCourse = courseMatch[1].trim();
      }
      for (let j = i + 2; j < Math.min(i + 6, lines.length); j++) {
        const subLine = lines[j].trim();
        if (subLine.match(/^(MIXED|Mixed)$/i)) {
          for (let k = j + 1; k < Math.min(j + 3, lines.length); k++) {
            const subjLine = lines[k].trim();
            if (subjLine && subjLine.length > 1) { currentSubject = subjLine; break; }
          }
          break;
        }
      }
      continue;
    }
    const termMatch = line.match(/^Term Grade\s+([\d.]+)\s*([A-F][+-]?)?\s*$/);
    if (termMatch && currentSubject) {
      const pct = parseFloat(termMatch[1]);
      let letter = termMatch[2] || percentToLetter(pct);
      parsed.push({ name: currentSubject, code: currentCourse || currentSubject, teacher: currentTeacher || '', percentage: pct, letter });
      currentCourse = null; currentTeacher = null; currentSubject = null;
    }
  }
  return parsed;
}

export default function Home() {
  const [mode, setMode] = useState('link'); // 'link' or 'paste'
  const [linkInput, setLinkInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [courses, setCourses] = useState([]);
  const [excluded, setExcluded] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showExclude, setShowExclude] = useState(false);

  async function handleCalculate() {
    setError('');
    setCourses([]);
    setExcluded(new Set());

    if (mode === 'link') {
      if (!linkInput.trim()) { setError('Paste your RenWeb link first.'); return; }
      if (!linkInput.includes('factsmgt.com')) { setError('That doesn\'t look like a RenWeb link. Make sure it\'s from factsmgt.com.'); return; }

      setLoading(true);
      try {
        const res = await fetch('/api/fetch-grades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: linkInput.trim() }),
        });
        const data = await res.json();
        if (data.error) { setError(data.error); setLoading(false); return; }
        applyResults(data.courses);
      } catch {
        setError('Something went wrong. Try pasting the report text instead.');
      }
      setLoading(false);
    } else {
      if (!textInput.trim()) { setError('Paste your RenWeb report text first.'); return; }
      const parsed = parseRenWebText(textInput);
      if (parsed.length === 0) { setError('Could not find any grades. Make sure you pasted the full report.'); return; }
      applyResults(parsed);
    }
  }

  function applyResults(courseList) {
    setCourses(courseList);
    const autoExclude = new Set();
    courseList.forEach((c) => {
      if (DEFAULT_EXCLUDES.some((ex) => c.name.toLowerCase().includes(ex))) {
        autoExclude.add(c.name);
      }
    });
    setExcluded(autoExclude);
  }

  function toggleExclude(name) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function clearAll() {
    setLinkInput('');
    setTextInput('');
    setCourses([]);
    setExcluded(new Set());
    setError('');
  }

  const included = courses.filter((c) => !excluded.has(c.name));
  const gpa = included.length > 0
    ? included.reduce((sum, c) => sum + (GRADE_SCALE[c.letter] || 0), 0) / included.length
    : 0;
  const gpaRounded = Math.round(gpa * 100) / 100;
  const gpaLetter = gpaToLetter(gpa);

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'DM Sans', sans-serif;
          background: #0b1628;
          color: #f0f4ff;
          min-height: 100vh;
        }
        .noise {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
          pointer-events: none; z-index: 0;
        }
        .glow-orb {
          position: fixed; width: 700px; height: 700px; border-radius: 50%;
          background: radial-gradient(circle, rgba(26,53,102,0.5) 0%, transparent 70%);
          top: -300px; right: -250px; pointer-events: none; z-index: 0;
        }
        .glow-orb-2 {
          position: fixed; width: 500px; height: 500px; border-radius: 50%;
          background: radial-gradient(circle, rgba(26,53,102,0.3) 0%, transparent 70%);
          bottom: -200px; left: -200px; pointer-events: none; z-index: 0;
        }
        .container {
          position: relative; z-index: 1; max-width: 720px;
          margin: 0 auto; padding: 40px 20px 80px;
        }
        header { text-align: center; margin-bottom: 48px; }
        .tag {
          font-family: 'Space Mono', monospace; font-size: 11px;
          text-transform: uppercase; letter-spacing: 4px; color: #fff;
          display: inline-block; background: #1a3566; border: 1px solid #2a4a82;
          padding: 6px 18px; border-radius: 100px; margin-bottom: 16px;
        }
        header h1 { font-size: 36px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 4px; color: #fff; }
        header p { color: #8296b8; font-size: 15px; line-height: 1.5; }
        .gpa-display {
          background: linear-gradient(135deg, #1a3566 0%, #112240 100%);
          border: 1px solid #1e3a6a; border-radius: 16px; padding: 44px 40px;
          text-align: center; margin-bottom: 32px; position: relative; overflow: hidden;
        }
        .gpa-display::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, transparent, #fff, transparent); opacity: 0.6;
        }
        .gpa-number {
          font-family: 'Space Mono', monospace; font-size: 76px; font-weight: 700;
          letter-spacing: -3px; line-height: 1; margin-bottom: 8px;
        }
        .gpa-label {
          font-size: 12px; color: #8296b8; text-transform: uppercase; letter-spacing: 3px;
        }
        .gpa-letter {
          font-family: 'Space Mono', monospace; font-size: 20px; font-weight: 700;
          margin-top: 14px; display: inline-block; padding: 4px 18px; border-radius: 8px;
        }
        .mode-toggle {
          display: flex; background: #112240; border: 1px solid #1e3a6a;
          border-radius: 10px; overflow: hidden; margin-bottom: 16px;
        }
        .mode-btn {
          flex: 1; padding: 10px; text-align: center; font-size: 13px;
          font-weight: 600; cursor: pointer; transition: all 0.2s;
          border: none; font-family: 'DM Sans', sans-serif; color: #8296b8;
          background: transparent;
        }
        .mode-btn.active { background: #1a3566; color: #fff; }
        input[type="text"], textarea {
          width: 100%; background: #112240; border: 1px solid #1e3a6a;
          border-radius: 12px; color: #f0f4ff; font-family: 'Space Mono', monospace;
          font-size: 13px; padding: 14px 16px; outline: none; transition: border-color 0.2s;
        }
        input[type="text"]:focus, textarea:focus {
          border-color: #fff; box-shadow: 0 0 0 3px rgba(255,255,255,0.08);
        }
        input::placeholder, textarea::placeholder { color: #8296b8; opacity: 0.5; }
        textarea { min-height: 140px; resize: vertical; }
        .btn-row { display: flex; gap: 12px; margin-top: 12px; }
        .btn-primary {
          flex: 1; background: #fff; color: #0b1628; border: none;
          border-radius: 10px; padding: 12px 24px; font-size: 14px;
          font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif;
          transition: all 0.2s;
        }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 24px rgba(255,255,255,0.15); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .btn-secondary {
          background: #112240; color: #8296b8; border: 1px solid #1e3a6a;
          border-radius: 10px; padding: 12px 24px; font-size: 14px;
          font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif;
          transition: all 0.2s;
        }
        .btn-secondary:hover { background: #162d54; color: #f0f4ff; }
        .error-msg {
          background: rgba(248,113,113,0.12); color: #f87171;
          padding: 12px 16px; border-radius: 12px; font-size: 13px; margin-top: 12px;
        }
        .exclude-toggle {
          font-size: 13px; color: #8296b8; cursor: pointer; padding: 8px 0;
          margin-bottom: 12px; user-select: none;
        }
        .exclude-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
        .chip {
          font-size: 12px; padding: 6px 14px; border-radius: 100px;
          background: #112240; border: 1px solid #1e3a6a; cursor: pointer;
          transition: all 0.2s; user-select: none;
        }
        .chip.excluded {
          background: rgba(248,113,113,0.12); border-color: #f87171;
          color: #f87171; text-decoration: line-through;
        }
        .chip:hover { border-color: #8296b8; }
        .course-card {
          display: flex; align-items: center; justify-content: space-between;
          background: #112240; border: 1px solid #1e3a6a; border-radius: 12px;
          padding: 16px 20px; margin-bottom: 8px; transition: all 0.3s;
          animation: slideIn 0.3s ease-out;
        }
        .course-card:hover { border-color: #2a4a82; background: #162d54; }
        .course-card.excluded-card { opacity: 0.3; }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .course-name { font-size: 15px; font-weight: 600; margin-bottom: 2px; }
        .course-teacher { font-size: 12px; color: #8296b8; }
        .course-pct { font-family: 'Space Mono', monospace; font-size: 20px; font-weight: 700; text-align: right; }
        .course-letter {
          font-family: 'Space Mono', monospace; font-size: 12px;
          padding: 2px 8px; border-radius: 6px; display: inline-block; margin-top: 2px;
        }
        .empty-state { text-align: center; padding: 60px 20px; color: #8296b8; }
        .empty-icon { font-size: 52px; margin-bottom: 16px; opacity: 0.4; }
        .empty-state p { font-size: 14px; line-height: 1.6; }
        .share-hint { text-align: center; font-size: 12px; color: #8296b8; margin-top: 24px; opacity: 0.5; }
        .footer {
          text-align: center; margin-top: 48px; padding-top: 24px;
          border-top: 1px solid #1e3a6a;
        }
        .footer p { font-family: 'Space Mono', monospace; font-size: 11px; color: #8296b8; opacity: 0.4; letter-spacing: 1px; }
        .spinner {
          display: inline-block; width: 18px; height: 18px;
          border: 2px solid rgba(11,22,40,0.3); border-top-color: #0b1628;
          border-radius: 50%; animation: spin 0.6s linear infinite;
          vertical-align: middle; margin-right: 8px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 480px) {
          .container { padding: 24px 16px 60px; }
          header h1 { font-size: 28px; }
          .gpa-number { font-size: 56px; }
        }
      `}</style>

      <div className="noise" />
      <div className="glow-orb" />
      <div className="glow-orb-2" />

      <div className="container">
        <header>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
            <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
              <path d="M8 6L14 20L10 34L18 42H30L38 34L34 20L40 6L32 16L24 12L16 16L8 6Z" fill="white" fillOpacity="0.9"/>
              <path d="M18 28L21 32H27L30 28L27 24H21L18 28Z" fill="#0b1628"/>
              <circle cx="18" cy="22" r="2" fill="#0b1628"/>
              <circle cx="30" cy="22" r="2" fill="#0b1628"/>
            </svg>
          </div>
          <div className="tag">Wolves Wire</div>
          <h1>GPA Calc</h1>
          <p>Paste your RenWeb link or report text. Get your GPA instantly.</p>
        </header>

        {courses.length > 0 && (
          <div className="gpa-display">
            <div className="gpa-number" style={{ color: gradeColor(gpaLetter) }}>
              {gpaRounded.toFixed(2)}
            </div>
            <div className="gpa-label">Semester GPA</div>
            <div className="gpa-letter" style={{ background: gradeColorBg(gpaLetter), color: gradeColor(gpaLetter) }}>
              {gpaLetter}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 32 }}>
          <div className="mode-toggle">
            <button className={`mode-btn ${mode === 'link' ? 'active' : ''}`} onClick={() => setMode('link')}>
              Paste Link
            </button>
            <button className={`mode-btn ${mode === 'paste' ? 'active' : ''}`} onClick={() => setMode('paste')}>
              Paste Text
            </button>
          </div>

          {mode === 'link' ? (
            <input
              type="text"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="Paste your RenWeb grade report link here..."
            />
          ) : (
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Copy everything from your RenWeb grade email and paste it here..."
            />
          )}

          {error && <div className="error-msg">{error}</div>}

          <div className="btn-row">
            <button className="btn-primary" onClick={handleCalculate} disabled={loading}>
              {loading ? <><span className="spinner" />Fetching...</> : 'Calculate GPA'}
            </button>
            <button className="btn-secondary" onClick={clearAll}>Clear</button>
          </div>
        </div>

        {courses.length > 0 && (
          <>
            <div
              className="exclude-toggle"
              onClick={() => setShowExclude(!showExclude)}
            >
              {showExclude ? '▾' : '▸'} Exclude courses from GPA
            </div>

            {showExclude && (
              <div className="exclude-chips">
                {courses.map((c) => (
                  <div
                    key={c.name}
                    className={`chip ${excluded.has(c.name) ? 'excluded' : ''}`}
                    onClick={() => toggleExclude(c.name)}
                  >
                    {c.name}
                  </div>
                ))}
              </div>
            )}

            {courses.map((c, i) => (
              <div
                key={i}
                className={`course-card ${excluded.has(c.name) ? 'excluded-card' : ''}`}
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div>
                  <div className="course-name">{c.name}</div>
                  <div className="course-teacher">{c.teacher}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="course-pct" style={{ color: gradeColor(c.letter) }}>
                    {c.percentage % 1 === 0 ? c.percentage : c.percentage.toFixed(2)}%
                  </div>
                  <div className="course-letter" style={{ background: gradeColorBg(c.letter), color: gradeColor(c.letter) }}>
                    {c.letter}
                  </div>
                </div>
              </div>
            ))}

            <div className="share-hint">Share this with the pack — anyone can paste their own grades.</div>
          </>
        )}

        {courses.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🐺</div>
            <p>Paste your RenWeb grade report link or text above<br />and hit Calculate to see your GPA.</p>
          </div>
        )}

        <div className="footer">
          <p>Wolves Wire · GPA Calc</p>
        </div>
      </div>
    </>
  );
}
