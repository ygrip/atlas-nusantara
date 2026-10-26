<script lang="ts">
  /** Actual geometry will be loaded from versioned ADM1/ADM2 SVG path assets. */
  let { label = 'Indonesia' }: { label?: string } = $props();
</script>
<section class="map" aria-label={label}><div class="placeholder" role="img" aria-label="Map geometry has not yet been imported"><span>◈</span><p>Indonesia · ADM0 / ADM1 / ADM2</p><small>Boundary dataset integration pending</small></div></section>
<style>
.map{min-height:330px;display:grid;place-items:center;border-radius:2rem;background:linear-gradient(145deg,#f0f6ee,#d1e0d1);box-shadow:inset 8px 8px 18px #c7d5c6,inset -8px -8px 18px #fff,10px 10px 25px #c9d6c9}.placeholder{text-align:center;color:#5a7a64;padding:2rem}.placeholder span{font-size:6rem;text-shadow:3px 3px #fff,8px 8px 10px #a4bca8}.placeholder p{font-weight:700}.placeholder small{font-size:.8rem}
</style>
