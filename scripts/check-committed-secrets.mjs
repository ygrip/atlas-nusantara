// Fast, dependency-free guard for newly committed credential material.
// This does not replace GitHub secret scanning or a full history scan.
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';

const files = execFileSync('git', ['ls-files', '-z'], {
  encoding: 'utf8', maxBuffer: 16 * 1024 * 1024
}).split('\0').filter(Boolean);
const textExtension = /\.(?:[cm]?js|tsx?|svelte|jsonc?|ya?ml|toml|md|txt|html|svg|sh|py|sql)$/i;
const patterns = [
  ['private key', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
  ['GitHub access token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/],
  ['GitHub fine-grained token', /\bgithub_pat_[A-Za-z0-9_]{40,}\b/],
  ['OpenAI API key', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{40,}\b/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{24,}\b/],
  ['inline deployment secret', /\b(?:CLOUDFLARE_API_TOKEN|OPENAI_API_KEY|TURNSTILE_SECRET|PUSH_ADMIN_TOKEN|PUSH_SUBSCRIBER_TOKEN)\s*[:=]\s*["']?[A-Za-z0-9+/_=-]{40,}["']?/]
];
const findings = [];
let inspected = 0;
for (const path of files) {
  const name = basename(path);
  if ((/^\.(?:env|dev\.vars)(?:\..+)?$/.test(name) && !/^\.(?:env|dev\.vars)\.example$/.test(name)) ||
      /\.(?:pem|p12|pfx|key)$/i.test(name) ||
      /(?:^|\/)(?:id_rsa|id_ed25519|service-account\.json|credentials\.json)$/.test(path)) {
    findings.push(path + ': credential-like filename must not be tracked');
    continue;
  }
  // Skip binary assets, generated data and unusually large files for a bounded PR guard.
  if (!textExtension.test(path) || path.startsWith('static/data/') || statSync(path).size > 1024 * 1024) continue;
  const content = readFileSync(path, 'utf8');
  if (content.includes('\0')) continue;
  inspected++;
  for (const [label, pattern] of patterns) {
    if (pattern.test(content)) findings.push(path + ': suspected ' + label);
  }
}
if (findings.length) {
  for (const finding of findings) console.error('::error::' + finding);
  process.exitCode = 1;
} else {
  console.log('Credential guard passed: ' + files.length + ' tracked paths checked; scanned ' + inspected + ' text files.');
}
