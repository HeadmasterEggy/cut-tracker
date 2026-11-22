// 「体重」页里的体成分卡：体脂秤最近一次读数、和上一次比、减掉的重量里脂肪占多少
import { S } from '../state';
import { plan } from '../calc';
import type { BodyComp } from '../types';
import { $, r1, r0, shift } from '../util';
import { animateNums, numSpan } from '../anim';

type Key = Exclude<keyof BodyComp, 'time'>;
// good：这个数往哪边走是好事（'dn' 降了好、'up' 涨了好、null 不评价）
interface Tile { k: Key | 'bmi'; name: string; unit: string; dec: number; good: 'dn' | 'up' | null; ref?: string }
const TILES: Tile[] = [
  { k: 'bodyFat', name: '体脂率', unit: '%', dec: 1, good: 'dn', ref: '男性正常约 10–20%' },
  { k: 'fatMass', name: '脂肪量', unit: 'kg', dec: 1, good: 'dn' },
  { k: 'leanMass', name: '去脂体重', unit: 'kg', dec: 1, good: 'up', ref: '减脂时尽量守住' },
  { k: 'muscle', name: '肌肉量', unit: 'kg', dec: 1, good: 'up' },
  { k: 'visceral', name: '内脏脂肪', unit: '级', dec: 0, good: 'dn', ref: '≤ 9 算正常' },
  { k: 'subFat', name: '皮下脂肪', unit: '%', dec: 1, good: 'dn' },
  { k: 'bmi', name: 'BMI', unit: '', dec: 1, good: 'dn', ref: '18.5–24 正常' },
  { k: 'water', name: '水分', unit: '%', dec: 1, good: null },
  { k: 'protein', name: '蛋白质', unit: '%', dec: 1, good: null },
  { k: 'bone', name: '骨量', unit: 'kg', dec: 1, good: null },
  { k: 'bmr', name: '基础代谢', unit: 'kcal', dec: 0, good: null },
];

const wOf = (ds: string, b: BodyComp) => b.weight ?? S.weights[ds];
const val = (ds: string, b: BodyComp, k: Tile['k']): number | undefined => {
  if (k !== 'bmi') return b[k];
  const w = wOf(ds, b), h = Number(S.settings.height) / 100;
  return w && h ? w / (h * h) : undefined;
};

export function renderBody() {
  const all = S.body || {}, ks = Object.keys(all).sort();
  $('wBody').hidden = !ks.length;
  if (!ks.length) return;
  const ds = ks[ks.length - 1], cur = all[ds];
  const pd = ks.length > 1 ? ks[ks.length - 2] : null, prev = pd ? all[pd] : null;
  $('wBodyWhen').textContent = `${ds.slice(5)}${cur.time ? ' ' + cur.time : ''}` + (pd ? ` · 对比 ${pd.slice(5)}` : '');

  // 减掉的是什么：第一次 → 最近一次，体重变化里脂肪和去脂各占多少
  const first = ks[0], f0 = all[first];
  const w0 = wOf(first, f0), w1 = wOf(ds, cur);
  let story = '';
  if (ks.length < 2) {
    story = '再称一次，就能看出减掉的是脂肪还是肌肉。';
  } else if (w0 && w1 && f0.fatMass != null && cur.fatMass != null) {
    const rawDw = w1 - w0, rawDf = cur.fatMass - f0.fatMass;
    const dw = r1(rawDw), df = r1(rawDf), dl = r1(rawDw - rawDf);
    const span = Math.round((new Date(ds).getTime() - new Date(first).getTime()) / 864e5);
    story = `${first.slice(5)} 以来（${span} 天）体重 <b>${sg(dw)} kg</b>，其中脂肪 <b class="${df < 0 ? 'ok' : 'warn'}">${sg(df)} kg</b>、去脂 <b class="${dl < -0.5 ? 'warn' : ''}">${sg(dl)} kg</b>`
      + (dw < 0 && df < 0 ? `，掉的里面约 <b>${r0(Math.min(100, rawDf / rawDw * 100))}%</b> 是脂肪。` : '。');
  }
  $('wBodyStory').innerHTML = story;

  const p = plan();
  $('wBodyGrid').innerHTML = TILES.map(t => {
    const v = val(ds, cur, t.k); if (v == null) return '';
    const pv = prev && pd ? val(pd, prev, t.k) : undefined;
    let tag = '';
    if (pv != null) {
      const dl = Number((v - pv).toFixed(t.dec || 1));
      const cls = dl === 0 || !t.good ? 'eq' : (dl < 0) === (t.good === 'dn') ? 'dn' : 'up';
      tag = `<span class="delta ${cls}">${dl === 0 ? '持平' : sg(dl)}</span>`;
    }
    const ref = t.k === 'bmr' ? `秤算的；网页公式 ${r0(p.bmr)}` : t.ref || '';
    return `<div class="stat bc"><span class="muted">${t.name}</span><b>${numSpan(v, t.dec)}<small>${t.unit}</small></b>${tag}${ref ? `<em>${ref}</em>` : ''}</div>`;
  }).join('');
  animateNums($('wBodyGrid'));
  drawBodyChart(ks);
}

const sg = (n: number) => (n > 0 ? '+' : '') + n;

// 两次以上：体脂率趋势小图
function drawBodyChart(ks: string[]) {
  const pts = ks.map(k => ({ d: k, v: S.body![k].bodyFat })).filter((x): x is { d: string; v: number } => x.v != null);
  const el = $('wBodyChart');
  el.hidden = pts.length < 2;
  if (pts.length < 2) return;
  const W = 600, H = 130, P = { l: 34, r: 12, t: 12, b: 26 };
  const T = (d: string) => new Date(d + 'T12:00:00').getTime();
  const t0 = T(pts[0].d), t1 = Math.max(T(pts[pts.length - 1].d), T(shift(pts[0].d, 1)));
  const lo = Math.floor(Math.min(...pts.map(p => p.v)) - 0.5), hi = Math.ceil(Math.max(...pts.map(p => p.v)) + 0.5);
  const x = (d: string) => P.l + (T(d) - t0) / (t1 - t0) * (W - P.l - P.r);
  const y = (v: number) => P.t + (hi - v) / (hi - lo) * (H - P.t - P.b);
  let g = `<text x="4" y="${y(hi) + 4}">${hi}%</text><text x="4" y="${y(lo) + 4}">${lo}%</text>`;
  g += `<polyline class="trend" pathLength="1" fill="none" stroke="#b197fc" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="${pts.map(p => `${x(p.d)},${y(p.v)}`).join(' ')}"/>`;
  g += pts.map(p => `<circle cx="${x(p.d)}" cy="${y(p.v)}" r="3.5" fill="#b197fc"><title>${p.d} · ${p.v}%</title></circle>`).join('');
  g += `<text x="${P.l}" y="${H - 6}">${pts[0].d.slice(5)}</text><text x="${W - P.r}" y="${H - 6}" text-anchor="end">${pts[pts.length - 1].d.slice(5)}</text>`;
  el.innerHTML = `<div class="muted" style="margin-bottom:4px">体脂率趋势</div><svg viewBox="0 0 ${W} ${H}" width="100%">${g}</svg>`;
}
