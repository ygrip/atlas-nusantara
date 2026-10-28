// Renders one social-preview image per language: static/og/nusantara-<locale>.png
// (static/og/nusantara.png stays the English default). Run: npm run og:generate
// The PNGs are committed, so builds never need a browser or fonts for Thai, Burmese, Khmer, etc.
import { chromium } from '@playwright/test';
import { mkdir, readFile, copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const WIDTH = 1200;
const HEIGHT = 630;
const PROVINCES = 38;
const CITIES_AND_REGENCIES = 514;
const require = createRequire(import.meta.url);

const settings = JSON.parse(await readFile('project.inlang/settings.json', 'utf8'));
const logo = 'data:image/webp;base64,' + (await readFile('static/brand/indonesia-clay.webp')).toString('base64');
const nunito = 'data:font/woff2;base64,' + (await readFile(require.resolve('@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2'))).toString('base64');

const escapeHtml = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function page(locale, text) {
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><style>
@font-face { font-family: 'Nunito'; src: url(${nunito}) format('woff2'); font-weight: 200 1000; }
* { box-sizing: border-box; margin: 0; }
:root { --page: #f8f5f3; --surface: #fffcfa; --panel: #f2e9e6; --text: #302628; --muted: #665659; --border: #e6d6d3;
  --accent: #b92238; --green: #386d53; --gold: #9a722f; --red-wash: #f5dedf; --green-wash: #e3eee5; --gold-wash: #f4ead9; --shadow: #7f47503b; }
html, body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
body { position: relative; font-family: 'Nunito', 'Noto Sans', system-ui, sans-serif; color: var(--text);
  background: radial-gradient(900px 520px at 0% -10%, var(--red-wash), transparent 62%), radial-gradient(700px 480px at 100% 8%, var(--green-wash), transparent 60%), radial-gradient(620px 420px at 78% 108%, var(--gold-wash), transparent 66%), var(--page); }
.blob { position: absolute; border-radius: 50%; }
.blob.one { width: 260px; height: 260px; left: -90px; bottom: -110px; background: var(--red-wash); box-shadow: inset 12px 14px 24px #ffffffb0, inset -14px -16px 28px #b9223820; }
.blob.two { width: 150px; height: 150px; right: 520px; top: -62px; background: var(--gold-wash); box-shadow: inset 8px 10px 18px #ffffffb0, inset -10px -12px 20px #9a722f26; }
.card { position: absolute; left: 44px; top: 44px; width: 1112px; height: 542px; border: 3px solid #fffaf6; border-radius: 56px;
  background: linear-gradient(160deg, #fffefd, var(--surface) 55%, #f8efec); box-shadow: 0 12px 0 -2px #e4d2ce, 18px 30px 56px #81565a30, inset 5px 6px 10px #ffffffd0, inset -8px -10px 18px #ae787b18; }
.copy { position: absolute; left: 92px; top: 80px; width: 540px; height: 466px; display: flex; flex-direction: column; justify-content: space-between; align-items: flex-start; }
.brand-name { padding: 9px 22px; border-radius: 999px; background: var(--red-wash); box-shadow: inset 3px 4px 6px #ffffffb8, inset -3px -4px 7px #b9223822; font-size: 25px; font-weight: 900; letter-spacing: .02em; color: var(--accent); }
h1 { font-size: 68px; line-height: 1.12; font-weight: 900; letter-spacing: -.01em; }
.tagline { font-size: 27px; line-height: 1.35; font-weight: 700; color: var(--muted); }
.cta { padding: 13px 26px; border-radius: 999px; background: var(--accent); color: #fff; font-size: 21px; line-height: 1.3; font-weight: 800;
  box-shadow: 0 6px 0 #8e1a2c, 4px 10px 16px #b9223840, inset 3px 3px 5px #ffffff4d; }
.note { font-size: 16px; line-height: 1.4; font-weight: 700; color: var(--muted); }
.domain { position: absolute; right: 92px; bottom: 76px; font-size: 18px; font-weight: 800; color: var(--muted); }
.logo-stage { position: absolute; right: 100px; top: 78px; width: 260px; height: 260px; display: grid; place-items: center; border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, #fff, var(--panel) 72%); box-shadow: 0 10px 0 #e4d2ce, 12px 22px 36px var(--shadow), inset 6px 8px 12px #fff, inset -8px -10px 18px #ae787b24; }
.logo-stage img { width: 218px; height: 218px; object-fit: contain; filter: drop-shadow(5px 9px 8px #5e4a3455); }
.stat { position: absolute; width: 232px; padding: 20px 26px 22px; border-radius: 40px; box-shadow: 0 9px 0 var(--edge), 10px 18px 28px var(--shadow), inset 4px 5px 8px #ffffffd0, inset -6px -8px 14px #00000012; }
.stat strong { display: block; font-size: 70px; line-height: 1; font-weight: 900; }
.stat span { display: block; margin-top: 6px; font-size: 21px; line-height: 1.2; font-weight: 800; }
.stat.provinces { --edge: #c7dccb; right: 330px; top: 380px; background: linear-gradient(155deg, #f0f7f2, var(--green-wash)); color: var(--green); transform: rotate(-3deg); }
.stat.cities { --edge: #e6d3ae; right: 92px; top: 366px; background: linear-gradient(155deg, #fbf4e6, var(--gold-wash)); color: var(--gold); transform: rotate(2.5deg); }
</style></head><body>
<div class="blob one"></div><div class="blob two"></div>
<div class="card"></div>
<div class="copy" id="copy">
  <div class="brand-name">${escapeHtml(text.site_title)}</div>
  <h1 id="headline">${escapeHtml(text.og_headline)}</h1>
  <p class="tagline" id="tagline">${escapeHtml(text.og_tagline)}</p>
  <p class="cta">${escapeHtml(text.og_cta)}</p>
  <p class="note">${escapeHtml(text.disclaimer)}</p>
</div>
<p class="domain">nusantara.readynaz.com</p>
<div class="logo-stage"><img src="${logo}" alt=""></div>
<div class="stat provinces"><strong>${PROVINCES}</strong><span>${escapeHtml(text.stat_provinces)}</span></div>
<div class="stat cities"><strong>${CITIES_AND_REGENCIES}</strong><span>${escapeHtml(text.og_cities_regencies)}</span></div>
</body></html>`;
}

// Long text (Burmese, Khmer, Tamil) shrinks until the whole left column fits, instead of overflowing.
async function fitCopy(browserPage) {
  await browserPage.evaluate(() => {
    const column = document.getElementById('copy');
    const headline = document.getElementById('headline');
    const tagline = document.getElementById('tagline');
    const overflows = () => column.scrollHeight > column.clientHeight + 1;
    let headlineSize = 68;
    while (headlineSize > 40 && overflows()) {
      headlineSize -= 2;
      headline.style.fontSize = headlineSize + 'px';
    }
    let taglineSize = 27;
    while (taglineSize > 18 && overflows()) {
      taglineSize -= 1;
      tagline.style.fontSize = taglineSize + 'px';
    }
  });
}

await mkdir('static/og', { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  for (const locale of settings.locales) {
    const text = JSON.parse(await readFile('messages/' + locale + '.json', 'utf8'));
    const browserPage = await context.newPage();
    await browserPage.setContent(page(locale, text), { waitUntil: 'load' });
    await browserPage.evaluate(() => document.fonts.ready);
    await fitCopy(browserPage);
    await browserPage.screenshot({ path: 'static/og/nusantara-' + locale + '.png' });
    await browserPage.close();
    console.log('og image: ' + locale);
  }
} finally { await browser.close(); }
await copyFile('static/og/nusantara-' + settings.baseLocale + '.png', 'static/og/nusantara.png');
