import { expect, test } from './fixtures';

test.use({ serviceWorkers: 'block' });

for (const theme of ['light', 'dark']) {
  test(`severity pills meet WCAG AA text contrast in ${theme} theme`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('PARAGLIDE_LOCALE', 'en'));
    await page.route('**/data/observations/hazards.json', async route => {
      const response = await route.fetch();
      const data = await response.json();
      const template = data.warnings.items[0];
      data.warnings.items = ['Extreme', 'Severe', 'Moderate', 'Minor'].map((severity, index) => ({
        ...template, id: `contrast-${index}`, severity,
        effective: new Date(Date.now() - 3600_000).toISOString(),
        expires: new Date(Date.now() + 3600_000).toISOString()
      }));
      await route.fulfill({ response, json: data });
    });
    await page.goto('/?layer=hazard');
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    for (const level of ['extreme', 'severe', 'moderate', 'minor']) {
      const pills = page.locator(`.severity-pill.severity-${level}`);
      await expect(pills.first()).toBeVisible();
      const ratios = await pills.evaluateAll(elements => {
        function luminance(color: string) {
          const channels = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map(value => {
            const channel = value / 255;
            if (channel <= .04045) return channel / 12.92;
            return ((channel + .055) / 1.055) ** 2.4;
          });
          return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
        }
        return elements.map(element => {
          const style = getComputedStyle(element);
          const foreground = luminance(style.color);
          const background = luminance(style.backgroundColor);
          return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
        });
      });
      for (const ratio of ratios) expect(ratio, `${theme} ${level}`).toBeGreaterThanOrEqual(4.5);
    }
  });
}
