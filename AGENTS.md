# 给 AI agent 的仓库规则

这是 Joey 的减脂记录网页：一个 `index.html`，GitHub Pages 发布到 https://qiao1.top/cut-tracker/ 。
Claude、Codex 等所有 agent 都按这份做（Claude Code 通过 `.claude/CLAUDE.md` 引入这份）。记账（`data/log.json`）的具体规则在根目录 `CLAUDE.md`。

## 沟通

- Joey 用中文写，回复也用中文，简短口语，先说结果。
- 需要 Joey 点头的事（合并 PR、删他电脑上的文件、改线上设置）在第一条消息里一次问完，给一句他能直接回的话。
- Joey 说「以后都……」的长期规则，当场写进这个文件，不要只记在对话里。

## 提交和分支

- **只改数据**（`data/log.json`，通过 `tools/log.py`）直接提交推送到 `main`；**改代码**（`index.html`、`tools/`、CI）一律走 PR，由 Joey 合并。
- 一个 PR 一个 worktree：`git fetch origin && git worktree add -b <分支> ../<目录> origin/main`。
  不在装着别的分支改动的目录里 `checkout -b`，不用 stash 搬改动；开新分支前先 fetch，否则 diff 会「回滚」刚合进去的 PR。
- 只改和任务有关的行。不要整文件重新格式化或重排 `index.html`：它是单文件，几个 PR 同时在改，整文件改动会和所有开着的 PR 冲突。
- 合并前看一眼 PR 的检查都是绿的；有红的不合，也不要让 Joey 合。

## 改界面

- 改了界面就用浏览器截图看过再说「好了」：手机宽度（390px）和电脑宽度（1440px）各一张，贴进 PR。
- 界面上写着会做的事，必须有代码真的在做。做不到就别写那句文案。
- 网页是只读仪表盘，数据都从 `data/log.json` 来，不在网页里加写数据的功能。仓库是公开的，记进去的东西任何人都能看到。

## 证据要诚实

- 跑了什么命令、结果是什么，照实写。没跑的检查写「没跑」，绝不写「通过」。
- 修 bug 时，尽量加一条在旧代码上会变红的检查（`tools/check.py` 里加一条、或之后的 lint/类型），在旧代码上跑一次确认它真会红。
  实在抓不住的（比如估算热量的措辞），在 PR 里写一句为什么。
- 新加的检查要故意违反一次，看它会红、报错信息能告诉人怎么修。

## 检查

```
python3 tools/check.py        # 校验 data/log.json 结构 + index.html 里的 JS 语法
```

CI（`.github/workflows/check.yml`）在每个 PR 和每次推到 `main` 时跑同一条。直接推到 `main` 的记账提交如果把 JSON 写坏了，
GitHub 上会出现红叉：马上用 `tools/log.py` 修好再推，网页在修好前读不到数据。

## 之后

页面会迁到 Vite + TypeScript。到时候再加：类型检查、ESLint、只格式化改动文件的 prettier 检查，并把 `tools/check.py` 的 JS 语法检查换成 `tsc`。
