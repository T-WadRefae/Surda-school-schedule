/* ==========================================================
   نسخة الطباعة — الأسبوع كاملًا في ورقة واحدة
   بالتخطيط نفسه المعتمد في المدرسة
   ========================================================== */

(function () {
  const used = (d) => periodsUsed(d);

  /* ===== الرأس ===== */
  document.getElementById('thead').innerHTML = `
    <tr>
      <th rowspan="2" class="c-day">اليوم</th>
      <th rowspan="2" class="c-per">الحصة</th>
      ${CLASSES.map(c => `<th colspan="2" class="c-cls">${esc(c)}</th>`).join('')}
      <th rowspan="2" class="c-sub">الإشغال — المعلمات المتفرغات</th>
      <th rowspan="2" class="c-free">حصص التفريغ</th>
      <th rowspan="2" class="c-duty">المناوبات</th>
    </tr>
    <tr>${CLASSES.map(() => '<th class="h2">الموضوع</th><th class="h2">المعلمة</th>').join('')}</tr>`;

  /* ===== الجسم ===== */
  let body = '';
  DAYS.forEach((day, d) => {
    for (let p = 0; p < PERIOD_NAMES.length; p++) {
      const isLast = p === PERIOD_NAMES.length - 1;
      body += `<tr class="${isLast ? 'day-end' : ''}">`;
      if (p === 0) body += `<th rowspan="${PERIOD_NAMES.length}" class="day">${esc(day)}</th>`;
      body += `<th class="per">${esc(PERIOD_NAMES[p])}</th>`;
      CLASSES.forEach((_, c) => {
        const x = parseCell(TIMETABLE[day][p][c]);
        body += x
          ? `<td class="s">${esc(x.subject)}</td><td class="t">${esc(x.teacher)}</td>`
          : '<td class="x"></td><td class="x"></td>';
      });
      body += p < used(d)
        ? `<td class="free">${freeTeachers(d, p).map(esc).join(' · ')}</td>`
        : '<td class="x"></td>';
      body += '<td></td><td></td></tr>';
    }
  });
  document.getElementById('tbody').innerHTML = body;

  /* ===== الحواشي ===== */
  const info = typeof TEACHER_INFO !== 'undefined' ? TEACHER_INFO : {};
  const sep = '  ·  ';
  document.getElementById('duties').innerHTML = Object.entries(info)
    .filter(([, v]) => v.duty).map(([t, v]) => `أ. ${esc(t)} — ${esc(v.duty)}`).join(sep) || '—';
  document.getElementById('homes').innerHTML = Object.entries(info)
    .filter(([, v]) => v.home).map(([t, v]) => `${esc(v.home)}: أ. ${esc(t)}`).join(sep) || '—';
  document.getElementById('meta').textContent =
    `${CLASSES.length} صفوف · ${TEACHERS.length} معلمة · ${DAYS.length} أيام`;
})();
