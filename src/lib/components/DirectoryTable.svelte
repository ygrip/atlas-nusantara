<script lang="ts" module>
  export interface DirectoryColumn { id: string; label: string; numeric?: boolean }
  export interface DirectoryRow {
    id: string;
    /** Region code shown in the first column; leave out for lists that have none. */
    code?: string;
    name: string;
    ariaLabel: string;
    selected?: boolean;
    /** Text for each extra column, keyed by column id. */
    cells: Record<string, string>;
  }
</script>

<script lang="ts">
  let { label, codeHeader, nameHeader, detailLabel, columns, rows, onopen }: {
    /** Accessible name of the scrollable table region. */
    label: string;
    codeHeader?: string;
    nameHeader: string;
    detailLabel: string;
    columns: DirectoryColumn[];
    rows: DirectoryRow[];
    onopen: (id: string) => void;
  } = $props();
</script>

<!-- A scrollable table stays keyboard reachable and keeps every column aligned. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="region-table-scroll scroll-area" tabindex="0" role="region" aria-label={label}>
  <table class="region-table" class:wide={columns.length > 0}>
    <thead>
      <tr>
        {#if codeHeader}<th scope="col">{codeHeader}</th>{/if}
        <th scope="col">{nameHeader}</th>
        {#each columns as column (column.id)}<th scope="col" class:numeric={column.numeric}>{column.label}</th>{/each}
        <th scope="col"><span class="visually-hidden">{detailLabel}</span></th>
      </tr>
    </thead>
    <tbody>
      {#each rows as row (row.id)}
        <tr class:selected={row.selected}>
          {#if codeHeader}<td class="region-code">{row.code ?? ''}</td>{/if}
          <th scope="row"><button type="button" class="region-row-action" aria-label={row.ariaLabel} onclick={() => onopen(row.id)} aria-pressed={row.selected}>
            <span>{row.name}</span>
          </button></th>
          {#each columns as column (column.id)}<td class:numeric={column.numeric} class="region-cell">{row.cells[column.id] ?? ''}</td>{/each}
          <td class="region-row-state">{#if row.selected}<span aria-hidden="true">✓</span><span class="visually-hidden">{detailLabel}</span>{:else}<span aria-hidden="true">›</span>{/if}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .region-table-scroll {
    max-height: min(460px, 58vh);
    overflow: auto;
    margin-top: 12px;
    padding: 0 8px 8px;
    border-radius: 18px;
    background: var(--panel);
    box-shadow: var(--clay-pressed);
    overscroll-behavior-x: contain;
  }
  .region-table { width: 100%; min-width: 340px; border-collapse: separate; border-spacing: 0 5px; font-size: .82rem; }
  .region-table.wide { min-width: 460px; }
  .region-table thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 10px 12px;
    background: var(--panel);
    color: var(--muted);
    text-align: left;
    font-size: .68rem;
    letter-spacing: .07em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .region-table tbody td, .region-table tbody th {
    padding: 9px 12px;
    background: var(--surface);
    text-align: left;
    font-weight: 500;
  }
  .region-table tbody tr:nth-child(even) td, .region-table tbody tr:nth-child(even) th {
    background: color-mix(in srgb, var(--surface) 76%, var(--page));
  }
  .region-table tbody tr > :first-child { border-radius: 12px 0 0 12px; }
  .region-table tbody tr > :last-child { border-radius: 0 12px 12px 0; }
  .region-table tbody tr.selected td, .region-table tbody tr.selected th {
    background: color-mix(in srgb, var(--mint) 74%, var(--surface));
  }
  .region-table tbody tr.selected > :first-child { box-shadow: inset 3px 0 var(--accent); }
  .region-code { width: 72px; color: var(--muted); font: 700 .75rem ui-monospace, SFMono-Regular, monospace; font-variant-numeric: tabular-nums; }
  .region-cell { color: var(--muted); }
  .numeric { text-align: right !important; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .region-row-action { display: flex; width: 100%; min-height: 38px; align-items: center; padding: 0; border: 0; background: transparent; color: var(--text); text-align: left; font: inherit; font-weight: 750; cursor: pointer; }
  .region-row-action:hover { color: var(--accent); }
  .region-row-action:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px; }
  .region-row-state { width: 38px; color: var(--accent); text-align: center !important; font-size: 1.1rem; font-weight: 900 !important; }
  .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; clip-path: inset(50%); }
  @media (max-width: 560px) {
    .region-table-scroll { max-height: min(400px, 52vh); margin-inline: -3px; }
    .region-table { min-width: 300px; }
    .region-table.wide { min-width: 420px; }
    .region-table tbody td, .region-table tbody th { padding-inline: 9px; }
    .region-code { width: 62px; }
  }
</style>
