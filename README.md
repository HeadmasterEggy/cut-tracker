# 减脂记录 cut-tracker

一个手机友好的减脂饮食 + 运动 + 体重记录网页（Vite + TypeScript）。

- **今天**：按食物库快速记录饮食，实时显示还能吃多少热量、蛋白质进度；记录运动（只记录，不加回热量）；一键复制当天汇总
- **体重**：每日体重 + 7 天平均趋势图，按最近速度预测到达目标的日期
- **食物库**：按包装标签增改食物（每 100g / 每个 / 每份）
- **设置**：用 Mifflin-St Jeor 公式算基础代谢和每日消耗，按热量缺口给出每日目标（男性不低于 1500 kcal）

## 两种用法

- **Claude 记账（默认）**：数据在 `data/log.json`。把吃了什么、体重、运动直接发给 Claude（文字或照片），Claude 用 `tools/log.py` 记进去并推送，网页（GitHub Pages）读取它做仪表盘，顶部显示 Claude 的点评。这时网页上的输入框都会隐藏。规则见 `CLAUDE.md`。
- **手动记录**：读不到 `data/log.json` 时就是原来的手动模式，数据存在浏览器 localStorage，可导出 / 导入 JSON 备份。

注意：仓库是公开的，`data/log.json` 里的饮食和体重别人也能看到。

## 使用

手机 Safari 打开 https://qiao1.top/cut-tracker/ ，“分享 → 添加到主屏幕”。

本地开发：`npm ci`，然后 `npm run dev`；`npm run build` 打包到 `dist/`。现在要打包才能跑，不能再直接双击 `index.html` 打开。
