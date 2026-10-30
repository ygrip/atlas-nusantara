<script lang="ts">
  import EditorialLayout from '$lib/components/EditorialLayout.svelte';
  import EditorialDocument from '$lib/components/EditorialDocument.svelte';
  import { guideKeys } from '$lib/content/editorial';
  import { m } from '$lib/i18n/messages';
  import { pathFor } from '$lib/i18n/links';
  const translate = (key: string) => (m as unknown as Record<string, () => string>)[key]();
</script>

<EditorialLayout title={m.editorial_index_title()} description={m.editorial_index_description()} eyebrow={m.editorial_nav_guides()}>
  <EditorialDocument text={m.editorial_index_body()} />
  <ul class="guide-list">
    {#each guideKeys as guide (guide.slug)}
      <li>
        <h2><a href={pathFor('/guides/' + guide.slug)}>{translate(guide.title)}</a></h2>
        <p>{translate(guide.description)}</p>
      </li>
    {/each}
  </ul>
</EditorialLayout>

<style>
  .guide-list { display: grid; gap: 8px; padding: 0; list-style: none; }
  .guide-list h2 { margin: 24px 0 6px; font-size: 1.25rem; }
</style>
