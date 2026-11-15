// 仪表盘模式（Claude 记账）：读 data/log.json，显示点评和最近 7 天
import { S, agentMode, save, setAgentMode, setState, withDefaults } from '../state';
import { plan, totals } from '../calc';
import { $, r0, shift, today } from '../util';
import type { LogData } from '../types';
import { renderAll } from '../render';

export function renderAgent() {
  if (!agentMode) return;
  const c = S.coach;
  $('coachText').textContent = c?.text || '还没有点评';
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
