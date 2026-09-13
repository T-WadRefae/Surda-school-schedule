/* ==========================================================
   إشغال الغياب — توليد جدول يومي بديل دون تضارب
   يعتمد على data.js (البيانات) و core.js (الدوال المشتركة)
   ========================================================== */

const STATE = {
  d: Math.max(0, todayIndex()),
  absent: new Set(),
  lastFirst: true,   // أولوية التوزيع للحصص الأخيرة
  maxCover: 2,       // الحد الأعلى المفضَّل لحصص الإشغال للمعلمة الواحدة
  overrides: {}      // "حصة-صف" => اسم المعلمة، أو "" لترك الحصة بلا تغطية
};

const slotKey = (p, c) => `${p}-${c}`;

/* ==========================================================
   الخوارزمية
   ----------------------------------------------------------
   القيود (تضمن عدم التضارب):
     • البديلة متفرغة أصلًا في تلك الحصة.
     • البديلة ليست غائبة.
     • البديلة لم تُسنَد إليها حصة إشغال أخرى في الحصة نفسها.
   الأولويات (ترتيب المفاضلة بين المتفرغات):
     • تُدرّس المادة نفسها لهذا الصف  ← الأفضل
     • تُدرّس المادة نفسها
     • تُدرّس الصف نفسه
     • الأقل عددًا في حصص الإشغال اليوم (توزيع عادل)
     • الأقل نصابًا أسبوعيًا
   ترتيب المعالجة: من آخر حصة إلى أولها افتراضيًا، فتنال الحصص
   الأخيرة أفضل المتفرغات المتاحات.
   ========================================================== */
function buildPlan() {
  const d = STATE.d;
  const absent = STATE.absent;

  const affected = LESSONS
    .filter(l => l.d === d && absent.has(l.teacher))
    .sort((a, b) => (STATE.lastFirst ? b.p - a.p : a.p - b.p) || a.c - b.c);

  const usedInPeriod = {};            // "حصة" => Set(أسماء المعلمات المُشغَّلات)
  const coverCount = {};              // اسم المعلمة => عدد حصص الإشغال اليوم
  TEACHERS.forEach(t => { coverCount[t] = 0; });

  const reserve = (p, teacher) => {
    (usedInPeriod[p] = usedInPeriod[p] || new Set()).add(teacher);
    coverCount[teacher]++;
  };

  const isAvailable = (teacher, lesson) =>
    !absent.has(teacher) &&
    !lessonsOf(teacher, d, lesson.p).length &&
    !(usedInPeriod[lesson.p] && usedInPeriod[lesson.p].has(teacher));

  const assignments = {};
  const manual = [];

  // 1) التعديلات اليدوية أولًا حتى تُحجز أماكنها قبل التوزيع التلقائي
  affected.forEach(lesson => {
    const key = slotKey(lesson.p, lesson.c);
    if (!(key in STATE.overrides)) return;
    const pick = STATE.overrides[key];
    if (pick && isAvailable(pick, lesson)) {
      reserve(lesson.p, pick);
      assignments[key] = { lesson, teacher: pick, manual: true };
    } else {
      assignments[key] = { lesson, teacher: null, manual: true };
    }
    manual.push(key);
  });

  // 2) التوزيع التلقائي لبقية الحصص
  affected.forEach(lesson => {
    const key = slotKey(lesson.p, lesson.c);
    if (assignments[key]) return;

    const candidates = TEACHERS.filter(t => isAvailable(t, lesson));
    if (!candidates.length) { assignments[key] = { lesson, teacher: null }; return; }

    const scored = candidates.map(t => {
      let score = 0;
      const sameSubject = teachesSubject(t, lesson.subject);
      const sameClass = teachesClass(t, lesson.c);
      if (sameSubject && sameClass) score += 160;
      else if (sameSubject) score += 100;
      else if (sameClass) score += 40;
      if (coverCount[t] >= STATE.maxCover) score -= 1000;   // تجاوز الحد: مقبول عند الضرورة فقط
      score -= coverCount[t] * 25;
      score -= WEEKLY_LOAD[t] * 0.4;
      return { t, score, sameSubject, sameClass };
    }).sort((a, b) => b.score - a.score || a.t.localeCompare(b.t, 'ar'));

    const best = scored[0];
    reserve(lesson.p, best.t);
    assignments[key] = {
      lesson, teacher: best.t,
      sameSubject: best.sameSubject,
      sameClass: best.sameClass,
      over: coverCount[best.t] > STATE.maxCover,
      alternatives: scored.slice(1, 6).map(x => x.t)
    };
  });

  return { affected, assignments, coverCount, usedInPeriod, manual };
}

/** المعلمات المتاحات لخانة معيّنة (لقائمة التعديل اليدوي) */
function availableFor(lesson, plan) {
  const d = STATE.d;
  return TEACHERS.filter(t => {
    if (STATE.absent.has(t)) return false;
    if (lessonsOf(t, d, lesson.p).length) return false;
    const taken = plan.usedInPeriod[lesson.p];
    const mine = plan.assignments[slotKey(lesson.p, lesson.c)];
    if (mine && mine.teacher === t) return true;      // اختيارها الحالي
    return !(taken && taken.has(t));
  });
}

/* ==========================================================
   العرض
   ========================================================== */
function renderDayPicker() {
  const tIdx = todayIndex();
  return DAYS.map((day, d) =>
    `<button class="chip ${d === STATE.d ? 'active' : ''} ${d === tIdx ? 'today-chip' : ''}" data-day="${d}">${esc(day)}</button>`
  ).join('');
}

function renderAbsentPicker() {
  const d = STATE.d;
  return TEACHERS.map(t => {
    const n = LESSONS.filter(l => l.d === d && l.teacher === t).length;
    const on = STATE.absent.has(t);
    return `<button class="chip ${on ? 'absent-on' : ''}" data-absent="${esc(t)}">
      أ. ${esc(t)}<b class="n">${n}</b>
    </button>`;
  }).join('');
}

function renderPlan(plan) {
  const d = STATE.d;
  const used = periodsUsed(d);

  if (!STATE.absent.size) {
    return `<div class="card">
      <div class="card-title">🧑‍🏫 اختاري المعلمة الغائبة</div>
      <p class="hint">اختاري معلمة واحدة أو أكثر من القائمة أعلاه، وسيُبنى جدول اليوم البديل تلقائيًا.
      الرقم بجانب كل اسم هو عدد حصصها في ${esc(DAYS[d])}.</p>
    </div>`;
  }

  const covered = Object.values(plan.assignments).filter(a => a.teacher).length;
  const gaps = Object.values(plan.assignments).filter(a => !a.teacher);
  const helpers = [...new Set(Object.values(plan.assignments).filter(a => a.teacher).map(a => a.teacher))];

  /* --- جدول اليوم بعد التعديل --- */
  let head = '<tr><th>الحصة</th>' + CLASSES.map(c => `<th>${esc(c)}</th>`).join('') + '</tr>';
  let body = '';
  for (let p = 0; p < used; p++) {
    body += `<tr><th>${periodLabel(p)}</th>`;
    CLASSES.forEach((_, c) => {
      const parsed = parseCell(TIMETABLE[DAYS[d]][p][c]);
      if (!parsed) { body += '<td class="empty"></td>'; return; }
      const a = plan.assignments[slotKey(p, c)];
      if (!a) { body += cellHTML(parsed); return; }
      if (a.teacher) {
        body += `<td class="swapped">
          <span class="cell-subject" style="color:${subjectColor(parsed.subject)}">${esc(parsed.subject)}</span>
          <span class="cell-teacher"><s>${esc(parsed.teacher)}</s> ← <b>أ. ${esc(a.teacher)}</b></span>
        </td>`;
      } else {
        body += `<td class="gap">
          <span class="cell-subject">${esc(parsed.subject)}</span>
          <span class="cell-teacher">بلا تغطية</span>
        </td>`;
      }
    });
    body += '</tr>';
  }

  /* --- قائمة التوزيع القابلة للتعديل --- */
  const ordered = plan.affected.slice().sort((a, b) => a.p - b.p || a.c - b.c);
  const rows = ordered.map(lesson => {
    const key = slotKey(lesson.p, lesson.c);
    const a = plan.assignments[key];
    const opts = availableFor(lesson, plan);
    const badge = !a.teacher
      ? '<span class="pill danger">لا تتوفر بديلة</span>'
      : a.sameSubject
        ? '<span class="pill ok">تدريس — التخصص نفسه</span>'
        : '<span class="pill warn">إشغال ومتابعة</span>';
    return `<tr>
      <td>${esc(PERIOD_NAMES[lesson.p])}</td>
      <td><b>${esc(lesson.className)}</b></td>
      <td style="color:${subjectColor(lesson.subject)};font-weight:800">${esc(lesson.subject)}</td>
      <td><s>أ. ${esc(lesson.teacher)}</s></td>
      <td>
        <select class="pick" data-key="${key}">
          <option value="">— بلا تغطية —</option>
          ${opts.map(t => `<option value="${esc(t)}" ${a.teacher === t ? 'selected' : ''}>أ. ${esc(t)}</option>`).join('')}
        </select>
        ${a.manual ? '<span class="pill manual">يدوي</span>' : ''}
      </td>
      <td>${badge}</td>
    </tr>`;
  }).join('');

  /* --- عبء الإشغال على كل معلمة --- */
  const loadTags = helpers
    .sort((a, b) => plan.coverCount[b] - plan.coverCount[a] || a.localeCompare(b, 'ar'))
    .map(t => `<span class="tag ${plan.coverCount[t] > STATE.maxCover ? 'none' : 'free'}">أ. ${esc(t)}<b class="n">${plan.coverCount[t]}</b></span>`)
    .join('');

  return `
    <div class="card">
      <div class="card-title">📋 ملخّص خطة ${esc(DAYS[d])}</div>
      <div class="stats">
        <div class="stat"><div class="num">${plan.affected.length}</div><div class="lbl">حصة متأثرة</div></div>
        <div class="stat"><div class="num">${covered}</div><div class="lbl">حصة مُغطّاة</div></div>
        <div class="stat"><div class="num">${gaps.length}</div><div class="lbl">بلا تغطية</div></div>
        <div class="stat"><div class="num">${helpers.length}</div><div class="lbl">معلمة مشاركة</div></div>
      </div>
      ${gaps.length ? `<p class="hint danger-text">⚠️ ${gaps.length} حصة لم تُغطَّ لعدم توفر معلمة متفرغة:
        ${gaps.map(g => `${esc(PERIOD_NAMES[g.lesson.p])} / ${esc(g.lesson.className)}`).join(' — ')}</p>` : ''}
      <div class="card-title" style="margin-top:16px">نصيب كل معلمة من الإشغال</div>
      <div class="tag-list">${loadTags || '<span class="tag">—</span>'}</div>
    </div>

    <div class="card">
      <div class="card-title">✏️ توزيع الحصص <span class="count">يمكن تعديل أي بديلة</span></div>
      <div class="table-wrap">
        <table class="grid list-table ${STATE.absent.size === 1 ? 'hide-absent' : ''}" style="min-width:720px">
          <thead><tr><th>الحصة</th><th>الصف</th><th>المادة</th><th>الغائبة</th><th>البديلة</th><th>النوع</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="scroll-hint list-hint">مرّري الجدول أفقيًا 👈 لرؤية بقية الأعمدة</p>
      <p class="hint">القائمة لا تعرض إلا المعلمات المتفرغات فعليًا في تلك الحصة، فأي تعديل يدوي يبقى بلا تضارب.</p>
    </div>

    <div class="card">
      <div class="card-title">📆 جدول ${esc(DAYS[d])} بعد التعديل</div>
      <div class="table-wrap">
        <table class="grid" style="min-width:900px"><thead>${head}</thead><tbody>${body}</tbody></table>
      </div>
      <p class="scroll-hint">مرّري الجدول أفقيًا 👈 لرؤية بقية الصفوف</p>
    </div>`;
}

/* ---------- نص جاهز للنسخ ---------- */
function planText(plan) {
  const d = STATE.d;
  const lines = [`إشغال يوم ${DAYS[d]}`];
  lines.push(`الغائبات: ${[...STATE.absent].map(t => 'أ. ' + t).join('، ') || '—'}`);
  lines.push('');
  plan.affected.slice().sort((a, b) => a.p - b.p || a.c - b.c).forEach(l => {
    const a = plan.assignments[slotKey(l.p, l.c)];
    lines.push(`${PERIOD_NAMES[l.p]} — ${l.className} (${l.subject}): ${a.teacher ? 'أ. ' + a.teacher : 'بلا تغطية'}`);
  });
  return lines.join('\n');
}

/* ==========================================================
   الربط بالواجهة
   ========================================================== */
let CURRENT_PLAN = null;

function render() {
  $('#day-picker').innerHTML = renderDayPicker();
  $('#absent-picker').innerHTML = renderAbsentPicker();
  $('#opt-last').checked = STATE.lastFirst;
  $('#opt-max').value = STATE.maxCover;

  CURRENT_PLAN = buildPlan();
  $('#plan').innerHTML = renderPlan(CURRENT_PLAN);

  $('#day-picker').querySelectorAll('[data-day]').forEach(b => {
    b.addEventListener('click', () => {
      STATE.d = +b.dataset.day;
      STATE.overrides = {};
      render();
    });
  });

  $('#absent-picker').querySelectorAll('[data-absent]').forEach(b => {
    b.addEventListener('click', () => {
      const t = b.dataset.absent;
      STATE.absent.has(t) ? STATE.absent.delete(t) : STATE.absent.add(t);
      STATE.overrides = {};
      render();
    });
  });

  $('#plan').querySelectorAll('select.pick').forEach(sel => {
    sel.addEventListener('change', () => {
      STATE.overrides[sel.dataset.key] = sel.value;
      render();
    });
  });
}

function init() {
  const tIdx = todayIndex();
  $('#today-label').textContent = tIdx >= 0 ? `اليوم: ${DAYS[tIdx]}` : 'عطلة نهاية الأسبوع';

  $('#opt-last').addEventListener('change', e => {
    STATE.lastFirst = e.target.checked;
    STATE.overrides = {};
    render();
  });

  $('#opt-max').addEventListener('change', e => {
    STATE.maxCover = Math.max(1, Math.min(7, +e.target.value || 2));
    STATE.overrides = {};
    render();
  });

  $('#reset-btn').addEventListener('click', () => {
    STATE.absent.clear();
    STATE.overrides = {};
    render();
  });

  $('#print-btn').addEventListener('click', () => window.print());

  $('#copy-btn').addEventListener('click', async () => {
    if (!CURRENT_PLAN || !STATE.absent.size) return;
    const text = planText(CURRENT_PLAN);
    try {
      await navigator.clipboard.writeText(text);
      $('#copy-btn').textContent = '✅ تم النسخ';
    } catch (e) {
      window.prompt('انسخي النص:', text);
    }
    setTimeout(() => { $('#copy-btn').textContent = '📋 نسخ الخطة'; }, 2000);
  });

  render();
}

document.addEventListener('DOMContentLoaded', init);
