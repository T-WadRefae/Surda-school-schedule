/* ==========================================================
   نسخة الطباعة — الأسبوع كاملًا في ورقة واحدة
   بالتخطيط نفسه المعتمد في المدرسة
   ========================================================== */

(function () {
  const used = (d) => periodsUsed(d);

  /* اختصارات الطباعة لأطول أسماء المواد — كما في ورقة المدرسة */
  const SHORT = { 'اجتماعيات': 'اجتماع', 'تكنولوجيا': 'تكنو' };
  const shortSubj = (x) => SHORT[x] || x;

  /* ===== المقاسات: كلها مشتقّة من حجم الخط ===== */
  const FS = window.__FS || 11.2;               // حجم خط الجدول بالنقاط
  const AVAIL = 405;                            // عرض A3 أفقي بعد الهوامش
  const W = {
    day:    Math.round(FS * 1.45 * 10) / 10,
    per:    Math.round(FS * 1.40 * 10) / 10,
    subj:   Math.round(FS * 1.34 * 10) / 10,
    teach:  Math.round(FS * 1.14 * 10) / 10,
    relief: Math.round(FS * 1.85 * 10) / 10,
    duty:   Math.round(FS * 1.60 * 10) / 10
  };
  W.free = +(AVAIL - W.day - W.per - CLASSES.length * (W.subj + W.teach)
             - W.relief - W.duty).toFixed(1);
  window.__W = W;

  const st = document.createElement('style');
  st.textContent = `
    th, td { font-size: ${FS}pt !important; }
    thead th.h2 { font-size: ${(FS * 0.85).toFixed(1)}pt !important; }
    th.day { font-size: ${(FS * 1.12).toFixed(1)}pt !important; }
    td.rota { font-size: ${(FS * 0.95).toFixed(1)}pt !important; }
    td.rota.r1 { font-weight: 700; }
    td.relief { font-size: ${(FS * 0.82).toFixed(1)}pt !important; }
    tbody tr { height: ${(FS * 0.47).toFixed(2)}mm; }`;
  document.head.appendChild(st);

  document.getElementById('cols1').innerHTML =
    `<col style="width:${W.day}mm"><col style="width:${W.per}mm">` +
    CLASSES.map(() => `<col style="width:${W.subj}mm"><col style="width:${W.teach}mm">`).join('') +
    [1, 2, 3].map(() => `<col style="width:${(W.free / 3).toFixed(1)}mm">`).join('') +
    `<col style="width:${W.relief}mm"><col style="width:${W.duty}mm">`;

  /* ===== الرأس ===== */
  document.getElementById('thead').innerHTML = `
    <tr>
      <th rowspan="2" class="c-day">اليوم</th>
      <th rowspan="2" class="c-per">الحصة</th>
      ${CLASSES.map(c => `<th colspan="2" class="c-cls">${esc(c)}</th>`).join('')}
      <th colspan="3">الإشغال</th>
      <th rowspan="2" class="c-free">التفريغ</th>
      <th rowspan="2" class="c-duty">المناوبات</th>
    </tr>
    <tr>${CLASSES.map(() =>
        '<th class="h2 w-subj">الموضوع</th><th class="h2 w-teach">المعلمة</th>').join('')}
      <th class="h2">الأول</th><th class="h2">الثاني</th><th class="h2">الثالث</th></tr>`;

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
          ? `<td class="s">${esc(shortSubj(x.subject))}</td><td class="t">${esc(x.teacher)}</td>`
          : '<td class="x"></td><td class="x"></td>';
      });
      const rota = (typeof COVER_ROTA !== 'undefined' && COVER_ROTA[day] && COVER_ROTA[day][p]) || null;
      body += p < used(d) && rota                           // الإشغال: أول، ثانٍ، ثالث
        ? rota.map((t, k) => `<td class="rota r${k + 1}">${esc(t)}</td>`).join('')
        : '<td class="x"></td><td class="x"></td><td class="x"></td>';
      const rl = RELIEF_AT[rowIndex];                       // التفريغ
      body += `<td class="relief">${rl ? 'أ. ' + esc(rl.teacher) + '<br>' + esc(rl.task) : ''}</td>`;
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

  /* ===== الحواشي ===== */
  const info = typeof TEACHER_INFO !== 'undefined' ? TEACHER_INFO : {};
  const sep = '  ·  ';
  document.getElementById('duties').innerHTML =
    relief.map(r => `أ. ${esc(r.teacher)} — ${esc(r.task)}`).join(sep) || '—';
  document.querySelector('.legend').firstElementChild.hidden = true;
  document.getElementById('homes').innerHTML = Object.entries(info)
    .filter(([, v]) => v.home)
    .sort((a, b) => CLASSES.indexOf(a[1].home) - CLASSES.indexOf(b[1].home))
    .map(([t, v]) => `${esc(v.home)}: أ. ${esc(t)}`).join(sep) || '—';
  document.getElementById('meta').textContent =
    `${CLASSES.length} صفوف · ${TEACHERS.length} معلمة · ${DAYS.length} أيام`;
})();
