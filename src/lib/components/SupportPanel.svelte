<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { Heart } from 'lucide-svelte';
</script>

<section id="support" class="support-panel" aria-labelledby="support-heading">
  <div><span class="support-heart"><Heart size={22} aria-hidden="true" /></span><br /><span class="eyebrow">NUSANTARA / INDEPENDENT</span><h2 id="support-heading">{m.support_heading()}</h2><p>{m.support_description()}</p></div>
  <div class="support-links" aria-label={m.support_action()}>
    <a href="https://trakteer.id/yunaz_gilang" target="_blank" rel="noopener noreferrer">Trakteer ↗</a>
    <a href="https://ko-fi.com/ygrip" target="_blank" rel="noopener noreferrer">Ko-fi ↗</a>
    <a href="https://www.patreon.com/c/ygrip" target="_blank" rel="noopener noreferrer">Patreon ↗</a>
    <a class="maker-link" href="https://readynaz.com" target="_blank" rel="noopener noreferrer">readynaz.com ↗</a>
  </div>
</section>
