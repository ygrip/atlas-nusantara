<script lang="ts">
  import { Braces, Code, Download, Table } from 'lucide-svelte';
  import { m } from '$lib/i18n/messages';
  import { exportFileName, serializeDataset, type ExportDataset, type ExportFormat } from '$lib/export/map-export';
  import MapDialog from './MapDialog.svelte';

  let { buildDataset }: {
    /** Builds the data behind the current map layer and view, or undefined when there is nothing to export yet. */
    buildDataset: () => ExportDataset | undefined;
  } = $props();

  let open = $state(false);
  let dataset = $state<ExportDataset>();
  let failed = $state(false);

  const formats: { id: ExportFormat; label: string; hint: () => string; icon: typeof Braces }[] = [
    { id: 'json', label: 'JSON', hint: m.export_json_hint, icon: Braces },
    { id: 'csv', label: 'CSV', hint: m.export_csv_hint, icon: Table },
    { id: 'xml', label: 'XML', hint: m.export_xml_hint, icon: Code }
  ];

  function openDialog() {
    failed = false;
    dataset = buildDataset();
    open = true;
  }

  function download(format: ExportFormat) {
    if (!dataset) return;
    try {
      const file = serializeDataset(dataset, format);
      const blob = new Blob([file.content], { type: file.mimeType + ';charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = exportFileName(dataset, format);
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      open = false;
    } catch (error) {
      failed = true;
      console.warn('Export failed', error);
    }
  }
</script>

<button type="button" class="export-trigger" aria-haspopup="dialog" onclick={openDialog}>
  <Download size={18} aria-hidden="true" /><span>{m.export_button()}</span>
</button>

<MapDialog {open} title={m.export_title()} onclose={() => { open = false; }}>
  {#if !dataset || dataset.rows.length === 0}
    <p class="export-empty" role="status">{m.export_unavailable()}</p>
  {:else}
    <p class="export-summary">{m.export_summary({ count: dataset.rows.length.toLocaleString(), layer: dataset.title, scope: dataset.scope })}</p>
    <ul class="export-formats">
      {#each formats as format (format.id)}
        {@const FormatIcon = format.icon}
        <li>
          <button type="button" class="export-format" data-format={format.id} onclick={() => download(format.id)}>
            <span class="format-icon"><FormatIcon size={20} aria-hidden="true" /></span>
            <span class="format-text"><strong>{format.label}</strong><small>{format.hint()}</small></span>
            <Download size={18} aria-hidden="true" />
          </button>
        </li>
      {/each}
    </ul>
    {#if failed}<p class="export-error" role="alert">{m.data_unavailable()}</p>{/if}
    <p class="export-note">{m.export_note()}</p>
  {/if}
</MapDialog>

<style>
  .export-trigger { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 16px; border: 1px solid var(--border); border-radius: 16px; color: var(--text); font: inherit; font-weight: 800; font-size: .85rem; background: linear-gradient(165deg, var(--surface), var(--panel)); cursor: pointer; box-shadow: 0 3px 0 var(--border), inset 0 2px 1px var(--clay-highlight); transition: transform 120ms, box-shadow 120ms, color 160ms; }
  .export-trigger:hover { color: var(--accent); }
  .export-trigger:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--border), inset 0 2px 4px var(--shadow); }
  .export-trigger:focus-visible, .export-format:focus-visible { outline: 3px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 2px; }
  .export-summary { margin: 4px 0 14px; color: var(--muted); font-size: .85rem; line-height: 1.55; overflow-wrap: anywhere; }
  .export-formats { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
  .export-format { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 60px; padding: 10px 14px; border: 1px solid var(--border); border-radius: 18px; color: var(--text); font: inherit; text-align: left; background: linear-gradient(165deg, var(--surface), var(--panel)); cursor: pointer; box-shadow: 0 3px 0 var(--border), inset 0 2px 1px var(--clay-highlight); transition: transform 120ms, box-shadow 120ms; }
  .export-format:hover { border-color: var(--accent); }
  .export-format:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--border), inset 0 2px 4px var(--shadow); }
  .format-icon { display: grid; place-items: center; flex: none; width: 40px; height: 40px; border-radius: 13px; color: var(--accent-strong); background: var(--mint); box-shadow: inset 0 2px 1px var(--clay-highlight); }
  .format-text { display: grid; flex: 1; min-width: 0; gap: 2px; }
  .format-text strong { font-size: .95rem; letter-spacing: .02em; }
  .format-text small { color: var(--muted); font-size: .76rem; line-height: 1.35; }
  .export-note { margin: 14px 0 0; color: var(--muted); font-size: .74rem; line-height: 1.5; }
  .export-empty, .export-error { margin: 8px 0; line-height: 1.55; }
  .export-error { color: var(--accent-strong); font-weight: 800; }
  @media (prefers-reduced-motion: reduce) { .export-trigger, .export-format { transition: none; } }
</style>
