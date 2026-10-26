// Build, run `node scripts/serve-built.mjs`, then run this script to refresh the documentation images.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const output = 'docs/screenshots';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const issues = [];

async function open({ mobile = false, dark = false, path = '/' } = {}) {
  let viewport = { width: 1440, height: 1000 };
  if (mobile) viewport = { width: 390, height: 844 };
  const page = await browser.newPage({ viewport, hasTouch: mobile, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  page.on('pageerror', error => issues.push(error.message));
  let theme = 'light';
  if (dark) theme = 'dark';
  await page.addInitScript(theme => {
    localStorage.setItem('PARAGLIDE_LOCALE', 'en');
    localStorage.setItem('nusantara:theme', theme);
  }, theme);
  await page.goto('http://127.0.0.1:4173' + path);
  await page.locator('main').waitFor();
  if (path === '/') await page.locator('.region-list li').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  return page;
}

async function align(page, selector) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.evaluate(selector => {
    const node = document.querySelector(selector);
    if (node) window.scrollTo(0, node.getBoundingClientRect().top + scrollY - 110);
  }, selector);
  await page.waitForTimeout(350);
}

async function save(page, name, selector) {
  if (selector) await page.locator(selector).screenshot({ path: `${output}/${name}.png` });
  else await page.screenshot({ path: `${output}/${name}.png` });
  console.log('Captured', name);
}

try {
  let page = await open();
  await save(page, 'home-light');
  await align(page, '.clay-map');
  await page.locator('.atlas-3d[data-ready="true"]').waitFor({ timeout: 30000 });
  await save(page, 'atlas-3d', '.clay-map');
  await page.locator('.region-list').getByRole('button', { name: 'Jawa Barat 32', exact: true }).click();
  await align(page, '.clay-map');
  await page.waitForTimeout(500);
  await save(page, 'province-relief', '.clay-map');
  await page.locator('.region-list').getByRole('button', { name: 'Kota Bandung 32.73', exact: true }).click();
  await align(page, '.clay-map');
  await page.waitForTimeout(500);
  await save(page, 'city-weather', '.clay-map');
  await page.locator('.atlas-breadcrumb').getByRole('button', { name: 'National' }).click();
  await page.getByRole('button', { name: /Earthquakes BMKG/ }).click();
  await align(page, '.clay-map');
  await page.waitForTimeout(350);
  await save(page, 'earthquake-overlay', '.clay-map');
  await page.getByRole('button', { name: /Disaster reports/ }).click();
  await page.locator('.hazard-list li').first().waitFor();
  await align(page, '.atlas-stage');
  await page.waitForTimeout(350);
  await save(page, 'disaster-reports', '.atlas-stage');
  await page.getByRole('button', { name: /Weather hazards/ }).click();
  await page.locator('.hazard-list li').first().waitFor();
  await align(page, '.atlas-stage');
  await page.waitForTimeout(350);
  await save(page, 'weather-hazards', '.atlas-stage');
  await page.close();

  page = await open({ dark: true });
  await save(page, 'home-dark');
  await page.close();

  page = await open();
  await align(page, '#provinces');
  await save(page, 'province-table', '#provinces');
  await page.getByRole('button', { name: 'Details · Jawa Barat', exact: true }).click();
  await save(page, 'province-popup');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  for (const code of ['32.73', '96.71']) {
    await page.locator('#province-code').selectOption(code);
    await page.locator('.places-form button').click();
  }
  await page.locator('.weather-place .current-weather').first().waitFor();
  await align(page, '#locations');
  await save(page, 'saved-weather', '#locations');
  await page.close();

  page = await open({ mobile: true });
  await save(page, 'mobile-home');
  await page.getByRole('button', { name: 'Quick settings', exact: true }).click();
  await save(page, 'mobile-settings');
  await page.locator('.quick-menu').getByRole('button', { name: /Language/ }).click();
  await save(page, 'language-popup');
  await page.keyboard.press('Escape');
  await align(page, '.clay-map');
  await page.locator('.atlas-3d[data-ready="true"]').waitFor({ timeout: 30000 });
  await save(page, 'mobile-atlas');
  const width = await page.evaluate(() => [document.body.scrollWidth, innerWidth]);
  if (width[0] > width[1]) issues.push('Mobile horizontal overflow: ' + width.join('/'));
  await page.close();

  page = await open({ mobile: true, path: '/missing-island' });
  await save(page, 'error-404');
  await page.close();
  page = await open({ path: '/terms' });
  await save(page, 'terms');
  await page.close();
  if (issues.length) throw Error(issues.join('\n'));
  console.log('Screenshots complete; no page errors or mobile overflow.');
} finally {
  await browser.close();
}
