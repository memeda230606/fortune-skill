#!/usr/bin/env node
/**
 * hecan-summary.mjs — 结构化合参与可解释置信度汇总。
 *
 * 用法:
 * node scripts/hecan-summary.mjs --solar "YYYY-MM-DD" --hour <0-23> [--minute <0-59>] \
 *   --gender <male|female> --birthplace "城市名" [--from 2026] [--to 2035] \
 *   [--ziwei-years 2026,2027] [--focus career,migration]
 */

import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { attachSchemaValidation, validateHecanSummaryOutput } from './schema-validators.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');
const node = process.execPath;

const DOMAIN_CONFIG = {
  career: {
    label: '事业/平台',
    lifeSignal: 'careerChange',
    ziweiKey: 'career',
    roles: ['官杀', '印星', '食伤'],
    ruleKeywords: ['官', '事业', '平台', '名分', '规则', '格局', '病药']
  },
  migration: {
    label: '迁移/外部平台',
    lifeSignal: 'cityMove',
    ziweiKey: 'migration',
    roles: ['驿马', '迁移', '官杀', '印星'],
    ruleKeywords: ['迁移', '驿马', '冲动', '换运', '外部']
  },
  wealth: {
    label: '财务/兑现',
    lifeSignal: 'familyAndAssets',
    ziweiKey: 'wealth',
    roles: ['财星', '食伤'],
    ruleKeywords: ['财', '合化', '兑现', '资产', '预算']
  },
  relationship: {
    label: '关系/伴侣',
    lifeSignal: 'relationshipChange',
    ziweiKey: 'relationship',
    roles: ['官杀', '财星', '比劫'],
    ruleKeywords: ['关系', '夫妻', '合', '冲', '家庭']
  },
  home: {
    label: '家庭/田宅',
    lifeSignal: 'familyAndAssets',
    ziweiKey: 'home',
    roles: ['财星', '印星', '比劫'],
    ruleKeywords: ['田宅', '家庭', '资产', '父母', '长辈']
  },
  health: {
    label: '健康/消耗',
    lifeSignal: 'healthStress',
    ziweiKey: 'health',
    roles: ['印星', '比劫', '官杀'],
    ruleKeywords: ['健康', '疾厄', '病药', '消耗', '伏吟', '反吟']
  },
  study: {
    label: '学业/文书',
    lifeSignal: 'studyAndExams',
    ziweiKey: 'study',
    roles: ['印星', '食伤', '官杀'],
    ruleKeywords: ['学业', '文昌', '学堂', '文书', '资质']
  }
};

const SIGNAL_SCORE = { '低': 0, '中': 1, '中高': 2, '高': 3 };
const CALIBRATION_BONUS = { '未校准': 0, '弱校准': 0.04, '中校准': 0.08, '强校准': 0.12 };
const CALIBRATION_CAP = { '未校准': 0.74, '弱校准': 0.82, '中校准': 0.9, '强校准': 1 };

function parseArgs() {
  const rawArgs = process.argv.slice(2);
  const opts = { rawArgs, focus: null };
  for (let i = 0; i < rawArgs.length; i++) {
    if (rawArgs[i] === '--focus' && rawArgs[i + 1]) {
      opts.focus = rawArgs[i + 1].split(',').map(item => item.trim()).filter(Boolean);
      i += 1;
    }
  }
  return opts;
}

function runReportData(rawArgs) {
  const filteredArgs = [];
  for (let i = 0; i < rawArgs.length; i++) {
    if (rawArgs[i] === '--focus') {
      i += 1;
      continue;
    }
    filteredArgs.push(rawArgs[i]);
  }

  const result = spawnSync(node, ['scripts/fortune-report-data.mjs', ...filteredArgs], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024
  });

  if (result.status !== 0) {
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    process.exit(result.status);
  }

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    process.stdout.write(JSON.stringify({
      error: 'invalid_report_data_json',
      message: error.message,
      stdout: result.stdout.slice(0, 1000)
    }, null, 2) + '\n');
    process.exit(1);
  }
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function signalValue(signal) {
  return SIGNAL_SCORE[signal?.signalIntensity || signal?.level] ?? 0;
}

function confidenceLabel(score) {
  if (score >= 0.75) return '高';
  if (score >= 0.55) return '中高';
  if (score >= 0.35) return '中';
  return '低';
}

function maxBaziSignal(years, domain) {
  const config = DOMAIN_CONFIG[domain];
  let best = null;
  for (const year of years || []) {
    const signal = year.lifeEventSignals?.[config.lifeSignal];
    const value = signalValue(signal);
    if (!best || value > best.value) {
      best = { year: year.year, signal, value, tendency: year.tendencyAnalysis };
    }
  }
  return best || { value: 0, signal: null, tendency: null };
}

function baziEvidenceFor(years, domain) {
  const config = DOMAIN_CONFIG[domain];
  return (years || [])
    .map(year => {
      const signal = year.lifeEventSignals?.[config.lifeSignal];
      const labels = year.tendencyAnalysis?.primaryTriggerLabels || [];
      const relevantLabels = labels.filter(label => config.roles.includes(label));
      const relationFlags = year.relationAnalysis?.flags || [];
      const formations = (year.formationAnalysis || [])
        .filter(item => item.strength === '动态成局')
        .map(item => item.description);
      const score = signalValue(signal);
      if (!score && !relevantLabels.length && !formations.length) return null;
      return {
        source: 'bazi',
        type: 'year_signal',
        year: year.year,
        summary: `${year.year} ${config.label}信号 ${signal?.signalIntensity || '低'}；主触发 ${relevantLabels.join('、') || labels.slice(0, 2).join('、') || '-'}；关系 ${relationFlags.slice(0, 3).join('、') || '-'}`,
        weight: clamp((score + relevantLabels.length) / 5)
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4);
}

function ziweiScoreFor(data, domain) {
  const config = DOMAIN_CONFIG[domain];
  const candidates = [];
  const base = data.base?.ziwei?.currentDomainScores || data.base?.ziwei?.domainScores;
  if (base?.[config.ziweiKey]) candidates.push({ scope: data.base?.ziwei?.domainScoreScope?.label || '当前运限', ...base[config.ziweiKey] });
  for (const item of data.ziweiYears || []) {
    if (item.domainScores?.[config.ziweiKey]) {
      candidates.push({ scope: String(item.year), ...item.domainScores[config.ziweiKey] });
    }
  }
  return candidates.sort((a, b) => (b.score || 0) - (a.score || 0))[0] || null;
}

function ziweiEvidenceFor(data, domain) {
  const config = DOMAIN_CONFIG[domain];
  const evidence = [];
  const score = ziweiScoreFor(data, domain);
  if (score) {
    evidence.push({
      source: 'ziwei',
      type: 'domain_score',
      scope: score.scope,
      summary: `${score.scope} ${config.label}：${score.tendency || '-'}(${score.score ?? '-'}/5)；关键词 ${score.keywords?.slice(0, 4).join('、') || '-'}`,
      weight: clamp((score.score || 0) / 5)
    });
  }

  for (const item of data.ziweiYears || []) {
    const interactions = (item.mutagenInteractions || []).filter(interaction => {
      const text = `${interaction.type || ''}${interaction.palaceName || ''}${interaction.note || ''}${interaction.description || ''}`;
      return config.ruleKeywords.some(keyword => text.includes(keyword)) ||
        (score?.mutagens || []).some(mutagen => mutagen.palaceName && text.includes(mutagen.palaceName));
    });
    if (interactions.length) {
      evidence.push({
        source: 'ziwei',
        type: 'mutagen_interaction',
        year: item.year,
        summary: `${item.year} 四化交互：${interactions.slice(0, 3).map(interaction => `${interaction.type || '交互'}@${interaction.palaceName || '-'}`).join('、')}`,
        weight: 0.55
      });
    }
  }
  return evidence.slice(0, 4);
}

function ruleEvidenceFor(ruleMatches, domain) {
  const config = DOMAIN_CONFIG[domain];
  const matches = [];
  for (const category of ruleMatches?.categories || []) {
    for (const match of category.matches || []) {
      const text = `${category.name}${match.title}${match.evidence}${match.interpretation}`;
      if (config.ruleKeywords.some(keyword => text.includes(keyword)) ||
          config.roles.some(role => text.includes(role))) {
        matches.push({
          source: 'rule',
          type: category.id,
          summary: `${match.title}：${match.evidence}`,
          weight: 0.45
        });
      }
    }
  }
  return matches.slice(0, 4);
}

function timeReliability(data) {
  const correction = data.base?.timeCorrection;
  if (!correction?.applied) {
    return {
      penalty: 0.12,
      assumptions: ['时间校正未成功，时柱和紫微宫位需保守解释。']
    };
  }
  const assumptions = [];
  let penalty = 0;
  if (correction.boundary?.corrected?.nearBoundary) {
    penalty += 0.12;
    assumptions.push('校正后时间接近时辰边界，需考虑双盘或保守解释。');
  }
  if (correction.solarTermBoundary?.near) {
    penalty += 0.12;
    assumptions.push('出生时间接近节气交界，月令和调候判断需保守。');
  }
  if (correction.shichenChanged) {
    assumptions.push('标准时间与真太阳时对应时辰不同，正式结论以校正后时辰为准。');
  }
  return { penalty: clamp(penalty, 0, 0.24), assumptions };
}

function conflictsFor(domain, baziSignal, ziweiScore, evidenceCounts) {
  const conflicts = [];
  const baziHigh = baziSignal.value >= 2;
  const baziLow = baziSignal.value === 0;
  const ziweiHigh = (ziweiScore?.score || 0) >= 4;
  const ziweiLow = ziweiScore && ziweiScore.score <= 2;
  if (baziHigh && ziweiLow) {
    conflicts.push(`${DOMAIN_CONFIG[domain].label} 八字信号较强，但紫微专项评分偏低。`);
  }
  if (baziLow && ziweiHigh) {
    conflicts.push(`${DOMAIN_CONFIG[domain].label} 紫微信号较强，但八字年度人生事件信号偏弱。`);
  }
  if (evidenceCounts.rule === 0 && (baziHigh || ziweiHigh)) {
    conflicts.push('缺少经典规则命中支撑，需避免把单一评分写成定论。');
  }
  return conflicts;
}

function buildJudgment(data, domain) {
  const config = DOMAIN_CONFIG[domain];
  const baziSignal = maxBaziSignal(data.years, domain);
  const ziweiScore = ziweiScoreFor(data, domain);
  const baziEvidence = baziEvidenceFor(data.years, domain);
  const ziweiEvidence = ziweiEvidenceFor(data, domain);
  const ruleEvidence = ruleEvidenceFor(data.ruleMatches, domain);
  const evidenceCounts = {
    bazi: baziEvidence.length,
    ziwei: ziweiEvidence.length,
    rule: ruleEvidence.length
  };
  const conflicts = conflictsFor(domain, baziSignal, ziweiScore, evidenceCounts);
  const time = timeReliability(data);
  const calibrationStatus = data.userCalibration?.status || '未校准';

  const baziScore = baziSignal.value / 3;
  const ziweiScoreNorm = ziweiScore ? (ziweiScore.score || 0) / 5 : 0;
  const ruleScore = clamp(ruleEvidence.length / 3);
  const evidenceDensity = clamp((baziEvidence.length + ziweiEvidence.length + ruleEvidence.length) / 9);
  const conflictPenalty = Math.min(0.18, conflicts.length * 0.07);

  const rawConfidence = clamp(
    0.24 +
    baziScore * 0.18 +
    ziweiScoreNorm * 0.18 +
    ruleScore * 0.14 +
    evidenceDensity * 0.12 +
    (CALIBRATION_BONUS[calibrationStatus] || 0) -
    conflictPenalty -
    time.penalty
  );
  const confidence = Math.min(rawConfidence, CALIBRATION_CAP[calibrationStatus] ?? 0.74);

  const tendencyParts = [
    baziSignal.signal?.signalIntensity ? `八字${baziSignal.signal.signalIntensity}` : null,
    ziweiScore?.tendency ? `紫微${ziweiScore.tendency}` : null,
    ruleEvidence.length ? `规则${ruleEvidence.length}条` : null,
    conflicts.length ? `冲突${conflicts.length}项` : null
  ].filter(Boolean);

  return {
    domain,
    label: config.label,
    claim: `${config.label}：${tendencyParts.join('，') || '信号不足，保守观察'}`,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    evidence: {
      bazi: baziEvidence,
      ziwei: ziweiEvidence,
      rules: ruleEvidence
    },
    conflicts,
    assumptions: [
      `现实校准状态：${calibrationStatus}`,
      ...time.assumptions
    ],
    recommendationBoundary: '只作为命盘先验判断单元；需要结合现实资源、预算、健康、家庭条件和用户选择，不写成确定事件。'
  };
}

export function buildHecanSummary(data, focusDomains = null) {
  const domainIds = (focusDomains?.length ? focusDomains : Object.keys(DOMAIN_CONFIG))
    .filter(domain => DOMAIN_CONFIG[domain]);
  const judgments = domainIds
    .map(domain => buildJudgment(data, domain))
    .sort((a, b) => b.confidence - a.confidence);
  const output = {
    input: data.input,
    timeBasis: {
      principle: '真太阳时为正式排盘基准；标准时间仅作为原始输入。',
      corrected: data.base?.timeCorrection?.corrected || null,
      shichenChanged: Boolean(data.base?.timeCorrection?.shichenChanged),
      solarTermBoundary: data.base?.timeCorrection?.solarTermBoundary || null
    },
    calibration: data.userCalibration || null,
    summary: {
      judgmentCount: judgments.length,
      highConfidenceCount: judgments.filter(item => item.confidenceLabel === '高').length,
      mediumOrAboveCount: judgments.filter(item => item.confidence >= 0.35).length,
      conflictCount: judgments.reduce((sum, item) => sum + item.conflicts.length, 0)
    },
    judgments
  };
  attachSchemaValidation(output, validateHecanSummaryOutput);
  return output;
}

function main() {
  const opts = parseArgs();
  const data = runReportData(opts.rawArgs);
  const output = buildHecanSummary(data, opts.focus);
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
