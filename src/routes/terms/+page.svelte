<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
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
  <h2>{m.terms_changes_title()}</h2>
  <p>{m.terms_changes_text()}</p>
</LegalLayout>
