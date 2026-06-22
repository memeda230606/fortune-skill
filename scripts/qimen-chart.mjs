#!/usr/bin/env node
/**
 * qimen-chart.mjs — 奇门遁甲起局脚本（基于 3meta）
 *
 * 用法:
 * node scripts/qimen-chart.mjs --datetime "YYYY-MM-DD HH:mm" --place "城市" --question "占问事项"
 *   [--solar-term 节气] [--dun yang|yin] [--ju 1-9] [--year-divide normal|exact]
 *   [--time-basis true-solar|standard]
 *
 * 输出: JSON 到 stdout，日志到 stderr
 */

import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { QimenChart } from '3meta';
import { attachSchemaValidation, validateQimenOutput } from './schema-validators.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { timeBasis: 'true-solar', yearDivide: 'normal' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--datetime' && args[i + 1]) opts.datetime = args[++i];
    else if (args[i] === '--place' && args[i + 1]) opts.place = args[++i];
    else if (args[i] === '--question' && args[i + 1]) opts.question = args[++i];
    else if (args[i] === '--solar-term' && args[i + 1]) opts.solarTerm = args[++i];
    else if (args[i] === '--dun' && args[i + 1]) opts.dun = args[++i];
    else if (args[i] === '--ju' && args[i + 1]) opts.ju = parseInt(args[++i], 10);
    else if (args[i] === '--year-divide' && args[i + 1]) opts.yearDivide = args[++i];
    else if (args[i] === '--time-basis' && args[i + 1]) opts.timeBasis = args[++i];
  }
  return opts;
}

function fail(error, message, input) {
  process.stdout.write(JSON.stringify({ error, message, input }, null, 2) + '\n');
  process.exit(1);
}

function parseDatetime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value || '');
  if (!match) fail('invalid_datetime', '时间格式错误，请使用 YYYY-MM-DD HH:mm', value);
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = parseInt(yearText, 10);
  const month = parseInt(monthText, 10);
  const day = parseInt(dayText, 10);
  const hour = parseInt(hourText, 10);
  const minute = parseInt(minuteText, 10);
  const second = secondText === undefined ? 0 : parseInt(secondText, 10);
  if (hour < 0 || hour > 23) fail('invalid_hour', '小时必须为 0-23', value);
  if (minute < 0 || minute > 59) fail('invalid_minute', '分钟必须为 0-59', value);
  if (second < 0 || second > 59) fail('invalid_second', '秒必须为 0-59', value);
  const utc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    fail('invalid_datetime', '日期不存在，请检查年月日', value);
  }
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    solar: `${yearText}-${monthText}-${dayText}`,
    datetime: `${yearText}-${monthText}-${dayText} ${String(hour).padStart(2, '0')}:${minuteText}:${String(second).padStart(2, '0')}`
  };
}

function formatDatetime(solar, hour, minute, second = 0) {
  return `${solar} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
}

function normalizeTime(parsed, place) {
  try {
    const scriptPath = join(__dirname, 'time-normalize.mjs');
    const result = execFileSync('node', [
      scriptPath,
      '--solar', parsed.solar,
      '--hour', String(parsed.hour),
      '--minute', String(parsed.minute),
      '--birthplace', place
    ], {
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return JSON.parse(result.trim());
  } catch (error) {
    return { error: 'time_normalize_failed', message: error.message };
  }
}

function validateOptions(opts) {
  if (!opts.datetime) fail('missing_datetime', '缺少 --datetime 参数，格式 YYYY-MM-DD HH:mm', opts);
  if (!opts.place) fail('missing_place', '缺少 --place 参数', opts);
  if (!opts.question) fail('missing_question', '缺少 --question 参数', opts);
  if (!['true-solar', 'standard'].includes(opts.timeBasis)) {
    fail('invalid_time_basis', '--time-basis 必须为 true-solar 或 standard', opts.timeBasis);
  }
  if (!['normal', 'exact'].includes(opts.yearDivide)) {
    fail('invalid_year_divide', '--year-divide 必须为 normal 或 exact', opts.yearDivide);
  }
  if (opts.dun && !['yang', 'yin'].includes(opts.dun)) {
    fail('invalid_dun', '--dun 必须为 yang 或 yin', opts.dun);
  }
  if (opts.ju !== undefined && (!Number.isInteger(opts.ju) || opts.ju < 1 || opts.ju > 9)) {
    fail('invalid_ju', '--ju 必须为 1-9 的整数', opts.ju);
  }
}

function qimenOptions(opts) {
  const result = { yearDivide: opts.yearDivide };
  if (opts.solarTerm) result.solarTerm = opts.solarTerm;
  if (opts.dun) result.isYangdun = opts.dun === 'yang';
  if (opts.ju !== undefined) result.juNumber = opts.ju;
  return result;
}

function buildTimeCorrection(opts, parsed) {
  if (opts.timeBasis === 'standard') {
    return {
      applied: false,
      basis: 'standard',
      note: '按用户提供的标准时间起局；未应用真太阳时校正。',
      original: {
        solar: parsed.solar,
        hour: parsed.hour,
        minute: parsed.minute
      },
      corrected: {
        solar: parsed.solar,
        hour: parsed.hour,
        minute: parsed.minute
      },
      warnings: ['标准时间模式仅用于对照外部排盘；正式占问默认建议使用 true-solar。']
    };
  }

  const timeNorm = normalizeTime(parsed, opts.place);
  if (!timeNorm || timeNorm.error) {
    fail('time_normalize_failed', timeNorm?.message || '时间校正失败', { datetime: opts.datetime, place: opts.place });
  }

  return {
    applied: true,
    basis: 'true-solar',
    original: timeNorm.original,
    corrected: timeNorm.corrected,
    dst: timeNorm.dst,
    trueSolarTime: timeNorm.trueSolarTime,
    timezone: timeNorm.timezone,
    shichenChanged: timeNorm.shichenChanged,
    boundary: timeNorm.boundary || null,
    solarTermBoundary: timeNorm.solarTermBoundary || null,
    warnings: timeNorm.warnings || []
  };
}

function asText(value) {
  return Array.isArray(value) ? value.join('、') : (value ?? '');
}

function serializePattern(pattern) {
  if (!pattern || typeof pattern !== 'object') return pattern;
  return {
    id: pattern.id || null,
    name: pattern.name || '',
    type: pattern.type || '',
    position: pattern.position || null,
    description: pattern.description || ''
  };
}

function palaceConstraints(palace) {
  const constraints = [];
  if (palace.voidness?.hasVoidness) constraints.push(`空亡:${asText(palace.voidness.voidInPalace)}`);
  if (palace.gatePressure && palace.gatePressure !== '无') constraints.push(`门迫/受制:${palace.gatePressure}`);
  if (palace.liuYiJiXing?.hasJiXing) constraints.push(`六仪击刑:${palace.liuYiJiXing.type || '是'}`);
  const tombs = [
    ...(palace.tombInfo?.heavenlyStemInTomb || []),
    ...(palace.tombInfo?.earthlyStemInTomb || [])
  ];
  if (tombs.length || palace.tombInfo?.timeStemInTomb || palace.tombInfo?.dayStemInTomb) {
    constraints.push(`入墓:${asText(tombs) || '日/时干入墓'}`);
  }
  return constraints;
}

function serializePalace(palace) {
  return {
    position: palace.position,
    trigram: palace.trigram,
    gate: palace.gate,
    star: palace.star,
    deity: palace.deity,
    heavenlyStem: palace.heavenlyStem,
    earthlyStem: palace.earthlyStem,
    earthBranch: palace.earthBranch,
    isZhiFu: Boolean(palace.isZhiFu),
    isZhiShi: Boolean(palace.isZhiShi),
    isPostHorse: Boolean(palace.isPostHorse),
    voidness: palace.voidness,
    fiveElements: palace.fiveElements,
    status: palace.status || null,
    innerOuter: palace.innerOuter || null,
    gatePressure: palace.gatePressure || null,
    growthInfo: palace.growthInfo || null,
    liuYiJiXing: palace.liuYiJiXing || null,
    tombInfo: palace.tombInfo || null,
    tenStemResponse: palace.tenStemResponse || null,
    auspiciousPatterns: (palace.auspiciousPatterns || []).map(serializePattern),
    inauspiciousPatterns: (palace.inauspiciousPatterns || []).map(serializePattern),
    isJiGong: palace.isJiGong || null,
    analysisTags: [
      palace.isZhiFu ? '值符' : null,
      palace.isZhiShi ? '值使' : null,
      palace.isPostHorse ? '驿马' : null,
      ...(palace.auspiciousPatterns || []).map(item => item.name || item.type).filter(Boolean),
      ...(palace.inauspiciousPatterns || []).map(item => item.name || item.type).filter(Boolean),
      ...palaceConstraints(palace)
    ].filter(Boolean)
  };
}

function buildAnalysisHints(output) {
  const zhiFuPalace = output.palaces.find(item => item.isZhiFu);
  const zhiShiPalace = output.palaces.find(item => item.isZhiShi);
  const emptyPalaces = output.palaces.filter(item => item.voidness?.hasVoidness).map(item => item.position);
  const strongSignals = output.palaces.flatMap(item =>
    [...(item.auspiciousPatterns || []), ...(item.inauspiciousPatterns || [])]
      .map(pattern => ({ palace: item.position, name: pattern.name, type: pattern.type, description: pattern.description }))
  );
  return {
    useGodPolicy: '按占问主题取用神：事业看开门/值使/日干/年命，财务看生门，关系看六合/乙庚/日时干，出行看驿马/开门/天盘动象；本脚本只提供盘面证据，不自动断事。',
    zhiFuPalace: zhiFuPalace?.position || output.zhiFu?.position || null,
    zhiShiPalace: zhiShiPalace?.position || output.zhiShi?.position || null,
    emptyPalaces,
    strongSignals,
    realityBoundary: '奇门判断必须回到问题背景、时间窗口和现实条件，不写成确定事件或专业建议替代。'
  };
}

function main() {
  const opts = parseArgs();
  validateOptions(opts);
  const parsed = parseDatetime(opts.datetime);
  const timeCorrection = buildTimeCorrection(opts, parsed);
  const chartDatetime = formatDatetime(
    timeCorrection.corrected.solar,
    timeCorrection.corrected.hour,
    timeCorrection.corrected.minute,
    parsed.second
  );
  const chart = QimenChart.byDatetime(chartDatetime, qimenOptions(opts));
  const raw = chart.toJSON ? chart.toJSON() : JSON.parse(JSON.stringify(chart));
  const output = {
    schemaVersion: 'fortune.qimen.v1',
    input: {
      datetime: opts.datetime,
      place: opts.place,
      question: opts.question,
      timeBasis: opts.timeBasis,
      options: {
        solarTerm: opts.solarTerm || null,
        dun: opts.dun || null,
        ju: opts.ju || null,
        yearDivide: opts.yearDivide
      }
    },
    timeBasis: {
      mode: opts.timeBasis,
      principle: opts.timeBasis === 'true-solar'
        ? '按起局地点校正后的真太阳时起局。'
        : '按用户提供的标准时间起局，仅用于对照。'
    },
    timeCorrection,
    chartInput: {
      datetime: chartDatetime,
      note: opts.timeBasis === 'true-solar' ? '3meta 接收校正后的起局时间。' : '3meta 接收原始标准时间。'
    },
    timeInfo: raw.timeInfo,
    fourPillars: raw.fourPillars,
    ju: raw.ju,
    yuan: raw.yuan,
    season: raw.season,
    monthElement: raw.monthElement,
    zhiFu: raw.zhiFu,
    zhiShi: raw.zhiShi,
    postHorse: raw.postHorse,
    specialPatterns: raw.specialPatterns || [],
    hiddenStems: raw.hiddenStems || null,
    palaces: (raw.palaces || []).map(serializePalace),
    source: {
      engine: '3meta',
      engineVersion: raw.version || chart.version || null,
      schema: 'fortune.qimen.v1'
    }
  };
  output.analysisHints = buildAnalysisHints(output);
  attachSchemaValidation(output, validateQimenOutput);
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

try {
  main();
} catch (error) {
  process.stdout.write(JSON.stringify({
    error: 'runtime_error',
    message: error.message
  }, null, 2) + '\n');
  process.exit(1);
}
