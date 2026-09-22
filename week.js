/* ==========================================================
   نسخة الطباعة — الأسبوع كاملًا في ورقة واحدة
   بالتخطيط نفسه المعتمد في المدرسة
   ========================================================== */

(function () {
  const used = (d) => periodsUsed(d);

  /* ===== عروض الأعمدة بالمليمتر ===== */
  const W = { day: 18, per: 17, subj: 21, teach: 13, relief: 32, duty: 20 };
  document.getElementById('cols1').innerHTML =
    `<col style="width:${W.day}mm"><col style="width:${W.per}mm">` +
    CLASSES.map(() => `<col style="width:${W.subj}mm"><col style="width:${W.teach}mm">`).join('') +
    `<col style="width:${W.relief}mm"><col style="width:${W.duty}mm">`;
  document.getElementById('cols2').innerHTML =
    `<col style="width:${W.day}mm"><col style="width:${W.per}mm"><col>`;

  /* ===== الرأس ===== */
  document.getElementById('thead').innerHTML = `
    <tr>
      <th rowspan="2" class="c-day">اليوم</th>
      <th rowspan="2" class="c-per">الحصة</th>
      ${CLASSES.map(c => `<th colspan="2" class="c-cls">${esc(c)}</th>`).join('')}
      <th rowspan="2" class="c-free">التفريغ</th>
      <th rowspan="2" class="c-duty">المناوبات</th>
    </tr>
    <tr>${CLASSES.map(() =>
        '<th class="h2 w-subj">الموضوع</th><th class="h2 w-teach">المعلمة</th>').join('')}</tr>`;

  /* ===== مواضع التفريغ: فراغات متساوية ===== */
  const relief = (typeof RELIEF !== 'undefined' ? RELIEF : []);
  const totalRows = DAYS.length * PERIOD_NAMES.length;
  const RELIEF_AT = {};
  const step = Math.floor(totalRows / relief.length);
  const pad = Math.floor((totalRows - step * (relief.length - 1) - 1) / 2);
  relief.forEach((r, i) => { RELIEF_AT[pad + i * step] = r; });

  /* ===== الجسم ===== */
  let body = '';
  let rowIndex = 0;
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
      const rl = RELIEF_AT[rowIndex];                       // التفريغ
      body += `<td class="relief">${rl ? 'أ. ' + esc(rl.teacher) + ' — ' + esc(rl.task) : ''}</td>`;
      rowIndex++;
      if (p === 0) {
        const duty = (typeof DUTY_ROSTER !== 'undefined' && DUTY_ROSTER[day]) || [];
        body += `<td rowspan="${PERIOD_NAMES.length}" class="duty">${
          duty.length ? duty.map(t => 'أ. ' + esc(t)).join('<br>') : '—'}</td>`;
      }
      body += '</tr>';
    }
  });
  document.getElementById('tbody').innerHTML = body;

  /* ===== صفحة الإشغال ===== */
  document.getElementById('thead2').innerHTML = `
    <tr><th class="c-day">اليوم</th><th class="c-per">الحصة</th>
        <th class="c-freelist">المعلمات المتفرغات</th></tr>`;
  let b2 = '';
  DAYS.forEach((day, d) => {
    for (let p = 0; p < used(d); p++) {
      const isLast = p === used(d) - 1;
      b2 += `<tr class="${isLast ? 'day-end' : ''}">`;
      if (p === 0) b2 += `<th rowspan="${used(d)}" class="day">${esc(day)}</th>`;
      b2 += `<th class="per">${esc(PERIOD_NAMES[p])}</th>`;
      b2 += `<td class="free">${freeTeachers(d, p).map(esc).join('  ·  ')}</td></tr>`;
    }
  });
  document.getElementById('tbody2').innerHTML = b2;

  /* ===== الحواشي ===== */
  const info = typeof TEACHER_INFO !== 'undefined' ? TEACHER_INFO : {};
  const sep = '  ·  ';
  document.getElementById('duties').innerHTML =
    relief.map(r => `أ. ${esc(r.teacher)} — ${esc(r.task)}`).join(sep) || '—';
  document.querySelector('.legend').firstElementChild.hidden = true;
  document.getElementById('homes').innerHTML = Object.entries(info)
    .filter(([, v]) => v.home).map(([t, v]) => `${esc(v.home)}: أ. ${esc(t)}`).join(sep) || '—';
  document.getElementById('meta').textContent =
    `${CLASSES.length} صفوف · ${TEACHERS.length} معلمة · ${DAYS.length} أيام`;
})();
