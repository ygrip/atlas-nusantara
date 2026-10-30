<script lang="ts">
  import EditorialLayout from '$lib/components/EditorialLayout.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const updated = $derived(data.guides.map(guide => guide.updated).sort().at(-1) ?? '2026-10-30');
</script>

<EditorialLayout title="Guides to Indonesia's data" description="Guides to the datasets behind Atlas Nusantara: administrative regions, weather and earthquake snapshots, species, cuisine and destinations, and how to read them." eyebrow="Guides" {updated}>
  <p>These guides explain the public datasets the atlas brings together: where each one comes from, how it was cleaned and joined to Indonesia's regions, what its numbers mean and where it stops being reliable. Read them before quoting a figure from the map.</p>
  <ul class="guide-list">
    {#each data.guides as guide (guide.slug)}
      <li>
        <h2><a href={'/guides/' + guide.slug}>{guide.title}</a></h2>
        <p>{guide.description}</p>
        <p class="guide-meta">Updated <time datetime={guide.updated}>{guide.updated}</time></p>
      </li>
    {/each}
  </ul>
</EditorialLayout>

<style>
  .guide-list { display: grid; gap: 8px; padding: 0; list-style: none; }
  .guide-list h2 { margin: 24px 0 6px; font-size: 1.25rem; }
  .guide-meta { font-size: .8rem; }
</style>
