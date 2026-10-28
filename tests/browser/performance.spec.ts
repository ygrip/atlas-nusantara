import { expect, test } from './fixtures';

test.use({ serviceWorkers: 'block', reducedMotion: 'no-preference' });

for (const width of [375, 1440]) {
  test(`hero plates form a thin aligned bevel at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('.island-assembly')).toHaveCount(7);
    await page.locator('.hero-card').screenshot({ path: `test-results/hero-bevel-${width}.png`, animations: 'disabled' });
    const layers = await page.locator('.island-assembly').evaluateAll(assemblies => assemblies.map(assembly => {
      const top = assembly.querySelector<SVGGraphicsElement>('.stack-top use');
      const middle = assembly.querySelector<SVGGraphicsElement>('.stack-middle use');
      const base = assembly.querySelector<SVGGraphicsElement>('.stack-base use');
      const topMatrix = top?.getScreenCTM();
      const middleMatrix = middle?.getScreenCTM();
      const baseMatrix = base?.getScreenCTM();
      if (!topMatrix || !middleMatrix || !baseMatrix) throw Error('Hero plate transform is unavailable');
      return {
        aligned: topMatrix.e === middleMatrix.e && topMatrix.e === baseMatrix.e,
        thin: middleMatrix.f > topMatrix.f && baseMatrix.f > middleMatrix.f && baseMatrix.f - topMatrix.f <= 4,
        sameSilhouette: top?.getAttribute('href') === middle?.getAttribute('href') && top?.getAttribute('href') === base?.getAttribute('href')
      };
    }));
    expect(layers.every(layer => layer.aligned && layer.thin && layer.sameSilhouette)).toBe(true);
    const card = await page.locator('.hero-card').boundingBox();
    const world = await page.locator('.anatomy-stage .world').boundingBox();
    if (!card || !world) throw Error('Hero layout is unavailable');
    expect(world.x >= card.x && world.x + world.width <= card.x + card.width).toBe(true);
  });
}

test('hero has no perpetual animation and map work is capped and stops offscreen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const state = window as Window & { atlasFrameCount: number; atlasDrawCount: number };
    state.atlasFrameCount = 0;
    state.atlasDrawCount = 0;
    const schedule = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => schedule(time => { state.atlasFrameCount++; callback(time); });
    const draw = WebGL2RenderingContext.prototype.drawElements;
    WebGL2RenderingContext.prototype.drawElements = function (...args: Parameters<typeof draw>) {
      state.atlasDrawCount++;
      return draw.apply(this, args);
    };
  });
  await page.goto('/');
  await page.waitForTimeout(3500);
  const infinite = await page.locator('.anatomy-stage').evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations === Infinity).length);
  expect(infinite).toBe(0);
  const frameCount = () => page.evaluate(() => (window as Window & { atlasFrameCount: number }).atlasFrameCount);
  const drawCount = () => page.evaluate(() => (window as Window & { atlasDrawCount: number }).atlasDrawCount);
  const idleBefore = await frameCount();
  await page.waitForTimeout(500);
  expect(await frameCount() - idleBefore).toBeLessThanOrEqual(2);
  await page.locator('.atlas-3d').scrollIntoViewIfNeeded();
  await expect(page.locator('.atlas-3d')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(1500);
  const activeBefore = await frameCount();
  await page.waitForTimeout(1000);
  const ambientFrames = await frameCount() - activeBefore;
  expect(ambientFrames).toBeGreaterThan(0);
  expect(ambientFrames).toBeLessThanOrEqual(36);
  const play = page.locator('.clay-map .play');
  await play.click();
  await page.waitForTimeout(800);
  const playingBefore = await frameCount();
  await page.waitForTimeout(1000);
  const playingFrames = await frameCount() - playingBefore;
  expect(playingFrames).toBeGreaterThan(0);
  expect(playingFrames).toBeLessThanOrEqual(36);
  await play.click();
  await page.waitForTimeout(500);
  const pausedBefore = await drawCount();
  await page.waitForTimeout(500);
  expect(await drawCount()).toBeGreaterThan(pausedBefore);
  await page.locator('#top').scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  const offscreenBefore = await drawCount();
  await page.waitForTimeout(500);
  expect(await drawCount()).toBe(offscreenBefore);
});
