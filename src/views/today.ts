// 「今天」页：进度环、吃了什么、运动、日期切换
import { S, curDate, setCurDate, day, save } from '../state';
import { deficitPlan, KCAL_PER_KG, macros, plan, totals, type Totals } from '../calc';
import { $, $in, $sel, esc, r0, r1, shift, today, toast } from '../util';
import {
  RM, animateNums, applyFlash, confetti, countTo, flashBtn, floatText, numSpan, removeAnimated, retrigger,
  setFlash, setRing, shakeEl, staggerList,
} from '../anim';
import { renderAgent } from './agent';

const PAL = ['#3ddc97', '#6ea8ff', '#b197fc', '#fbbf24', '#f472b6', '#2dd4bf', '#fb923c', '#a3e635'];
const WK = '日一二三四五六';
const wk = (ds: string) => '周' + WK[new Date(ds + 'T12:00:00').getDay()];
let ringMode: 'kcal' | 'protein' = 'kcal';
let foodSort: 'time' | 'kcal' | 'protein' = 'time';
let openFood = -1, openDate = '';

export function renderToday() {
  const p = plan(), t = totals(curDate), d = day(curDate);
  const isToday = curDate === today();
  $('dateLabel').textContent = (isToday ? '今天 · ' : '') + curDate.slice(5).replace('-', ' 月 ') + ' 日 · ' + wk(curDate);
  $<HTMLButtonElement>('nextDay').disabled = isToday;
  $('foodTitle').textContent = isToday ? '今天吃了' : `${curDate.slice(5)} 吃了`;
  renderWeekStrip(p);
  const left = p.target - t.kcal;
  renderRing(p, t);
  setRing(ring('kcalRing'), t.kcal / p.target, left < -150 ? 'var(--bad)' : left < 0 ? 'var(--warn)' : 'var(--accent)');
  const pPct = t.protein / p.protein;
  setRing(ring('proteinRing'), pPct, 'var(--blue)');
  $('kcalWrap').classList.toggle('pdone', pPct >= 1);

  // 两条进度：热量（带下限刻度）、蛋白质
  $('kcalLine').innerHTML = `${r0(t.kcal)} <small>/ ${r0(p.target)} kcal</small>`;
  const kb = $('kcalBar');
  kb.style.width = Math.min(100, t.kcal / p.target * 100) + '%';
  kb.className = 'meter-fill' + (left < -150 ? ' bad' : left < 0 ? ' warn' : '');
  $('floorTick').style.left = Math.min(100, p.floor / p.target * 100) + '%';
  $('kcalSub').innerHTML = left >= 0
    ? `还能吃 <b>${r0(left)}</b> kcal · 竖线是下限 ${p.floor}`
    : `超了 <b>${r0(-left)}</b> kcal，明天正常吃就好`;
  $('proteinLine').innerHTML = `${r0(t.protein)} <small>/ ${r0(p.protein)} g</small>`;
  $('proteinBar').style.width = Math.min(100, pPct * 100) + '%';
  const short = p.protein - t.protein;
  $('proteinSub').innerHTML = short > 0
    ? `还差 <b>${r0(short)}</b> g ≈ 熟鸡胸 ${r0(short / 31 * 100)} g`
    : '已达标 ✓';

  // 三大营养素：已吃 / 每天目标。没记脂肪、碳水的条目不算进去，会在标题里说明
  const m = macros(p);
  const mc = (cls: string, name: string, ate: number, goal: number) => `
      <div class="mc ${cls}"><span>${name}</span><b>${r0(ate)}<small> g</small></b>
        <i class="mc-bar"><i style="width:${Math.min(100, goal ? ate / goal * 100 : 0)}%"></i></i><em>目标 ${r0(goal)} g</em></div>`;
  $('macroBox').innerHTML = `
    <div class="mc-h">三大营养素 <small>已吃 / 目标（按 ${r0(p.target)} kcal）${t.noMacro ? ` · ${t.noMacro} 条没记碳水脂肪` : ''}</small></div>
    <div class="mc-row">${mc('p', '蛋白质', t.protein, m.protein)}${mc('c', '碳水', t.carbs, m.carbs)}${mc('f', '脂肪', t.fat, m.fat)}
    </div>`;

  let hint = '';
  const hour = new Date().getHours();
  if (t.kcal > 0 && isToday && hour >= 20 && t.kcal < p.floor) hint = `⚠️ 今天才 ${r0(t.kcal)} kcal，低于 ${p.floor}，晚上补点蛋白质（鸡胸/牛肉/鸡蛋/牛奶）。`;
  else if (t.kcal > 0 && t.protein < p.protein * 0.6 && t.kcal > p.target * 0.6) hint = '蛋白质偏少，剩下的热量优先给肉、蛋、奶。';
  else if (left < 0) hint = '今天超了一点，没关系，明天正常吃，别饿回来。';
  $('dayHint').textContent = hint;
  // 电脑端总览里的几个数
  const wToday = S.weights[curDate], ratio = t.kcal ? t.protein / t.kcal * 100 : 0, goalRatio = p.protein / p.target * 100;
  $('heroKpis').innerHTML = `
    <div class="stat"><span class="muted">运动</span><b>${numSpan(t.exMin)} <small>分钟${t.exKcal ? ` · ${r0(t.exKcal)} kcal` : ''}</small></b></div>
    <div class="stat"><span class="muted">${wToday ? '当天体重' : '最近体重'}</span><b>${numSpan(r1(wToday || p.w), 1)} <small>kg</small></b></div>
    <div class="stat" title="目标比例 ${r1(goalRatio)} g / 100 kcal"><span class="muted">每 100 kcal 蛋白</span><b class="${!t.kcal ? '' : ratio >= goalRatio ? 'ok' : 'warn'}">${t.kcal ? numSpan(r1(ratio), 1) : '—'} <small>g · 目标 ${r1(goalRatio)}</small></b></div>`;
  animateNums($('heroKpis'));
  renderDeficit(p.tdee, t.kcal, isToday);
  renderFoods(p, t);

  $('exList').innerHTML = d.ex.length ? d.ex.map((e, i) => `
    <li><span class="ex-ic">${/力量|练/.test(e.type) ? '🏋️' : /跑/.test(e.type) ? '🏃' : /骑/.test(e.type) ? '🚴' : '🚶'}</span><span class="name">${esc(e.type)}</span>
      <span class="num">${e.min || 0} 分钟${e.kcal ? `<br><span class="muted">${e.kcal} kcal</span>` : ''}</span>
      <button class="del" data-ex="${i}" aria-label="删除">×</button></li>`).join('')
    : `<li class="muted empty">${isToday ? '今天' : '这天'}还没运动</li>`;
  applyFlash('foodList'); applyFlash('exList');

  renderFoodPicker();
  renderAgent();
  const st = Number(S.settings.start), gl = Number(S.settings.goal);
  $('hdrWeight').textContent = S.setupDone ? `${r1(p.w)} → ${S.settings.goal} kg` : '先在设置里填身体数据';
  const prog = S.setupDone && st > gl ? Math.max(0, Math.min(1, (st - p.w) / (st - gl))) : 0;
  $('hdrProg').style.width = prog * 100 + '%';
  const dp = deficitPlan(today());
  $('hdrDays').textContent = dp && dp.daysLeft > 0 ? `剩 ${dp.daysLeft} 天` : '';
  $('sideGoal').innerHTML = S.setupDone ? `
    <div class="sg-h">目标 ${gl} kg${dp ? ' · ' + dp.goalDate.slice(5) : ''}</div>
    <div class="sg-n">${r1(p.w)}<small>kg</small></div>
    <div class="sg-bar"><i style="width:${prog * 100}%"></i></div>
    <div class="sg-s"><span>已减 ${r1(Math.max(0, st - p.w))}</span><span>还差 ${r1(Math.max(0, p.w - gl))} kg</span></div>` : '';
}

// 中间的大数字：点一下在「还能吃 kcal」和「蛋白还差 g」之间切换
function renderRing(p = plan(), t = totals(curDate)) {
  const left = p.target - t.kcal, short = p.protein - t.protein, el = $('kcalLeft');
  $('kcalWrap').dataset.mode = ringMode;
  if (ringMode === 'kcal') {
    $('ringLabel').textContent = left >= 0 ? '还能吃' : '超了';
    countTo(el, Math.abs(left), r0); $('ringUnit').textContent = 'kcal';
    el.className = 'big ' + (left < -150 ? 'bad' : left < 0 ? 'warn' : 'ok');
  } else {
    $('ringLabel').textContent = short > 0 ? '蛋白还差' : '蛋白已吃';
    countTo(el, short > 0 ? short : t.protein, r0); $('ringUnit').textContent = 'g';
    el.className = 'big ' + (short > 0 ? '' : 'ok');
    el.style.color = short > 0 ? 'var(--blue)' : '';
  }
  if (ringMode === 'kcal') el.style.color = '';
}

// 一周日期条：每天一个小环（吃了多少 / 目标），点了跳到那天
function renderWeekStrip(p: ReturnType<typeof plan>) {
  const t0 = today();
  let end = shift(curDate, 3); if (end > t0) end = t0;
  $('weekStrip').innerHTML = [...Array(7)].map((_, i) => {
    const ds = shift(end, i - 6), t = totals(ds), has = !!S.days[ds]?.foods.length;
    const c = !has ? 'transparent' : t.kcal > p.target + 150 ? 'var(--bad)' : t.kcal > p.target || (ds < t0 && t.kcal < p.floor) ? 'var(--warn)' : 'var(--accent)';
    const off = 100 - Math.min(1, t.kcal / p.target) * 100;
    return `<button class="wd${ds === curDate ? ' on' : ''}${ds === t0 ? ' is-today' : ''}" data-d="${ds}" title="${ds} · ${has ? r0(t.kcal) + ' kcal · 蛋白 ' + r0(t.protein) + ' g' : '没记录'}">
      <span>${ds === t0 ? '今天' : wk(ds)}<b>${Number(ds.slice(8))}</b></span>
      <svg viewBox="0 0 30 30"><circle class="wbg" cx="15" cy="15" r="12"/><circle class="wfg" cx="15" cy="15" r="12" pathLength="100" style="stroke:${c};stroke-dashoffset:${off}"/></svg></button>`;
  }).join('');
}

// 吃了什么：上面一条按热量占比的组成条，下面每条可展开看占比和蛋白密度
function renderFoods(p: ReturnType<typeof plan>, t: Totals) {
  const d = day(curDate);
  if (openDate !== curDate) { openFood = -1; openDate = curDate; }
  const items = d.foods.map((f, i) => ({ f, i, c: PAL[i % PAL.length] }));
  if (foodSort === 'kcal') items.sort((a, b) => b.f.kcal - a.f.kcal);
  if (foodSort === 'protein') items.sort((a, b) => b.f.protein - a.f.protein);
  document.querySelectorAll('#foodSort button').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.s === foodSort));
  const scale = Math.max(p.target, t.kcal), goalRatio = p.protein / p.target * 100;
  $('foodStack').innerHTML = items.length ? `<div class="stack">${items.map(({ f, i, c }, n) =>
    `<i data-i="${i}" style="--c:${c};--i:${n};width:${f.kcal / scale * 100}%" title="${esc(f.label || f.name)} · ${r0(f.kcal)} kcal"></i>`).join('')}${t.kcal < p.target ? '<i class="rest"></i>' : ''}</div>
    <div class="stack-cap"><span>按热量占比${t.kcal < p.target ? '，斜纹是还能吃的' : ''} · 点一条看详情</span><span>${r0(t.kcal)} / ${r0(p.target)} kcal</span></div>` : '';
  $('foodList').innerHTML = items.length ? items.map(({ f, i, c }) => {
    const dens = f.kcal ? f.protein / f.kcal * 100 : 0, lib = S.foods.find(x => x.name === f.name);
    const verdict = !f.kcal ? '' : dens >= goalRatio ? `高于目标比例 ${r1(goalRatio)} g，多吃这类` : dens >= goalRatio / 2 ? `低于目标比例 ${r1(goalRatio)} g，搭配高蛋白的吃` : `主要是热量，蛋白很少（目标比例 ${r1(goalRatio)} g）`;
    return `<li data-i="${i}" style="--c:${c}" class="${openFood === i ? 'open' : ''}">
      <button class="fi" aria-expanded="${openFood === i}"><i class="sw"></i><span class="name">${esc(f.label || f.name)}</span>
        <span class="num">${r0(f.kcal)} kcal<small>${r1(f.protein)} g 蛋白</small></span>
        <svg class="chev" viewBox="0 0 16 16"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <div class="fd"><div><div class="fd-in">
        <div><span>占当天热量</span><b>${t.kcal ? r0(f.kcal / t.kcal * 100) : 0}<small>%</small></b></div>
        <div><span>占蛋白目标</span><b>${r0(f.protein / p.protein * 100)}<small>%</small></b></div>
        <div><span>每 100 kcal 蛋白</span><b class="${dens >= goalRatio ? 'ok' : dens >= goalRatio / 2 ? '' : 'warn'}">${r1(dens)}<small>g</small></b></div>
        <div class="fd-note">${f.fat != null && f.carbs != null ? `碳水 ${r1(f.carbs)} g · 脂肪 ${r1(f.fat)} g<br>` : ''}${verdict}${lib ? `<br>食物库：每 ${lib.per}${esc(lib.unit)} ${lib.kcal} kcal · ${lib.protein} g 蛋白` : ''}</div>
      </div></div></div>
      <button class="del" data-food="${i}" aria-label="删除">×</button></li>`;
  }).join('')
    : `<li class="muted empty">${curDate === today() ? '今天还没记录' : '这天没有记录'}</li>`;
}

export function selectDay(ds: string) {
  if (ds === curDate || ds > today()) return;
  const n = ds < curDate ? -1 : 1;
  setCurDate(ds); renderToday();
  retrigger($('dateLabel'), n < 0 ? 'slide-l' : 'slide-r');
  staggerList($('foodList')); staggerList($('exList'));
}

// 热量缺口：离目标还差多少、每天要缺多少、当天实际缺了多少
const k = (n: number) => r0(n).toLocaleString('en-US');
function renderDeficit(tdee: number, eaten: number, isToday: boolean) {
  const dp = deficitPlan(today()), box = $('deficitBox');
  $('deficitCard').hidden = !dp;
  if (!dp) return;
  const goal = S.settings.goal, w = r1(plan().w), dayDef = tdee - eaten;
  $('deficitTitle').textContent = `热量缺口（${dp.goalDate.slice(5)} 到 ${goal} kg）`;
  if (dp.remaining <= 0) {
    box.innerHTML = `<div class="dz-key"><div class="dz-tile ok"><span>还差</span><b>已到目标 🎉</b></div></div>`;
    $('deficitNote').textContent = $('deficitDone').innerHTML = ''; $('deficitBar').style.width = '100%';
    return;
  }
  // 来不及时（要的缺口比吃到下限还大），「可吃」按下限显示，不会出现负数
  const over = dp.daysLeft <= 0, floor = plan().floor, late = dp.perDay > dp.maxPerDay;
  const eat = Math.max(floor, tdee - dp.perDay), def = late ? dp.maxPerDay : dp.perDay;
  box.innerHTML = over
    ? `<div class="dz-key"><div class="dz-tile warn"><span>目标日期 ${dp.goalDate}</span><b>已到期</b></div></div>`
    : `<div class="dz-key">
      <div class="dz-tile ${late ? 'warn' : 'ok'}"><span>每天需要缺口</span><b>${k(dp.perDay)}<small>kcal</small></b><em>${late ? `剩 ${dp.daysLeft} 天，来不及` : `剩 ${dp.daysLeft} 天（含今天）`}</em></div>
      <div class="dz-tile ${late ? 'warn' : 'ok'}"><span>${late ? '按下限吃' : '每天只能吃'}</span><b>${k(eat)}<small>kcal</small></b><em>${late ? `${dp.goalDate.slice(5)} 大约到 ${r1(dp.projected)} kg` : '按这个吃能按时到'}</em></div>
    </div>
    <div class="dz-eq">消耗 <b>${k(tdee)}</b><i>−</i>缺口 <b>${k(def)}</b><i>=</i>可吃 <b class="${late ? 'warn' : 'ok'}">${k(eat)}</b></div>`;
  box.innerHTML += `<div class="dz-mini">
      <div><span>还差总缺口</span><b>${k(dp.remaining)}<small>kcal</small></b><em>${w} → ${goal} kg</em></div>
      <div><span>${isToday ? '今天缺口（到目前）' : '当天缺口'}</span><b class="${dayDef < 0 ? 'bad' : ''}">${dayDef < 0 ? '超 ' + k(-dayDef) : k(dayDef)}<small>kcal</small></b><em>吃了 ${k(eaten)}</em></div>
    </div>`;
  const pct = dp.total ? dp.done / dp.total * 100 : 0;
  $('deficitDone').innerHTML = `<span>已完成 <b>${r0(pct)}%</b> · ${S.settings.start} → ${w} kg</span><span>${k(dp.done)} / ${k(dp.total)} kcal</span>`;
  $('deficitBar').style.width = pct + '%';
  $('deficitNote').textContent = over ? '' : late
    ? `⚠️ 剩 ${dp.daysLeft} 天减 ${r1(dp.remaining / KCAL_PER_KG)} kg 来不及（每天要缺 ${k(dp.perDay)}，吃到下限也只能缺 ${k(dp.maxPerDay)}）。别低于 ${floor}，${dp.goalDate.slice(5)} 大约到 ${r1(dp.projected)} kg。`
    : '';
}

const ring = (id: string) => document.getElementById(id) as unknown as SVGElement;
export const kcalRing = () => ring('kcalRing');
export const proteinRing = () => ring('proteinRing');

// 加了一条之后：飘字 + 达标庆祝
function afterAdd(kcal: number, protein: number, before: Totals) {
  const p = plan(), t = totals(curDate);
  if (kcal) floatText($('kcalWrap'), '+' + r0(kcal), t.kcal > p.target ? 'var(--warn)' : 'var(--accent)');
  if (protein >= 1) setTimeout(() => floatText($('proteinWrap'), '+' + r1(protein) + 'g', 'var(--blue)'), 120);
  if (before.protein < p.protein && t.protein >= p.protein) {
    setTimeout(() => { confetti($('proteinWrap')); toast('蛋白质达标 🎉'); }, 500);
    return true;
  }
  if (before.kcal <= p.target && t.kcal > p.target) retrigger($('kcalWrap'), 'over');
  if (navigator.vibrate) navigator.vibrate(8);
  return false;
}

let chipPicked = false;
const libAt = (v: string) => S.foods[Number(v)];

export function renderFoodPicker() {
  const sel = $sel('foodSel'), prev = sel.value;
  sel.innerHTML = S.foods.map((f, i) => `<option value="${i}">${esc(f.name)}（每${f.per}${f.unit} ${f.kcal}kcal）</option>`).join('');
  if (prev && libAt(prev)) sel.value = prev;
  // 最近用过的食物做成快捷按钮
  const recent: string[] = [];
  Object.keys(S.days).sort().reverse().slice(0, 14).forEach(k => S.days[k].foods.forEach(f => {
    if (f.name && !recent.includes(f.name) && S.foods.some(x => x.name === f.name)) recent.push(f.name);
  }));
  const chips = (recent.length ? recent : S.foods.slice(0, 6).map(f => f.name)).slice(0, 8);
  const cur = libAt(sel.value)?.name;
  $('foodChips').innerHTML = chips.map(n => `<span class="chip${n === cur && $in('foodAmt').value === '' && chipPicked ? ' on' : ''}" data-chip="${esc(n)}">${esc(n)}</span>`).join('');
  updatePreview();
}
function updatePreview() {
  const f = libAt($sel('foodSel').value);
  if (!f) { $('foodPreview').textContent = ''; return; }
  $in('foodAmt').placeholder = f.unit;
  const amt = Number($in('foodAmt').value);
  $('foodPreview').textContent = amt > 0
    ? `${amt}${f.unit} = ${r0(f.kcal * amt / f.per)} kcal · ${r1(f.protein * amt / f.per)}g 蛋白质`
    : `输入数量（${f.unit}）`;
}

export function goDay(n: number) {
  if (n > 0 && curDate >= today()) { retrigger($('dateLabel'), 'slide-r'); return; }
  setCurDate(shift(curDate, n)); renderToday();
  retrigger($('dateLabel'), n < 0 ? 'slide-l' : 'slide-r');
  staggerList($('foodList')); staggerList($('exList'));
}

export function initToday() {
  $sel('foodSel').onchange = () => { chipPicked = false; document.querySelectorAll('.chip.on').forEach(c => c.classList.remove('on')); updatePreview(); };
  $in('foodAmt').oninput = updatePreview;
  $('foodChips').onclick = e => {
    const chip = e.target as HTMLElement;
    const n = chip.dataset.chip; if (!n) return;
    const i = S.foods.findIndex(f => f.name === n);
    if (i >= 0) {
      $sel('foodSel').value = String(i); chipPicked = true;
      document.querySelectorAll('.chip.on').forEach(c => c.classList.remove('on'));
      chip.classList.add('on'); $('foodAmt').focus(); updatePreview();
    }
  };
  $('addFood').onclick = () => {
    const f = libAt($sel('foodSel').value), amt = Number($in('foodAmt').value);
    if (!f || !(amt > 0)) return shakeEl('foodAmt', '先填数量');
    const before = totals(curDate), item = {
      name: f.name, label: `${f.name} ${amt}${f.unit}`,
      kcal: f.kcal * amt / f.per, protein: f.protein * amt / f.per,
    };
    day(curDate).foods.push(item);
    chipPicked = false; setFlash({ list: 'foodList', nth: day(curDate).foods.length });
    $in('foodAmt').value = ''; save(); renderToday(); flashBtn($('addFood'), '✓ 已添加');
    afterAdd(item.kcal, item.protein, before);
  };
  $('addCustom').onclick = () => {
    const name = $in('cName').value.trim(), kcal = Number($in('cKcal').value), protein = Number($in('cProt').value) || 0;
    if (!name) return shakeEl('cName', '填名称和热量');
    if (!(kcal >= 0) || $in('cKcal').value === '') return shakeEl('cKcal', '填名称和热量');
    const before = totals(curDate);
    day(curDate).foods.push({ name, label: name, kcal, protein });
    setFlash({ list: 'foodList', nth: day(curDate).foods.length });
    $in('cName').value = $in('cKcal').value = $in('cProt').value = ''; save(); renderToday(); flashBtn($('addCustom'), '✓ 已添加');
    afterAdd(kcal, protein, before);
  };
  $('foodList').onclick = e => {
    const fi = (e.target as Element).closest<HTMLElement>('.fi');
    if (fi) { toggleFood(Number(fi.closest<HTMLElement>('li')!.dataset.i)); return; }
    const b = (e.target as Element).closest<HTMLElement>('[data-food]'); if (!b) return;
    const i = Number(b.dataset.food), dd = day(curDate);
    removeAnimated(b.closest('li'), () => {
      const [item] = dd.foods.splice(i, 1); save(); renderToday();
      toast(`已删除 ${item.label || item.name}`, { action: '撤销', fn: () => {
        dd.foods.splice(i, 0, item); save(); setFlash({ list: 'foodList', nth: i + 1 }); renderToday();
      } });
    });
  };
  $('addEx').onclick = () => {
    const min = Number($in('exMin').value), kcal = Number($in('exKcal').value) || 0;
    if (!(min > 0)) return shakeEl('exMin', '填分钟数');
    day(curDate).ex.push({ type: $sel('exType').value, min, kcal });
    setFlash({ list: 'exList', nth: day(curDate).ex.length });
    $in('exMin').value = $in('exKcal').value = ''; save(); renderToday(); flashBtn($('addEx'), '💪 已记录');
    if (navigator.vibrate) navigator.vibrate(8);
  };
  $('exList').onclick = e => {
    const b = (e.target as Element).closest<HTMLElement>('[data-ex]'); if (!b) return;
    const i = Number(b.dataset.ex), dd = day(curDate);
    removeAnimated(b.closest('li'), () => {
      const [item] = dd.ex.splice(i, 1); save(); renderToday();
      toast(`已删除 ${item.type}`, { action: '撤销', fn: () => {
        dd.ex.splice(i, 0, item); save(); setFlash({ list: 'exList', nth: i + 1 }); renderToday();
      } });
    });
  };
  $('weekStrip').onclick = e => {
    const b = (e.target as Element).closest<HTMLElement>('[data-d]'); if (b) selectDay(b.dataset.d!);
  };
  const flip = () => {
    ringMode = ringMode === 'kcal' ? 'protein' : 'kcal'; renderRing();
    retrigger(document.querySelector('#kcalWrap .ring-center')!, 'swap');
  };
  $('kcalWrap').onclick = flip;
  $('kcalWrap').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } };
  $('foodSort').onclick = e => {
    const b = (e.target as Element).closest<HTMLElement>('[data-s]'); if (!b || b.dataset.s === foodSort) return;
    foodSort = b.dataset.s as typeof foodSort; renderFoods(plan(), totals(curDate)); staggerList($('foodList'));
  };
  // 组成条和列表互相高亮
  const card = $('foodList').closest<HTMLElement>('.card')!;
  const hl = (i: string | null) => {
    card.classList.toggle('hl', i !== null);
    card.querySelectorAll('[data-i]').forEach(el => el.classList.toggle('cur', (el as HTMLElement).dataset.i === i));
  };
  card.addEventListener('pointerover', e => {
    if ((e as PointerEvent).pointerType !== 'mouse') return;
    const el = (e.target as Element).closest<HTMLElement>('[data-i]'); hl(el ? el.dataset.i! : null);
  });
  card.addEventListener('pointerleave', () => hl(null));
  const toggleFood = (i: number, scroll = false) => {
    const li = $('foodList').querySelector<HTMLElement>(`li[data-i="${i}"]`); if (!li) return;
    const open = !li.classList.contains('open');
    $('foodList').querySelectorAll('li.open').forEach(x => { x.classList.remove('open'); x.querySelector('.fi')?.setAttribute('aria-expanded', 'false'); });
    li.classList.toggle('open', open); li.querySelector('.fi')!.setAttribute('aria-expanded', String(open));
    openFood = open ? i : -1;
    if (scroll && open) setTimeout(() => li.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'nearest' }), 120);
  };
  $('foodStack').onclick = e => {
    const el = (e.target as Element).closest<HTMLElement>('[data-i]'); if (el) toggleFood(Number(el.dataset.i), true);
  };
  $('prevDay').onclick = () => goDay(-1);
  $('nextDay').onclick = () => goDay(1);
  // 在日期 / 进度环卡片上左右滑动切换日期
  let sx = 0, sy = 0, on = false;
  ['heroCard', 'weekStrip'].forEach(id => {
    const el = $(id);
    el.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; on = true; }, { passive: true });
    el.addEventListener('touchend', e => {
      if (!on) return; on = false;
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) goDay(dx > 0 ? -1 : 1);
    }, { passive: true });
  });
  $('copyDay').onclick = async () => {
    const p = plan(), t = totals(curDate), d = day(curDate);
    const lines = [
      `${curDate} 饮食运动汇总`,
      `目标 ${r0(p.target)} kcal / 蛋白 ${r0(p.protein)}g`,
      `已吃 ${r0(t.kcal)} kcal / 蛋白 ${r0(t.protein)}g`,
      '', '吃了：', ...d.foods.map(f => `- ${f.label || f.name}：${r0(f.kcal)} kcal，${r1(f.protein)}g 蛋白`),
    ];
    if (d.ex.length) lines.push('', '运动：', ...d.ex.map(e => `- ${e.type} ${e.min} 分钟${e.kcal ? `，约 ${e.kcal} kcal` : ''}`));
    if (S.weights[curDate]) lines.push('', `体重：${S.weights[curDate]} kg`);
    const text = lines.join('\n');
    try { await navigator.clipboard.writeText(text); flashBtn($('copyDay'), '✓ 已复制到剪贴板'); }
    catch (e) { prompt('复制下面的内容：', text); }
  };
}
