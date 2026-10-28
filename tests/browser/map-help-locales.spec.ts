import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const locales = ['en', 'id', 'ms', 'fil', 'th', 'vi', 'my', 'km', 'lo', 'zh-SG', 'ta', 'tet', 'pt-TL'];
test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });

for (const locale of locales) {
  const messages = JSON.parse(readFileSync(`messages/${locale}.json`, 'utf8'));
  test(`${locale}: map help renders from its own catalog in both modes`, async ({ page }) => {
    let path = '/';
    if (locale !== 'en') path = '/' + locale + '/';
    await page.goto(path);
    const map = page.locator('.clay-map');
    await map.scrollIntoViewIfNeeded();
    await expect.poll(() => map.locator('.atlas-3d').getAttribute('aria-label')).toContain(messages.map_help_3d);
    await map.locator('.segmented button').nth(1).click();
    await expect(map.locator('.pane-2d .map-help')).toHaveText(messages.map_help);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
