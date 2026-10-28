import { expect, test } from './fixtures';
test.use({ hasTouch: true });

test('installation is user-triggered and unsupported prompts use manual guidance', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('PARAGLIDE_LOCALE', 'en');
    window.addEventListener('beforeinstallprompt', event => { if (event.isTrusted) { event.preventDefault(); event.stopImmediatePropagation(); } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Install app', exact: true }).click();
  await expect(page.getByText('Use your browser menu to install this app. In Safari, choose Share, then Add to Home Screen.')).toBeVisible();
  await page.evaluate(() => {
    const state = window as Window & { installCalls?: number };
    state.installCalls = 0;
    const invitation = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(invitation, { prompt: async () => { state.installCalls = (state.installCalls ?? 0) + 1; }, userChoice: Promise.resolve({ outcome: 'accepted' }) });
    window.dispatchEvent(invitation);
  });
  expect(await page.evaluate(() => (window as Window & { installCalls?: number }).installCalls)).toBe(0);
  await page.getByRole('button', { name: 'Install app', exact: true }).click();
  expect(await page.evaluate(() => (window as Window & { installCalls?: number }).installCalls)).toBe(1);
  await expect(page.getByText('Installation requested. Finish the browser’s installation steps.')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(page.locator('.pwa-panel')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Install app', exact: true })).toHaveCount(0);
});

test('installed apps hide installation and update controls while checking quietly', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    localStorage.setItem('PARAGLIDE_LOCALE', 'en');
    const container = new EventTarget();
    const registration = new EventTarget();
    Object.assign(registration, { waiting: null, installing: null, update: async () => {
      sessionStorage.setItem('background-update-checked', 'true');
    } });
    Object.assign(container, { controller: {}, ready: Promise.resolve(registration), getRegistration: async () => registration, register: async () => registration });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: container });
    Object.assign(window, { stagePwaUpdate: () => {
      const worker = new EventTarget();
      Object.assign(worker, { state: 'installed', postMessage: (message: { type: string }) => {
        sessionStorage.setItem('pwa-activation-message', message.type);
        Object.assign(container, { controller: {} });
        Object.assign(registration, { waiting: null, installing: null });
        container.dispatchEvent(new Event('controllerchange'));
      } });
      Object.assign(registration, { waiting: worker, installing: worker });
      registration.dispatchEvent(new Event('updatefound'));
      worker.dispatchEvent(new Event('statechange'));
    } });
  });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('background-update-checked'))).toBe('true');
  await expect(page.locator('.pwa-panel, .pwa-check, .pwa-update')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /updates|reload|already installed/i })).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem('nusantara:pins:v1', JSON.stringify([{ id: 'region:32', code: '32', type: 'region', name: 'JAWA BARAT', addedAt: new Date().toISOString() }])));
  await page.evaluate(() => (window as Window & { stagePwaUpdate: () => void }).stagePwaUpdate());
  await expect(page.locator('.pwa-update')).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('pwa-activation-message'))).toBeNull();
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nusantara:pins:v1') ?? '[]')[0].name)).toBe('JAWA BARAT');
});

test('desktop web does not show an install invitation', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.pwa-panel')).toHaveCount(0);
});

test('static data requests carry a release key and manifest has real install icons', async ({ page, request }) => {
  const provinces = page.waitForRequest(url => url.url().includes('/data/admin-2025/provinces.json'));
  await page.goto('/');
  expect(new URL((await provinces).url()).searchParams.get('v')).toBeTruthy();
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  for (const size of ['192x192', '512x512']) {
    const icon = manifest.icons.find((entry: { sizes: string }) => entry.sizes === size);
    expect(icon).toBeTruthy();
    const image = await request.get(icon.src);
    expect(image.ok()).toBeTruthy();
    expect(image.headers()['content-type']).toContain('image/png');
  }
});
