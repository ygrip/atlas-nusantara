export interface HeroSprite {
  frameSize: number;
  width: number;
  left: number;
  bottom: number;
  cycle: number;
  repeats: number;
}

// Alignment comes from the neutral pose bounds, not each frame's moving silhouette.
// Keep the feet/hull anchored while hands, wings, tongue, tail and smoke move.
export const heroSprites: Record<string, HeroSprite> = {
  tiger: { frameSize: 192, width: 126.9, left: -13.82, bottom: -8.83, cycle: 800, repeats: 4 },
  orangutan: { frameSize: 208, width: 133.37, left: -12, bottom: -12.69, cycle: 1200, repeats: 3 },
  komodo: { frameSize: 224, width: 135.68, left: -18.5, bottom: -28.84, cycle: 1200, repeats: 3 },
  volcano: { frameSize: 256, width: 172.64, left: -35.65, bottom: -8.09, cycle: 1200, repeats: 3 },
  pinisi: { frameSize: 208, width: 130.91, left: -16.22, bottom: -7.73, cycle: 1400, repeats: 3 },
  cendrawasih: { frameSize: 208, width: 159.29, left: -24.67, bottom: -6.7, cycle: 1000, repeats: 3 },
  flag: { frameSize: 256, width: 209.53, left: -47.6, bottom: -5.4, cycle: 1400, repeats: 1 }
};

/** Invoked only by the post-load interaction import, never during SSR or hydration. */
export async function preloadHeroSprites(): Promise<void> {
  await Promise.all(Object.keys(heroSprites).map(async id => {
    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = 'low';
    image.srcset = `/illustrations/hero/motion/${id}-1x.webp 1x, /illustrations/hero/motion/${id}.webp 2x`;
    image.src = `/illustrations/hero/motion/${id}.webp`;
    await image.decode();
  }));
}
