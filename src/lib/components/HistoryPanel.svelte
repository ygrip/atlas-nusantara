<script lang="ts">
  import { onMount } from 'svelte';
  import { Pause, Play, SkipBack, SkipForward } from 'lucide-svelte';
  import DataExport from './DataExport.svelte';
  import type { ExportDataset } from '$lib/export/map-export';
  import { m } from '$lib/i18n/messages';
  import {
    historyEventLabel, historyPeriodLabel, historyYearLabel, localizedDateNote, localizedHistorySummary, localizedPlace, regionLabel
  } from '$lib/data/history-summary';
  import {
    HISTORICAL_POLITIES, HISTORY_EVENTS, HISTORY_MIN_YEAR, HISTORY_MAX_YEAR,
    historyActive, historyRulersAt, historyCategoryAt, historyMostProminent
  } from '$lib/data/history';

  let { year = $bindable(682), selectedId = $bindable() }: { year: number; selectedId?: string } = $props();
  let playing = $state(false);
  let showAll = $state(false);
  const active = $derived(historyActive(year));
  const selected = $derived(active.find(item => item.id === selectedId) ?? historyMostProminent(year));
  const nearest = $derived([...HISTORY_EVENTS].reverse().find(event => event.year <= year));
  $effect(() => { if (!active.some(item => item.id === selectedId)) selectedId = selected?.id; });
  const currentRulers = $derived(selected ? historyRulersAt(selected, year) : []);

  /** Reduced-motion readers get one slow step per milestone instead of a fast 25-year sweep. */
  function prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function advanceOneStep() {
    if (prefersReducedMotion()) {
      const nextMilestone = HISTORY_EVENTS.map(event => event.year).find(value => value > year);
      year = nextMilestone ?? HISTORY_MAX_YEAR;
    } else {
      year = Math.min(HISTORY_MAX_YEAR, year + 25);
    }
    if (year >= HISTORY_MAX_YEAR) playing = false;
  }

  $effect(() => {
    if (!playing) return;
    const delayMs = prefersReducedMotion() ? 1800 : 520;
    const id = window.setInterval(advanceOneStep, delayMs);
    return () => window.clearInterval(id);
  });

  onMount(() => {
    const visibility = () => { if (document.hidden) playing = false; };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  });

  function jump(step: -1 | 1) {
    playing = false;
    const years = HISTORY_EVENTS.map(event => event.year);
    const next = step === 1 ? years.find(value => value > year) : years.filter(value => value < year).at(-1);
    year = next ?? (step === 1 ? HISTORY_MAX_YEAR : HISTORY_MIN_YEAR);
  }

  function choosePolity(id: string) {
    const polity = HISTORICAL_POLITIES.find(item => item.id === id);
    if (!polity) return;
    playing = false;
    year = Math.max(HISTORY_MIN_YEAR, Math.min(HISTORY_MAX_YEAR, Math.round((polity.from + polity.to) / 2)));
    selectedId = id;
  }

  function buildHistoryExportDataset(): ExportDataset {
    const columns = ['record_type', 'id', 'name', 'from', 'to', 'category', 'region', 'place', 'place_id', 'summary_en', 'summary_id', 'date_note_en', 'date_note_id', 'rulers', 'zones', 'sources', 'year', 'event_en', 'event_id'].map(id => ({ id }));
    const polities = HISTORICAL_POLITIES.map(polity => ({
      record_type: 'polity', id: polity.id, name: polity.name, from: polity.from, to: polity.to,
      category: polity.category, region: polity.region, place: polity.place, place_id: polity.placeId,
      summary_en: polity.summary.en, summary_id: polity.summary.id,
      date_note_en: polity.dateNote?.en ?? null, date_note_id: polity.dateNote?.id ?? null,
      rulers: JSON.stringify(polity.rulers), zones: JSON.stringify(polity.zones), sources: polity.sources.join('; ')
    }));
    const events = HISTORY_EVENTS.map(event => ({ record_type: 'milestone', year: event.year, event_en: event.en, event_id: event.id }));
    return {
      layer: 'history', title: m.history_title(), scope: 'Nusantara · pre-1945',
      generatedAt: new Date().toISOString(), source: 'Curated Nusantara history atlas',
      sourceUrl: 'https://id.wikipedia.org/wiki/Sejarah_Nusantara',
      attribution: 'Schematic influence zones, not historical or modern borders. Verify cited sources and geometries before reuse.',
      columns, rows: [...polities, ...events]
    };
  }

  const colors = {
    'hindu-buddhist': '#b88743',
    'islamic': '#388b77',
    regional: '#b85c65',
    colonial: '#697a95'
  };
</script>

<section class="history-panel" aria-label={m.layer_history()}>
  <header class="history-heading">
    <div>
      <h3>{m.history_title()}</h3>
      <p>{m.history_intro()}</p>
    </div>
    <span class="era">{historyYearLabel(year)}</span>
  </header>

  <div class="playback" role="group" aria-label={m.history_timeline()}>
    <button type="button" onclick={() => jump(-1)} title={m.history_previous()} aria-label={m.history_previous()}><SkipBack size={18} /></button>
    <button type="button" onclick={() => { if (year >= HISTORY_MAX_YEAR) year = HISTORY_MIN_YEAR; playing = !playing; }} aria-label={playing ? m.map_pause() : m.map_play()} aria-pressed={playing} class="play">
      {#if playing}<Pause size={20}/>{:else}<Play size={20}/>{/if}
    </button>
    <label class="year-slider">
      <span class="sr-only">{m.history_year()}</span>
      <input type="range" min={HISTORY_MIN_YEAR} max={HISTORY_MAX_YEAR} step="1" value={year} oninput={event => { year = Number(event.currentTarget.value); playing = false; }} aria-label={m.history_year()} />
      <span class="bounds"><span>{historyYearLabel(HISTORY_MIN_YEAR)}</span><span>{historyYearLabel(HISTORY_MAX_YEAR)}</span></span>
    </label>
    <button type="button" onclick={() => jump(1)} title={m.history_next()} aria-label={m.history_next()}><SkipForward size={18} /></button>
  </div>

  {#if nearest}
    <aside class="milestone info-card" aria-live="off"><span class="milestone-mark" aria-hidden="true">i</span><span><strong>{historyYearLabel(nearest.year)}</strong><span class="milestone-copy">{historyEventLabel(nearest.year)}</span></span></aside>
  {/if}

  <div class="legend" aria-label={m.history_legend()}>
    <span><i style="--tone:#b88743"></i>{m.history_hindu()}</span>
    <span><i style="--tone:#388b77"></i>{m.history_islamic()}</span>
    <span><i style="--tone:#b85c65"></i>{m.history_regional()}</span>
    <span><i style="--tone:#697a95"></i>{m.history_colonial()}</span>
  </div>
  <p class="caution">{m.history_cartography_warning()}</p>

  <div class="history-details">
    <div class="active-list">
      <h4>{m.history_active()} · {active.length}</h4>
      {#if active.length === 0}<p>{m.history_no_records()}</p>{/if}
      <div class="polity-choices">
        {#each active as item (item.id)}
          <button type="button" class:selected={selected?.id === item.id} onclick={() => selectedId = item.id} aria-pressed={selected?.id === item.id}>
            <span class="dot" style={'--tone:' + colors[historyCategoryAt(item, year)]}></span>{item.name}
          </button>
        {/each}
      </div>
      <button class="all-toggle" type="button" aria-expanded={showAll} onclick={() => showAll = !showAll}>{m.history_browse_all()} · {HISTORICAL_POLITIES.length}</button>
      {#if showAll}
        <label class="sr-only" for="history-select">{m.history_browse_all()}</label>
        <select id="history-select" value="" onchange={e => choosePolity(e.currentTarget.value)}>
          <option value="" disabled>{m.history_select()}</option>
          {#each [...HISTORICAL_POLITIES].sort((a,b)=>a.from-b.from) as polity (polity.id)}
            <option value={polity.id}>{polity.name} ({polity.from}–{polity.to})</option>
          {/each}
        </select>
      {/if}
    </div>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (The scrollable region must be keyboard-accessible.) -->
    <section class="polity-detail scroll-area" tabindex="0" aria-label={selected?.name ?? m.history_no_records()}>
      {#if selected}
        <header class="detail-heading">
          <div class="detail-title">
            <span class="detail-kicker">{regionLabel(selected.region)}</span>
            <h4>{selected.name}</h4>
          </div>
          <span class="period">{historyPeriodLabel(selected.from, selected.to)}</span>
        </header>
        {#if localizedPlace(selected)}<p class="place">{localizedPlace(selected)}</p>{/if}
        <p class="summary">{localizedHistorySummary(selected)}</p>
        <section class="detail-section" aria-labelledby="rulers-heading">
          <h5 id="rulers-heading">{m.history_rulers()}</h5>
          {#if currentRulers.length}<p class="current-ruler">{currentRulers.map(r => r.name).join(' · ')}</p>{/if}
          {#if selected.rulers.length}
            <ul class="rulers">{#each selected.rulers as ruler (ruler.name)}
              <li><span>{ruler.name}</span>{#if ruler.from !== undefined}<span class="ruler-years">{ruler.from}–{ruler.to ?? '?'}</span>{/if}{#if ruler.uncertain} <small>{m.history_ruler_uncertain()}</small>{/if}</li>
            {/each}</ul>
          {:else}<p>{m.history_no_rulers()}</p>{/if}
        </section>
        {#if selected.dateNote}<p class="caution">{localizedDateNote(selected)}</p>{/if}
        <section class="detail-section" aria-labelledby="sources-heading">
          <h5 id="sources-heading">{m.history_sources()}</h5>
          <ul class="sources">{#each selected.sources as url (url)}<li><a href={url} target="_blank" rel="noreferrer">{new URL(url).hostname}</a></li>{/each}</ul>
        </section>
      {:else}
        <p>{m.history_no_records()}</p>
      {/if}
    </section>
  </div>
  <footer class="downloads">
    <DataExport buildDataset={buildHistoryExportDataset} />
    <small>{m.history_download_note()}</small>
  </footer>
</section>

<style>
  .history-panel { margin-top:16px;display:grid;gap:16px;min-width:0;padding:20px;border-radius:22px;background:var(--surface);box-shadow:var(--clay-pressed); }
  .history-heading {display:flex;align-items:flex-start;gap:12px;justify-content:space-between}
  h3,h4,h5,p {margin:0} h3{font-size:1.15rem} h4{font-size:1rem} h5{font-size:.83rem}
  p {font-size:.85rem;line-height:1.6;color:var(--muted)}
  .era {white-space:nowrap;background:var(--panel);padding:8px 12px;border-radius:12px;font-weight:900;color:var(--text);font-variant-numeric:tabular-nums}
  .playback {display:flex;align-items:center;gap:8px}
  .playback button,.all-toggle {border:1px solid var(--border);border-radius:14px;background:var(--panel);color:var(--text);min-height:40px;padding:7px 12px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;box-shadow:0 3px 0 var(--border)}
  .playback .play{flex:none;display:grid;place-items:center;width:52px;height:52px;padding:0;border:0;border-radius:50%;background:radial-gradient(circle at 32% 26%,color-mix(in srgb,var(--accent) 70%,#fff),var(--accent));color:var(--on-accent,#fff);cursor:pointer;box-shadow:0 4px 0 color-mix(in srgb,var(--accent) 60%,#000),inset 0 2px 2px #ffffff66;transition:transform 120ms,box-shadow 120ms} .playback button:active{transform:translateY(2px);box-shadow:0 1px 0 var(--border)}
  .year-slider{display:grid;flex:1;min-width:0;gap:4px} .year-slider input{width:100%;accent-color:var(--accent)}
  .bounds{display:flex;justify-content:space-between;font-size:.7rem;color:var(--muted);font-variant-numeric:tabular-nums}
  .milestone {display:flex;align-items:center;gap:11px;padding:12px 14px;border:1px solid color-mix(in srgb,var(--accent) 28%,var(--border));border-radius:17px;background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 9%,var(--surface)),var(--panel));box-shadow:0 3px 0 -1px var(--border),inset 0 2px 1px var(--clay-highlight);font-weight:650}
  .milestone > span:last-child{display:grid;gap:2px;min-width:0}.milestone strong{font-variant-numeric:tabular-nums;color:var(--text)}.milestone-copy{font-size:.82rem;line-height:1.45;color:var(--muted)}
  .milestone-mark{display:grid;place-items:center;flex:none;width:30px;height:30px;border-radius:11px;background:var(--mint);color:var(--accent-strong);font:900 .95rem Georgia,serif;box-shadow:inset 0 2px 1px var(--clay-highlight),0 2px 0 var(--border)}
  .legend{display:flex;gap:8px 14px;flex-wrap:wrap;font-size:.75rem;color:var(--muted)}
  .legend span{display:inline-flex;align-items:center;gap:5px}.legend i,.dot{display:inline-block;width:10px;height:10px;flex:none;border-radius:50%;background:var(--tone)}
  .caution {font-size:.76rem} .history-details{display:grid;grid-template-columns:minmax(0,.7fr) minmax(0,1.3fr);gap:14px}
  .active-list,.polity-detail{display:grid;align-content:start;gap:11px;padding:16px;background:var(--panel);border-radius:18px;min-width:0}
  .polity-detail{max-height:30rem;overflow-y:auto;scrollbar-gutter:stable;background:linear-gradient(145deg,var(--surface),var(--panel));box-shadow:0 4px 0 -1px var(--border),inset 2px 2px 4px var(--clay-highlight),inset -2px -3px 6px var(--shadow)}
  .detail-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding-bottom:10px;border-bottom:1px solid var(--border)}
  .detail-title{display:grid;gap:3px;min-width:0}.detail-kicker{font-size:.7rem;font-weight:850;letter-spacing:.06em;text-transform:uppercase;color:var(--accent-strong)}
  .detail-heading h4{font-size:1.18rem;line-height:1.25;text-wrap:pretty;overflow-wrap:anywhere}
  .period{flex:none;padding:6px 9px;border:1px solid var(--border);border-radius:999px;background:var(--panel);font-size:.72rem;font-weight:850;color:var(--text);font-variant-numeric:tabular-nums;box-shadow:inset 1px 1px 2px var(--clay-highlight)}
  .detail-section{display:grid;gap:7px}.detail-section h5{color:var(--accent-strong)}
  .polity-choices{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));gap:8px;max-height:240px;overflow:auto;padding:2px 3px 5px 2px;scrollbar-width:thin;scrollbar-color:var(--accent) var(--panel)}
  .polity-choices button{min-height:44px;text-align:left;background:linear-gradient(160deg,var(--surface),var(--panel));color:var(--text);padding:9px 11px;border:1px solid var(--border);border-radius:15px;font-size:.76rem;line-height:1.35;font-weight:750;cursor:pointer;display:inline-flex;align-items:center;gap:8px;box-shadow:0 3px 0 -1px var(--border),inset 0 2px 1px var(--clay-highlight);transition:transform 120ms,box-shadow 120ms,border-color 120ms}
  .polity-choices button:hover{transform:translateY(-1px);border-color:color-mix(in srgb,var(--accent) 48%,var(--border))}
  .polity-choices button.selected{border-color:var(--accent);background:linear-gradient(150deg,color-mix(in srgb,var(--accent) 11%,var(--surface)),var(--panel));box-shadow:inset 0 2px 5px var(--shadow),0 2px 0 -1px var(--accent);font-weight:900}
  .polity-choices .dot{width:12px;height:12px;border:2px solid var(--surface);box-shadow:0 1px 3px var(--shadow)}
  .all-toggle{justify-content:center;width:100%;font-weight:800}
  select{width:100%;padding:11px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--text)}
  .place{font-size:.77rem;font-weight:750;color:var(--muted)}
  .summary{padding:12px 14px;border:1px solid var(--border);border-radius:14px;background:var(--panel);color:var(--text);line-height:1.7;box-shadow:inset 1px 1px 3px var(--shadow)}
  .polity-detail ul{padding-left:0;margin:0;list-style:none;font-size:.82rem;line-height:1.55;color:var(--text)}
  .rulers{display:grid;gap:5px}.rulers li{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:7px 9px;border-radius:10px;background:color-mix(in srgb,var(--surface) 78%,transparent)}
  .ruler-years{flex:none;font-size:.74rem;font-variant-numeric:tabular-nums;color:var(--muted)}
  .polity-detail li small{color:var(--muted)}.sources{display:flex;flex-wrap:wrap;gap:6px 12px}.sources a{display:inline-flex;align-items:center;min-height:44px;color:var(--accent-strong);overflow-wrap:anywhere}
  .current-ruler{padding:8px 10px;border-radius:11px;background:color-mix(in srgb,var(--accent) 12%,var(--surface));font-size:.82rem;font-weight:900;color:var(--text)}.downloads{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
  .polity-detail:focus-visible{outline:3px solid color-mix(in srgb,var(--accent) 60%,transparent);outline-offset:2px}
  .downloads small{flex-basis:100%;font-size:.73rem;color:var(--muted)}
  .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
  @media(max-width:620px){.history-heading{flex-wrap:wrap}.history-details{grid-template-columns:1fr}.polity-detail{max-height:24rem}.detail-heading{flex-wrap:wrap}.playback{gap:4px}.playback button{padding:7px}.playback button.play{font-size:.8rem}}
  @media(prefers-reduced-motion:reduce){.playback button,.all-toggle,.polity-choices button{transition:none}}
</style>
