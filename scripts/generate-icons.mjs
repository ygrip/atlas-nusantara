import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

// Transparent PNG variants derived from the approved claymorphic Indonesia emblem.
// The source and every rendered product icon must preserve alpha transparency.

const source = await readFile('static/brand/indonesia-clay.webp');
const imageData = `data:image/webp;base64,${source.toString('base64')}`;
const browser = await chromium.launch();
try {
  for (const size of [64, 192, 256, 512]) {
    let path = `static/icon-${size}.png`;
    if (size === 64) path = 'static/brand/favicon-64.png';
    if (size === 256) path = 'static/brand/logo-256.png';
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<style>
      html,body { margin:0; width:100%; height:100%; background:transparent; }
      body { display:grid; place-items:center; }
      img { display:block; width:92%; height:92%; object-fit:contain; }
    </style><img src="${imageData}" alt="">`);
    await page.locator('img').evaluate(image => image.decode());
    const sourceBorder = await page.locator('img').evaluate(image => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) throw Error('Canvas is unavailable while checking source alpha');
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let opaqueBorderPixels = 0;
      for (let x = 0; x < canvas.width; x += 1) {
        if (pixels[(x * 4) + 3] === 255) opaqueBorderPixels += 1;
        if (pixels[(((canvas.height - 1) * canvas.width + x) * 4) + 3] === 255) opaqueBorderPixels += 1;
      }
      for (let y = 1; y < canvas.height - 1; y += 1) {
        if (pixels[(y * canvas.width * 4) + 3] === 255) opaqueBorderPixels += 1;
        if (pixels[((y * canvas.width + canvas.width - 1) * 4) + 3] === 255) opaqueBorderPixels += 1;
      }
      return opaqueBorderPixels;
    });
    if (sourceBorder !== 0) throw Error(`Source WEBP has ${sourceBorder} fully opaque edge pixels; review its alpha border before generating icons`);
    const png = await page.screenshot({ omitBackground: true });
    const imageDataUrl = `data:image/png;base64,${png.toString('base64')}`;
    const alpha = await page.evaluate(async dataUrl => {
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (!context) throw Error('Canvas is unavailable while verifying icon transparency');
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, image.width, image.height).data;
      return {
        corner: pixels[3],
        center: pixels[(Math.floor(image.height / 2) * image.width + Math.floor(image.width / 2)) * 4 + 3]
      };
    }, imageDataUrl);
    if (alpha.corner !== 0 || alpha.center === 0) throw Error(`${path} has a background or a missing logo (corner alpha=${alpha.corner}, center alpha=${alpha.center})`);
    await writeFile(path, png);
    await page.close();
  }
} finally {
  await browser.close();
}
