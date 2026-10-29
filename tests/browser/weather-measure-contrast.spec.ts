import { expect, test } from './fixtures';

test.use({ serviceWorkers: 'block' });

for (const theme of ['light', 'dark']) {
  test(`selected weather measures have enhanced text and unit contrast in ${theme}`, async ({ page }) => {
    await page.goto('/');
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    await page.locator('#weather-tab-history').click();
    const buttons = page.locator('.measure-picker button');
    await expect(buttons).toHaveCount(5);
    for (const button of await buttons.all()) {
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      const contrast = await button.evaluate(element => {
        function luminance(color: string) {
          const channels = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map(value => {
            const channel = value / 255;
            if (channel <= .04045) return channel / 12.92;
            return ((channel + .055) / 1.055) ** 2.4;
          });
          return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
        }
        const style = getComputedStyle(element);
        const unit = element.querySelector('small');
        if (!unit) throw Error('Measure unit is missing');
        const unitStyle = getComputedStyle(unit);
        const background = luminance(style.backgroundColor);
        return {
          ratios: [style.color, unitStyle.color].map(color => {
            const foreground = luminance(color);
            return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
          }),
          unitOpacity: unitStyle.opacity
        };
      });
      for (const ratio of contrast.ratios) expect(ratio).toBeGreaterThanOrEqual(7);
      expect(contrast.unitOpacity).toBe('1');
    }
  });
}
