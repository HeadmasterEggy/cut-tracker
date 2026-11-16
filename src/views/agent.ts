// 仪表盘模式（Claude 记账）：读 data/log.json，显示点评和最近 7 天
import { S, agentMode, curDate, save, setAgentMode, setState, withDefaults } from '../state';
import { plan, totals } from '../calc';
import { $, esc, r0, shift, today } from '../util';
import { selectDay } from './today';
import type { LogData } from '../types';
import { renderAll } from '../render';

export function renderAgent() {
  if (!agentMode) return;
  const c = S.coach;
  const lines = (c?.text || '还没有点评').split('\n').filter(Boolean);
  const box = $('coachText'), more = $('coachMore');
  box.innerHTML = lines.map(l => `<p>${esc(l)}</p>`).join('');
  // 手机上点评太长就先折起来，点「展开全部」看完
  const fold = innerWidth < 900 && lines.join('').length > 80 && !coachOpen;
  box.classList.toggle('clamp', fold); more.hidden = !fold && !coachOpen || innerWidth >= 900;
  more.textContent = coachOpen ? '收起' : '展开全部';
  $('coachTime').textContent = c?.updated ? '更新于 ' + c.updated.replace('T', ' ').slice(0, 16) : '';
  const p = plan(), end = today();
  const ks = [...Array(7)].map((_, i) => shift(end, -i)).filter(k => S.days[k] && S.days[k].foods.length);
  const avg = (f: (t: ReturnType<typeof totals>) => number) => ks.length ? ks.reduce((a, k) => a + f(totals(k)), 0) / ks.length : 0;
  const hit = ks.filter(k => { const t = totals(k); return t.kcal >= p.floor && t.kcal <= p.target + 100; }).length;
  const exMin = [...Array(7)].map((_, i) => totals(shift(end, -i)).exMin).reduce((a, b) => a + b, 0);
  $('weekStats').innerHTML = `
    <div class="stat"><span class="muted">平均热量</span><b>${ks.length ? r0(avg(t => t.kcal)) : '—'}</b></div>
    <div class="stat"><span class="muted">平均蛋白</span><b>${ks.length ? r0(avg(t => t.protein)) + ' g' : '—'}</b></div>
    <div class="stat"><span class="muted">热量达标天数</span><b>${hit} / ${ks.length}</b></div>
    <div class="stat"><span class="muted">运动</span><b>${exMin} 分钟</b></div>`;
  // 7 天柱状图：每天吃了多少，虚线是目标和下限；点柱子跳到那天
  const days7 = [...Array(7)].map((_, i) => shift(end, i - 6));
  const max = Math.max(p.target * 1.15, ...days7.map(k => totals(k).kcal));
  const at = (v: number) => `bottom:calc(22px + (100% - 42px) * ${v / max})`;
  $('weekChart').innerHTML = `<i class="gl t" style="${at(p.target)}"></i><i class="gl f" style="${at(p.floor)}"></i>` +
    days7.map((k, i) => {
      const t = totals(k), has = !!S.days[k]?.foods.length;
      const cls = !has ? 'none' : t.kcal > p.target + 150 ? 'bad' : t.kcal < p.floor && k < end ? 'low' : '';
      return `<button class="wb${k === curDate ? ' on' : ''}" data-d="${k}" title="${k} · ${has ? `${r0(t.kcal)} kcal · 蛋白 ${r0(t.protein)} g` : '没记录'}">
        <span class="wcol"><span class="fill ${cls}" style="--i:${i};height:${has ? t.kcal / max * 100 : 0}%">${has ? `<span class="v">${r0(t.kcal)}</span>` : ''}</span></span>
        <span class="wl">${k === end ? '今天' : '日一二三四五六'[new Date(k + 'T12:00:00').getDay()]}</span></button>`;
    }).join('');
}

let coachOpen = false;
export function initAgent() {
  $('coachMore').onclick = () => { coachOpen = !coachOpen; renderAgent(); };
  $('weekChart').onclick = e => {
    const b = (e.target as Element).closest<HTMLElement>('[data-d]'); if (b) selectDay(b.dataset.d!);
  };
}

// 部署后读 data/log.json（相对当前页面的路径，GitHub Pages 子路径和 Vercel 根路径都对）；
// 读不到就还是手动模式
export async function loadRemote() {
  try {
    const res = await fetch('data/log.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return false;
    const data = await res.json() as Partial<LogData>;
    if (!data.settings || !data.days) return false;
    setState(withDefaults(data));
    setAgentMode(true); document.body.classList.add('agent');
    save(); renderAll();
    return true;
  } catch (e) { return false; }
}
