// 只给 tsc 看：data/log.json 的结构和 LogData 对不上时，npm run typecheck 会报错。
// 运行时不引用这个文件（网页是 fetch 读 log.json 的）。
import log from '../data/log.json';
import type { LogData, Settings } from './types';

// JSON 里的 sex 会被推断成 string，这里跳过（tools/check.py 会检查是不是 'm' / 'f'）
const { sex: _sex, ...settings } = log.settings;
export const _settings: Omit<Settings, 'sex'> = settings;
export const _rest: Omit<LogData, 'settings'> = log;
