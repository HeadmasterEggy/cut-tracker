#!/usr/bin/env python3
"""记账小工具：改 data/log.json，并算出当天还剩多少额度。

用法（日期不写就是墨尔本时间的今天，写成 YYYY-MM-DD 或 -1 表示昨天）：
  tools/log.py food  "GYG 牛腩 burrito（去芝士）" 690 40 [脂肪 碳水] [--date D] [--name 食物库名]
  tools/log.py lib   "鸡蛋" 3 [--date D]          # 按食物库换算，数量用食物库的单位
  tools/log.py ex    快走 53 [230] [--date D]
  tools/log.py weight 88.3 [--date D]
  tools/log.py rm    food|ex 2 [--date D]         # 删当天第 N 条（从 1 数）
  tools/log.py addlib "名称" 100 g 499 8.2 [脂肪 碳水]  # 新增/更新食物库：每 100g 499kcal 8.2g 蛋白
  tools/log.py macros food|lib N|名称 脂肪 碳水 [--date D]  # 给已有的一条 / 食物库项补上脂肪碳水
脂肪、碳水单位都是 g，可以不写（旧数据没有）；写了就两个都写。
  tools/log.py coach "点评文字"                    # 更新网页顶部的点评
  tools/log.py summary [--date D]                  # 打印当天和最近 7 天情况
"""
import argparse, json, sys
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Australia/Melbourne")
PATH = Path(__file__).resolve().parent.parent / "data" / "log.json"


def now():
    return datetime.now(TZ)


def resolve_date(s):
    if not s:
        return now().date().isoformat()
    if s.lstrip("-").isdigit() and len(s) < 4:
        return (now().date() + timedelta(days=int(s))).isoformat()
    datetime.strptime(s, "%Y-%m-%d")
    return s


def load():
    return json.loads(PATH.read_text())


def save(d):
    PATH.write_text(json.dumps(d, ensure_ascii=False, indent=1) + "\n")


def day(d, ds):
    return d["days"].setdefault(ds, {"foods": [], "ex": []})


def latest_weight(d, upto=None):
    ks = sorted(k for k in d["weights"] if upto is None or k <= upto)
    return d["weights"][ks[-1]] if ks else d["settings"]["start"]


def plan(d, ds=None):
    """和网页里的 plan() 同一个公式。"""
    s = d["settings"]
    w = latest_weight(d, ds)
    bmr = 10 * w + 6.25 * s["height"] - 5 * s["age"] + (5 if s["sex"] == "m" else -161)
    tdee = bmr * float(s["act"])
    floor = 1500 if s["sex"] == "m" else 1200
    return {"w": w, "tdee": tdee, "target": max(tdee - s["deficit"], floor), "floor": floor,
            "protein": w * s["protK"]}


def totals(d, ds):
    x = d["days"].get(ds, {"foods": [], "ex": []})
    return (sum(f["kcal"] for f in x["foods"]), sum(f["protein"] for f in x["foods"]),
            sum(e.get("min", 0) for e in x["ex"]))


def macro_totals(d, ds):
    fs = d["days"].get(ds, {"foods": []})["foods"]
    return (sum(f.get("fat", 0) for f in fs), sum(f.get("carbs", 0) for f in fs),
            sum(1 for f in fs if "fat" not in f or "carbs" not in f))


def macro_plan(p):
    """和网页 calc.ts 的 macros() 同一个公式：脂肪 0.8 g/kg，剩下给碳水。"""
    fat = p["w"] * 0.8
    return fat, max(0, (p["target"] - p["protein"] * 4 - fat * 9) / 4)


def fat_carbs(x, i):
    """x[i], x[i+1] 是可选的 脂肪 碳水；返回 {} 或 {"fat":..,"carbs":..}"""
    if len(x) <= i:
        return {}
    if len(x) < i + 2:
        sys.exit("脂肪和碳水要一起写：... 脂肪 碳水")
    return {"fat": round(float(x[i]), 1), "carbs": round(float(x[i + 1]), 1)}


def summary(d, ds):
    p, (k, pr, m) = plan(d, ds), totals(d, ds)
    print(f"{ds}：已吃 {k:.0f} / {p['target']:.0f} kcal（剩 {p['target'] - k:.0f}），"
          f"蛋白 {pr:.0f} / {p['protein']:.0f} g（差 {max(0, p['protein'] - pr):.0f}），运动 {m} 分钟")
    fa, ca, miss = macro_totals(d, ds)
    gf, gc = macro_plan(p)
    if k:
        print(f"  碳水 {ca:.0f} / {gc:.0f} g，脂肪 {fa:.0f} / {gf:.0f} g" + (f"（{miss} 条没记碳水脂肪）" if miss else ""))
    for i, f in enumerate(d["days"].get(ds, {}).get("foods", []), 1):
        mac = f"  碳水 {f['carbs']:.0f} / 脂肪 {f['fat']:.0f} g" if "fat" in f and "carbs" in f else "  （没记碳水脂肪）"
        print(f"  {i}. {f.get('label') or f['name']}  {f['kcal']:.0f} kcal / {f['protein']:.1f} g" + mac)
    for i, e in enumerate(d["days"].get(ds, {}).get("ex", []), 1):
        print(f"  运动{i}. {e['type']} {e['min']} 分钟" + (f" {e['kcal']} kcal" if e.get("kcal") else ""))
    days = [(datetime.fromisoformat(ds) - timedelta(days=i)).date().isoformat() for i in range(1, 8)]
    logged = [x for x in days if d["days"].get(x, {}).get("foods")]
    if logged:
        ak = sum(totals(d, x)[0] for x in logged) / len(logged)
        ap = sum(totals(d, x)[1] for x in logged) / len(logged)
        print(f"前 7 天（有记录 {len(logged)} 天）平均：{ak:.0f} kcal，蛋白 {ap:.0f} g")
    ws = sorted(d["weights"].items())
    if ws:
        recent = [v for x, v in ws if x > (datetime.fromisoformat(ds) - timedelta(days=7)).date().isoformat() and x <= ds]
        avg = f"，7 天平均 {sum(recent) / len(recent):.1f}" if recent else ""
        print(f"体重：最近 {ws[-1][0]} {ws[-1][1]} kg{avg}，目标 {d['settings']['goal']} kg")
        gd = d["settings"].get("goalDate")
        if gd and recent:
            left = (datetime.fromisoformat(gd) - datetime.fromisoformat(ds)).days
            gap = sum(recent) / len(recent) - d["settings"]["goal"]
            if left > 0 and gap > 0:
                print(f"离 {gd} 还剩 {left} 天，还差 {gap:.1f} kg，需要每周 {gap / left * 7:.1f} kg")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd")
    ap.add_argument("args", nargs="*")
    ap.add_argument("--date")
    ap.add_argument("--name")
    a = ap.parse_args()
    d, ds = load(), resolve_date(a.date)
    c, x = a.cmd, a.args

    if c == "food":
        label, kcal, prot = x[0], float(x[1]), float(x[2])
        day(d, ds)["foods"].append({"name": a.name or label, "label": label,
                                    "kcal": round(kcal, 1), "protein": round(prot, 1), **fat_carbs(x, 3)})
    elif c == "lib":
        f = next((f for f in d["foods"] if f["name"] == x[0]), None)
        if not f:
            sys.exit(f"食物库里没有「{x[0]}」，先用 addlib 加，或用 food 直接记")
        amt = float(x[1])
        e = {"name": f["name"], "label": f"{f['name']} {x[1]}{f['unit']}",
             "kcal": round(f["kcal"] * amt / f["per"], 1),
             "protein": round(f["protein"] * amt / f["per"], 1)}
        if "fat" in f and "carbs" in f:
            e.update(fat=round(f["fat"] * amt / f["per"], 1), carbs=round(f["carbs"] * amt / f["per"], 1))
        day(d, ds)["foods"].append(e)
    elif c == "ex":
        e = {"type": x[0], "min": int(x[1]), "kcal": int(x[2]) if len(x) > 2 else 0}
        day(d, ds)["ex"].append(e)
    elif c == "weight":
        v = float(x[0])
        assert 30 < v < 300, "体重不合理"
        d["weights"][ds] = round(v, 1)
        d["weights"] = dict(sorted(d["weights"].items()))
    elif c == "rm":
        key = {"food": "foods", "ex": "ex"}[x[0]]
        removed = day(d, ds)[key].pop(int(x[1]) - 1)
        print("删掉了：", removed)
    elif c == "addlib":
        f = {"name": x[0], "per": float(x[1]), "unit": x[2], "kcal": float(x[3]), "protein": float(x[4]),
             **fat_carbs(x, 5)}
        d["foods"] = [g for g in d["foods"] if g["name"] != f["name"]] + [f]
    elif c == "macros":
        mc = fat_carbs(x, 2) or sys.exit("用法：macros food|lib N|名称 脂肪 碳水")
        if x[0] == "food":
            day(d, ds)["foods"][int(x[1]) - 1].update(mc)
        else:
            f = next((f for f in d["foods"] if f["name"] == x[1]), None) or sys.exit(f"食物库里没有「{x[1]}」")
            f.update(mc)
    elif c == "coach":
        d["coach"] = {"updated": now().isoformat(timespec="minutes"), "text": x[0]}
    elif c != "summary":
        sys.exit(__doc__)

    d["days"] = dict(sorted(d["days"].items()))
    if c != "summary":
        save(d)
    summary(d, ds)


if __name__ == "__main__":
    main()
