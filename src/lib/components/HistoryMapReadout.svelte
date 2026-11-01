<script lang="ts">
  import { onMount } from 'svelte';
  import { Landmark } from '@lucide/svelte';
  import { m } from '$lib/i18n/messages';
  import type { HistoricalPolity } from '$lib/data/history';
  import { historyPeriodLabel, localizedHistorySummary, localizedHistoryName } from '$lib/data/history-summary';
  import GooeyPanel from './GooeyPanel.svelte';
  import IndonesiaFlag from './IndonesiaFlag.svelte';

  let { polity }: { polity: HistoricalPolity } = $props();
  let open = $state(false);
  onMount(() => { open = matchMedia('(min-width: 701px)').matches; });
</script>

<GooeyPanel class="history-readout" corner="top-right" icon={Landmark} label={localizedHistoryName(polity.id, polity.name)} bind:open>
  <div aria-live="polite">
    {#if polity.id === 'indonesia'}
      <div class="indonesia-flag-detail">
        <IndonesiaFlag width={42} />
        <span><strong>{m.history_indonesia_flag()}</strong><a href="https://peraturan.bpk.go.id/Download/27970/UU%20Nomor%2024%20Tahun%202009.pdf" target="_blank" rel="noreferrer">{m.history_official_flag()}</a></span>
      </div>
    {/if}
    <p class="period">{historyPeriodLabel(polity.from, polity.to, polity.ongoing)}</p>
    <p class="summary">{localizedHistorySummary(polity)}</p>
  </div>
</GooeyPanel>

<style>
  .indonesia-flag-detail { display:flex; align-items:center; gap:9px; margin-bottom:9px; }
  .indonesia-flag-detail span { display:grid; gap:2px; }
  .indonesia-flag-detail strong { font-size:.75rem; }
  .indonesia-flag-detail a { color:var(--accent-strong); font-size:.68rem; text-decoration:underline; text-underline-offset:2px; }
  .period { margin:0 0 6px;color:var(--muted);font-size:.7rem;font-weight:800;font-variant-numeric:tabular-nums; }
  .summary { margin:0;font-size:.75rem;line-height:1.5;color:var(--text); }
</style>
