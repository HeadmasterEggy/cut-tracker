import { S } from './state';
import { shift } from './util';

export function latestWeight() {
  const keys = Object.keys(S.weights).sort();
  return keys.length ? S.weights[keys[keys.length - 1]] : Number(S.settings.start);
}

export interface Plan { w: number; bmr: number; tdee: number; target: number; floor: number; clamped: boolean; protein: number }

/** Mifflin-St Jeor 算基础代谢 → 每日消耗 → 减去缺口（不低于下限） */
export function plan(): Plan {
  const s = S.settings, w = latestWeight();
  const bmr = 10 * w + 6.25 * s.height - 5 * s.age + (s.sex === 'm' ? 5 : -161);
  const tdee = bmr * Number(s.act);
  const floor = s.sex === 'm' ? 1500 : 1200;
  const raw = tdee - Number(s.deficit);
  const target = Math.max(raw, floor);
  return { w, bmr, tdee, target, floor, clamped: raw < floor, protein: w * Number(s.protK) };
}

export interface Totals { kcal: number; protein: number; exMin: number; exKcal: number }

export function totals(ds: string): Totals {
  const d = S.days[ds] || { foods: [], ex: [] };
  return {
    kcal: d.foods.reduce((a, f) => a + f.kcal, 0),
    protein: d.foods.reduce((a, f) => a + f.protein, 0),
    exMin: d.ex.reduce((a, e) => a + (Number(e.min) || 0), 0),
    exKcal: d.ex.reduce((a, e) => a + (Number(e.kcal) || 0), 0),
  };
}

export interface WeightPoint { date: string; w: number; avg: number }

/** 每天体重 + 含当天在内 7 天的平均 */
export function weightSeries(): WeightPoint[] {
  const keys = Object.keys(S.weights).sort();
  return keys.map(k => {
    const from = shift(k, -6);
    const win = keys.filter(x => x >= from && x <= k).map(x => S.weights[x]);
    return { date: k, w: S.weights[k], avg: win.reduce((a, b) => a + b, 0) / win.length };
  });
}
