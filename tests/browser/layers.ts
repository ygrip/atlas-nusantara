import { expect, type Page } from '@playwright/test';

/** Opens the layer popup, optionally narrows it with the search box, and picks one layer by its visible name. */
export async function chooseLayer(page: Page, name: string) {
  await page.locator('.layer-picker-trigger').click();
  const dialog = page.locator('dialog.map-dialog[open]');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('searchbox').fill(name);
  await dialog.locator('.layer-option').filter({ hasText: name }).first().click();
  await expect(dialog).toHaveCount(0);
}

/** Opens the searchable place popup on the "Your places" form and picks the first matching place. */
export async function choosePlace(page: Page, name: string) {
  await page.locator('.place-trigger').click();
  const dialog = page.getByRole('dialog', { name: 'Choose a place' });
  await dialog.getByRole('combobox').fill(name);
  await dialog.getByRole('option', { name: new RegExp('^' + name) }).first().click();
  await expect(dialog).toBeHidden();
}

/** The provinces card opens on "Overview"; the province table lives on its second tab. */
export async function openProvinceDetails(page: Page) {
  const tab = page.locator('#provinces').getByRole('tab', { name: 'Province details' });
  // A click made before the page hydrates is lost, so retry until the tab is really selected.
  await expect(async () => {
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 500 });
  }).toPass();
  await expect(page.locator('#provinces .province-table tbody tr').first()).toBeVisible();
}
