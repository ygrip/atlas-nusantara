import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const headers = readFileSync('build/_headers', 'utf8');
const cspLine = headers.split('\n').find(line => line.trim().startsWith('Content-Security-Policy:'));
if (!cspLine) throw Error('Build the site before running CSP browser checks.');
const policy = cspLine.trim().slice('Content-Security-Policy:'.length).trim();

test.use({ serviceWorkers: 'block' });

test('CSP permits the atlas and opt-in ads, while blocking untrusted inline code', async ({ page }) => {
  const violations: string[] = [];
  const adRequests: string[] = [];
  await page.exposeFunction('recordPolicyViolation', (directive: string) => violations.push(directive));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', event => {
      void (window as unknown as { recordPolicyViolation: (directive: string) => Promise<void> }).recordPolicyViolation(event.effectiveDirective);
    });
  });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'pagead2.googlesyndication.com') {
      adRequests.push(url.href);
      await route.fulfill({ contentType: 'application/javascript', body: 'window.adsbygoogle={push:function(){window.__testAdRequests=(window.__testAdRequests||0)+1;}};' });
      return;
    }
    if (url.origin === 'http://127.0.0.1:4173' && route.request().resourceType() === 'document') {
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': policy } });
      return;
    }
    await route.continue();
  });
  await page.goto('/');
  await expect(page.locator('.region-table tbody tr')).toHaveCount(38);
  expect(adRequests).toHaveLength(0);
  await expect(page.getByRole('button', { name: 'Load advertisement' })).toBeVisible();
  await page.getByRole('button', { name: 'Load advertisement' }).click();
  await expect(page.locator('ins.adsbygoogle')).toHaveAttribute('data-ad-slot', '5292790825');
  await expect(page.locator('ins.adsbygoogle')).not.toHaveAttribute('data-adtest');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __testAdRequests?: number }).__testAdRequests)).toBe(1);
  expect(adRequests).toHaveLength(1);
  expect(violations).toEqual([]);
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.__untrustedScriptExecuted=true;';
    document.head.append(script);
  });
  await expect.poll(() => violations).toContain('script-src-elem');
  expect(await page.evaluate(() => (window as unknown as { __untrustedScriptExecuted?: boolean }).__untrustedScriptExecuted)).toBeUndefined();
});

test('Turnstile loads on demand with the configured sitekey and archive action', async ({ page }) => {
  const revision = '123e4567-e89b-42d3-a456-426614174000';
  const generatedAt = new Date().toISOString();
  const validUntil = new Date(Date.now() + 600_000).toISOString();
  let challengeRequests = 0;
  await page.route('**/data/published/manifest.json', route => route.fulfill({ json: {
    schemaVersion: 1, revision, generatedAt, validUntil,
    summary: `/data/published/${revision}/summary.json`, snapshots: {}
  } }));
  await page.route(`**/data/published/${revision}/summary.json`, route => route.fulfill({ json: {
    generatedAt, retentionDays: 365, counts: { warning: 1, earthquake: 0, incident: 0, hazard: 0 },
    sources: [{ id: 'synthetic-browser-fixture', type: 'warning', status: 'healthy', name: 'Synthetic browser fixture', intervalMinutes: 5, sourceUrl: 'https://example.org', termsUrl: 'https://example.org' }],
    observations: [], derivedFacts: []
  } }));
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', route => {
    challengeRequests += 1;
    return route.fulfill({ contentType: 'application/javascript', body: 'window.turnstile={render:function(container,options){container.dataset.sitekey=options.sitekey;container.dataset.action=options.action;options.callback("synthetic-browser-proof");return "fixture";},remove:function(){},reset:function(){}};' });
  });
  await page.route('http://127.0.0.1:4173/', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': policy } });
  });
  await page.goto('/');
  const download = page.locator('button[data-kind="warning"]');
  await expect(download).toBeVisible();
  expect(challengeRequests).toBe(0);
  await download.click();
  await expect(page.locator('.turnstile-widget')).toHaveAttribute('data-sitekey', '0x4AAAAAAFpTFqEhiXanSRaa');
  await expect(page.locator('.turnstile-widget')).toHaveAttribute('data-action', 'archive_download');
  expect(challengeRequests).toBe(1);
});
