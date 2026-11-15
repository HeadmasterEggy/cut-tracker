#!/usr/bin/env python3
"""仓库检查：data/log.json 的结构，以及 TypeScript 类型检查（tsc）。

用法：python3 tools/check.py
全部通过 exit 0；有问题逐条打印「哪里 + 该怎么改」并 exit 1。
类型检查需要先 npm ci；没装依赖时会明确说「没跑」，不算通过。
"""
import json, shutil, subprocess, sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
errors = []


def err(where, msg):
    errors.append(f"{where}: {msg}")


def is_num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def is_date(s):
    try:
        return isinstance(s, str) and date.fromisoformat(s).isoformat() == s
    except ValueError:
        return False


def check_num(where, v, lo, hi):
    if not is_num(v):
        err(where, f"应该是数字，现在是 {v!r}")
    elif not lo <= v <= hi:
        err(where, f"{v} 不在合理范围 {lo}–{hi}")


def check_log():
    path = ROOT / "data" / "log.json"
    if not path.exists():
        print("data/log.json 不存在，跳过数据检查")
        return
    try:
        d = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        err("data/log.json", f"不是合法 JSON（第 {e.lineno} 行第 {e.colno} 列：{e.msg}）。用 tools/log.py 改，不要手写")
        return
    if not isinstance(d, dict):
        err("data/log.json", "顶层应该是对象")
        return
    for k in ("settings", "foods", "days", "weights"):
        if k not in d:
            err("data/log.json", f"缺少顶层字段 {k!r}")

    s = d.get("settings", {})
    if not isinstance(s, dict):
        err("settings", "应该是对象")
        s = {}
    if "settings" in d:
        if s.get("sex") not in ("m", "f"):
            err("settings.sex", f"应该是 'm' 或 'f'，现在是 {s.get('sex')!r}")
        check_num("settings.age", s.get("age"), 10, 100)
        check_num("settings.height", s.get("height"), 100, 250)
        check_num("settings.start", s.get("start"), 30, 300)
        check_num("settings.goal", s.get("goal"), 30, 300)
        check_num("settings.deficit", s.get("deficit"), 0, 1500)
        check_num("settings.protK", s.get("protK"), 0.5, 3.5)
        try:
            check_num("settings.act", float(s.get("act")), 1.0, 2.5)
        except (TypeError, ValueError):
            err("settings.act", f"应该是数字，现在是 {s.get('act')!r}")
        if "goalDate" in s and not is_date(s["goalDate"]):
            err("settings.goalDate", f"应该是 YYYY-MM-DD，现在是 {s['goalDate']!r}")

    names = set()
    for i, f in enumerate(d.get("foods", [])):
        w = f"foods[{i}]"
        if not isinstance(f, dict):
            err(w, "应该是对象")
            continue
        n = f.get("name")
        if not isinstance(n, str) or not n:
            err(w, "缺少 name")
        elif n in names:
            err(w, f"食物库名字重复：{n!r}（addlib 会覆盖同名项，手改才会出现重复）")
        names.add(n)
        check_num(f"{w}.per", f.get("per"), 0.01, 10000)
        if not isinstance(f.get("unit"), str) or not f.get("unit"):
            err(w, "缺少 unit")
        check_num(f"{w}.kcal", f.get("kcal"), 0, 2000)
        check_num(f"{w}.protein", f.get("protein"), 0, 200)

    days = d.get("days", {})
    if not isinstance(days, dict):
        err("days", "应该是 {日期: {...}} 对象")
        days = {}
    for ds, x in days.items():
        w = f"days[{ds}]"
        if not is_date(ds):
            err(w, "键应该是 YYYY-MM-DD 日期")
        if not isinstance(x, dict):
            err(w, "应该是对象")
            continue
        for j, f in enumerate(x.get("foods", []), 1):
            fw = f"{w}.foods 第 {j} 条"
            if not isinstance(f, dict):
                err(fw, "应该是对象")
                continue
            if not (f.get("label") or f.get("name")):
                err(fw, "缺少 name/label，网页上会显示成空白")
            check_num(f"{fw}.kcal", f.get("kcal"), 0, 5000)
            check_num(f"{fw}.protein", f.get("protein"), 0, 400)
        for j, e in enumerate(x.get("ex", []), 1):
            ew = f"{w}.ex 第 {j} 条"
            if not isinstance(e, dict):
                err(ew, "应该是对象")
                continue
            if not isinstance(e.get("type"), str) or not e.get("type"):
                err(ew, "缺少 type")
            check_num(f"{ew}.min", e.get("min"), 0, 600)
            if "kcal" in e:
                check_num(f"{ew}.kcal", e["kcal"], 0, 5000)
        total = sum(f.get("kcal", 0) for f in x.get("foods", []) if isinstance(f, dict) and is_num(f.get("kcal")))
        if total > 8000:
            err(w, f"当天合计 {total:.0f} kcal，多半是多打了一个 0")

    ws = d.get("weights", {})
    if not isinstance(ws, dict):
        err("weights", "应该是 {日期: 体重} 对象")
        ws = {}
    for ds, v in ws.items():
        if not is_date(ds):
            err(f"weights[{ds}]", "键应该是 YYYY-MM-DD 日期")
        check_num(f"weights[{ds}]", v, 30, 300)

    if "coach" in d:
        c = d["coach"]
        if not isinstance(c, dict) or not isinstance(c.get("text"), str):
            err("coach", "应该是 {updated, text} 对象")


def check_ts():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    if 'src="./src/main.ts"' not in html:
        err("index.html", '找不到 <script type="module" src="./src/main.ts">，页面不会加载任何代码')
    tsc = ROOT / "node_modules" / ".bin" / "tsc"
    if not shutil.which("node") or not tsc.exists():
        print("没跑：TypeScript 类型检查（没装 node 或没 npm ci）")
        return
    r = subprocess.run([str(tsc), "--noEmit", "--pretty", "false"], cwd=ROOT, capture_output=True, text=True)
    if r.returncode:
        out = (r.stdout + r.stderr).strip()
        hint = ""
        if "data/log.json" in out or "data-shape.ts" in out:
            hint = "\n（data-shape.ts 报错 = data/log.json 的结构和 src/types.ts 的 LogData 对不上：用 tools/log.py 修数据，或者确实要加字段就改 types.ts）"
        err("tsc", "类型检查没过：\n" + out + hint)


check_log()
check_ts()
if errors:
    print(f"{len(errors)} 个问题：")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print("全部通过")
