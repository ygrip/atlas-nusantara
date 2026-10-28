<script lang="ts">
  import { m } from '$lib/i18n/messages';
  import { pathFor } from '$lib/i18n/links';
  import ClayCompass from './ClayCompass.svelte';
  import { Map, Heart, CodeXml, ShieldCheck, LockKeyhole, ExternalLink, Database } from 'lucide-svelte';
</script>

<footer class="site-footer clay-card">
  <div class="footer-compass" aria-hidden="true"><ClayCompass /></div>
  <div class="footer-top">
    <div class="footer-about">
      <a class="footer-brand" href="#top"><img src="/brand/logo-256.png" alt="" width="40" height="40" /><strong>Atlas Nusantara</strong></a>
      <p>{m.atlas_intro()}</p>
      <a class="footer-maker" href="https://readynaz.com" target="_blank" rel="noopener noreferrer">{m.footer_maker()} <ExternalLink size={14} aria-hidden="true" /></a>
    </div>
    <nav class="footer-col" aria-label={m.footer_explore()}>
      <h2>{m.footer_explore()}</h2>
      <ul>
        <li><a href="#atlas"><Map size={17} aria-hidden="true" />{m.nav_atlas()}</a></li>
        <li><a href="#provinces"><Database size={17} aria-hidden="true" />{m.nav_provinces()}</a></li>
        <li><a href="#support"><Heart size={17} aria-hidden="true" />{m.support_action()}</a></li>
        <li><a href="https://github.com/ygrip/nusantara" target="_blank" rel="noopener noreferrer"><CodeXml size={17} aria-hidden="true" />{m.source_code()}</a></li>
      </ul>
    </nav>
    <nav class="footer-col" aria-label={m.legal_label()}>
      <h2>{m.legal_label()}</h2>
      <ul>
        <li><a href={pathFor('/privacy')} data-sveltekit-reload><LockKeyhole size={17} aria-hidden="true" />{m.legal_privacy_link()}</a></li>
        <li><a href={pathFor('/terms')} data-sveltekit-reload><ShieldCheck size={17} aria-hidden="true" />{m.legal_terms_link()}</a></li>
        <li><a href={pathFor('/terms#sources')} data-sveltekit-reload><Database size={17} aria-hidden="true" />{m.source_details()}</a></li>
      </ul>
    </nav>
  </div>
</footer>
