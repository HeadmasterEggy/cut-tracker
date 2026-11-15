export const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));

export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
export const $in = (id: string) => $<HTMLInputElement>(id);
export const $sel = (id: string) => $<HTMLSelectElement>(id);

export const r1 = (n: number) => Math.round(n * 10) / 10;
export const r0 = (n: number) => Math.round(n);
export function pad(n: number) { return String(n).padStart(2, '0'); }
export function fmt(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function today() { return fmt(new Date()); }
export function shift(ds: string, n: number) { const d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() + n); return fmt(d); }

export function esc(s: unknown) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string, opt: { action?: string; fn?: () => void } = {}) {
  const t = $('toast');
  t.innerHTML = `<span>${esc(msg)}</span>` + (opt.action ? `<button>${esc(opt.action)}</button>` : '');
  if (opt.action) t.querySelector('button')!.onclick = () => { t.classList.remove('on'); opt.fn?.(); };
  t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), opt.action ? 4000 : 1600);
}
