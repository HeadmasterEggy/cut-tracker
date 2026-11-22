// 「体重」页：趋势图、统计、历史
import { S, save } from '../state';
import { weightSeries, type WeightPoint } from '../calc';
import { $, $in, r0, r1, shift, today, toast } from '../util';
import { animateNums, applyFlash, confetti, flashBtn, numSpan, removeAnimated, setFlash, shakeEl } from '../anim';
import { renderToday } from './today';
import { renderBody } from './body';

const days = (a: string, b: string) => (new Date(a).getTime() - new Date(b).getTime()) / 864e5;

export function renderWeight() {
  $in('wDate').value = $in('wDate').value || today();
  const ser = weightSeries();
  // 图
  const gd = S.settings.goalDate;
  $('wRange').hidden = !gd; $('wPlanLg').hidden = !(gd && range === 'goal');
  if (ser.length < (gd && range === 'goal' ? 1 : 2)) {
    $('wChart').innerHTML = '<div class="muted">记录两天以上就会出现趋势图。</div>';
  } else {
    drawChart(ser, gd && range === 'goal' ? gd : null);
  }
  // 统计
  const start = Number(S.settings.start), goal = Number(S.settings.goal);
  const last = ser.length ? ser[ser.length - 1] : null;
  let rate: number | null = null, eta = '—';
  if (last && ser.length >= 2) {
    const a = ser.find(s => s.date >= shift(last.date, -14)) || ser[0];
    const n = days(last.date, a.date);
    if (n >= 3) rate = (last.avg - a.avg) / n * 7;
    if (rate && rate < 0 && last.avg > goal) {
      const weeks = (last.avg - goal) / -rate;
      eta = shift(last.date, Math.round(weeks * 7));
    }
  }
  $('wStats').innerHTML = `
    <div class="stat"><span class="muted">7 天平均</span><b>${last ? numSpan(r1(last.avg), 1) : '—'} kg</b></div>
    <div class="stat"><span class="muted">比起始</span><b class="${last && last.avg < start ? 'ok' : ''}">${last ? numSpan(r1(last.avg - start), 1) : '—'} kg</b></div>
    <div class="stat"><span class="muted">最近每周</span><b>${rate === null ? '—' : numSpan(r1(rate), 1, ' kg')}</b></div>
    <div class="stat"><span class="muted">按这个速度到 ${goal}kg</span><b style="font-size:16px">${eta}</b></div>` + deadlineStats(last, rate, goal);
  animateNums($('wStats'));
  // 历史：和上一次比涨了还是降了
  $('wList').innerHTML = ser.map((s, j) => {
    const dl = j ? r1(s.w - ser[j - 1].w) : null;
    const tag = dl === null ? '' : `<span class="delta ${dl < 0 ? 'dn' : dl > 0 ? 'up' : 'eq'}">${dl > 0 ? '+' : ''}${dl === 0 ? '持平' : dl}</span>`;
    return `<li><span class="name wl-d">${s.date.slice(5)}<small>${WK(s.date)}</small></span>${tag}<span class="num">${s.w} kg <span class="muted">均 ${r1(s.avg)}</span></span>
     <button class="del" data-w="${s.date}" aria-label="删除">×</button></li>`;
  }).reverse().slice(0, 60).join('') || '<li class="muted empty">还没记录</li>';
  applyFlash('wList');
  renderBody();
}

const WK = (ds: string) => '周' + '日一二三四五六'[new Date(ds + 'T12:00:00').getDay()];
let range: 'goal' | 'all' = 'goal';

// 体重图。to 有值时横轴延伸到目标日期，并画一条「按时到目标」的路线（从第一条记录的 7 天平均直线到目标）
function drawChart(ser: WeightPoint[], to: string | null) {
  const W = 600, H = innerWidth >= 900 ? 280 : 230, P = { l: 34, r: 14, t: 16, b: 26 };
  const T = (d: string) => new Date(d + 'T12:00:00').getTime();
  const first = ser[0], last = ser[ser.length - 1], goal = Number(S.settings.goal);
  const endD = to && to > last.date ? to : last.date;
  const t0 = T(first.date), t1 = T(endD);
  const vals = ser.map(s => s.w).concat([goal]);
  const lo = Math.floor(Math.min(...vals) - 0.5), hi = Math.ceil(Math.max(...vals) + 0.5);
  const x = (d: string) => P.l + (T(d) - t0) / Math.max(1, t1 - t0) * (W - P.l - P.r);
  const y = (v: number) => P.t + (hi - v) / (hi - lo) * (H - P.t - P.b);
  const planAt = (d: string) => to ? first.avg + (goal - first.avg) * Math.min(1, (T(d) - t0) / Math.max(1, T(to) - t0)) : null;
  let g = '';
  const step = Math.max(1, Math.ceil((hi - lo) / 5));
  for (let v = lo; v <= hi; v += step) g += `<line x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(148,163,184,.12)"/><text x="4" y="${y(v) + 4}">${v}</text>`;
  const gy = y(goal);
  g += `<line x1="${P.l}" x2="${W - P.r}" y1="${gy}" y2="${gy}" stroke="rgba(61,220,151,.35)" stroke-dasharray="2 4"/><text x="${P.l + 4}" y="${gy - 6}" style="fill:#3ddc97">目标 ${goal}</text>`;
  if (to) {
    // 今天的竖线 + 计划路线
    const tx = x(today());
    if (today() > first.date && today() < endD) g += `<line x1="${tx}" x2="${tx}" y1="${P.t}" y2="${H - P.b}" stroke="rgba(148,163,184,.25)"/><text x="${tx}" y="${P.t - 4}" text-anchor="middle">今天</text>`;
    g += `<line class="plan-line" x1="${x(first.date)}" y1="${y(first.avg)}" x2="${x(to)}" y2="${y(goal)}" stroke="#3ddc97" stroke-width="2"/>`;
    g += `<circle cx="${x(to)}" cy="${y(goal)}" r="5" fill="#0a0e17" stroke="#3ddc97" stroke-width="2"/>`;
  }
  const pts = ser.map(s => `${x(s.date)},${y(s.avg)}`);
  g += `<defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6ea8ff" stop-opacity=".25"/><stop offset="1" stop-color="#6ea8ff" stop-opacity="0"/></linearGradient></defs>`;
  if (ser.length > 1 && !to) g += `<polygon class="area" fill="url(#wg)" points="${x(first.date)},${H - P.b} ${pts.join(' ')} ${x(last.date)},${H - P.b}"/>`;
  g += ser.map((s, i) => `<circle class="dot" cx="${x(s.date)}" cy="${y(s.w)}" r="3.5" fill="#8b97ad" style="animation-delay:${r0(i / ser.length * 700)}ms"/>`).join('');
  if (ser.length > 1) g += `<polyline class="trend" pathLength="1" fill="none" stroke="#6ea8ff" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="${pts.join(' ')}"/>`;
  g += `<text x="${P.l}" y="${H - 6}">${first.date.slice(5)}</text>`;
  if (endD !== first.date) g += `<text x="${W - P.r}" y="${H - 6}" text-anchor="end">${endD.slice(5)}${to && endD === to ? ' 截止' : ''}</text>`;
  g += `<g class="cursor"><line y1="${P.t}" y2="${H - P.b}" stroke="#5b6679" stroke-dasharray="3 3"/><circle r="6" fill="#0a0e17" stroke="#6ea8ff" stroke-width="2.5"/></g>`;
  $('wChart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%">${g}</svg><div class="tip"></div>`;
  // 按住 / 悬停查看某天：体重、7 天平均，以及和计划路线差多少
  const svg = $('wChart').querySelector('svg')!, cur = svg.querySelector('.cursor')!, tip = $('wChart').querySelector<HTMLElement>('.tip')!;
  const line = cur.querySelector('line')!, dot = cur.querySelector('circle')!;
  const show = (e: PointerEvent) => {
    const r = svg.getBoundingClientRect(), k = r.width / W, mx = (e.clientX - r.left) / k;
    let best = ser[0];
    ser.forEach(s => { if (Math.abs(x(s.date) - mx) < Math.abs(x(best.date) - mx)) best = s; });
    const cx = String(x(best.date));
    line.setAttribute('x1', cx); line.setAttribute('x2', cx);
    dot.setAttribute('cx', cx); dot.setAttribute('cy', String(y(best.w)));
    cur.classList.add('on');
    const pl = planAt(best.date), diff = pl === null ? null : r1(best.avg - pl);
    tip.innerHTML = `${best.date.slice(5)} ${WK(best.date)} · <b>${best.w}</b> kg<br><span class="muted">7 天平均 ${r1(best.avg)}${diff === null ? '' : ` · 比路线${diff > 0 ? `慢 ${diff}` : diff < 0 ? `快 ${-diff}` : '刚好'}${diff ? ' kg' : ''}`}</span>`;
    tip.style.left = Math.max(80, Math.min(r.width - 80, x(best.date) * k)) + 'px';
    tip.classList.add('on');
  };
  const hide = () => { cur.classList.remove('on'); tip.classList.remove('on'); };
  svg.addEventListener('pointerdown', show); svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerleave', hide); svg.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') setTimeout(hide, 1600); });
}

// 截止日期：离目标日期还剩几天、每周需要减多少、现在的速度够不够
function deadlineStats(last: WeightPoint | null, rate: number | null, goal: number) {
  const gd = S.settings.goalDate; if (!gd) return '';
  const from = last ? last.date : today(), cur = last ? last.avg : Number(S.settings.start);
  const left = Math.round(days(gd, from));
  if (left <= 0) return `<div class="stat"><span class="muted">目标日期 ${gd}</span><b style="font-size:16px">已到期</b></div>`;
  const need = (cur - goal) / left * 7;
  if (need <= 0) return `<div class="stat"><span class="muted">目标日期 ${gd}</span><b class="ok" style="font-size:16px">已达到</b></div>`;
  const on = rate !== null && -rate >= need * 0.9;
  return `
    <div class="stat"><span class="muted">离 ${gd.slice(5)} 还剩 ${left} 天，每周需减</span><b class="${need > 1 ? 'warn' : ''}">${r1(need)} kg</b></div>
    <div class="stat"><span class="muted">按现在速度</span><b class="${rate === null ? '' : on ? 'ok' : 'warn'}" style="font-size:16px">${rate === null ? '数据还不够' : on ? '赶得上' : '会慢一点'}</b></div>`;
}

export function initWeight() {
  $('wRange').onclick = e => {
    const b = (e.target as Element).closest<HTMLElement>('[data-r]'); if (!b || b.dataset.r === range) return;
    range = b.dataset.r as typeof range;
    $('wRange').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    renderWeight();
  };
  $('addW').onclick = () => {
    const d = $in('wDate').value, v = Number($in('wVal').value);
    if (!d) return shakeEl('wDate', '选日期');
    if (!(v > 20 && v < 400)) return shakeEl('wVal', '填一个合理的体重');
    const prev = Object.values(S.weights), isLow = prev.length >= 3 && r1(v) < Math.min(...prev);
    S.weights[d] = r1(v); $in('wVal').value = '';
    setFlash({ list: 'wList', sel: `[data-w="${d}"]` });
    save(); renderWeight(); renderToday(); flashBtn($('addW'), '✓ 已保存');
    if (isLow) { confetti($('addW')); toast('新低！继续保持 🎉'); }
  };
  $('wList').onclick = e => {
    const b = (e.target as Element).closest<HTMLElement>('[data-w]'); if (!b) return;
    const d = b.dataset.w!, v = S.weights[d];
    removeAnimated(b.closest('li'), () => {
      delete S.weights[d]; save(); renderWeight(); renderToday();
      toast(`已删除 ${d}`, { action: '撤销', fn: () => {
        S.weights[d] = v; save(); setFlash({ list: 'wList', sel: `[data-w="${d}"]` }); renderWeight(); renderToday();
      } });
    });
  };
}
