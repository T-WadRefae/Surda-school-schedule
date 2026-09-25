/* ==========================================================
   نظام الجدول المدرسي — عروض الجدول
   يعتمد على data.js (البيانات) و core.js (الدوال المشتركة)
   ========================================================== */

/* ==========================================================
   1) عرض الصف — الأيام في الأعمدة والحصص في الصفوف
   ========================================================== */
function renderClassView(className) {
  const c = CLASSES.indexOf(className);
  const tIdx = todayIndex();
  const maxP = Math.max(...DAYS.map((_, d) => {
    let last = 0;
    TIMETABLE[DAYS[d]].forEach((row, p) => { if (row[c]) last = p + 1; });
    return last;
  }));

  let head = '<tr><th>الحصة</th>' + DAYS.map((day, d) =>
    `<th class="${d === tIdx ? 'is-today' : ''}">${esc(day)}</th>`).join('') + '</tr>';

  let body = '';
  for (let p = 0; p < maxP; p++) {
    body += `<tr><th>${periodLabel(p)}</th>`;
    DAYS.forEach((day, d) => {
      const parsed = parseCell(TIMETABLE[day][p][c]);
      const todayCls = d === tIdx ? 'is-today' : '';
      if (parsed) {
        body += cellHTML(parsed).replace('<td>', `<td class="${todayCls}">`);
      } else {
        body += `<td class="${p < periodsUsed(d) ? 'empty' : 'na'} ${todayCls}"></td>`;
      }
    });
    body += '</tr>';
  }

  const total = LESSONS.filter(l => l.c === c).length;
  const bySubject = {};
  LESSONS.filter(l => l.c === c).forEach(l => { bySubject[l.subject] = (bySubject[l.subject] || 0) + 1; });
  const teachers = [...new Set(LESSONS.filter(l => l.c === c).map(l => l.teacher))]
    .sort((a, b) => a.localeCompare(b, 'ar'));

  return `
    <div class="card">
      <div class="card-title">📘 جدول الصف ${esc(className)} <span class="count">${total} حصة أسبوعيًا</span></div>
      <div class="table-wrap">
        <table class="grid"><thead>${head}</thead><tbody>${body}</tbody></table>
      </div>
      <p class="scroll-hint">مرّري الجدول أفقيًا 👈 لرؤية بقية الأيام</p>
    </div>

    <div class="card">
      <div class="card-title">📊 توزيع المواد</div>
      <div class="tag-list">
        ${Object.entries(bySubject).sort((a, b) => b[1] - a[1]).map(([s, n]) =>
          `<span class="tag" style="color:${subjectColor(s)}">${esc(s)}<b class="n">${n}</b></span>`).join('')}
      </div>
      <div class="card-title" style="margin-top:16px">👩‍🏫 معلمات الصف <span class="count">${teachers.length}</span></div>
      <div class="tag-list">
        ${teachers.map(t => `<span class="tag">أ. ${esc(t)}</span>`).join('')}
      </div>
    </div>`;
}

/* ==========================================================
   2) عرض المعلمة
   ========================================================== */
function renderTeacherView(teacher) {
  const tIdx = todayIndex();
  const maxP = Math.max(...DAYS.map((_, d) => periodsUsed(d)));

  let head = '<tr><th>الحصة</th>' + DAYS.map((day, d) =>
    `<th class="${d === tIdx ? 'is-today' : ''}">${esc(day)}</th>`).join('') + '</tr>';

  let body = '';
  for (let p = 0; p < maxP; p++) {
    body += `<tr><th>${periodLabel(p)}</th>`;
    DAYS.forEach((day, d) => {
      const list = lessonsOf(teacher, d, p);
      const todayCls = d === tIdx ? 'is-today' : '';
      if (!list.length) {
        body += `<td class="${p < periodsUsed(d) ? 'empty' : 'na'} ${todayCls}"></td>`;
      } else {
        body += `<td class="${todayCls}">` + list.map(l =>
          `<span class="cell-subject" style="color:${subjectColor(l.subject)}">${esc(l.subject)}</span>
           <span class="cell-teacher">${esc(l.className)}</span>`).join('<hr style="border:0;border-top:1px dashed #d8e3ec;margin:4px 0">') + '</td>';
      }
    });
    body += '</tr>';
  }

  const mine = LESSONS.filter(l => l.teacher === teacher);
  const bySubject = {};
  mine.forEach(l => { bySubject[l.subject] = (bySubject[l.subject] || 0) + 1; });
  const myClasses = [...new Set(mine.map(l => l.className))];
  const busiest = DAYS.map((day, d) => ({ day, n: mine.filter(l => l.d === d).length }))
    .sort((a, b) => b.n - a.n)[0];

  // الحصص الفارغة لكل يوم
  const freeRows = DAYS.map((day, d) => {
    const used = periodsUsed(d);
    const free = [];
    for (let p = 0; p < used; p++) {
      if (!lessonsOf(teacher, d, p).length) free.push(`<span class="tag free">${esc(PERIOD_NAMES[p])}</span>`);
    }
    return `<div class="free-row">
      <div class="p-name">${esc(day)}</div>
      <div class="tag-list">${free.length
        ? free.join('')
        : '<span class="tag none">لا توجد حصص فارغة</span>'}</div>
    </div>`;
  }).join('');

  const info = (typeof TEACHER_INFO !== 'undefined' && TEACHER_INFO[teacher]) || {};
  const badges = [
    info.home ? `<span class="count">تربية الصف ${esc(info.home)}</span>` : '',
    info.duty ? `<span class="count">تفريغ: ${esc(info.duty)}</span>` : ''
  ].join('');

  return `
    <div class="card">
      <div class="card-title">👩‍🏫 جدول المعلمة ${esc(teacher)}
        <span class="count">${mine.length} حصة أسبوعيًا</span>${badges}</div>
      <div class="table-wrap">
        <table class="grid"><thead>${head}</thead><tbody>${body}</tbody></table>
      </div>
      <p class="scroll-hint">مرّري الجدول أفقيًا 👈 لرؤية بقية الأيام</p>
    </div>

    <div class="card">
      <div class="card-title">📊 ملخص النصاب</div>
      <div class="stats">
        <div class="stat"><div class="num">${mine.length}</div><div class="lbl">مجموع الحصص</div></div>
        <div class="stat"><div class="num">${myClasses.length}</div><div class="lbl">عدد الصفوف</div></div>
        <div class="stat"><div class="num">${Object.keys(bySubject).length}</div><div class="lbl">عدد المواد</div></div>
        <div class="stat"><div class="num">${busiest.n}</div><div class="lbl">أثقل يوم: ${esc(busiest.day)}</div></div>
      </div>
      <div class="card-title" style="margin-top:16px">المواد والصفوف</div>
      <div class="tag-list">
        ${Object.entries(bySubject).sort((a, b) => b[1] - a[1]).map(([s, n]) =>
          `<span class="tag" style="color:${subjectColor(s)}">${esc(s)}<b class="n">${n}</b></span>`).join('')}
      </div>
      <div class="tag-list" style="margin-top:8px">
        ${myClasses.map(c => `<span class="tag">${esc(c)}</span>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-title">🟢 الحصص الفارغة</div>
      <div class="free-list">${freeRows}</div>
    </div>`;
}

/* ==========================================================
   3) عرض اليوم — كل الصفوف في جدول واحد
   ========================================================== */
function renderDayView(day) {
  const d = DAYS.indexOf(day);
  const used = periodsUsed(d);

  let head = '<tr><th>الحصة</th>' + CLASSES.map(c => `<th>${esc(c)}</th>`).join('') + '</tr>';
  let body = '';
  for (let p = 0; p < used; p++) {
    body += `<tr><th>${periodLabel(p)}</th>`;
    CLASSES.forEach((_, c) => { body += cellHTML(parseCell(TIMETABLE[day][p][c])); });
    body += '</tr>';
  }

  const count = LESSONS.filter(l => l.d === d).length;
  const cl = clashes(d);

  return `
    <div class="card">
      <div class="card-title">📆 جدول يوم ${esc(day)} <span class="count">${count} حصة</span></div>
      <div class="table-wrap">
        <table class="grid" style="min-width:900px"><thead>${head}</thead><tbody>${body}</tbody></table>
      </div>
      <p class="scroll-hint">مرّري الجدول أفقيًا 👈 لرؤية بقية الصفوف</p>
      ${cl.length ? `
        <div class="card-title" style="margin-top:16px">🔔 حصص مشتركة بين صفّين</div>
        <div class="tag-list">
          ${cl.map(x => `<span class="tag none">${esc(PERIOD_NAMES[x.p])} — أ. ${esc(x.teacher)}: ${x.classes.map(esc).join(' + ')}</span>`).join('')}
        </div>
        <p class="hint">المعلمة مسجّلة في أكثر من صف بنفس الحصة — يُرجى التأكد من أنها حصة مدمجة.</p>` : ''}
    </div>`;
}

/* ==========================================================
   4) الإشغال — المعلمات المتفرغات في كل حصة
   ========================================================== */
const ROTA_LABELS = ['أول', 'ثانٍ', 'ثالث'];

function renderFreeView(day) {
  const d = DAYS.indexOf(day);
  const used = periodsUsed(d);

  let rows = '';
  for (let p = 0; p < used; p++) {
    const free = freeTeachers(d, p);
    const rota = ((typeof COVER_ROTA !== 'undefined' && COVER_ROTA[day]) || [])[p] || [];
    const tags = rota.map((t, k) => `<span class="tag rota">إشغال ${ROTA_LABELS[k]}: أ. ${esc(t)}</span>`)
      .concat(free.filter(t => !rota.includes(t)).map(t => `<span class="tag free">أ. ${esc(t)}</span>`));
    rows += `<div class="free-row">
      <div class="p-name">${esc(PERIOD_NAMES[p])}</div>
      <div class="tag-list">${tags.length
        ? tags.join('')
        : '<span class="tag none">جميع المعلمات مشغولات</span>'}</div>
    </div>`;
  }

  return `
    <div class="card">
      <div class="card-title">🔁 الإشغال ليوم ${esc(day)}</div>
      <div class="free-list">${rows}</div>
      <p class="hint">الإشغال الأول ثم الثاني ثم الثالث حسب جدول الإشغال المعتمد، وبعدهن بقية المعلمات المتفرغات في تلك الحصة.</p>
    </div>`;
}

/* ==========================================================
   واجهة التنقّل
   ========================================================== */
const STATE = {
  tab: 'class',
  className: CLASSES[0],
  teacher: TEACHERS[0],
  day: DAYS[Math.max(0, todayIndex())],
  query: ''
};

function saveState() {
  try { localStorage.setItem('surda_schedule_state', JSON.stringify(STATE)); } catch (e) { /* تجاهل */ }
}
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem('surda_schedule_state') || '{}');
    if (CLASSES.includes(s.className)) STATE.className = s.className;
    if (TEACHERS.includes(s.teacher)) STATE.teacher = s.teacher;
    if (['class', 'teacher', 'day', 'free'].includes(s.tab)) STATE.tab = s.tab;
  } catch (e) { /* تجاهل */ }
}

function chipRow(items, current, todayItem) {
  const q = STATE.query.trim();
  const shown = q ? items.filter(i => i.includes(q)) : items;
  if (!shown.length) return '<p class="hint">لا نتائج مطابقة للبحث.</p>';
  return `<div class="chip-row">${shown.map(i =>
    `<button class="chip ${i === current ? 'active' : ''} ${i === todayItem ? 'today-chip' : ''}" data-pick="${esc(i)}">${esc(i)}</button>`
  ).join('')}</div>`;
}

function render() {
  const tIdx = todayIndex();
  const todayName = tIdx >= 0 ? DAYS[tIdx] : null;

  document.querySelectorAll('.tab').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === STATE.tab));

  let picker = '', content = '', placeholder = '';

  if (STATE.tab === 'class') {
    placeholder = 'ابحثي عن صف…';
    picker = chipRow(CLASSES, STATE.className);
    content = renderClassView(STATE.className);
  } else if (STATE.tab === 'teacher') {
    placeholder = 'ابحثي عن معلمة…';
    picker = chipRow(TEACHERS, STATE.teacher);
    content = renderTeacherView(STATE.teacher);
  } else if (STATE.tab === 'day') {
    placeholder = 'ابحثي عن يوم…';
    picker = chipRow(DAYS, STATE.day, todayName);
    content = renderDayView(STATE.day);
  } else {
    placeholder = 'ابحثي عن يوم…';
    picker = chipRow(DAYS, STATE.day, todayName);
    content = renderFreeView(STATE.day);
  }

  $('#search').placeholder = placeholder;
  $('#picker').innerHTML = picker;
  $('#content').innerHTML = content;

  $('#picker').querySelectorAll('[data-pick]').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.pick;
      if (STATE.tab === 'class') STATE.className = val;
      else if (STATE.tab === 'teacher') STATE.teacher = val;
      else STATE.day = val;
      saveState();
      render();
    });
  });
}

function init() {
  loadState();

  const tIdx = todayIndex();
  $('#today-label').textContent = tIdx >= 0
    ? `اليوم: ${DAYS[tIdx]}`
    : 'عطلة نهاية الأسبوع';

  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      STATE.tab = btn.dataset.tab;
      STATE.query = '';
      $('#search').value = '';
      saveState();
      render();
    });
  });

  $('#search').addEventListener('input', (e) => {
    STATE.query = e.target.value;
    render();
  });

  $('#print-btn').addEventListener('click', () => window.print());

  render();
}

document.addEventListener('DOMContentLoaded', init);
