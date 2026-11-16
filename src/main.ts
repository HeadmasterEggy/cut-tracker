import './style.css';
import { S, agentMode } from './state';
import { $, toast } from './util';
import { RM, initGlobalEffects, resetRing, retrigger } from './anim';
import { renderAll } from './render';
import { goDay, initToday, kcalRing, proteinRing } from './views/today';
import { initWeight } from './views/weight';
import { initFoods } from './views/foods';
import { initSettings } from './views/settings';
import { initBackup } from './views/backup';
import { initAgent, loadRemote } from './views/agent';

initGlobalEffects();
initToday();
initWeight();
initFoods();
initSettings();
initBackup();
initAgent();

// ---------- 导航 ----------
// 导航指示块跟随当前按钮（手机底栏 / 电脑侧栏通用）
function moveInd() {
  const b = document.querySelector<HTMLElement>('nav button.on')!, ind = $('navInd');
  ind.style.transform = `translate(${b.offsetLeft}px, ${b.offsetTop}px)`;
  ind.style.width = b.offsetWidth + 'px'; ind.style.height = b.offsetHeight + 'px';
}
addEventListener('resize', () => { const ind = $('navInd'); ind.style.transition = 'none'; moveInd(); void ind.offsetWidth; ind.style.transition = ''; });
// 电脑上用方向键切换日期
addEventListener('keydown', e => {
  if (!$('tab-today').classList.contains('on') || (e.target as Element).closest('input, select, textarea')) return;
  if (e.key === 'ArrowLeft') goDay(-1); else if (e.key === 'ArrowRight') goDay(1);
});
document.querySelectorAll('.tab').forEach(t => t.querySelectorAll<HTMLElement>('.card').forEach((c, i) => c.style.setProperty('--i', String(i))));
document.querySelector('nav')!.onclick = e => {
  const b = (e.target as Element).closest<HTMLElement>('[data-tab]'); if (!b) return;
  const t = b.dataset.tab;
  if (b.classList.contains('on')) { window.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' }); return; }
  document.querySelectorAll('nav button').forEach(x => x.classList.toggle('on', x === b));
  retrigger(b, 'bounce');
  $('pageTitle').textContent = (b.textContent ?? '').trim();
  moveInd();
  document.querySelectorAll('.tab').forEach(s => s.classList.toggle('on', s.id === 'tab-' + t));
  if (t === 'today') { resetRing(kcalRing()); resetRing(proteinRing()); }
  $('toast').classList.remove('on');
  renderAll(); window.scrollTo(0, 0);
};

renderAll(); moveInd();
loadRemote().then(ok => {
  if (!ok && !S.setupDone) {
    document.querySelector<HTMLElement>('nav button[data-tab="settings"]')!.click();
    toast('先填一下身体数据');
  }
});
// 回到页面时刷新一下，拿到 Claude 刚记的
document.addEventListener('visibilitychange', () => { if (!document.hidden && agentMode) loadRemote(); });
