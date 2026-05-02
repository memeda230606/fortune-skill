# Fortune Skill — Claude Code 指引

中国传统命理分析 Skill（八字 + 紫微斗数）。个人使用，不商用。

## 快速上手

```bash
# 安装依赖
npm ci
python3 -m pip install -r requirements.txt

# 运行排盘（三个脚本可并行）
node scripts/bazi-chart.mjs --solar "1990-05-15" --hour 15 --gender male --birthplace "上海"
node scripts/ziwei-chart.mjs --solar "1990-05-15" --hour 15 --gender male --birthplace "上海"
python3 scripts/bazi-classic.py --solar "1990-05-15" --hour 15 --gender male --birthplace "上海"
```

所有脚本输出 JSON 到 stdout，日志到 stderr。

## 项目结构

- `SKILL.md` — Skill 入口文件（LLM 读取的完整分析指令）
- `scripts/` — 三个排盘脚本（Node.js + Python）
- `references/` — 命理知识库（6 个 Markdown 文件，LLM 分析时按需读取）
- `vendor/bazi/` — china-testing/bazi 源码（bazi-classic.py 的数据依赖）
- `requirements.txt` — Python 依赖清单

## 依赖

- Node.js: `iztro`（紫微）、`lunar-javascript`（八字）
- Python: `lunar-python`、`colorama`、`bidict`（vendor/bazi 依赖）

## 分析流程概要

1. 收集出生信息（姓名、阳历生日、时辰、性别、出生地）
2. 并行调用三个排盘脚本获取 JSON 数据
3. 读取 references/ 知识文件
4. 八字分析（日主、十神、五行、格局、大运流年）
5. 紫微分析（命宫、十二宫、四化、大限流年）
6. 综合建议 + 免责声明

## 修改指南

- 修改分析流程 → 编辑 `SKILL.md`
- 修改排盘逻辑 → 编辑 `scripts/` 下对应脚本
- 补充命理知识 → 编辑 `references/` 下对应文件
- 脚本接口：`--solar "YYYY-MM-DD" --hour <0-23> --gender <male|female> --birthplace "城市"`
