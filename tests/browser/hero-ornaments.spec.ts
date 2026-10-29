import { expect, test } from './fixtures';

// Service worker network requests bypass page.route; keep failure/defer probes deterministic.
test.use({ serviceWorkers: 'block' });

const ornaments = ['tiger', 'orangutan', 'flag', 'volcano', 'komodo', 'pinisi', 'cendrawasih'];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('PARAGLIDE_LOCALE', 'en'));
});

test('effects wait for page load and audio waits for an ornament click', async ({ page }) => {
  let releaseImage!: () => void;
  const imageGate = new Promise<void>(resolve => { releaseImage = resolve; });
  const requestedAudio: string[] = [];
  const requestedSprites: string[] = [];
  const effectRequests: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/audio/hero/')) requestedAudio.push(request.url());
    if (request.url().includes('/illustrations/hero/motion/')) requestedSprites.push(request.url());
    if (/interaction[^/]*\.(js|css)/.test(request.url())) effectRequests.push(request.url());
  });
  await page.route('**/illustrations/hero/pinisi.webp', async route => {
    await imageGate;
    await route.continue();
  });
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.ornament-tiger')).toBeDisabled();
    expect(requestedAudio).toEqual([]);
    expect(requestedSprites).toEqual([]);
    expect(effectRequests).toEqual([]);
  } finally {
    releaseImage();
  }
  await page.waitForLoadState('load');
  await expect(page.locator('.ornament-tiger')).toBeEnabled();
  expect(requestedAudio).toEqual([]);
  expect(effectRequests.some(url => url.endsWith('.css'))).toBe(true);
  expect(new Set(requestedSprites).size).toBe(7);
  await page.locator('.ornament-tiger').click();
  await expect(page.locator('.ornament-tiger')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => requestedAudio.some(url => url.endsWith('/tiger.mp3'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('.ornament.playing')).toHaveCount(0);
});

for (const viewport of [{ width: 1280, height: 900 }, { width: 761, height: 900 }, { width: 390, height: 844 }]) {
  test(`all seven ornaments are clickable, exclusive and stoppable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('.ornament-tiger')).toBeEnabled();
    for (const id of ornaments) {
      const button = page.locator(`.ornament-${id}`);
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.ornament.playing')).toHaveCount(1);
      const viewport = button.locator('.motion-viewport');
      await expect(viewport).toBeVisible();
      const sizes = await viewport.evaluate(element => ({
        viewport: element.getBoundingClientRect().width,
        strip: element.querySelector('img')?.getBoundingClientRect().width ?? 0
      }));
      expect(sizes.strip / sizes.viewport).toBeCloseTo(8, 1);
      expect(await button.evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(44);
    }
    await page.locator('.ornament-cendrawasih').click();
    await expect(page.locator('.ornament.playing')).toHaveCount(0);
    await page.locator('.ornament-komodo').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.ornament-komodo')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('.ornament.playing')).toHaveCount(0);
  });
}

test('desktop geography reaches the right edge without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('.ornament-tiger')).toBeEnabled();
  const layout = await page.evaluate(() => {
    const hero = document.querySelector('.hero-card')?.getBoundingClientRect();
    const papua = document.querySelector('.island-assembly:last-child .stack-top')?.getBoundingClientRect();
    return {
      gap: (hero?.right ?? 0) - (papua?.right ?? 0),
      overflow: document.documentElement.scrollWidth > innerWidth
    };
  });
  expect(Math.abs(layout.gap)).toBeLessThanOrEqual(3);
  expect(layout.overflow).toBe(false);
});

for (const width of [740, 761, 800, 900, 1024]) {
  test(`tiger stays clear of actual copy text at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('.ornament-tiger')).toBeEnabled();
    const overlaps = await page.evaluate(() => {
      const tiger = document.querySelector('.ornament-tiger')?.getBoundingClientRect();
      if (!tiger) throw new Error('Missing tiger');
      const elements = document.querySelectorAll('.hero-copy .eyebrow, .hero-copy h1, .hero-tagline, .hero-copy > p, .hero-actions a');
      return Array.from(elements).flatMap(element => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0
          && rect.left < tiger.right && rect.right > tiger.left
          && rect.top < tiger.bottom && rect.bottom > tiger.top).map(() => element.textContent);
      });
    });
    expect(overlaps).toEqual([]);
  });
}

test('each bundled sound decodes and starts; hiding the page stops playback', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    window.Audio = class extends NativeAudio {
      constructor() {
        super();
        (window as Window & { heroTestAudio?: HTMLAudioElement }).heroTestAudio = this;
      }
    };
  });
  await page.goto('/');
  await expect(page.locator('.ornament-tiger')).toBeEnabled();
  for (const id of ornaments) {
    await page.locator(`.ornament-${id}`).click();
    await expect.poll(() => page.evaluate(() => {
      const audio = (window as Window & { heroTestAudio?: HTMLAudioElement }).heroTestAudio;
      return Boolean(audio && !audio.paused && audio.readyState >= 2 && audio.currentTime > 0);
    })).toBe(true);
  }
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.ornament.playing')).toHaveCount(0);
  expect(await page.evaluate(() => (window as Window & { heroTestAudio?: HTMLAudioElement }).heroTestAudio?.paused)).toBe(true);
});

test('hover uses a soft radiance instead of a rectangular outline', async ({ page }) => {
  await page.goto('/');
  const tiger = page.locator('.ornament-tiger');
  await expect(tiger).toBeEnabled();
  await tiger.hover();
  await expect.poll(() => tiger.evaluate(element => getComputedStyle(element, '::after').opacity)).toBe('1');
  expect(await tiger.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('none');
});

test('reduced motion keeps sound controls without moving the artwork', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const button = page.locator('.ornament-orangutan');
  await expect(button).toBeEnabled();
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  const animationNames = await button.locator('*').evaluateAll(elements => elements.map(element => getComputedStyle(element).animationName));
  expect(animationNames.every(name => name === 'none')).toBe(true);
  await expect(button.locator('.motion-viewport')).toBeHidden();
});

test('an unavailable audio file leaves the animation usable with a status message', async ({ page }) => {
  let intercepted = false;
  await page.route('**/audio/hero/volcano.mp3', route => {
    intercepted = true;
    return route.fulfill({ status: 404, contentType: 'text/plain', body: 'Unavailable' });
  });
  await page.goto('/');
  const button = page.locator('.ornament-volcano');
  await expect(button).toBeEnabled();
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.sound-status')).toContainText('Sound unavailable');
  expect(intercepted).toBe(true);
});
