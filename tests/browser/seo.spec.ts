import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';

const settings = JSON.parse(readFileSync('project.inlang/settings.json', 'utf8'));

test.describe('crawlable static pages', () => {
  test.use({ javaScriptEnabled: false, serviceWorkers: 'block' });

  for (const locale of settings.locales as string[]) {
    test(`${locale}: content and language metadata work without JavaScript${['en', 'id', 'zh-SG'].includes(locale) ? ' @smoke' : ''}`, async ({ page }) => {
      const copy = JSON.parse(readFileSync('messages/' + locale + '.json', 'utf8'));
      let path = '/';
      if (locale !== 'en') path = '/' + locale + '/';
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.locator('.hero-copy p')).toHaveText(copy.atlas_intro);
      await expect(page.locator('.hero-tagline')).toHaveText(copy.og_headline);
      await expect(page.locator('.animated-number').first()).toHaveText(new Intl.NumberFormat(locale).format(38));
      await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(13);
      await expect(page.locator('meta[property="og:locale:alternate"]')).toHaveCount(12);
      const structuredData = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? '{}');
      expect(structuredData).toMatchObject({ inLanguage: locale, author: { name: 'ygrip' } });
      expect(Number.isNaN(Date.parse(structuredData.dateModified))).toBe(false);
    });
  }

  test('crawler guidance is a real text document, not an HTML fallback', async ({ request }) => {
    const response = await request.get('/llms.txt');
    expect(response.status()).toBe(200);
    expect(await response.text()).toMatch(/^# Atlas Nusantara\n/);
  });

  for (const route of ['terms', 'privacy']) {
    test(`${route}: localized legal content has one title and description`, async ({ page }) => {
      const copy = JSON.parse(readFileSync('messages/id.json', 'utf8'));
      await page.goto('/id/' + route);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(copy[route + '_title']);
      await expect(page.locator('head title')).toHaveCount(1);
      await expect(page.locator('meta[name="description"]')).toHaveCount(1);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', copy[route + '_description']);
    });
  }
});
