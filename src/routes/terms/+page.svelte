<script lang="ts">
  import { m } from '$lib/i18n/messages';
  import LegalLayout from '$lib/components/LegalLayout.svelte';
  import { CODE_EDITION } from '$lib/atlas/edition';
  import { sources } from '$lib/data/sources';
</script>

<LegalLayout title={m.terms_title()} description={m.terms_description()}>
  <h2>{m.terms_use_title()}</h2>
  <p>{m.terms_use_text()}</p>
  <h2 id="sources">{m.terms_data_title()}</h2>
  <p>{m.terms_data_text()}</p>
  <ul class="source-list">
    {#each sources as source}<li><a href={source.url} target="_blank" rel="noreferrer">{source.agency} ↗</a></li>{/each}
    <li><a href="https://data.humdata.org/dataset/cod-ab-idn" target="_blank" rel="noreferrer">BPS / OCHA COD-AB · CC BY 3.0 IGO ↗</a></li>
    <li><a href="https://www.ncei.noaa.gov/products/etopo-global-relief-model" target="_blank" rel="noreferrer">ETOPO1 / NOAA NCEI · Public domain ↗</a></li>
  </ul>
  <h2>{m.terms_boundaries_title()}</h2>
  <p>{m.terms_boundaries_text()}</p>
  <p>{m.code_edition()}: {CODE_EDITION}</p>
  <h2>{m.terms_availability_title()}</h2>
  <p>{m.terms_availability_text()}</p>
  <h2>{m.terms_liability_title()}</h2>
  <p>{m.terms_liability_text()}</p>
  <h2>{m.terms_links_title()}</h2>
  <p>{m.terms_links_text()}</p>
  <h2>Advertisements and verified downloads</h2>
  <p>The homepage automatically requests one clearly labelled Google advertisement. Empty, blocked or failed placements are hidden. Advertisements are separate from the atlas’s data, source attributions and public-safety guidance; their presence does not imply endorsement. Ad blockers do not restrict ordinary browsing. Ad delivery depends on Google’s availability, publisher approval and applicable consent requirements.</p>
  <p>Archive downloads require Cloudflare Turnstile verification and are subject to request, size and daily limits. Passing verification does not grant access to an unapproved or unavailable dataset. Do not bypass verification, automate abuse, or treat this atlas as an emergency alert service.</p>
  <h2>{m.terms_changes_title()}</h2>
  <p>{m.terms_changes_text()}</p>
</LegalLayout>
