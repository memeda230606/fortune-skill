import { PILLAR_KEYS, SIGNAL_LEVELS, isSignalLevel } from './constants.mjs';

function ensure(condition, message, errors) {
  if (!condition) errors.push(message);
}

function validatePillars(pillars, errors, path = 'pillars') {
  ensure(pillars && typeof pillars === 'object', `${path} missing`, errors);
  for (const key of PILLAR_KEYS) {
    ensure(Boolean(pillars?.[key]?.ganZhi), `${path}.${key}.ganZhi missing`, errors);
  }
}

function validateLifeEventSignals(lifeEventSignals, errors, path = 'lifeEventSignals') {
  if (!lifeEventSignals) return;
  for (const [name, signal] of Object.entries(lifeEventSignals)) {
    ensure(isSignalLevel(signal?.signalIntensity), `${path}.${name}.signalIntensity must be one of ${SIGNAL_LEVELS.join('/')}`, errors);
    ensure(signal?.level === signal?.signalIntensity, `${path}.${name}.level should mirror signalIntensity`, errors);
  }
}

function validateTimeCorrection(timeCorrection, errors, path = 'timeCorrection') {
  if (!timeCorrection?.applied) return;
  ensure(Boolean(timeCorrection.boundary?.corrected), `${path}.boundary.corrected missing`, errors);
  ensure(Boolean(timeCorrection.solarTermBoundary?.checked), `${path}.solarTermBoundary missing`, errors);
}

function validateYearFortune(yearFortune, errors, path = 'yearFortune') {
  if (!yearFortune) return;
  ensure(Number.isInteger(yearFortune.year), `${path}.year missing`, errors);
  ensure(Boolean(yearFortune.ganZhi), `${path}.ganZhi missing`, errors);
  ensure(Array.isArray(yearFortune.formationAnalysis), `${path}.formationAnalysis must be array`, errors);
  ensure(Array.isArray(yearFortune.combinationTransformations), `${path}.combinationTransformations must be array`, errors);
  ensure(Array.isArray(yearFortune.tendencyAnalysis?.primaryTriggerLabels), `${path}.tendencyAnalysis.primaryTriggerLabels must be array`, errors);
  ensure(Boolean(yearFortune.tendencyAnalysis?._legacy?.triggerLabels), `${path}.tendencyAnalysis._legacy.triggerLabels missing`, errors);
  validateLifeEventSignals(yearFortune.lifeEventSignals, errors, `${path}.lifeEventSignals`);
  for (const [index, month] of (yearFortune.liuYue || []).entries()) {
    validateLifeEventSignals(month.lifeEventSignals, errors, `${path}.liuYue[${index}].lifeEventSignals`);
  }
}

export function validateBaziOutput(output) {
  const errors = [];
  validatePillars(output.pillars, errors);
  ensure(Boolean(output.dayMaster?.gan), 'dayMaster.gan missing', errors);
  ensure(Boolean(output.fiveElements?.scores), 'fiveElements.scores missing', errors);
  validateTimeCorrection(output.timeCorrection, errors);
  if (output.mode === 'yearFortune') {
    validateYearFortune(output.yearFortune, errors);
  } else {
    validateYearFortune(output.annualFortune, errors, 'annualFortune');
    ensure(Boolean(output.tenGods), 'tenGods missing', errors);
    ensure(Boolean(output.hiddenStems), 'hiddenStems missing', errors);
    ensure(Boolean(output.nayin), 'nayin missing', errors);
  }
  return {
    ok: errors.length === 0,
    schema: 'fortune.bazi.v1',
    errors
  };
}

export function validateZiweiOutput(output) {
  const errors = [];
  ensure(Boolean(output.soulPalace?.name), 'soulPalace.name missing', errors);
  ensure(Boolean(output.bodyPalace?.name), 'bodyPalace.name missing', errors);
  ensure(Array.isArray(output.triadAnalysis), 'triadAnalysis must be array', errors);
  validateTimeCorrection(output.timeCorrection, errors);
  if (output.mode === 'yearFortune') {
    ensure(Boolean(output.yearFortuneScope?.sampleDate), 'yearFortuneScope.sampleDate missing', errors);
    ensure(Boolean(output.yearFortuneSummary?.yearly?.mutagen), 'yearFortuneSummary.yearly.mutagen missing', errors);
  } else {
    ensure(Boolean(output.domainScoreScope), 'domainScoreScope missing', errors);
  }
  return {
    ok: errors.length === 0,
    schema: 'fortune.ziwei.v1',
    errors
  };
}

export function validateFortuneReportDataOutput(output) {
  const errors = [];
  validatePillars(output.base?.pillars, errors, 'base.pillars');
  validateTimeCorrection(output.base?.timeCorrection, errors, 'base.timeCorrection');
  ensure(Boolean(output.base?.tenGods?.zhiMain), 'base.tenGods.zhiMain missing', errors);
  ensure(Boolean(output.base?.tenGods?.zhiFull), 'base.tenGods.zhiFull missing', errors);
  ensure(Array.isArray(output.years), 'years must be array', errors);
  for (const [index, year] of (output.years || []).entries()) {
    validateLifeEventSignals(year.lifeEventSignals, errors, `years[${index}].lifeEventSignals`);
  }
  ensure(Boolean(output.ruleMatches?.summary), 'ruleMatches.summary missing', errors);
  return {
    ok: errors.length === 0,
    schema: 'fortune.reportData.v1',
    errors
  };
}

export function validateHecanSummaryOutput(output) {
  const errors = [];
  ensure(Boolean(output.timeBasis?.principle), 'timeBasis.principle missing', errors);
  ensure(Number.isInteger(output.summary?.judgmentCount), 'summary.judgmentCount missing', errors);
  ensure(Array.isArray(output.judgments), 'judgments must be array', errors);
  ensure(output.summary?.judgmentCount === output.judgments?.length, 'summary.judgmentCount should equal judgments.length', errors);
  for (const [index, judgment] of (output.judgments || []).entries()) {
    ensure(Boolean(judgment.domain), `judgments[${index}].domain missing`, errors);
    ensure(Boolean(judgment.claim), `judgments[${index}].claim missing`, errors);
    ensure(typeof judgment.confidence === 'number' && judgment.confidence >= 0 && judgment.confidence <= 1, `judgments[${index}].confidence must be 0..1`, errors);
    ensure(['低', '中', '中高', '高'].includes(judgment.confidenceLabel), `judgments[${index}].confidenceLabel invalid`, errors);
    ensure(Boolean(judgment.evidence), `judgments[${index}].evidence missing`, errors);
    ensure(Array.isArray(judgment.evidence?.bazi), `judgments[${index}].evidence.bazi must be array`, errors);
    ensure(Array.isArray(judgment.evidence?.ziwei), `judgments[${index}].evidence.ziwei must be array`, errors);
    ensure(Array.isArray(judgment.evidence?.rules), `judgments[${index}].evidence.rules must be array`, errors);
    ensure(Array.isArray(judgment.conflicts), `judgments[${index}].conflicts must be array`, errors);
    ensure(Array.isArray(judgment.assumptions), `judgments[${index}].assumptions must be array`, errors);
  }
  return {
    ok: errors.length === 0,
    schema: 'fortune.hecanSummary.v1',
    errors
  };
}

export function attachSchemaValidation(output, validator) {
  const validation = validator(output);
  output.schemaValidation = validation.errors.length
    ? validation
    : { ok: true, schema: validation.schema };
  if (!validation.ok) {
    throw new Error(`schema validation failed: ${validation.errors.join('; ')}`);
  }
  return output;
}
