#!/usr/bin/env node
/**
 * privacy-check.mjs — 检查 staged 内容中是否包含个人报告或明显敏感信息。
 *
 * 用法:
 *   node scripts/privacy-check.mjs
 */

import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');
const policyPath = join(root, 'references', 'privacy-policy.json');

function runGit(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    return { ok: false, stdout: result.stdout || '', stderr: result.stderr || '' };
  }
  return { ok: true, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function loadPolicy() {
  return JSON.parse(readFileSync(policyPath, 'utf8'));
}

function hasPrivatePath(path, privatePaths) {
  return privatePaths.some(pattern => {
    if (pattern.endsWith('/')) return path.startsWith(pattern);
    if (pattern.startsWith('*.')) return path.endsWith(pattern.slice(1));
    if (pattern.endsWith('.*')) return path === pattern.slice(0, -2) || path.startsWith(pattern.slice(0, -1));
    return path === pattern;
  });
}

function sensitivePatternFindings(diffText) {
  const patterns = [
    { type: 'secret_token_shape', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g, message: 'staged diff 中疑似出现 sk- token' },
    { type: 'bearer_token_shape', pattern: /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/gi, message: 'staged diff 中疑似出现 Bearer token' },
    { type: 'stripe_live_key_shape', pattern: /\bpk_live_[A-Za-z0-9]{20,}\b/g, message: 'staged diff 中疑似出现 live key' },
    { type: 'pem_private_key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g, message: 'staged diff 中疑似出现 PEM 私钥' }
  ];
  return patterns.flatMap(item =>
    [...diffText.matchAll(item.pattern)].map(match => ({
      type: item.type,
      sample: match[0].slice(0, 24),
      message: item.message
    }))
  );
}

function main() {
  const policy = loadPolicy();
  if (process.argv.includes('--no-git')) {
    process.stdout.write(JSON.stringify({
      ok: true,
      policy: {
        privatePaths: policy.privatePaths,
        sensitiveKeywordCount: policy.sensitiveKeywords?.length || 0,
        ruleCount: policy.rules?.length || 0
      }
    }, null, 2) + '\n');
    return;
  }

  const staged = runGit(['diff', '--cached', '--name-only']);
  const trackedReports = runGit(['ls-files', 'reports']);
  const stagedDiff = runGit([
    'diff',
    '--cached',
    '--',
    '.',
    ':(exclude)references/privacy-policy.json',
    ':(exclude)scripts/privacy-check.mjs'
  ]);

  const stagedFiles = staged.stdout.split('\n').filter(Boolean);
  const findings = [];

  for (const file of stagedFiles) {
    if (hasPrivatePath(file, policy.privatePaths || [])) {
      findings.push({ type: 'private_path_staged', file, message: '个人/敏感路径不应提交' });
    }
  }

  for (const file of trackedReports.stdout.split('\n').filter(Boolean)) {
    findings.push({ type: 'tracked_report', file, message: 'reports/ 中已有文件被 git 跟踪，请确认是否确实要公开' });
  }

  const diffText = stagedDiff.stdout || '';
  const lowerDiffText = diffText.toLowerCase();
  for (const keyword of policy.sensitiveKeywords || []) {
    if (lowerDiffText.includes(String(keyword).toLowerCase())) {
      findings.push({ type: 'sensitive_keyword', keyword, message: 'staged diff 中出现敏感关键词，请人工确认' });
    }
  }
  findings.push(...sensitivePatternFindings(diffText));

  const output = {
    ok: findings.length === 0,
    stagedFiles,
    findings,
    policy: {
      privatePaths: policy.privatePaths,
      sensitiveKeywordCount: policy.sensitiveKeywords?.length || 0
    }
  };

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  if (findings.length) process.exit(1);
}

main();
