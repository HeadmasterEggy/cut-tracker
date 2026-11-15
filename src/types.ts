// data/log.json 的结构（Claude 用 tools/log.py 写，网页只读）。
// 手动模式下 localStorage 里存的也是同一个结构。

export type Sex = 'm' | 'f';

export interface Settings {
  sex: Sex;
  age: number;
  height: number; // cm
  start: number; // 起始体重 kg
  goal: number; // 目标体重 kg
  act: number | string; // 活动系数；设置页 <select> 里是字符串，用的时候 Number()
  deficit: number; // 每日热量缺口 kcal
  protK: number; // 蛋白质 g / kg 体重
  goalDate?: string; // YYYY-MM-DD
}

/** 食物库里的一项：每 per 个 unit 有多少 kcal / 蛋白 */
export interface LibFood {
  name: string;
  per: number;
  unit: string;
  kcal: number;
  protein: number;
}

/** 某天吃的一条 */
export interface FoodEntry {
  name?: string;
  label?: string;
  kcal: number;
  protein: number;
}

export interface Exercise {
  type: string;
  min: number;
  kcal?: number;
}

export interface Day {
  foods: FoodEntry[];
  ex: Exercise[];
}

export interface Coach {
  updated?: string;
  text: string;
}

/** 'YYYY-MM-DD' 日期字符串 */
export type DateStr = string;

export interface LogData {
  settings: Settings;
  foods: LibFood[];
  days: Record<DateStr, Day>;
  weights: Record<DateStr, number>;
  coach?: Coach;
}

/** 网页运行时的状态：log.json 加上手动模式才有的字段 */
export interface State extends LogData {
  setupDone: boolean;
}
