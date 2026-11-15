import { renderToday } from './views/today';
import { renderWeight } from './views/weight';
import { renderLib } from './views/foods';
import { renderSettings } from './views/settings';

export function renderAll() { renderToday(); renderWeight(); renderLib(); renderSettings(); }
