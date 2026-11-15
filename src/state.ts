import type { Day, LibFood, State } from './types';
import { clone, today, toast } from './util';

const KEY = 'cut-tracker-v1';

// 常见食物的估算值（每 per 单位）。按包装标签修改会更准。
export const DEFAULT_FOODS: LibFood[] = [
  { name: '鸡胸肉（熟）', per: 100, unit: 'g', kcal: 165, protein: 31 },
  { name: '牛肉（熟，带点肥）', per: 100, unit: 'g', kcal: 220, protein: 27 },
  { name: '米饭（熟）', per: 100, unit: 'g', kcal: 130, protein: 2.7 },
  { name: '西兰花', per: 100, unit: 'g', kcal: 34, protein: 2.8 },
  { name: '鸡蛋', per: 1, unit: '个', kcal: 70, protein: 6.3 },
  { name: '全脂奶', per: 100, unit: 'ml', kcal: 65, protein: 3.4 },
  { name: '低脂奶', per: 100, unit: 'ml', kcal: 45, protein: 3.6 },
  { name: 'Just Right 麦片', per: 100, unit: 'g', kcal: 363, protein: 8.1 },
  { name: '腰果 / 混合坚果', per: 100, unit: 'g', kcal: 580, protein: 18 },
  { name: '草莓', per: 100, unit: 'g', kcal: 32, protein: 0.7 },
  { name: 'Lean Cuisine 鸡肉意面', per: 1, unit: '份', kcal: 340, protein: 20 },
  { name: '无糖希腊酸奶', per: 100, unit: 'g', kcal: 95, protein: 9 },
  { name: '燕麦片（rolled oats）', per: 100, unit: 'g', kcal: 375, protein: 12 },
  { name: 'Market Lane 果干坚果', per: 100, unit: 'g', kcal: 499, protein: 8.2 },
  { name: 'GYG 牛腩 burrito（去芝士、糙米）', per: 1, unit: '份', kcal: 690, protein: 40 },
];

export const DEFAULT_STATE: State = {
  settings: { sex: 'm', age: 25, height: 175, start: 75, goal: 70, act: 1.375, deficit: 800, protK: 1.8 },
  foods: DEFAULT_FOODS,
  days: {},
  weights: {},
  setupDone: false,
};

/** 用默认值补齐导入 / 远程数据缺的字段 */
export const withDefaults = (data: Partial<State>): State => Object.assign(clone(DEFAULT_STATE), data);

// 下面几个是全局状态。ES 模块导出的 let 是活绑定：别的模块读到的永远是最新值，但只能用 setX() 改。
export let S: State = load();
export let curDate = today();
export let agentMode = false;
export function setState(next: State) { S = next; }
export function setCurDate(ds: string) { curDate = ds; }
export function setAgentMode(on: boolean) { agentMode = on; }

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return withDefaults(JSON.parse(raw));
  } catch (e) {}
  return clone(DEFAULT_STATE);
}
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('保存失败：浏览器存储不可用'); }
}

export function day(ds: string): Day { return S.days[ds] || (S.days[ds] = { foods: [], ex: [] }); }
