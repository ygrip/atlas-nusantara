import { expect, test } from './fixtures';

for (const popup of ['language', 'province']) {
  test(`${popup} popup keeps search fixed while options scroll`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    let url = '/';
    if (popup === 'province') url = '/?layer=destinations&region=32';
    await page.goto(url);
    await expect(page.locator('.language-dialog')).not.toBeVisible();
    let dialog = page.locator('.language-dialog[open]');
    let options = dialog.locator('.language-grid');
    if (popup === 'language') {
      await page.getByRole('button', { name: 'Choose your language', exact: true }).click();
      dialog = page.locator('.language-dialog[open]');
      options = dialog.locator('.language-grid');
    } else {
      await page.locator('.destination-explorer .place-trigger').click();
      dialog = page.locator('dialog.map-dialog[open]');
      options = dialog.locator('.place-list');
    }
    await page.setViewportSize({ width: 390, height: 620 });
    let search = dialog.getByRole('searchbox');
    if (popup === 'province') search = dialog.getByRole('combobox');
    await expect(search).toBeVisible();
    const before = await search.boundingBox();
    await options.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect.poll(() => options.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    const after = await search.boundingBox();
    expect(before?.y).toBe(after?.y);
    await expect(options).toHaveCSS('overflow-y', 'auto');
    await search.fill('zzz');
    await expect(search).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
}
