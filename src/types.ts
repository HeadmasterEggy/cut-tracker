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
  fatK?: number; // 脂肪 g / kg 体重，不写就是 0.8
  goalDate?: string; // YYYY-MM-DD
}

/** 食物库里的一项：每 per 个 unit 有多少 kcal / 蛋白（脂肪、碳水是后加的，旧条目可能没有） */
export interface LibFood {
  name: string;
  per: number;
  unit: string;
  kcal: number;
  protein: number;
  fat?: number;
  carbs?: number;
}

/** 某天吃的一条 */
export interface FoodEntry {
  name?: string;
  label?: string;
  kcal: number;
  protein: number;
  fat?: number; // g，没记就是 undefined
  carbs?: number; // g
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

/** 体脂秤的一次读数。秤给什么记什么，全部可选（tools/log.py body 写入） */
export interface BodyComp {
  time?: string; // 称的时间 HH:MM
  weight?: number; // 那次秤上的体重 kg（没写就用 weights 里当天的）
  bodyFat?: number; // 体脂率 %
  fatMass?: number; // 脂肪量 kg
  leanMass?: number; // 去脂体重 kg
  muscle?: number; // 肌肉量 kg
  water?: number; // 水分 %
  bone?: number; // 骨量 kg
  bmr?: number; // 秤算的基础代谢 kcal
  protein?: number; // 蛋白质率 %
  visceral?: number; // 内脏脂肪等级
  subFat?: number; // 皮下脂肪率 %
}

/** 'YYYY-MM-DD' 日期字符串 */
export type DateStr = string;

export interface LogData {
  settings: Settings;
  foods: LibFood[];
  days: Record<DateStr, Day>;
  weights: Record<DateStr, number>;
  body?: Record<DateStr, BodyComp>; // 体脂秤读数，一天一条（同一天再称会覆盖）
  coach?: Coach;
}

/** 网页运行时的状态：log.json 加上手动模式才有的字段 */
export interface State extends LogData {
  setupDone: boolean;
}
