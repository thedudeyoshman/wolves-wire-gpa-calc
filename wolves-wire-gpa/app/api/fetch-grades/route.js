export async function POST(request) {
  try {
    const { url } = await request.json();

    // Validate URL
    if (!url || !url.includes('factsmgt.com')) {
      return Response.json(
        { error: 'Please paste a valid RenWeb/FACTS grade report link.' },
        { status: 400 }
      );
    }

    // Fetch the grade report from RenWeb
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!res.ok) {
      return Response.json(
        { error: 'Could not fetch the grade report. The link may have expired.' },
        { status: 400 }
      );
    }

    const html = await res.text();

    // Strip HTML tags to get plain text
    const text = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/td>/gi, '\t')
      .replace(/<\/th>/gi, '\t')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#\d+;/g, '')
      .replace(/\t+/g, '\t')
      .replace(/\n\s*\n/g, '\n');

    // Parse the grades
    const courses = parseGrades(text);

    if (courses.length === 0) {
      return Response.json(
        { error: 'Could not find any grades in the report. The link may have expired or the format may be different.' },
        { status: 400 }
      );
    }

    return Response.json({ courses });
  } catch (err) {
    console.error('Error fetching grades:', err);
    return Response.json(
      { error: 'Something went wrong. Please try pasting the report text instead.' },
      { status: 500 }
    );
  }
}

function parseGrades(text) {
  const parsed = [];
  const lines = text.split('\n');
  let currentTeacher = null;
  let currentCourse = null;
  let currentSubject = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect header: "LastName, FirstName  2025-2026  TeacherFirst, TeacherLast"
    const headerMatch = line.match(/^[\w]+,\s*[\w]+\s+\d{4}-\d{4}\s+(.+)$/);
    if (headerMatch) {
      currentTeacher = headerMatch[1].trim();
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        const courseMatch = nextLine.match(/^(.+?)\s+Sem\s+\d/);
        if (courseMatch) {
          currentCourse = courseMatch[1].trim();
        }
      }
      for (let j = i + 2; j < Math.min(i + 6, lines.length); j++) {
        const subLine = lines[j].trim();
        if (subLine.match(/^(MIXED|Mixed)$/i)) {
          for (let k = j + 1; k < Math.min(j + 3, lines.length); k++) {
            const subjLine = lines[k].trim();
            if (subjLine && subjLine.length > 1) {
              currentSubject = subjLine;
              break;
            }
          }
          break;
        }
      }
      continue;
    }

    // Detect Term Grade
    const termMatch = line.match(/^Term Grade\s+([\d.]+)\s*([A-F][+-]?)?\s*$/);
    if (termMatch && currentSubject) {
      const pct = parseFloat(termMatch[1]);
      let letter = termMatch[2] || '';
      if (!letter) {
        letter = percentToLetter(pct);
      }

      parsed.push({
        name: currentSubject,
        code: currentCourse || currentSubject,
        teacher: currentTeacher || '',
        percentage: pct,
        letter: letter,
      });

      currentCourse = null;
      currentTeacher = null;
      currentSubject = null;
    }
  }

  return parsed;
}

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
