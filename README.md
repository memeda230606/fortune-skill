# Fortune Skill — 中国传统命理 AI 分析技能

Source-available，非商用使用。详见 [LICENSE](LICENSE) 和
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

> **隐私与示例数据声明**
>
> 本仓库 README、文档、测试脚本（含 `scripts/verify.mjs`）以及任何示例命令中
> 出现的出生日期、时辰、出生地、姓名等命主信息均为**虚构演示数据**，
> 不对应任何真实人物。请勿据此推算真人命盘或还原个人画像。
>
> 用户在本地使用本 Skill 生成的命理报告默认存放于 `reports/`，
> 该目录已加入 `.gitignore`，不上传到任何远程仓库。如需提交相关变更，
> 请先运行 `node scripts/privacy-check.mjs` 自查。

## 项目概述

为 OpenClaw agent 构建一个中国传统命理分析 Skill，支持紫微斗数和八字命理两大体系。用户通过自然语言对话提供出生信息，系统自动排盘并结合经典典籍进行专业分析。

设计目标：对 OpenClaw / Claude Code / Codex 等 agent 平台原生友好。

---

## 协议与公开发布边界

本仓库的原创代码、文档、脚本、prompt 和 skill 材料默认按
PolyForm Noncommercial License 1.0.0 发布，仅限非商用使用；这不是 OSI
意义上的开源协议。

第三方依赖、vendored 代码和引用材料保留各自的原始协议或权利状态，详见
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。其中 `vendor/bazi/`
对应的上游 `china-testing/bazi` 在本地审查时未发现声明式 license，本仓库保留
该目录用于个人、研究和非商用场景，但不对其作额外转授权。

---

## 核心依赖

核心排盘依赖优先选择成熟项目；第三方协议状态以实际仓库和
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 为准。

| 项目 | ⭐ | 语言 | License | 最近更新 | 用途 |
|------|-----|------|---------|---------|------|
| [SylarLong/iztro](https://github.com/SylarLong/iztro) | 3,617 | TypeScript | MIT | 2026-04-15 | 紫微斗数排盘引擎（12 宫、运限、四化、三方四正、插件系统） |
| [6tail/lunar-javascript](https://github.com/6tail/lunar-javascript) | 1,502 | JavaScript | MIT | 2026-04-30 | 万年历+八字排盘（四柱、十神、五行、大运、流年、神煞、纳音） |
| [china-testing/bazi](https://github.com/china-testing/bazi) | 1,285 | Python | 未声明 / accepted risk | 2026-02-03 | 三命通会论断、冲刑合会分析、五行分数、格局判定、合婚 |
| [jinchenma94/bazi-skill](https://github.com/jinchenma94/bazi-skill) | 1,208 | Markdown | MIT | 2026-04-04 | 分析流程框架 + 经典典籍 references（穷通宝典等九本） |

### 参考项目（不直接依赖）

| 项目 | ⭐ | 参考价值 |
|------|-----|---------|
| [hhszzzz/taibu](https://github.com/hhszzzz/taibu) | 119 | AGENTS.md / CLAUDE.md 的 agent 友好设计、MCP 工具定义方式、taibu-core 的 API 设计思路 |
| [DestinyLinker/MingLi-Bench](https://github.com/DestinyLinker/MingLi-Bench) | 133 | LLM 命理评测基准（160 道题），可用于验证分析质量 |

---

## 架构

```
fortune-skill/
├── SKILL.md                    # OpenClaw Skill 入口
├── AGENTS.md                   # Codex agent 指引
├── CLAUDE.md                   # Claude Code agent 指引
├── package.json                # npm 依赖（iztro, lunar-javascript）
├── requirements.txt            # Python 依赖（lunar-python, colorama, bidict）
├── scripts/
│   ├── ziwei-chart.mjs         # iztro → 紫微盘 JSON
│   ├── bazi-chart.mjs          # lunar → 八字盘 JSON
│   └── bazi-classic.py         # china-testing/bazi → 三命通会评判 JSON
├── vendor/
│   └── bazi/                   # china-testing/bazi（git clone）
└── references/                 # 命理知识库（LLM 分析时读取）
    ├── classical-texts.md      # 九本经典典籍核心规则摘要
    ├── wuxing-tables.md        # 五行、天干地支、十神参考表
    ├── dayun-rules.md          # 大运顺逆排规则
    ├── shichen-table.md        # 时辰对照表
    ├── ziwei-guide.md          # 紫微斗数解盘指南
    └── bazi-guide.md           # 八字命理分析指南
```

---

## 三层计算架构

```
┌──────────────────────────────────────────────────┐
│  Layer 1: 精确排盘（脚本计算，JSON stdout）        │
│                                                    │
│  ziwei-chart.mjs ← iztro                          │
│    12 宫星盘、运限、星耀亮度、四化、三方四正        │
│                                                    │
│  bazi-chart.mjs ← lunar-javascript                 │
│    四柱、十神、五行、大运、流年、神煞、纳音         │
│                                                    │
│  bazi-classic.py ← china-testing/bazi              │
│    三命通会论断、冲刑合会、五行分数、格局           │
├──────────────────────────────────────────────────┤
│  Layer 2: 经典典籍（references/ Markdown）         │
│                                                    │
│  穷通宝典、三命通会、滴天髓、渊海子平、            │
│  子平真诠、千里命稿、神峰通考、协纪辨方书          │
├──────────────────────────────────────────────────┤
│  Layer 3: LLM 综合分析（SKILL.md 引导）            │
│                                                    │
│  Layer 1 排盘 JSON + Layer 2 典籍规则              │
│  → 日主强弱、格局、喜用神、大运流年                │
│  → 事业/财运/感情/健康建议                         │
│  → 历史事件校准（可选）                            │
└──────────────────────────────────────────────────┘
```

Layer 1 保证排盘精确（LLM 自己算干支会出错），Layer 2 提供系统化的专业知识，Layer 3 发挥 LLM 的综合分析和表达能力。

### 报告增强脚本

深度报告优先走结构化流水线，减少手工复制和 LLM 自由发挥：

| 命令 | 用途 |
|------|------|
| `npm run report-data -- ...` | 聚合基础盘、年度/逐月流年、方法论框架、报告模板、紫微三方四正与专项评分 |
| `npm run rule-matcher -- ...` | 输出调候、病药、作用优先级、神煞边界、大运切换、伏吟反吟、十神现代映射等规则命中点 |
| `npm run report-draft -- ...` | 按模板生成主报告摘要、十年流年、两年逐月或长期综合 Markdown 草稿 |
| `npm run report-qa -- --file reports/xxx.md` | 检查最终报告是否覆盖免责声明、时辰边界、方法论、现实校准、隐私、条件性贵人边界和绝对化风险 |
| `npm run privacy-check` | 提交前检查 staged 文件是否包含 `reports/` 或敏感材料 |

说明：历史经历不是默认产品化输入，只有用户主动提供时才作为可选校准材料；贵人也不是默认专项报告，只有用户明确询问人脉、平台资源或贵人问题时才单独展开。

---

## 安装

克隆仓库后先安装运行时依赖：

```bash
npm ci
python3 -m pip install -r requirements.txt
```

最小验证：

```bash
node scripts/time-normalize.mjs --solar "1990-05-15" --hour 15 --birthplace "上海"
node scripts/bazi-chart.mjs --solar "1990-05-15" --hour 15 --gender male --birthplace "上海"
node scripts/ziwei-chart.mjs --solar "1990-05-15" --hour 15 --gender male --birthplace "上海"
python3 scripts/bazi-classic.py --solar "1990-05-15" --hour 15 --gender male --birthplace "上海"
npm run report-framework -- --summary
npm run rule-matcher -- --solar "1990-05-15" --hour 15 --gender male --birthplace "上海" --from 2026 --to 2027 --ziwei-years 2026
npm run report-draft -- --solar "1990-05-15" --hour 15 --gender male --birthplace "上海" --from 2026 --to 2027 --ziwei-years 2026
npm run privacy-check -- --no-git
```

---

## Agent 友好性设计

### 1. JSON-first 输出

所有排盘脚本 stdout 输出结构化 JSON，stderr 输出日志。Agent 拿到数据后自行决定呈现和分析方式。

```bash
node scripts/bazi-chart.mjs --solar "1990-05-15" --hour 15 --gender male --birthplace "上海"
# stdout → { "pillars": {...}, "tenGods": {...}, "fiveElements": {...}, ... }

node scripts/ziwei-chart.mjs --solar "1990-05-15" --hour 15 --gender male --birthplace "上海"
# stdout → { "palaces": [...], "horoscope": {...}, "stars": {...}, ... }

python3 scripts/bazi-classic.py --solar "1990-05-15" --hour 15 --minute 0 --gender female --birthplace "上海"
# stdout → { "sanming": "...", "clashes": [...], "scores": {...}, ... }
```

`--minute` 为可选参数，默认 `0`；出生时间接近时辰边界时建议提供分钟。

### 2. exec 调用（零服务集成）

所有计算通过 exec 调用命令行脚本。不需要 MCP 协议、HTTP Server、特殊 SDK；克隆后按“安装”章节安装 Node.js 和 Python 依赖即可使用。任何能执行 shell 命令的 agent 都能用：
- OpenClaw → exec tool
- Claude Code → bash tool
- Codex → terminal
- Cursor / Windsurf → terminal

### 3. SKILL.md 触发词

```yaml
triggers:
  - "算命" "算八字" "看八字" "批八字" "排八字" "排盘"
  - "紫微" "紫微斗数" "看紫微盘"
  - "帮我看看命" "我的运势" "今年运势"
  - "合婚" "八字合婚"
  - "bazi" "ziwei" "fortune"
```

### 4. AGENTS.md + CLAUDE.md

项目根目录放 agent 指引文件，让 Codex / Claude Code 自动理解项目结构和工具调用方式：

```markdown
# AGENTS.md

## 项目结构
- scripts/ 下有三个排盘脚本，通过命令行调用，stdout 输出 JSON
- references/ 下有命理知识 Markdown，分析时读取作为上下文
- SKILL.md 定义了完整的交互流程和分析框架

## 工具调用
- 紫微排盘: node scripts/ziwei-chart.mjs --solar <date> --hour <0-23> [--minute <0-59>] --gender <male|female> --birthplace <city>
- 八字排盘: node scripts/bazi-chart.mjs --solar <date> --hour <0-23> [--minute <0-59>] --gender <male|female> --birthplace <city>
- 三命通会: python3 scripts/bazi-classic.py --solar <date> --hour <0-23> [--minute <0-59>] --gender <male|female> --birthplace <city>

## 分析流程
1. 收集用户出生信息（日期、时间、性别、出生地）
2. 调用排盘脚本获取结构化数据
3. 读取 references/ 中的典籍规则
4. 结合排盘数据和典籍规则进行综合分析
```

### 5. References 作为可读上下文

references/ 目录的 Markdown 文件在分析阶段被读入 agent 上下文。比硬编码 prompt 更灵活，方便迭代。Agent 可以按需读取特定文件（比如只看穷通宝典的调候规则），不需要一次性加载全部。

### 6. 错误处理对 agent 友好

脚本在输入错误时返回结构化错误 JSON（不是 traceback），让 agent 能理解并重试：

```json
{ "error": "invalid_date", "message": "日期格式错误，请使用 YYYY-MM-DD", "input": "1990/5/15" }
```

---

## china-testing/bazi 集成

### 代码结构（vendor/bazi/）

| 文件 | 大小 | 内容 |
|------|------|------|
| bazi.py | 120KB | 主程序：排盘+分析+输出，依赖 lunar-python |
| sizi.py | 172KB | 三命通会论断数据（六十甲子日时论命） |
| datas.py | 85KB | 天干地支/十神/五行/神煞等数据表 |
| ganzhi.py | 26KB | 干支计算 |
| yue.py | 87KB | 月令论断 |
| common.py | 1.6KB | 公共函数 |
| luohou.py | 11KB | 罗喉日计算 |
| shengxiao.py | 2KB | 生肖合婚 |

### Wrapper 方案

`scripts/bazi-classic.py` 做一层 wrapper：
1. `sys.path.insert` 引入 `vendor/bazi/`
2. 接收命令行参数（阳历日期、时间、性别）
3. 调用 bazi.py 的核心函数
4. 捕获 print 输出，解析提取关键数据
5. 输出结构化 JSON 到 stdout

提取的数据：
- 三命通会论断文本（sizi.py 的 summarys）
- 冲刑合会关系
- 五行分数
- 格局判定
- 神煞
- 大运列表

Python 依赖：`lunar-python`、`colorama`、`bidict`（见 `requirements.txt`）

---

## 工作流程

### Phase 1：信息收集（对话式）

```
用户："帮我算命"
Agent："请告诉我您的出生日期（阳历或农历都可以）"
用户："1990年5月15日"
Agent："出生时间大概是几点？"
用户："下午3点左右"
Agent："性别？"
用户："男"
Agent："出生地？（用于真太阳时参考）"
用户："上海"
→ 确认信息，开始排盘
```

### Phase 2：排盘计算（并行执行）

Agent 同时调用三个脚本：

```bash
node scripts/bazi-chart.mjs --solar "1990-05-15" --hour 15 --minute 0 --gender male --birthplace "上海"
node scripts/ziwei-chart.mjs --solar "1990-05-15" --hour 15 --minute 0 --gender male --birthplace "上海"
python3 scripts/bazi-classic.py --solar "1990-05-15" --hour 15 --minute 0 --gender male --birthplace "上海"
```

三个脚本独立运行，各自输出 JSON。

### Phase 3：综合分析

Agent 读取 references/ 中的典籍规则，结合三份排盘数据，按 SKILL.md 定义的分析框架输出：

**八字分析：**
1. 日主强弱（得令、得地、得势）
2. 十神分析与六亲关系
3. 五行平衡与喜用神（参考穷通宝典调候）
4. 格局判定（参考子平真诠）
5. 三命通会论断（来自 bazi-classic.py）
6. 大运流年分析
7. 综合建议（事业、财运、感情、健康）

**紫微分析：**
1. 命宫主星与格局
2. 十二宫逐宫分析
3. 四化飞星与三方四正
4. 大限流年运势
5. 综合建议

### Phase 4：历史校准（可选）

根据排盘结果预测用户过去 3-5 个关键事件的时间和性质，让用户验证，微调分析。

---

## 当前状态

- P0 排盘脚本已完成：`bazi-chart.mjs`、`ziwei-chart.mjs`、`bazi-classic.py` 均输出 JSON。
- P1 Skill 框架已完成：`SKILL.md`、`AGENTS.md`、`CLAUDE.md`、`references/` 已就位。
- P2 功能已完成：时间校正、合婚、流年快查已接入脚本和 Skill 指令。
- 最小回归验证已接入：运行 `npm test` 或 `npm run verify`。

## 时间校正

出生地是必填项。系统会在排盘前调用 `scripts/time-normalize.mjs` 完成：

1. 出生地匹配到时区和经度；县区别名会优先归属到对应地级市。
2. 用 Node.js `Intl.DateTimeFormat` 检测该日期是否处于夏令时。
3. 按出生地经度与时区标准经度差值计算真太阳时。
4. 用校正后的日期和小时调用下游排盘引擎。

中国城市统一使用 `Asia/Shanghai` 时区，并按城市经度修正真太阳时。县区或复合出生地会先尝试解析到地级市，例如 `当涂`、`当涂县`、`马鞍山-当涂` 会按 `马鞍山` 校正。海外城市依赖内置城市表；英文或非中文城市如果不在表中，会返回结构化 `unknown_city` 错误。

## 验证

```bash
npm test
```

验证覆盖：
- 时间校正有效案例和非法日期错误。
- 三个排盘脚本的关键字段。
- 八字流年快查。
- 紫微四化落宫、三方四正和四化交互。
- 方法论框架、报告框架和隐私策略。
- 报告聚合脚本。
- 合婚脚本。

报告草稿：

```bash
npm run report-draft -- --type long_year_month --solar "1990-05-15" --hour 15 --minute 0 --gender male --birthplace "上海" --from 2026 --to 2035 --ziwei-years 2026,2027
npm run report-draft -- --type yearly_outlook_report --solar "1990-05-15" --hour 15 --gender male --birthplace "上海" --from 2026 --to 2035 --ziwei-years 2026,2028,2031
npm run report-draft -- --type monthly_outlook_report --solar "1990-05-15" --hour 15 --gender male --birthplace "上海" --from 2026 --to 2027 --ziwei-years 2026,2027
```

`reports/` 默认视为个人敏感输出，已加入 `.gitignore`。提交前建议运行：

```bash
npm run privacy-check
```

## 后续候选

- 用 MingLi-Bench 或自建样例集评估分析质量。
- 增加更多城市别名和海外出生地覆盖。
- 增加排盘可视化输出。
- 根据真实对话继续压缩提问轮次和输出篇幅。

## 风险与注意事项

1. **排盘精度**：LLM 不应自行计算四柱，必须以脚本 JSON 为准。
2. **时辰未知**：不要用默认时辰生成伪精确盘，按 `SKILL.md` 的未知时辰流程处理。
3. **节气边界**：立春前后、月令交界需要用户尽量提供具体时间。
4. **出生地覆盖**：未知中文城市会先尝试县区/复合地名归属；仍无法匹配时会降级为 `Asia/Shanghai` 并跳过真太阳时。未知非中文城市会返回错误。
5. **免责声明**：输出必须包含“仅供文化研究和娱乐参考”。
