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


def check_macros(where, f, hi):
    """脂肪、碳水可以都没有（旧数据），有就两个都要有，而且和热量对得上。"""
    has = [k for k in ("fat", "carbs") if k in f]
    if not has:
        return
    if len(has) == 1:
        err(where, f"只有 {has[0]}，脂肪和碳水要一起写（tools/log.py macros ... 脂肪 碳水）")
        return
    check_num(f"{where}.fat", f["fat"], 0, hi)
    check_num(f"{where}.carbs", f["carbs"], 0, hi * 2)
    if all(is_num(f.get(k)) for k in ("kcal", "protein", "fat", "carbs")):
        est = f["protein"] * 4 + f["fat"] * 9 + f["carbs"] * 4
        if f["kcal"] > 50 and abs(est - f["kcal"]) > max(60, f["kcal"] * 0.25):
            err(where, f"蛋白×4 + 脂肪×9 + 碳水×4 = {est:.0f} kcal，和记的 {f['kcal']:.0f} kcal 差太多，多半是脂肪/碳水写反或打错")


# body 里每个字段的合理范围（tools/log.py 的 BODY 表是同一份，改一个要改另一个）
BODY = {"weight": (30, 300), "bodyFat": (3, 60), "fatMass": (1, 150), "leanMass": (20, 150),
        "muscle": (15, 120), "water": (30, 80), "bone": (1, 8), "bmr": (800, 4000),
        "protein": (5, 30), "visceral": (1, 30), "subFat": (3, 60)}


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
        if "fatK" in s:
            check_num("settings.fatK", s.get("fatK"), 0.3, 1.5)
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
        check_macros(w, f, 200)

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
            check_macros(fw, f, 500)
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

    body = d.get("body", {})
    if not isinstance(body, dict):
        err("body", "应该是 {日期: {...}} 对象")
        body = {}
    for ds, b in body.items():
        w = f"body[{ds}]"
        if not is_date(ds):
            err(w, "键应该是 YYYY-MM-DD 日期")
        if not isinstance(b, dict):
            err(w, "应该是对象（tools/log.py body bf=... fat=...）")
            continue
        for k, v in b.items():
            if k == "time":
                if not (isinstance(v, str) and len(v) == 5 and v[2] == ":" and v.replace(":", "").isdigit()):
                    err(f"{w}.time", f"应该是 HH:MM，现在是 {v!r}")
            elif k in BODY:
                check_num(f"{w}.{k}", v, *BODY[k])
            else:
                err(w, f"不认识的字段 {k!r}，可以有：time, " + ", ".join(BODY) + "（加新字段要同时改 src/types.ts 的 BodyComp）")
        bw = b.get("weight", ws.get(ds))
        if all(is_num(x) for x in (bw, b.get("fatMass"), b.get("leanMass"))) and abs(b["fatMass"] + b["leanMass"] - bw) > 1:
            err(w, f"脂肪 {b['fatMass']} + 去脂 {b['leanMass']} = {b['fatMass'] + b['leanMass']:.2f} kg，和体重 {bw} 差超过 1 kg，多半打错了")
        if all(is_num(x) for x in (bw, b.get("fatMass"), b.get("bodyFat"))) and abs(b["fatMass"] / bw * 100 - b["bodyFat"]) > 1.5:
            err(w, f"脂肪 {b['fatMass']} kg ÷ 体重 {bw} = {b['fatMass'] / bw * 100:.1f}%，和体脂率 {b['bodyFat']}% 对不上，多半打错了")

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
