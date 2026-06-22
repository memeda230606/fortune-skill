#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
liuyao-chart.py — 六爻纳甲起卦脚本（基于 bopo/najia）

用法:
python3 scripts/liuyao-chart.py --method manual --lines "6,7,8,9,8,7" \
  --datetime "YYYY-MM-DD HH:mm" --place "城市" --question "占问事项"

python3 scripts/liuyao-chart.py --method time \
  --datetime "YYYY-MM-DD HH:mm" --place "城市" --question "占问事项"

输出: JSON 到 stdout，日志到 stderr。
"""

import argparse
import calendar
import json
import os
import re
import subprocess
import sys
from datetime import datetime

from lunar_python import Solar
from najia import Najia
from najia.utils import get_type


ZHI_ORDER = "子丑寅卯辰巳午未申酉戌亥"
TRIGRAM_MARKS = {
    1: "111",  # 乾
    2: "110",  # 兑
    3: "101",  # 离
    4: "100",  # 震
    5: "011",  # 巽
    6: "010",  # 坎
    7: "001",  # 艮
    8: "000",  # 坤
}
TRIGRAM_NAMES = {
    1: "乾",
    2: "兑",
    3: "离",
    4: "震",
    5: "巽",
    6: "坎",
    7: "艮",
    8: "坤",
}
TRADITIONAL_TO_NAJIA = {
    6: 4,  # 老阴动，变阳
    7: 1,  # 少阳
    8: 2,  # 少阴
    9: 3,  # 老阳动，变阴
}
NAJIA_TO_TRADITIONAL = {value: key for key, value in TRADITIONAL_TO_NAJIA.items()}


def fail(error, message, input_value=None):
    json.dump(
        {"error": error, "message": message, "input": input_value},
        sys.stdout,
        ensure_ascii=False,
        indent=2,
    )
    print()
    sys.exit(1)


def parse_args():
    parser = argparse.ArgumentParser(description="六爻纳甲起卦")
    parser.add_argument("--datetime", required=True, help="起卦时间 YYYY-MM-DD HH:mm")
    parser.add_argument("--place", required=True, help="起卦地点")
    parser.add_argument("--question", required=True, help="占问事项")
    parser.add_argument("--method", required=True, choices=["manual", "time"], help="起卦方法")
    parser.add_argument("--lines", help="手动爻值，自下而上，如 6,7,8,9,8,7")
    parser.add_argument("--gender", default="", help="可选，传给 najia 保留")
    parser.add_argument("--time-basis", default="true-solar", choices=["true-solar", "standard"], help="起卦时间基准")
    return parser.parse_args()


def parse_datetime(value):
    match = re.match(r"^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$", value or "")
    if not match:
        fail("invalid_datetime", "时间格式错误，请使用 YYYY-MM-DD HH:mm", value)
    year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
    hour, minute = int(match.group(4)), int(match.group(5))
    second = int(match.group(6) or 0)
    if hour < 0 or hour > 23:
        fail("invalid_hour", "小时必须为 0-23", value)
    if minute < 0 or minute > 59:
        fail("invalid_minute", "分钟必须为 0-59", value)
    if second < 0 or second > 59:
        fail("invalid_second", "秒必须为 0-59", value)
    if month < 1 or month > 12:
        fail("invalid_datetime", "日期不存在，请检查年月日", value)
    _, max_day = calendar.monthrange(year, month)
    if day < 1 or day > max_day:
        fail("invalid_datetime", "日期不存在，请检查年月日", value)
    return {
        "year": year,
        "month": month,
        "day": day,
        "hour": hour,
        "minute": minute,
        "second": second,
        "solar": f"{year:04d}-{month:02d}-{day:02d}",
        "datetime": f"{year:04d}-{month:02d}-{day:02d} {hour:02d}:{minute:02d}:{second:02d}",
    }


def format_datetime(parts):
    return (
        f"{parts['solar']} "
        f"{int(parts['hour']):02d}:{int(parts['minute']):02d}:{int(parts.get('second', 0)):02d}"
    )


def normalize_time(parsed, place):
    script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "time-normalize.mjs")
    try:
        result = subprocess.run(
            [
                "node",
                script_path,
                "--solar",
                parsed["solar"],
                "--hour",
                str(parsed["hour"]),
                "--minute",
                str(parsed["minute"]),
                "--birthplace",
                place,
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode != 0:
            return {"error": "time_normalize_failed", "message": result.stdout.strip() or result.stderr.strip()}
        return json.loads(result.stdout)
    except Exception as exc:
        return {"error": "time_normalize_failed", "message": str(exc)}


def build_time_correction(args, parsed):
    if args.time_basis == "standard":
        return {
            "applied": False,
            "basis": "standard",
            "note": "按用户提供的标准时间起卦；未应用真太阳时校正。",
            "original": {"solar": parsed["solar"], "hour": parsed["hour"], "minute": parsed["minute"]},
            "corrected": {"solar": parsed["solar"], "hour": parsed["hour"], "minute": parsed["minute"]},
            "warnings": ["标准时间模式仅用于对照外部排盘；正式占问默认建议使用 true-solar。"],
        }

    time_norm = normalize_time(parsed, args.place)
    if not time_norm or time_norm.get("error"):
        fail("time_normalize_failed", time_norm.get("message", "时间校正失败"), {"datetime": args.datetime, "place": args.place})
    return {
        "applied": True,
        "basis": "true-solar",
        "original": time_norm.get("original"),
        "corrected": time_norm.get("corrected"),
        "dst": time_norm.get("dst"),
        "trueSolarTime": time_norm.get("trueSolarTime"),
        "timezone": time_norm.get("timezone"),
        "shichenChanged": time_norm.get("shichenChanged"),
        "boundary": time_norm.get("boundary"),
        "solarTermBoundary": time_norm.get("solarTermBoundary"),
        "warnings": time_norm.get("warnings") or [],
    }


def parse_manual_lines(value):
    if value is None:
        fail("missing_lines", "手动六爻模式必须提供 --lines", value)
    items = [item for item in re.split(r"[\s,，]+", value.strip()) if item]
    if len(items) != 6:
        fail("invalid_lines", "--lines 必须包含 6 个爻值，且自下而上", value)
    try:
        lines = [int(item) for item in items]
    except ValueError:
        fail("invalid_lines", "爻值必须为数字 6/7/8/9", value)
    invalid = [item for item in lines if item not in TRADITIONAL_TO_NAJIA]
    if invalid:
        fail("invalid_lines", "爻值只能为 6=老阴动、7=少阳、8=少阴、9=老阳动", invalid)
    return lines


def remainder(value, modulo):
    result = value % modulo
    return modulo if result == 0 else result


def zhi_number(zhi):
    if zhi not in ZHI_ORDER:
        fail("calc_error", f"无法识别地支：{zhi}", zhi)
    return ZHI_ORDER.index(zhi) + 1


def time_meihua_lines(dt):
    solar = Solar.fromYmdHms(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second)
    lunar = solar.getLunar()
    year_number = zhi_number(lunar.getYearZhi())
    lunar_month = abs(lunar.getMonth())
    lunar_day = lunar.getDay()
    hour_number = zhi_number(lunar.getTimeZhi())
    base_sum = year_number + lunar_month + lunar_day
    full_sum = base_sum + hour_number
    upper_index = remainder(base_sum, 8)
    lower_index = remainder(full_sum, 8)
    moving_line = remainder(full_sum, 6)
    mark = TRIGRAM_MARKS[lower_index] + TRIGRAM_MARKS[upper_index]
    lines = [7 if char == "1" else 8 for char in mark]
    lines[moving_line - 1] = 9 if lines[moving_line - 1] == 7 else 6
    details = {
        "sourceMethod": "time_meihua_to_najia",
        "rule": "上卦=(年支数+农历月+农历日)取八；下卦=(年支数+农历月+农历日+时支数)取八；动爻同总数取六。",
        "yearBranch": lunar.getYearZhi(),
        "yearNumber": year_number,
        "lunarMonth": lunar_month,
        "lunarDay": lunar_day,
        "hourBranch": lunar.getTimeZhi(),
        "hourNumber": hour_number,
        "upperTrigram": TRIGRAM_NAMES[upper_index],
        "lowerTrigram": TRIGRAM_NAMES[lower_index],
        "movingLine": moving_line,
        "generatedMark": mark,
        "note": "时间起卦为辅助入口；严肃六爻分析优先使用用户手动摇出的六爻值。",
    }
    return lines, details


def to_najia_params(traditional_lines):
    return [TRADITIONAL_TO_NAJIA[item] for item in traditional_lines]


def moving_positions(traditional_lines):
    return [index + 1 for index, value in enumerate(traditional_lines) if value in (6, 9)]


def line_label(value):
    labels = {
        6: ("阴", True, "老阴"),
        7: ("阳", False, "少阳"),
        8: ("阴", False, "少阴"),
        9: ("阳", True, "老阳"),
    }
    yin_yang, moving, name = labels[value]
    return {"yinYang": yin_yang, "moving": moving, "name": name}


def serialize_changed_hexagram(bian):
    if not bian:
        return None
    return {
        "name": bian.get("name"),
        "mark": bian.get("mark"),
        "palace": bian.get("gong"),
        "type": get_type(bian.get("mark")),
        "sixRelatives": bian.get("qin6") or [],
        "najia": bian.get("qinx") or [],
    }


def serialize_hidden(hidden):
    if not hidden:
        return None
    return {
        "name": hidden.get("name"),
        "mark": hidden.get("mark"),
        "palace": hidden.get("gong"),
        "type": get_type(hidden.get("mark")),
        "sixRelatives": hidden.get("qin6") or [],
        "najia": hidden.get("qinx") or [],
        "seats": [(item + 1) for item in (hidden.get("seat") or [])],
    }


def build_lines(data, traditional_lines, najia_params):
    raw_shiy = list(data.get("shiy") or [])
    shi = raw_shiy[0] if len(raw_shiy) > 0 else None
    ying = raw_shiy[1] if len(raw_shiy) > 1 else None
    result = []
    for index, value in enumerate(traditional_lines):
        label = line_label(value)
        position = index + 1
        role = "世" if position == shi else "应" if position == ying else ""
        result.append(
            {
                "position": position,
                "traditionalValue": value,
                "najiaParam": najia_params[index],
                "name": label["name"],
                "yinYang": label["yinYang"],
                "moving": label["moving"],
                "role": role,
                "sixRelative": data.get("qin6", [""] * 6)[index],
                "sixSpirit": data.get("god6", [""] * 6)[index],
                "najia": data.get("qinx", [""] * 6)[index],
            }
        )
    return result


def validate_output(output):
    errors = []

    def ensure(condition, message):
        if not condition:
            errors.append(message)

    ensure(output.get("schemaVersion") == "fortune.liuyao.v1", "schemaVersion must be fortune.liuyao.v1")
    ensure(bool(output.get("input", {}).get("datetime")), "input.datetime missing")
    ensure(bool(output.get("input", {}).get("place")), "input.place missing")
    ensure(bool(output.get("input", {}).get("question")), "input.question missing")
    ensure(output.get("input", {}).get("method") in ("manual", "time"), "input.method invalid")
    ensure(output.get("input", {}).get("timeBasis") in ("true-solar", "standard"), "input.timeBasis invalid")
    ensure(bool(output.get("methodDetails", {}).get("sourceMethod")), "methodDetails.sourceMethod missing")
    ensure(len(output.get("lines") or []) == 6, "lines must contain 6 items")
    for index, line in enumerate(output.get("lines") or []):
        ensure(line.get("position") == index + 1, f"lines[{index}].position invalid")
        ensure(line.get("traditionalValue") in (6, 7, 8, 9), f"lines[{index}].traditionalValue invalid")
        ensure(bool(line.get("sixRelative")), f"lines[{index}].sixRelative missing")
        ensure(bool(line.get("sixSpirit")), f"lines[{index}].sixSpirit missing")
        ensure(bool(line.get("najia")), f"lines[{index}].najia missing")
    ensure(bool(output.get("hexagram", {}).get("name")), "hexagram.name missing")
    ensure(bool(output.get("hexagram", {}).get("mark")), "hexagram.mark missing")
    ensure(bool(output.get("hexagram", {}).get("palace")), "hexagram.palace missing")
    ensure(isinstance(output.get("shiYing", {}).get("shi"), int), "shiYing.shi missing")
    ensure(isinstance(output.get("shiYing", {}).get("ying"), int), "shiYing.ying missing")
    ensure(len(output.get("sixSpirits") or []) == 6, "sixSpirits must contain 6 items")
    ensure(bool(output.get("datePillars", {}).get("day")), "datePillars.day missing")
    ensure(bool(output.get("datePillars", {}).get("hour")), "datePillars.hour missing")
    return {"ok": len(errors) == 0, "schema": "fortune.liuyao.v1", "errors": errors}


def attach_schema_validation(output):
    validation = validate_output(output)
    output["schemaValidation"] = {"ok": True, "schema": validation["schema"]} if validation["ok"] else validation
    if not validation["ok"]:
        fail("schema_validation_failed", "; ".join(validation["errors"]), validation)


def build_output(args, parsed, time_correction, traditional_lines, method_details):
    corrected = time_correction["corrected"]
    chart_dt = datetime(
        int(corrected["solar"][0:4]),
        int(corrected["solar"][5:7]),
        int(corrected["solar"][8:10]),
        int(corrected["hour"]),
        int(corrected["minute"]),
        parsed["second"],
    )
    najia_params = to_najia_params(traditional_lines)
    najia_chart = Najia(0).compile(
        params=najia_params,
        gender=args.gender,
        date=chart_dt.strftime("%Y-%m-%d %H:%M:%S"),
        title=args.question,
        guaci=False,
    )
    data = najia_chart.data
    raw_shiy = list(data.get("shiy") or [])
    output = {
        "schemaVersion": "fortune.liuyao.v1",
        "input": {
            "datetime": args.datetime,
            "place": args.place,
            "question": args.question,
            "method": args.method,
            "timeBasis": args.time_basis,
            "gender": args.gender or None,
            "lines": traditional_lines if args.method == "manual" else None,
        },
        "timeBasis": {
            "mode": args.time_basis,
            "principle": "按起卦地点校正后的真太阳时起卦。" if args.time_basis == "true-solar" else "按用户提供的标准时间起卦，仅用于对照。",
        },
        "timeCorrection": time_correction,
        "chartInput": {
            "datetime": chart_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "note": "najia 接收校正后的起卦时间。" if args.time_basis == "true-solar" else "najia 接收原始标准时间。",
        },
        "methodDetails": method_details,
        "traditionalLines": traditional_lines,
        "najiaParams": najia_params,
        "movingLines": moving_positions(traditional_lines),
        "datePillars": data.get("lunar", {}).get("gz", {}),
        "xunKong": data.get("lunar", {}).get("xkong"),
        "sixSpirits": list(data.get("god6") or []),
        "hexagram": {
            "name": data.get("name"),
            "mark": data.get("mark"),
            "palace": data.get("gong"),
            "type": get_type(data.get("mark")),
            "sixRelatives": data.get("qin6") or [],
            "najia": data.get("qinx") or [],
        },
        "changedHexagram": serialize_changed_hexagram(data.get("bian")),
        "hiddenSpirit": serialize_hidden(data.get("hide")),
        "shiYing": {
            "shi": raw_shiy[0] if len(raw_shiy) > 0 else None,
            "ying": raw_shiy[1] if len(raw_shiy) > 1 else None,
            "raw": raw_shiy,
        },
        "lines": build_lines(data, traditional_lines, najia_params),
        "source": {
            "engine": "najia",
            "engineVersion": "2.0.1",
            "schema": "fortune.liuyao.v1",
        },
        "analysisHints": {
            "useGodPolicy": "按占问主题取用神：事业看官鬼/父母，财务看妻财，关系看世应与财官，健康看官鬼/子孙；本脚本只提供装卦证据，不自动断事。",
            "manualPreferred": True,
            "realityBoundary": "六爻判断必须回到问题背景、应期范围和现实条件，不写成确定事件或专业建议替代。",
        },
    }
    attach_schema_validation(output)
    return output


def main():
    args = parse_args()
    parsed = parse_datetime(args.datetime)
    time_correction = build_time_correction(args, parsed)
    corrected = time_correction["corrected"]
    chart_dt = datetime(
        int(corrected["solar"][0:4]),
        int(corrected["solar"][5:7]),
        int(corrected["solar"][8:10]),
        int(corrected["hour"]),
        int(corrected["minute"]),
        parsed["second"],
    )

    if args.method == "manual":
        traditional_lines = parse_manual_lines(args.lines)
        method_details = {
            "sourceMethod": "manual_traditional_lines",
            "rule": "用户提供自下而上的传统六爻值：6=老阴动、7=少阳、8=少阴、9=老阳动。",
            "note": "手动摇卦为正式六爻分析的优先输入。"
        }
    else:
        traditional_lines, method_details = time_meihua_lines(chart_dt)

    output = build_output(args, parsed, time_correction, traditional_lines, method_details)
    json.dump(output, sys.stdout, ensure_ascii=False, indent=2)
    print()


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:
        fail("runtime_error", str(exc))
