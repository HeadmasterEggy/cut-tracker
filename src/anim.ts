import { $, toast } from './util';

// 动画用到的、挂在元素上的临时状态
type Anim = { _v?: number; _raf?: number; _init?: boolean; _off?: number; _txt?: string; _t?: ReturnType<typeof setTimeout> };
const A = <T extends Element>(el: T) => el as T & Anim;

export const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
// 环形用 pathLength="100"，周长按 100 算
const RING_C = 100;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export function countTo(node: HTMLElement, to: number, fmt: (v: number) => string | number, dur = 700) {
  const el = A(node);
  const from = el._v === undefined ? 0 : el._v;
  el._v = to; cancelAnimationFrame(el._raf!);
  if (RM || from === to) { el.textContent = String(fmt(to)); return; }
  const t0 = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / dur);
    el.textContent = String(fmt(from + (to - from) * ease(k)));
    if (k < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}
export function animateNums(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-num]').forEach(el => {
    const dec = Number(el.dataset.dec || 0), sfx = el.dataset.sfx || '';
    A(el)._v = 0; countTo(el, Number(el.dataset.num), v => (dec ? v.toFixed(dec) : Math.round(v)) + sfx, 800);
  });
}
export const numSpan = (v: number, dec = 0, sfx = '') =>
  `<span data-num="${v}" data-dec="${dec}" data-sfx="${sfx}">${dec ? Number(v).toFixed(dec) : Math.round(v)}${sfx}</span>`;

export function setRing(node: SVGElement, pct: number, color: string) {
  const el = A(node);
  el.style.stroke = color;
  const off = RING_C * (1 - Math.max(0, Math.min(1, pct)));
  if (!el._init) { el._init = true; requestAnimationFrame(() => requestAnimationFrame(() => el.style.strokeDashoffset = String(el._off))); }
  else el.style.strokeDashoffset = String(off);
  el._off = off;
}
export function resetRing(node: SVGElement) {
  const el = A(node);
  el.style.transition = 'none'; el.style.strokeDashoffset = String(RING_C); void el.getBoundingClientRect();
  el.style.transition = ''; el._init = false;
}
export function retrigger(el: Element, cls: string) { el.classList.remove(cls); void (el as HTMLElement).offsetWidth; el.classList.add(cls); }
export function shakeEl(id: string, msg: string) {
  const el = $(id); retrigger(el, 'shake'); setTimeout(() => el.classList.remove('shake'), 500); el.focus(); toast(msg);
}
export function floatText(parent: HTMLElement, text: string, color: string) {
  if (RM) return;
  const f = document.createElement('span'); f.className = 'floaty'; f.textContent = text; f.style.color = color;
  parent.appendChild(f); setTimeout(() => f.remove(), 1200);
}
export function flashBtn(node: HTMLElement, text: string) {
  const btn = A(node);
  if (!btn._txt) btn._txt = btn.textContent ?? '';
  btn.textContent = text; retrigger(btn, 'done-flash');
  clearTimeout(btn._t); btn._t = setTimeout(() => { btn.textContent = btn._txt!; btn.classList.remove('done-flash'); }, 900);
}
export function confetti(el: Element) {
  if (RM) return;
  const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const colors = ['#22c55e', '#38bdf8', '#f59e0b', '#f472b6', '#a78bfa', '#facc15'];
  for (let i = 0; i < 28; i++) {
    const c = document.createElement('i'); c.className = 'confetti';
    const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 90;
    c.style.cssText = `left:${cx}px;top:${cy}px;background:${colors[i % colors.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d + 40}px;--rot:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * 80}ms`;
    document.body.appendChild(c); setTimeout(() => c.remove(), 1200);
  }
}
// 删除时先收起再真正删除
export function removeAnimated(li: HTMLElement | null, done: () => void) {
  if (!li || RM) return done();
  li.style.height = li.offsetHeight + 'px'; void li.offsetHeight;
  li.classList.add('leaving'); li.querySelectorAll('button').forEach(b => b.disabled = true);
  setTimeout(done, 300);
}

// 渲染后高亮刚加的那一条：nth 是第几条（从 1 数），或者用 sel 选
type Flash = { list: string; nth?: number; sel?: string; scroll?: boolean };
let flash: Flash | null = null;
export function setFlash(f: Flash) { flash = f; }
export function applyFlash(listId: string) {
  if (!flash || flash.list !== listId) return;
  const ul = $(listId);
  const li = flash.nth ? ul.children[flash.nth - 1] : ul.querySelector(flash.sel!)?.closest('li');
  if (li) { li.classList.add('enter'); if (flash.scroll) li.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'nearest' }); }
  flash = null;
}
export function staggerList(ul: HTMLElement) {
  [...ul.children].forEach((li, i) => (li as HTMLElement).style.setProperty('--i', String(Math.min(i, 12))));
  retrigger(ul, 'stagger'); setTimeout(() => ul.classList.remove('stagger'), 900);
}

// 按钮涟漪 + 滚动后顶栏加阴影
export function initGlobalEffects() {
  document.addEventListener('pointerdown', e => {
    const b = (e.target as Element).closest('button'); if (!b || RM || b.classList.contains('del') || b.closest('nav')) return;
    const r = b.getBoundingClientRect(), size = Math.max(r.width, r.height);
    const s = document.createElement('span'); s.className = 'ripple';
    s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    b.appendChild(s); setTimeout(() => s.remove(), 650);
  });
  addEventListener('scroll', () => document.querySelector('header')!.classList.toggle('scrolled', scrollY > 4), { passive: true });
}
