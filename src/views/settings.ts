// 「设置」页：身体数据 → 计算结果
import { S, save } from '../state';
import { plan } from '../calc';
import { $, $in, r0, r1 } from '../util';
import { animateNums, flashBtn, numSpan, retrigger } from '../anim';
import { renderToday } from './today';
import type { Settings } from '../types';

const SET_FIELDS = { sSex: 'sex', sAge: 'age', sHeight: 'height', sStart: 'start', sGoal: 'goal', sAct: 'act', sDef: 'deficit', sProtK: 'protK' } as const;
const fields = Object.entries(SET_FIELDS) as [string, keyof Settings][];

export function renderSettings() {
  for (const [id, k] of fields) $in(id).value = String(S.settings[k]);
  const p = plan();
  $('calcBox').innerHTML = `
    <div class="stat"><span class="muted">基础代谢</span><b>${numSpan(r0(p.bmr))}</b></div>
    <div class="stat"><span class="muted">每天总消耗</span><b>${numSpan(r0(p.tdee))}</b></div>
    <div class="stat"><span class="muted">每天吃</span><b class="ok">${numSpan(r0(p.target))}</b></div>
    <div class="stat"><span class="muted">蛋白质</span><b>${numSpan(r0(p.protein), 0, ' g')}</b></div>`;
  animateNums($('calcBox'));
  const perWeek = (p.tdee - p.target) * 7 / 7700;
  $('calcNote').textContent = `按当前体重 ${r1(p.w)}kg 计算，预计每周减约 ${r1(perWeek)} kg 脂肪。` +
    (p.clamped ? ` 缺口太大，已按最低 ${p.floor} kcal 处理。` : '') +
    (perWeek > 1 ? ' 每周超过 1kg 容易掉肌肉，建议缩小缺口。' : '');
}

export function initSettings() {
  $('saveSet').onclick = () => {
    const s = S.settings as unknown as Record<string, string | number>;
    for (const [id, k] of fields) {
      const v = $in(id).value;
      s[k] = k === 'sex' ? v : Number(v);
    }
    S.setupDone = true; save(); renderSettings(); renderToday(); flashBtn($('saveSet'), '✓ 已保存');
    retrigger($('calcBox').closest('.card')!, 'pulse');
  };
}
