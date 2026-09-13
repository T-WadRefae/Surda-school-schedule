/* ==========================================================
   نظام الجدول المدرسي — النواة المشتركة
   تستخدمها صفحة الجدول (app.js) وصفحة الإشغال (cover.js)
   ========================================================== */

const $ = (sel) => document.querySelector(sel);

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function parseCell(cell) {
  if (!cell) return null;
  const [subject, teacher] = cell.split('|');
  return { subject: (subject || '').trim(), teacher: (teacher || '').trim() };
}

function subjectColor(subject) {
  return SUBJECT_COLORS[subject] || '#334155';
}

function periodLabel(i) {
  const t = PERIOD_TIMES[i];
  if (t && t.start && t.end) {
    return `${PERIOD_NAMES[i]}<br><span style="font-weight:600;font-size:.72rem;color:#6b7f92">${t.start} - ${t.end}</span>`;
  }
  return PERIOD_NAMES[i];
}

/* ---------- فهرسة البيانات ---------- */
const LESSONS = [];
DAYS.forEach((day, d) => {
  TIMETABLE[day].forEach((row, p) => {
    row.forEach((cell, c) => {
      const parsed = parseCell(cell);
      if (parsed) LESSONS.push({ d, p, c, day, className: CLASSES[c], ...parsed });
    });
  });
});

const TEACHERS = [...new Set(LESSONS.map(l => l.teacher))].sort((a, b) => a.localeCompare(b, 'ar'));

/** نصاب المعلمة الأسبوعي */
const WEEKLY_LOAD = {};
TEACHERS.forEach(t => { WEEKLY_LOAD[t] = LESSONS.filter(l => l.teacher === t).length; });

/** حصص المعلمة في يوم وحصة محددين (قد تكون أكثر من واحدة عند دمج صفّين) */
function lessonsOf(teacher, d, p) {
  return LESSONS.filter(l => l.teacher === teacher && l.d === d && l.p === p);
}

/** عدد الحصص الفعلية في يوم معيّن (آخر حصة فيها درس) */
function periodsUsed(d) {
  let last = 0;
  TIMETABLE[DAYS[d]].forEach((row, p) => { if (row.some(Boolean)) last = p + 1; });
  return last;
}

/** المعلمات المتفرغات في حصة معيّنة حسب الجدول الأصلي */
function freeTeachers(d, p) {
  const busy = new Set(LESSONS.filter(l => l.d === d && l.p === p).map(l => l.teacher));
  return TEACHERS.filter(t => !busy.has(t));
}

/** تعارضات: معلمة واحدة في أكثر من صف بنفس الحصة */
function clashes(d) {
  const out = [];
  for (let p = 0; p < PERIOD_NAMES.length; p++) {
    const byTeacher = {};
    LESSONS.filter(l => l.d === d && l.p === p).forEach(l => {
      (byTeacher[l.teacher] = byTeacher[l.teacher] || []).push(l);
    });
    Object.entries(byTeacher).forEach(([teacher, list]) => {
      if (list.length > 1) out.push({ p, teacher, classes: list.map(l => l.className) });
    });
  }
  return out;
}

/** هل تُدرّس المعلمة هذه المادة خلال الأسبوع؟ */
function teachesSubject(teacher, subject) {
  return LESSONS.some(l => l.teacher === teacher && l.subject === subject);
}

/** هل تُدرّس المعلمة هذا الصف خلال الأسبوع؟ */
function teachesClass(teacher, classIdx) {
  return LESSONS.some(l => l.teacher === teacher && l.c === classIdx);
}

/* ---------- اليوم الحالي ---------- */
function todayIndex() {
  const wd = new Date().getDay(); // 0 = الأحد
  return wd >= 0 && wd <= 4 ? wd : -1;
}

/* ---------- خلية جدول ---------- */
function cellHTML(parsed) {
  if (!parsed) return '<td class="empty"></td>';
  return `<td>
    <span class="cell-subject" style="color:${subjectColor(parsed.subject)}">${esc(parsed.subject)}</span>
    <span class="cell-teacher">أ. ${esc(parsed.teacher)}</span>
  </td>`;
}
