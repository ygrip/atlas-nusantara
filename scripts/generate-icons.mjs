import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// Derived from the approved, text-free claymorphic Indonesia emblem.
// The original is committed as static/brand/indonesia-clay.webp.
const source = await readFile('static/brand/indonesia-clay.webp');
const imageData = `data:image/webp;base64,${source.toString('base64')}`;
const browser = await chromium.launch();
try {
  for (const size of [64, 192, 512]) {
    const isFavicon = size === 64;
    const path = isFavicon ? 'static/brand/favicon-64.png' : `static/icon-${size}.png`;
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<style>
      html,body { margin:0; width:100%; height:100%; }
      body { display:grid; place-items:center; background:${isFavicon ? 'transparent' : '#f6f0e7'}; }
      img { display:block; width:${isFavicon ? '100%' : '92%'}; height:${isFavicon ? '100%' : '92%'}; object-fit:contain; }
    </style><img src="${imageData}" alt="">`);
    await page.locator('img').evaluate(image => image.decode());
    await page.screenshot({ path, omitBackground: isFavicon });
    await page.close();
  }
} finally {
  await browser.close();
}
