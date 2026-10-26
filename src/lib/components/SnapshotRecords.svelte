<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import type { DatasetRecord } from '$lib/data/ingestion/schema';
  import { officialWarningUrl } from '$lib/pwa/notification-payload';
  export let records: DatasetRecord[];
  export let source: string;
  $: displayed = records.slice(0, 30);
  function date(value: string) { return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
</script>

{#if records.length > 0}
  <p class="record-count">{m.records_shown()}: {displayed.length} / {records.length}</p>
  <ul class="snapshot-records">
    {#each displayed as record (record.id)}
      {@const link = officialWarningUrl(record.properties.sourceLink, source)}
      <li>
        {#if record.observedAt}<time datetime={record.observedAt}>{date(record.observedAt)}</time>{/if}
        <dl class="record-properties">
          {#each Object.entries(record.properties) as [key, value]}
            {#if value !== null && key !== 'sourceLink'}<div><dt><code>{key}</code></dt><dd>{value}</dd></div>{/if}
          {/each}
        </dl>
        {#if record.regionCodes.length}<small>{record.regionCodes.join(' · ')}</small>{/if}
        {#if link}<a href={link} target="_blank" rel="noopener noreferrer">{m.sources_heading()} · {source} ↗</a>{/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .record-count { font-size: .75rem; color: var(--muted); }
  .record-properties { width: 100%; display: grid; gap: 8px; margin: 0; }
  .record-properties > div { display: grid; grid-template-columns: minmax(0, 120px) minmax(0, 1fr); gap: 12px; }
  dt { color: var(--muted); overflow-wrap: anywhere; } dd { margin: 0; }
  a { text-decoration: underline; text-underline-offset: 3px; }
  @media(max-width: 480px) { .record-properties > div { grid-template-columns: 1fr; gap: 3px; } }
</style>
