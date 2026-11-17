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

export interface Macros { protein: number; fat: number; carbs: number }

/** 每天三大营养素目标：蛋白按设置的 g/kg，脂肪 0.8 g/kg 体重，剩下的热量给碳水 */
export const FAT_PER_KG = 0.8;
export function macros(p: Plan): Macros {
  const fat = p.w * FAT_PER_KG;
  const carbs = Math.max(0, (p.target - p.protein * 4 - fat * 9) / 4);
  return { protein: p.protein, fat, carbs };
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

/** 1 kg 脂肪约 7700 kcal */
export const KCAL_PER_KG = 7700;

export interface DeficitPlan {
  goalDate: string; daysLeft: number; // 含今天
  remaining: number; // 还差的总缺口（现在体重 → 目标）
  total: number; done: number; // 起始 → 目标的总缺口、已完成（按体重）
  perDay: number; // 每天需要的缺口
  maxPerDay: number; // 吃到下限时每天最多的缺口
  projected: number; // 按下限吃到截止日大约的体重
}

/** 离目标还差多少热量缺口、每天要缺多少。没设截止日期返回 null */
export function deficitPlan(from: string): DeficitPlan | null {
  const gd = S.settings.goalDate; if (!gd) return null;
  const p = plan(), goal = Number(S.settings.goal), start = Number(S.settings.start);
  const daysLeft = Math.round((new Date(gd + 'T12:00:00').getTime() - new Date(from + 'T12:00:00').getTime()) / 864e5) + 1;
  const remaining = Math.max(0, (p.w - goal) * KCAL_PER_KG);
  const total = Math.max(0, (start - goal) * KCAL_PER_KG);
  const maxPerDay = Math.max(0, p.tdee - p.floor);
  return {
    goalDate: gd, daysLeft, remaining, total, done: Math.max(0, Math.min(total, total - remaining)),
    perDay: daysLeft > 0 ? remaining / daysLeft : 0, maxPerDay,
    projected: Math.max(goal, p.w - maxPerDay * Math.max(0, daysLeft) / KCAL_PER_KG),
  };
}
