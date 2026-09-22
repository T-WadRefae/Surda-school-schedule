/* ==========================================================
   إشغال الغياب — توليد جدول يومي بديل دون تضارب
   يعتمد على data.js (البيانات) و core.js (الدوال المشتركة)
   ========================================================== */

const STATE = {
  d: Math.max(0, todayIndex()),
  absent: new Set(),
  compact: true,     // تقديم الحصص المتأخرة لسدّ الشاغر قبل اللجوء إلى الإشغال
  maxCover: 2,       // الحد الأعلى المفضَّل لحصص الإشغال للمعلمة الواحدة
  overrides: {}      // "حصة-صف" => 'auto' | '' (بلا تغطية) | اسم معلمة الإشغال
};

const slotKey = (p, c) => `${p}-${c}`;

/* ==========================================================
   الخوارزمية
   ----------------------------------------------------------
   ١) تقديم الحصص المتأخرة (لكل صف على حدة):
      حصة الغائبة تصير شاغرًا، فتُقدَّم إليه حصة معلمة حاضرة
      من آخر اليوم في الصف نفسه، فتُعطي المعلمة حصتها أبكر
      وتُلغى حصتها المتأخرة، وينصرف الصف أبكر بحصة.
      • المعلمة المُقدَّمة يجب أن تكون متفرغة في الحصة الجديدة.
      • يُختار الترتيب الذي يسدّ أكبر عدد من الشواغر بأقل عدد
        من الحصص المنقولة، مع تفضيل نقل الحصص الأخيرة.
      • إن كان الشاغر نفسه آخر حصة في يوم الصف، ينصرف الصف
        أبكر دون نقل أي حصة.
   ٢) الإشغال الإضافي: ما تعذّر سدّه بالتقديم تُغطّيه معلمة
      متفرغة، بالأولويات:
      • تُدرّس المادة نفسها لهذا الصف ← الأفضل
      • تُدرّس المادة نفسها
      • تُدرّس الصف نفسه
      • الأقل عددًا في حصص الإشغال اليوم (توزيع عادل)
      • الأقل نصابًا أسبوعيًا
   ========================================================== */

/** كل المجموعات الجزئية ذات الحجم k من المصفوفة arr */
function combos(arr, k) {
  if (!k) return [[]];
  const out = [];
  arr.forEach((x, i) => combos(arr.slice(i + 1), k - 1).forEach(r => out.push([x, ...r])));
  return out;
}

/** يوزّع حصص الصف الحاضرة على المواضع المتاحة بأقل عدد من النقلات */
function placeLessons(present, slots, busy) {
  let best = null;
  const cur = new Map();
  const used = new Set();
  const len = Math.max(...present.map(l => l.p), ...slots) + 1;
  const walk = (i, moves, late) => {
    if (best && (moves > best.moves || (moves === best.moves && late >= best.late))) return;
    if (i === present.length) { best = { moves, late, pos: new Map(cur) }; return; }
    const l = present[i];
    const order = slots.includes(l.p) ? [l.p, ...slots.filter(x => x !== l.p)] : slots;
    order.forEach(x => {
      if (used.has(x)) return;
      const moved = x !== l.p;
      if (moved && busy[l.teacher].has(x)) return;          // المعلمة مشغولة في تلك الحصة
      used.add(x); cur.set(l, x);
      walk(i + 1, moves + (moved ? 1 : 0), late + (moved ? len - l.p : 0));
      used.delete(x); cur.delete(l);
    });
  };
  walk(0, 0, 0);
  return best;
}

/** يقدّم حصص الصف المتأخرة إلى الشواغر؛ يعيد أفضل ترتيب أو null */
function compactClass(present, len, vac, forced, busy) {
  const free = vac.filter(p => !forced.includes(p));
  for (let j = free.length; j >= 1; j--) {
    let best = null;
    combos(free, j).forEach(S => {
      const kept = vac.filter(p => !S.includes(p));
      const newLen = len - j;
      if (kept.some(p => p >= newLen)) return;
      const slots = [];
      for (let x = 0; x < newLen; x++) if (!kept.includes(x)) slots.push(x);
      const r = placeLessons(present, slots, busy);
      if (r && (!best || r.moves < best.moves || (r.moves === best.moves && r.late < best.late))) {
        best = { ...r, kept, newLen };
      }
    });
    if (best) return best;
  }
  return null;
}

function buildPlan() {
  const d = STATE.d;
  const absent = STATE.absent;
  const dayLessons = LESSONS.filter(l => l.d === d);

  const affected = dayLessons.filter(l => absent.has(l.teacher))
    .sort((a, b) => b.p - a.p || a.c - b.c);

  // حصص كل معلمة حاضرة في هذا اليوم، وتُحدَّث مع كل نقل
  const busy = {};
  TEACHERS.forEach(t => { busy[t] = new Set(); });
  dayLessons.forEach(l => { if (!absent.has(l.teacher)) busy[l.teacher].add(l.p); });

  const classes = {};            // رقم الصف => ترتيب يومه بعد التعديل
  const byClass = {};
  affected.forEach(l => (byClass[l.c] = byClass[l.c] || []).push(l));

  // ١) تقديم الحصص المتأخرة
  Object.keys(byClass).map(Number).sort((a, b) => a - b).forEach(c => {
    const own = dayLessons.filter(l => l.c === c);
    const len = own.reduce((m, l) => Math.max(m, l.p + 1), 0);
    const vac = byClass[c].map(l => l.p);
    const present = own.filter(l => !absent.has(l.teacher)).sort((a, b) => a.p - b.p);
    const forced = vac.filter(p => {
      const o = STATE.overrides[slotKey(p, c)];
      return o !== undefined && o !== 'auto';
    });
    const r = STATE.compact ? compactClass(present, len, vac, forced, busy) : null;
    const plan = { len, newLen: len, kept: vac.slice(), moves: [], pos: new Map(present.map(l => [l, l.p])) };
    if (r) {
      Object.assign(plan, { newLen: r.newLen, kept: r.kept, pos: r.pos });
      r.pos.forEach((to, l) => {
        if (to === l.p) return;
        plan.moves.push({ lesson: l, from: l.p, to });
        busy[l.teacher].delete(l.p);
        busy[l.teacher].add(to);
      });
      plan.moves.sort((a, b) => a.to - b.to);
    }
    classes[c] = plan;
  });

  // ٢) الإشغال الإضافي لما بقي من شواغر
  const usedInPeriod = {};
  const coverCount = {};
  TEACHERS.forEach(t => { coverCount[t] = 0; });
  const reserve = (p, t) => {
    (usedInPeriod[p] = usedInPeriod[p] || new Set()).add(t);
    coverCount[t]++;
  };
  const isAvailable = (t, p) =>
    !absent.has(t) && !busy[t].has(p) && !(usedInPeriod[p] && usedInPeriod[p].has(t));

  const assignments = {};
  const toCover = affected.filter(l => classes[l.c].kept.includes(l.p));

  affected.forEach(lesson => {
    if (toCover.includes(lesson)) return;
    const plan = classes[lesson.c];
    const filler = [...plan.pos].find(([, to]) => to === lesson.p);
    assignments[slotKey(lesson.p, lesson.c)] = {
      lesson, type: 'compact',
      filler: filler ? { lesson: filler[0], from: filler[0].p } : null
    };
  });

  // الاختيارات اليدوية أولًا
  toCover.forEach(lesson => {
    const key = slotKey(lesson.p, lesson.c);
    const pick = STATE.overrides[key];
    if (pick === undefined || pick === 'auto') return;
    if (pick && isAvailable(pick, lesson.p)) {
      reserve(lesson.p, pick);
      assignments[key] = { lesson, type: 'cover', teacher: pick, manual: true,
        sameSubject: teachesSubject(pick, lesson.subject) };
    } else {
      assignments[key] = { lesson, type: 'gap', teacher: null, manual: true };
    }
  });

  toCover.forEach(lesson => {
    const key = slotKey(lesson.p, lesson.c);
    if (assignments[key]) return;
    const candidates = TEACHERS.filter(t => isAvailable(t, lesson.p));
    if (!candidates.length) { assignments[key] = { lesson, type: 'gap', teacher: null }; return; }
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
    assignments[key] = { lesson, type: 'cover', teacher: best.t, sameSubject: best.sameSubject };
  });

  return { affected, assignments, coverCount, usedInPeriod, classes, busy };
}

/** المعلمات المتاحات لإشغال خانة معيّنة (لقائمة التعديل اليدوي) */
function availableFor(lesson, plan) {
  return TEACHERS.filter(t => {
    if (STATE.absent.has(t)) return false;
    if (plan.busy[t].has(lesson.p)) return false;
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

  const all = Object.values(plan.assignments);
  const compacted = all.filter(a => a.type === 'compact');
  const covers = all.filter(a => a.type === 'cover');
  const gaps = all.filter(a => a.type === 'gap');
  const early = Object.entries(plan.classes).filter(([, k]) => k.newLen < k.len);
  const helpers = [...new Set(covers.map(a => a.teacher))];
  const moveCount = Object.values(plan.classes).reduce((n, k) => n + k.moves.length, 0);

  /* --- ما يتغيّر في كل صف --- */
  const classCards = Object.entries(plan.classes).map(([c, k]) => {
    const lines = [];
    k.moves.forEach(m => lines.push(`<li>⏫ أ. ${esc(m.lesson.teacher)} تُعطي <b>${esc(m.lesson.subject)}</b>
      في الحصة <b>${esc(PERIOD_NAMES[m.to])}</b> بدل ${esc(PERIOD_NAMES[m.from])}</li>`));
    k.kept.forEach(p => {
      const a = plan.assignments[slotKey(p, +c)];
      lines.push(a.teacher
        ? `<li>🔁 الحصة ${esc(PERIOD_NAMES[p])} (${esc(a.lesson.subject)}): إشغال أ. ${esc(a.teacher)}</li>`
        : `<li class="danger-text">⚠️ الحصة ${esc(PERIOD_NAMES[p])} (${esc(a.lesson.subject)}): بلا تغطية</li>`);
    });
    const end = k.newLen < k.len
      ? `<span class="pill ok">ينصرف بعد الحصة ${esc(PERIOD_NAMES[k.newLen - 1])}</span>`
      : '<span class="pill warn">دوام كامل</span>';
    return `<div class="class-change">
      <div class="cc-head"><b>الصف ${esc(CLASSES[c])}</b> ${end}</div>
      <ul>${lines.join('') || '<li>لا نقل — الشاغر في آخر اليوم</li>'}</ul>
    </div>`;
  }).join('');

  /* --- جدول اليوم بعد التعديل --- */
  const head = '<tr><th>الحصة</th>' + CLASSES.map(c => `<th>${esc(c)}</th>`).join('') + '</tr>';
  const cellAt = (p, c) => {
    const k = plan.classes[c];
    if (!k) {
      const parsed = parseCell(TIMETABLE[DAYS[d]][p][c]);
      return parsed ? cellHTML(parsed) : '<td class="empty"></td>';
    }
    if (p >= k.newLen) {
      return p < k.len ? '<td class="out"><span class="cell-teacher">انصراف</span></td>' : '<td class="empty"></td>';
    }
    if (k.kept.includes(p)) {
      const a = plan.assignments[slotKey(p, c)];
      return a.teacher
        ? `<td class="swapped">
            <span class="cell-subject" style="color:${subjectColor(a.lesson.subject)}">${esc(a.lesson.subject)}</span>
            <span class="cell-teacher"><s>${esc(a.lesson.teacher)}</s> ← <b>أ. ${esc(a.teacher)}</b></span>
          </td>`
        : `<td class="gap">
            <span class="cell-subject">${esc(a.lesson.subject)}</span>
            <span class="cell-teacher">بلا تغطية</span>
          </td>`;
    }
    const l = [...k.pos].find(([, to]) => to === p)[0];
    if (l.p === p) return cellHTML({ subject: l.subject, teacher: l.teacher });
    return `<td class="moved">
      <span class="cell-subject" style="color:${subjectColor(l.subject)}">${esc(l.subject)}</span>
      <span class="cell-teacher"><b>أ. ${esc(l.teacher)}</b> ⏫ من ${esc(PERIOD_NAMES[l.p])}</span>
    </td>`;
  };
  let body = '';
  for (let p = 0; p < used; p++) {
    body += `<tr><th>${periodLabel(p)}</th>` + CLASSES.map((_, c) => cellAt(p, c)).join('') + '</tr>';
  }

  /* --- قائمة الشواغر القابلة للتعديل --- */
  const ordered = plan.affected.slice().sort((a, b) => a.p - b.p || a.c - b.c);
  const rows = ordered.map(lesson => {
    const key = slotKey(lesson.p, lesson.c);
    const a = plan.assignments[key];
    const ov = STATE.overrides[key];
    const opts = availableFor(lesson, plan);
    let what, badge;
    if (a.type === 'compact') {
      what = a.filler
        ? `تُقدَّم ${esc(a.filler.lesson.subject)} أ. ${esc(a.filler.lesson.teacher)} من ${esc(PERIOD_NAMES[a.filler.from])}`
        : 'انصراف مبكر';
      badge = '<span class="pill ok">تقديم</span>';
    } else if (a.type === 'cover') {
      what = `إشغال أ. ${esc(a.teacher)}`;
      badge = a.sameSubject ? '<span class="pill ok">إشغال — التخصص نفسه</span>' : '<span class="pill warn">إشغال إضافي</span>';
    } else {
      what = 'بلا تغطية';
      badge = '<span class="pill danger">لا تتوفر بديلة</span>';
    }
    return `<tr>
      <td>${esc(PERIOD_NAMES[lesson.p])}</td>
      <td><b>${esc(lesson.className)}</b></td>
      <td style="color:${subjectColor(lesson.subject)};font-weight:800">${esc(lesson.subject)}</td>
      <td><s>أ. ${esc(lesson.teacher)}</s></td>
      <td>${what}</td>
      <td>
        <select class="pick" data-key="${key}">
          <option value="auto" ${ov === undefined || ov === 'auto' ? 'selected' : ''}>تلقائي (تقديم ثم إشغال)</option>
          ${opts.map(t => `<option value="${esc(t)}" ${ov === t ? 'selected' : ''}>إشغال: أ. ${esc(t)}</option>`).join('')}
          <option value="" ${ov === '' ? 'selected' : ''}>— بلا تغطية —</option>
        </select>
        ${a.manual ? '<span class="pill manual">يدوي</span>' : ''}
      </td>
      <td>${badge}</td>
    </tr>`;
  }).join('');

  const loadTags = helpers
    .sort((a, b) => plan.coverCount[b] - plan.coverCount[a] || a.localeCompare(b, 'ar'))
    .map(t => `<span class="tag ${plan.coverCount[t] > STATE.maxCover ? 'none' : 'free'}">أ. ${esc(t)}<b class="n">${plan.coverCount[t]}</b></span>`)
    .join('');

  return `
    <div class="card">
      <div class="card-title">📋 ملخّص خطة ${esc(DAYS[d])}</div>
      <div class="stats">
        <div class="stat"><div class="num">${plan.affected.length}</div><div class="lbl">حصة شاغرة</div></div>
        <div class="stat"><div class="num">${compacted.length}</div><div class="lbl">سُدّت بالتقديم</div></div>
        <div class="stat"><div class="num">${covers.length}</div><div class="lbl">إشغال إضافي</div></div>
        <div class="stat"><div class="num">${gaps.length}</div><div class="lbl">بلا تغطية</div></div>
        <div class="stat"><div class="num">${early.length}</div><div class="lbl">صف ينصرف أبكر</div></div>
      </div>
      ${gaps.length ? `<p class="hint danger-text">⚠️ ${gaps.length} حصة لم تُغطَّ لعدم توفر معلمة متفرغة:
        ${gaps.map(g => `${esc(PERIOD_NAMES[g.lesson.p])} / ${esc(g.lesson.className)}`).join(' — ')}</p>` : ''}
      <p class="hint">نُقلت ${moveCount} حصة إلى وقت أبكر، ولم تُلغَ أي حصة لمعلمة حاضرة إلا بعد أن أعطتها أبكر.</p>
      <div class="card-title" style="margin-top:16px">ما يتغيّر في كل صف</div>
      <div class="class-changes">${classCards}</div>
      <div class="card-title" style="margin-top:16px">الإشغال الإضافي على كل معلمة</div>
      <div class="tag-list">${loadTags || '<span class="tag">لا يوجد</span>'}</div>
    </div>

    <div class="card">
      <div class="card-title">✏️ الحصص الشاغرة <span class="count">يمكن تعديل أي حصة</span></div>
      <div class="table-wrap">
        <table class="grid list-table ${STATE.absent.size === 1 ? 'hide-absent' : ''}" style="min-width:820px">
          <thead><tr><th>الحصة</th><th>الصف</th><th>المادة</th><th>الغائبة</th><th>المعالجة</th><th>تعديل</th><th>النوع</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="scroll-hint list-hint">مرّري الجدول أفقيًا 👈 لرؤية بقية الأعمدة</p>
      <p class="hint">«تلقائي» يقدّم حصة متأخرة إن أمكن، وإلا يُسند إشغالًا. واختيار معلمة بعينها
      يُبقي الحصة في مكانها ويُسند إشغالها إليها. القائمة لا تعرض إلا المتفرغات فعليًا بعد النقل.</p>
    </div>

    <div class="card">
      <div class="card-title">📆 جدول ${esc(DAYS[d])} بعد التعديل</div>
      <div class="table-wrap">
        <table class="grid" style="min-width:900px"><thead>${head}</thead><tbody>${body}</tbody></table>
      </div>
      <p class="scroll-hint">مرّري الجدول أفقيًا 👈 لرؤية بقية الصفوف</p>
      <p class="hint">⏫ حصة مُقدَّمة · 🟩 إشغال · «انصراف» الحصص التي يُعفى منها الصف.</p>
    </div>`;
}

/* ---------- نص جاهز للنسخ ---------- */
function planText(plan) {
  const d = STATE.d;
  const lines = [`خطة غياب يوم ${DAYS[d]}`];
  lines.push(`الغائبات: ${[...STATE.absent].map(t => 'أ. ' + t).join('، ') || '—'}`);
  Object.entries(plan.classes).forEach(([c, k]) => {
    lines.push('');
    lines.push(`الصف ${CLASSES[c]}${k.newLen < k.len ? ` — ينصرف بعد الحصة ${PERIOD_NAMES[k.newLen - 1]}` : ''}:`);
    k.moves.forEach(m => lines.push(`• أ. ${m.lesson.teacher} تُعطي ${m.lesson.subject} في الحصة ${PERIOD_NAMES[m.to]} بدل ${PERIOD_NAMES[m.from]}`));
    k.kept.forEach(p => {
      const a = plan.assignments[slotKey(p, +c)];
      lines.push(`• الحصة ${PERIOD_NAMES[p]} (${a.lesson.subject}): ${a.teacher ? 'إشغال أ. ' + a.teacher : 'بلا تغطية'}`);
    });
    if (!k.moves.length && !k.kept.length) lines.push('• لا نقل، الشاغر في آخر اليوم');
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
  $('#opt-compact').checked = STATE.compact;
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

  $('#opt-compact').addEventListener('change', e => {
    STATE.compact = e.target.checked;
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
