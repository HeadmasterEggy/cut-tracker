// 「今天」页：进度环、吃了什么、运动、日期切换
import { S, curDate, setCurDate, day, save } from '../state';
import { deficitPlan, plan, totals, type Totals } from '../calc';
import { $, $in, $sel, esc, r0, r1, shift, today, toast } from '../util';
import {
  animateNums, applyFlash, confetti, countTo, flashBtn, floatText, numSpan, removeAnimated, retrigger,
  setFlash, setRing, shakeEl, staggerList,
} from '../anim';
import { renderAgent } from './agent';

export function renderToday() {
  const p = plan(), t = totals(curDate), d = day(curDate);
  const isToday = curDate === today();
  $('dateLabel').textContent = (isToday ? '今天 · ' : '') + curDate;
  $<HTMLButtonElement>('nextDay').disabled = isToday;
  const left = p.target - t.kcal;
  countTo($('kcalLeft'), left, r0);
  $('kcalLeft').className = 'big ' + (left < -150 ? 'bad' : left < 0 ? 'warn' : 'ok');
  $('kcalLine').textContent = `已吃 ${r0(t.kcal)} / 目标 ${r0(p.target)} kcal`;
  countTo($('proteinNow'), t.protein, v => r0(v) + 'g');
  const pPct = t.protein / p.protein;
  $('proteinPct').textContent = r0(pPct * 100) + '%';
  $('proteinLine').textContent = `目标 ${r0(p.protein)}g`;
  setRing(ring('kcalRing'), t.kcal / p.target, left < -150 ? 'var(--bad)' : left < 0 ? 'var(--warn)' : 'var(--accent)');
  setRing(ring('proteinRing'), pPct, 'var(--blue)');
  $('proteinWrap').classList.toggle('done', pPct >= 1);

  let hint = '';
  const hour = new Date().getHours();
  if (t.kcal > 0 && isToday && hour >= 20 && t.kcal < p.floor) hint = `⚠️ 今天才 ${r0(t.kcal)} kcal，低于 ${p.floor}，晚上补点蛋白质（鸡胸/牛肉/鸡蛋/牛奶）。`;
  else if (t.kcal > 0 && t.protein < p.protein * 0.6 && t.kcal > p.target * 0.6) hint = '蛋白质偏少，剩下的热量优先给肉、蛋、奶。';
  else if (left < 0) hint = '今天超了一点，没关系，明天正常吃，别饿回来。';
  $('dayHint').textContent = hint;
  // 电脑端总览里的几个数
  const wToday = S.weights[curDate], gl0 = Number(S.settings.goal);
  $('heroKpis').innerHTML = `
    <div class="stat"><span class="muted">已吃</span><b>${numSpan(r0(t.kcal))} <small>/ ${r0(p.target)} kcal</small></b></div>
    <div class="stat"><span class="muted">蛋白还差</span><b>${numSpan(Math.max(0, r0(p.protein - t.protein)), 0, ' g')}</b></div>
    <div class="stat"><span class="muted">运动</span><b>${numSpan(t.exMin)} <small>分钟${t.exKcal ? ` · ${r0(t.exKcal)} kcal` : ''}</small></b></div>
    <div class="stat"><span class="muted">${wToday ? '当天体重' : '最近体重'}</span><b>${numSpan(r1(wToday || p.w), 1)} <small>kg · 离目标 ${r1(Math.max(0, (wToday || p.w) - gl0))}</small></b></div>`;
  animateNums($('heroKpis'));
  renderDeficit(p.tdee, t.kcal, isToday);

  $('foodList').innerHTML = d.foods.length ? d.foods.map((f, i) => `
    <li><span class="name">${esc(f.label || f.name)}</span>
      <span class="num">${r0(f.kcal)} kcal<br><span class="muted">${r1(f.protein)}g 蛋白</span></span>
      <button class="del" data-food="${i}" aria-label="删除">×</button></li>`).join('')
    : '<li class="muted empty">还没记录，从上面加一条吧</li>';

  $('exList').innerHTML = d.ex.length ? d.ex.map((e, i) => `
    <li><span class="name">${esc(e.type)}</span>
      <span class="num">${e.min || 0} 分钟${e.kcal ? ` · ${e.kcal} kcal` : ''}</span>
      <button class="del" data-ex="${i}" aria-label="删除">×</button></li>`).join('')
    : '<li class="muted empty">今天还没运动</li>';
  applyFlash('foodList'); applyFlash('exList');

  renderFoodPicker();
  renderAgent();
  $('hdrWeight').textContent = S.setupDone ? `${r1(p.w)} kg → ${S.settings.goal} kg` : '先在设置里填身体数据';
  const st = Number(S.settings.start), gl = Number(S.settings.goal);
  $('hdrProg').style.width = (S.setupDone && st > gl ? Math.max(0, Math.min(1, (st - p.w) / (st - gl))) * 100 : 0) + '%';
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
    box.innerHTML = `<div class="stat"><span class="muted">还差</span><b class="ok">已到目标</b></div>`;
    $('deficitNote').textContent = $('deficitDone').textContent = ''; $('deficitBar').style.width = '100%';
    return;
  }
  const over = dp.daysLeft <= 0, floor = plan().floor, eat = tdee - dp.perDay;
  box.innerHTML = `
    <div class="stat key"><span class="muted">每天需要缺口</span><b class="${dp.perDay > dp.maxPerDay ? 'warn' : ''}">${over ? '已到期' : `${k(dp.perDay)} <small>kcal</small>`}</b><small class="muted">${over ? dp.goalDate : `剩 ${dp.daysLeft} 天（含今天）`}</small></div>
    <div class="stat key"><span class="muted">每天只能吃</span><b class="${eat < floor ? 'bad' : 'ok'}">${over ? '—' : `${k(eat)} <small>kcal</small>`}</b><small class="muted">消耗约 ${k(tdee)} − 缺口</small></div>
    <div class="stat"><span class="muted">还差总缺口</span><b>${k(dp.remaining)} <small>kcal</small></b><small class="muted">${w} → ${goal} kg</small></div>
    <div class="stat"><span class="muted">${isToday ? '今天缺口（到目前）' : '当天缺口'}</span><b class="${dayDef < 0 ? 'bad' : ''}">${dayDef < 0 ? '超出 ' + k(-dayDef) : k(dayDef)} <small>kcal</small></b><small class="muted">消耗约 ${k(tdee)} − 吃了 ${k(eaten)}</small></div>`;
  $('deficitDone').textContent = `已完成 ${k(dp.done)} / ${k(dp.total)} kcal（${S.settings.start} → ${w} kg）`;
  $('deficitBar').style.width = (dp.total ? dp.done / dp.total * 100 : 0) + '%';
  $('deficitNote').textContent = over ? '' : dp.perDay > dp.maxPerDay
    ? `⚠️ 每天只吃 ${k(eat)} kcal 低于 ${floor} 下限，不要这么吃。按 ${floor} 吃（每天缺 ${k(dp.maxPerDay)}），${dp.goalDate.slice(5)} 大约到 ${r1(dp.projected)} kg。`
    : `每天吃 ${k(eat)} kcal 左右就能按时到 ${goal} kg。`;
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
  $('prevDay').onclick = () => goDay(-1);
  $('nextDay').onclick = () => goDay(1);
  // 在日期 / 进度环卡片上左右滑动切换日期
  let sx = 0, sy = 0, on = false;
  ['heroCard', 'dateLabel'].forEach(id => {
    const el = id === 'dateLabel' ? $(id).closest<HTMLElement>('.card')! : $(id);
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
