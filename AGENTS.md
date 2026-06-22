# Fortune Skill — Agent 指引

中国传统命理分析 Skill（八字 + 紫微斗数）与独立占问模块（奇门遁甲 + 六爻）。

## 项目结构

```
fortune-skill/
├── SKILL.md                    # Skill 入口（LLM 指令）
├── scripts/
│   ├── bazi-chart.mjs          # 八字排盘（lunar-javascript）
│   ├── ziwei-chart.mjs         # 紫微排盘（iztro）
│   ├── qimen-chart.mjs         # 奇门遁甲起局（3meta）
│   ├── liuyao-chart.py         # 六爻纳甲起卦（najia）
│   └── bazi-classic.py         # 三命通会经典分析（china-testing/bazi）
├── references/                 # 命理知识库（LLM 分析时读取）
│   ├── classical-texts.md      # 九本经典典籍核心规则
│   ├── wuxing-tables.md        # 五行、天干地支、十神表
│   ├── dayun-rules.md          # 大运顺逆排规则
│   ├── shichen-table.md        # 时辰对照表
│   ├── ziwei-guide.md          # 紫微斗数解盘指南
│   ├── bazi-guide.md           # 八字命理分析指南
│   ├── qimen-guide.md          # 奇门遁甲占问指南
│   └── liuyao-guide.md         # 六爻纳甲占问指南
├── vendor/bazi/                # china-testing/bazi（git clone）
├── package.json                # Node.js 依赖声明
└── requirements.txt            # Python 依赖声明
```

## 安装依赖

克隆仓库后先运行：

```bash
npm ci
python3 -m pip install -r requirements.txt
```

## 排盘脚本调用

三个脚本接口统一，可并行调用：

```bash
# 八字排盘 → JSON（四柱、十神、五行、大运、流年、神煞）
node scripts/bazi-chart.mjs --solar "1990-05-15" --hour 15 --gender male --birthplace "上海"

# 紫微排盘 → JSON（十二宫、命宫、身宫、五行局、运限）
node scripts/ziwei-chart.mjs --solar "1990-05-15" --hour 15 --gender male --birthplace "上海"

# 三命通会 → JSON（经典论断、冲刑合会、五行分数、格局）
python3 scripts/bazi-classic.py --solar "1990-05-15" --hour 15 --gender male --birthplace "上海"

# 奇门遁甲 → JSON（九宫、门星神、局数、值符值使、格局）
node scripts/qimen-chart.mjs --datetime "2026-06-22 14:30" --place "上海" --question "这个项目是否适合推进"

# 六爻纳甲 → JSON（本卦、变卦、世应、六亲、六神、纳甲）
python3 scripts/liuyao-chart.py --method manual --lines "6,7,8,9,8,7" --datetime "2026-06-22 14:30" --place "上海" --question "这个项目是否适合推进"
python3 scripts/liuyao-chart.py --method time --datetime "2026-06-22 14:30" --place "上海" --question "这个项目是否适合推进"
```

所有脚本：stdout = JSON，stderr = 日志。错误时返回 `{"error": "..."}` 结构。

## references/ 用途

知识文件供 LLM 在分析阶段读取，不是给脚本用的：
- `classical-texts.md` + `bazi-guide.md` → 八字分析时读取
- `ziwei-guide.md` → 紫微分析时读取
- `qimen-guide.md` → 奇门遁甲占问时读取
- `liuyao-guide.md` → 六爻占问时读取
- `wuxing-tables.md` + `shichen-table.md` + `dayun-rules.md` → 排盘验证和规则参考

## 分析流程

1. **信息收集**：姓名、生日、时辰、性别、出生地（详见 SKILL.md）
2. **排盘**：并行调用三个脚本
3. **八字分析**：日主强弱 → 十神 → 五行 → 格局 → 三命通会 → 大运流年
4. **紫微分析**：命宫主星 → 十二宫 → 四化 → 大限流年
5. **综合建议**：事业、财运、感情、健康

## 占问流程（奇门 / 六爻）

奇门遁甲和六爻是独立占问模块，不并入八字/紫微本命报告。只收集问题、起局/起卦时间、地点；六爻手动模式还需用户提供自下而上的 6 个爻值。
- 注意，如果是对世界杯比赛的预测，首先要读取根目录下的 `世界杯-奇门遁甲规则.md` / `世界杯-六爻规则.md` 规则文档，并按照此文档要求进行
1. **奇门**：调用 `qimen-chart.mjs`，读取 `references/qimen-guide.md`，围绕值符、值使、用神宫、门星神、空亡、门迫、击刑、入墓和格局解释。
2. **六爻**：调用 `liuyao-chart.py`，读取 `references/liuyao-guide.md`，围绕本卦、变卦、世应、用神、六亲、六神、月日、旬空和动爻解释。
3. **边界**：占问只给趋势、条件和现实验证点，不输出确定性事件，不替代医学、财务、法律等专业建议。

## 注意事项

- 出生地为必填项，用于夏令时和真太阳时校正
- 真太阳时为正式排盘基准；用户提供的标准时间只是原始输入，不得为了贴合外部 benchmark 或预计算命盘而使用未校正 Raw Time
- 时辰未知时不要调用排盘脚本生成精确四柱；只做年月日层面的定性分析，紫微需等用户补充时辰
- 奇门/六爻是具体占问模块，不要求出生信息；默认使用起局/起卦地点真太阳时
- 分析结束必须附免责声明

## easy-memory rules
- At the start of the current session (before the first task), use the `easy-memory` skill and follow all rules and constraints in its `SKILL.md`.
- Only re-run memory read/search when necessary for the task.
