import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent('<style>body{margin:0}</style><canvas width="1200" height="630"></canvas>');
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const context = canvas.getContext('2d');
    context.fillStyle = '#f6f0e7'; context.fillRect(0, 0, 1200, 630);
    context.fillStyle = '#dae7d8'; context.beginPath(); context.roundRect(760, 90, 350, 440, 36); context.fill();
    context.fillStyle = '#a74f29'; context.font = 'bold 21px system-ui'; context.fillText('NUSANTARA / ATLAS', 70, 85);
    context.fillStyle = '#392f2b'; context.font = 'bold 72px system-ui'; context.fillText('Indonesia,', 65, 205); context.fillText('region by region.', 65, 290);
    context.font = '26px system-ui'; context.fillStyle = '#6c6057'; context.fillText('Dated observations. Transparent sources.', 70, 365);
    context.font = 'bold 76px system-ui'; context.fillStyle = '#405b48'; context.fillText('37', 805, 220); context.fillText('514', 805, 365);
    context.font = '22px system-ui'; context.fillText('provinces', 805, 255); context.fillText('cities / regencies', 805, 405);
    context.font = '18px system-ui'; context.fillText('Historical 2022 code edition', 790, 470);
    context.fillStyle = '#392f2b'; context.font = '20px system-ui'; context.fillText('Not an emergency alert service. Follow official advisories.', 70, 520);
    context.fillStyle = '#6c6057'; context.font = '19px system-ui'; context.fillText('nusantara.readynaz.com', 70, 570);
  });
  await mkdir('static/og', { recursive: true });
  await page.screenshot({ path: 'static/og/nusantara.png' });
} finally { await browser.close(); }
