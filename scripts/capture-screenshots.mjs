// Build, run `node scripts/serve-built.mjs`, then run this script to refresh the documentation images.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const output = 'docs/screenshots';
const mobileOnly = process.argv.includes('--mobile');
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
  if (path === '/') await page.locator('.region-table tbody tr').first().waitFor({ timeout: 30000 });
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

/** Opens the layer popup, narrows it by name and picks the first match. */
async function chooseLayer(page, name) {
  await page.locator('.layer-picker-trigger').click();
  const dialog = page.locator('dialog.map-dialog[open]');
  await dialog.getByRole('searchbox').fill(name);
  await dialog.locator('.layer-option').filter({ hasText: name }).first().click();
  await dialog.waitFor({ state: 'detached' });
}

/** Opens the searchable place popup on the "Your places" form and picks the first match. */
async function choosePlace(page, name) {
  await page.locator('.place-trigger').click();
  const dialog = page.getByRole('dialog', { name: 'Choose a place' });
  await dialog.getByRole('combobox').fill(name);
  await dialog.getByRole('option', { name: new RegExp('^' + name) }).first().click();
  await dialog.waitFor({ state: 'hidden' });
}

async function openProvinceDetails(page) {
  const tab = page.locator('#provinces').getByRole('tab', { name: 'Province details' });
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await tab.click();
    if (await tab.getAttribute('aria-selected') === 'true') break;
    await page.waitForTimeout(300);
  }
  await page.locator('#provinces .province-table tbody tr').first().waitFor();
}

async function captureSections(page, prefix) {
  for (const [name, selector] of [['island-groups', '.island-chart'], ['observatory', '#summary'], ['support', '#support'], ['footer', '.site-footer']]) {
    await align(page, selector);
    await save(page, `${prefix}-${name}`, selector);
  }
}

try {
  let page;
  if (!mobileOnly) {
  page = await open();
  await save(page, 'home-light');
  await captureSections(page, 'desktop');
  await page.locator('.atlas-breadcrumb').getByRole('button', { name: 'National', exact: true }).click();
  await page.locator('.region-table tbody tr').first().waitFor();
  await align(page, '.clay-map');
  await page.locator('.atlas-3d[data-ready="true"]').waitFor({ timeout: 30000 });
  await save(page, 'atlas-3d', '.clay-map');
  await page.locator('.region-table').getByRole('button', { name: 'Jawa Barat 32', exact: true }).click();
  await align(page, '.clay-map');
  await page.waitForTimeout(500);
  await save(page, 'province-relief', '.clay-map');
  await page.locator('.region-table').getByRole('button', { name: 'Kota Bandung 32.73', exact: true }).click();
  await align(page, '.clay-map');
  await page.waitForTimeout(500);
  await save(page, 'city-weather', '.clay-map');
  await save(page, 'region-directory', '.region-directory');
  await page.locator('.atlas-breadcrumb').getByRole('button', { name: 'National' }).click();
  await chooseLayer(page, 'Earthquakes');
  await align(page, '.clay-map');
  await page.waitForTimeout(350);
  await save(page, 'earthquake-overlay', '.clay-map');
  await chooseLayer(page, 'Disaster reports');
  await page.locator('.hazard-panel[aria-busy="false"]').waitFor();
  await align(page, '.atlas-stage');
  await page.waitForTimeout(350);
  await save(page, 'disaster-reports', '.atlas-stage');
  await chooseLayer(page, 'Weather hazards');
  await page.locator('.hazard-panel[aria-busy="false"]').waitFor();
  await align(page, '.atlas-stage');
  await page.waitForTimeout(350);
  await save(page, 'weather-hazards', '.atlas-stage');
  for (const [layer, name] of [['Mountains', 'layer-mountains'], ['Destinations', 'layer-destinations'], ['Population', 'layer-population'], ['Cuisine', 'layer-cuisine'], ['Flora', 'layer-flora'], ['Fauna', 'layer-fauna'], ['Local languages', 'layer-languages']]) {
    await chooseLayer(page, layer);
    await align(page, '.atlas-stage');
    await page.waitForTimeout(900);
    await save(page, name, '.atlas-stage');
  }
  await page.close();

  page = await open({ dark: true });
  await save(page, 'home-dark');
  await captureSections(page, 'desktop-dark');
  await page.close();

  page = await open({ path: '/?region=32' });
  await align(page, '#provinces');
  await openProvinceDetails(page);
  await page.locator('#provinces tr.active-region').scrollIntoViewIfNeeded();
  await save(page, 'province-table', '#provinces');
  await page.getByRole('button', { name: 'Details · Jawa Barat', exact: true }).click();
  await save(page, 'province-popup');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  for (const place of ['Kota Bandung', 'Kota Jayapura']) {
    await choosePlace(page, place);
    await page.locator('.places-form button[type="submit"], .places-form > div > button:not(.place-trigger)').last().click();
  }
  await page.locator('.weather-place .current-weather').first().waitFor();
  await align(page, '#locations');
  await save(page, 'saved-weather', '#locations');
  await page.close();

  }

  page = await open({ mobile: true });
  await save(page, 'mobile-home');
  await page.getByRole('button', { name: 'Quick settings', exact: true }).click();
  await save(page, 'mobile-settings');
  await page.locator('.quick-menu').getByRole('button', { name: 'Choose your language', exact: true }).click();
  await save(page, 'language-popup');
  await page.getByRole('dialog', { name: 'Choose your language' }).getByRole('searchbox').fill('Vietnamese');
  await save(page, 'language-filtered');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Choose your language' }).waitFor({ state: 'hidden' });
  await captureSections(page, 'mobile');
  await align(page, '.clay-map');
  await page.locator('.atlas-3d[data-ready="true"]').waitFor({ timeout: 30000 });
  await save(page, 'mobile-atlas');
  const width = await page.evaluate(() => [document.body.scrollWidth, innerWidth]);
  if (width[0] > width[1]) issues.push('Mobile horizontal overflow: ' + width.join('/'));
  await page.close();

  page = await open({ mobile: true, dark: true });
  await save(page, 'mobile-home-dark');
  await page.getByRole('button', { name: 'Quick settings', exact: true }).click();
  await save(page, 'mobile-settings-dark');
  await page.keyboard.press('Escape');
  await captureSections(page, 'mobile-dark');
  await page.close();

  if (!mobileOnly) {
  page = await open({ mobile: true, path: '/missing-island' });
  await save(page, 'error-404');
  await page.close();
  page = await open({ path: '/terms' });
  await save(page, 'terms');
  await page.close();
  }
  if (issues.length) throw Error(issues.join('\n'));
  console.log('Screenshots complete; no page errors or mobile overflow.');
} finally {
  await browser.close();
}
