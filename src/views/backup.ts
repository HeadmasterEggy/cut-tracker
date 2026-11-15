// 手动模式的导出 / 导入 / 合并导入
import { S, day, save, setState, withDefaults } from '../state';
import { $, $in, today, toast } from '../util';
import { renderAll } from '../render';
import type { State } from '../types';

// 合并：同一天里同样的记录按条数补齐（同一天吃两次牛肉也能保留两条）
function mergeList<T>(cur: T[], add: T[], key: (x: T) => string) {
  const left: Record<string, number> = {};
  cur.forEach(x => { const k = key(x); left[k] = (left[k] || 0) + 1; });
  let n = 0;
  add.forEach(x => { const k = key(x); if (left[k] > 0) left[k]--; else { cur.push(x); n++; } });
  return n;
}
function mergeData(data: Partial<State>) {
  let nf = 0, nl = 0, nw = 0;
  if (!S.setupDone && data.setupDone && data.settings) { S.settings = data.settings; S.setupDone = true; }
  (data.foods || []).forEach(f => { if (!S.foods.some(x => x.name === f.name)) { S.foods.push(f); nl++; } });
  const days = data.days || {}, weights = data.weights || {};
  Object.keys(days).forEach(ds => {
    const src = days[ds], d = day(ds);
    nf += mergeList(d.foods, src.foods || [], f => `${f.label || f.name}|${f.kcal}|${f.protein}`);
    nf += mergeList(d.ex, src.ex || [], e => `${e.type}|${e.min}|${e.kcal}`);
  });
  Object.keys(weights).forEach(ds => { if (S.weights[ds] == null) { S.weights[ds] = weights[ds]; nw++; } });
  return `已合并：${nf} 条记录、${nl} 种食物、${nw} 个体重`;
}

export function initBackup() {
  $('exportBtn').onclick = () => {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `cut-tracker-${today()}.json`; a.click();
  };
  let importMode: 'replace' | 'merge' = 'replace';
  $('importBtn').onclick = () => { importMode = 'replace'; $('importFile').click(); };
  $('mergeBtn').onclick = () => { importMode = 'merge'; $('importFile').click(); };
  $in('importFile').onchange = async e => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as Partial<State>;
      input.value = '';  // 同一个文件可以再选一次
      if (!data.settings || !data.days) throw new Error();
      if (importMode === 'merge') { const msg = mergeData(data); save(); renderAll(); toast(msg); return; }
      if (!confirm('导入会覆盖当前数据，继续？')) return;
      setState(withDefaults(data)); save(); renderAll(); toast('已导入');
    } catch (err) { toast('文件格式不对'); }
  };
}
