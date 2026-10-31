import { expect, test, type Page } from './fixtures';

const localeStorageKey = 'PARAGLIDE_LOCALE';

async function useEnglish(page: Page) {
  await page.addInitScript(key => localStorage.setItem(key, 'en'), localeStorageKey);
}

test.describe('error pages and legal pages', () => {
  test('unknown routes show an illustrated 404 and link back to the atlas @smoke', async ({ page }) => {
    await useEnglish(page);
    await page.setViewportSize({ width: 375, height: 812 });
    const response = await page.goto('/a-missing-place');
    expect(response?.status()).toBe(404);
    await expect(page.getByText('Error 404', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'This place is not on the map.' })).toBeVisible();
    await expect(page.getByRole('img', { name: /compass/ })).toBeVisible();
    const fitsViewport = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    expect(fitsViewport).toBe(true);
    await page.getByRole('link', { name: 'Back to the atlas', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('searchbox')).toBeVisible();
  });

  for (const status of [500, 503]) {
    test(`exported ${status}.html works without JavaScript, fonts or images`, async ({ browser }) => {
      const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: 'dark', viewport: { width: 375, height: 812 } });
      try {
        const page = await context.newPage();
        const externalAssets: string[] = [];
        page.on('request', request => {
          if (['script', 'font', 'image'].includes(request.resourceType())) externalAssets.push(request.url());
        });
        await page.goto(`/${status}.html`);
        await expect(page.getByText(`Error ${status}`, { exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.getByRole('img', { name: /compass/ })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Back to the atlas' })).toHaveAttribute('href', '/');
        expect(externalAssets).toEqual([]);
        const fitsViewport = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
        expect(fitsViewport).toBe(true);
      } finally {
        await context.close();
      }
    });
  }

  for (const [path, heading, footerLink] of [['/terms', 'Terms of use', 'Terms'], ['/privacy', 'Privacy notice', 'Privacy']]) {
    test(`${path} renders its legal card and footer links reach it`, async ({ page }) => {
      await useEnglish(page);
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expect(page.getByText('Last updated: 2026-10-26')).toBeVisible();
      await page.getByRole('link', { name: '← Atlas Nusantara' }).click();
      await expect(page.getByRole('searchbox')).toBeVisible();
      await page.locator('footer').getByRole('link', { name: footerLink }).click();
      await expect(page).toHaveURL(new RegExp(path + '$'));
    });
  }
});
