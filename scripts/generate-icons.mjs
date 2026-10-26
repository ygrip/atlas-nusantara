import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// Rasterize the project's own simple brand mark; no generated or third-party imagery.
const svg = await readFile('static/icon.svg', 'utf8');
const browser = await chromium.launch();
try {
  for (const size of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<style>html,body{margin:0;background:#dceadf}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
    await page.screenshot({ path: `static/icon-${size}.png` });
    await page.close();
  }
} finally { await browser.close(); }
