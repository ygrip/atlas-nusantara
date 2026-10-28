<script lang="ts">
  import { assetUrl } from '$lib/pwa/assets';
  import type { SpeciesImage, SpeciesKind } from '$lib/data/species-contract';
  import { speciesImageUrl, speciesPlaceholderPath, type SpeciesImageSize } from '$lib/data/species-images';

  /** A species photo that falls back to the local flora or fauna illustration when there is none or it fails to load. */
  let { kind, image, size = 'small', alt }: { kind: SpeciesKind; image?: SpeciesImage; size?: SpeciesImageSize; alt: string } = $props();
  let failed = $state(false);
  $effect(() => { void image; failed = false; });
  const showPhoto = $derived(Boolean(image) && !failed);
  /**
   * Openly licensed photos come from a bucket that allows cross-origin reads. They are requested the same way as the share
   * card requests them, because a browser reuses a cached plain response and then refuses it for the canvas.
   */
  const crossorigin = $derived(image && image.license && !failed ? 'anonymous' : undefined);
  const source = $derived.by(() => {
    if (image && !failed) return speciesImageUrl(image, size);
    return assetUrl(speciesPlaceholderPath(kind));
  });
</script>

<img class="species-photo-img" class:placeholder={!showPhoto} src={source} alt={showPhoto ? alt : ''} loading="lazy" decoding="async" referrerpolicy="no-referrer" {crossorigin} onerror={() => { failed = true; }} />

<style>
  .species-photo-img { display: block; width: 100%; height: 100%; object-fit: cover; background: var(--border); }
  .species-photo-img.placeholder { object-fit: cover; }
</style>
