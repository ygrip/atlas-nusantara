// Stitched full-page capture (workflow from MengTo/Skills stitched-full-page-capture).
// Native fullPage screenshots go blank on lazy/scroll-animated pages, so: warm the page by scrolling
// once, then capture settled viewport slices and stitch them. Fixed/sticky chrome is hidden after the
// first slice so it is not repeated.
// Usage: node scripts/capture-full-page.mjs [--url http://127.0.0.1:4173/] [--out docs/screenshots] [--only light,dark,mobile]
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf('--' + name);
  if (index === -1) return fallback;
  return args[index + 1];
};
const url = option('url', 'http://127.0.0.1:4173/');
const out = option('out', 'docs/screenshots');
const only = option('only', 'light,dark,mobile').split(',');
const settleMs = Number(option('wait', 1500));
const targets = [
  { name: 'full-page-light', width: 1440, height: 1000, dark: false },
  { name: 'full-page-dark', width: 1440, height: 1000, dark: true },
  { name: 'full-page-mobile', width: 390, height: 844, dark: false, mobile: true }
].filter(target => only.some(key => target.name.endsWith(key)));

await mkdir(out, { recursive: true });
const browser = await chromium.launch();

async function scrollTo(page, y) {
  await page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), y);
  await page.waitForTimeout(settleMs);
}

for (const target of targets) {
  const page = await browser.newPage({
    viewport: { width: target.width, height: target.height },
    hasTouch: Boolean(target.mobile),
    deviceScaleFactor: 1
  });
  const theme = target.dark ? 'dark' : 'light';
  await page.addInitScript(value => {
    localStorage.setItem('PARAGLIDE_LOCALE', 'en');
    localStorage.setItem('nusantara:theme', value);
  }, theme);
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('main').waitFor();
  await page.evaluate(() => document.fonts.ready);

  const total = () => page.evaluate(() => document.documentElement.scrollHeight);
  // Warm: scroll top to bottom once so lazy media and reveals mount.
  for (let y = 0; y < await total(); y += target.height * 0.8) await scrollTo(page, y);
  // Reload so scroll-spy, hero entrance and counters restart from the top; media stays cached.
  await page.reload({ waitUntil: 'load' });
  await page.locator('main').waitFor();
  await page.evaluate(() => document.fonts.ready);
  // The body gradient is background-attachment: fixed, which would band between slices.
  await page.addStyleTag({ content: 'body{background-attachment:scroll!important}*{scroll-behavior:auto!important}' });
  await scrollTo(page, 0);
  await page.waitForTimeout(2500); // let the hero entrance finish

  const height = await total();
  const step = target.height - 120; // overlap keeps seams away from content
  const slices = [];
  for (let y = 0; ; y += step) {
    const targetY = Math.min(y, Math.max(0, height - target.height));
    await scrollTo(page, targetY);
    const actualY = await page.evaluate(() => Math.round(window.scrollY));
    // Keep the masthead only in the first slice; hide every other fixed/sticky element throughout.
    await page.evaluate(first => {
      for (const element of document.querySelectorAll('body *')) {
        const position = getComputedStyle(element).position;
        if (position !== 'fixed' && position !== 'sticky') continue;
        const keep = first && element.closest('.masthead');
        element.style.visibility = keep ? '' : 'hidden';
      }
    }, slices.length === 0);
    slices.push({ y: actualY, buffer: await page.screenshot() });
    if (targetY >= height - target.height) break;
  }
  const composites = slices.map(slice => ({ input: slice.buffer, left: 0, top: slice.y }));
  const stitched = sharp({ create: { width: target.width, height, channels: 3, background: '#ffffff' } })
    .composite(composites);
  const file = `${out}/${target.name}.jpg`;
  await stitched.jpeg({ quality: 82, mozjpeg: true }).toFile(file);
  console.log(target.name, target.width + 'x' + height, slices.length + ' slices');
  await page.close();
}
await browser.close();
