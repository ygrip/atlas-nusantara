<script lang="ts">
  import { assetUrl } from '$lib/pwa/assets';
  import type { CuisineImage } from '$lib/data/cuisine-contract';
  import { CUISINE_PLACEHOLDER_PATH, cuisineImageUrl, isShareableCuisinePhoto, type CuisineImageSize } from '$lib/data/cuisine-images';

  /** A dish photo that falls back to the local bowl illustration when there is none or it fails to load. */
  let { image, size = 'small', alt }: { image?: CuisineImage; size?: CuisineImageSize; alt: string } = $props();
  let failed = $state(false);
  $effect(() => { void image; failed = false; });
  const showPhoto = $derived(Boolean(image) && !failed);
  /**
   * Commons photos allow cross-origin reads. They are requested the same way as the share card requests them, because a
   * browser reuses a cached plain response and then refuses it for the canvas.
   */
  const crossorigin = $derived(image && isShareableCuisinePhoto(image) && !failed ? 'anonymous' : undefined);
  const source = $derived.by(() => {
    if (image && !failed) return cuisineImageUrl(image, size);
    return assetUrl(CUISINE_PLACEHOLDER_PATH);
  });
</script>

<img class="cuisine-photo-img" class:placeholder={!showPhoto} src={source} alt={showPhoto ? alt : ''} loading="lazy" decoding="async" referrerpolicy="no-referrer" {crossorigin} onerror={() => { failed = true; }} />

<style>
  .cuisine-photo-img { display: block; width: 100%; height: 100%; object-fit: cover; background: var(--border); }
</style>
