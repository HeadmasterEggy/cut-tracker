// 「食物库」页
import { S, save } from '../state';
import { $, $in, $sel, esc, toast } from '../util';
import { RM, applyFlash, flashBtn, removeAnimated, retrigger, setFlash, shakeEl } from '../anim';
import { renderFoodPicker } from './today';
import type { LibFood } from '../types';

export function renderLib() {
  $('libList').innerHTML = S.foods.map((f, i) => `
    <li><span class="name" data-edit="${i}" style="cursor:pointer">${esc(f.name)}<br>
      <span class="muted">每 ${f.per}${f.unit}</span></span>
      <span class="num">${f.kcal} kcal<br><span class="muted">${f.protein}g 蛋白</span></span>
      <button class="del" data-lib="${i}" aria-label="删除">×</button></li>`).join('');
  applyFlash('libList');
}

export function initFoods() {
  $('libList').onclick = e => {
    const b = (e.target as Element).closest<HTMLElement>('[data-lib]');
    if (b) {
      const i = Number(b.dataset.lib);
      removeAnimated(b.closest('li'), () => {
        const [f] = S.foods.splice(i, 1); save(); renderLib(); renderFoodPicker();
        toast(`已删除「${f.name}」`, { action: '撤销', fn: () => {
          S.foods.splice(i, 0, f); save(); setFlash({ list: 'libList', nth: i + 1 }); renderLib(); renderFoodPicker();
        } });
      });
      return;
    }
    const el = (e.target as Element).closest<HTMLElement>('[data-edit]'); if (!el) return;
    const f = S.foods[Number(el.dataset.edit)];
    $in('lName').value = f.name; $in('lPer').value = String(f.per); $sel('lUnit').value = f.unit;
    $in('lKcal').value = String(f.kcal); $in('lProt').value = String(f.protein);
    $('lName').scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' });
    setTimeout(() => retrigger($('lName').closest('.card')!, 'pulse'), 250);
  };
  $('saveLib').onclick = () => {
    const f: LibFood = {
      name: $in('lName').value.trim(), per: Number($in('lPer').value), unit: $sel('lUnit').value,
      kcal: Number($in('lKcal').value), protein: Number($in('lProt').value) || 0,
    };
    if (!f.name) return shakeEl('lName', '名称、数量、热量要填');
    if (!(f.per > 0)) return shakeEl('lPer', '名称、数量、热量要填');
    if ($in('lKcal').value === '') return shakeEl('lKcal', '名称、数量、热量要填');
    let i = S.foods.findIndex(x => x.name === f.name);
    if (i >= 0) S.foods[i] = f; else i = S.foods.push(f) - 1;
    ['lName', 'lKcal', 'lProt'].forEach(id => $in(id).value = ''); $in('lPer').value = '100';
    setFlash({ list: 'libList', nth: i + 1, scroll: true });
    save(); renderLib(); renderFoodPicker(); flashBtn($('saveLib'), '✓ 已保存');
  };
}
