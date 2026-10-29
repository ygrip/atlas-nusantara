export interface HeroSprite {
  width: number;
  left: number;
  bottom: number;
  cycle: number;
  repeats: number;
}

// Alignment comes from the neutral pose bounds, not each frame's moving silhouette.
// Keep the feet/hull anchored while hands, wings, tongue, tail and smoke move.
export const heroSprites: Record<string, HeroSprite> = {
  tiger: { width: 126.9, left: -13.82, bottom: -8.83, cycle: 800, repeats: 4 },
  orangutan: { width: 133.37, left: -12, bottom: -12.69, cycle: 1200, repeats: 3 },
  komodo: { width: 135.68, left: -18.5, bottom: -28.84, cycle: 1200, repeats: 3 },
  volcano: { width: 172.64, left: -35.65, bottom: -8.09, cycle: 1200, repeats: 3 },
  pinisi: { width: 130.91, left: -16.22, bottom: -7.73, cycle: 1400, repeats: 3 },
  cendrawasih: { width: 159.29, left: -24.67, bottom: -6.7, cycle: 1000, repeats: 3 },
  flag: { width: 209.53, left: -47.6, bottom: -5.4, cycle: 1400, repeats: 1 }
};

/** Invoked only by the post-load interaction import, never during SSR or hydration. */
export async function preloadHeroSprites(): Promise<void> {
  await Promise.all(Object.keys(heroSprites).map(async id => {
    const image = new Image();
    image.decoding = 'async';
    image.src = `/illustrations/hero/motion/${id}.webp`;
    await image.decode();
  }));
}
