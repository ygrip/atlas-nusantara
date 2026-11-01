<script lang="ts">
  import { onMount } from 'svelte';
  import { Check, Landmark, Pause, Play, Search, SkipBack, SkipForward } from 'lucide-svelte';
  import DataExport from './DataExport.svelte';
  import HistoryInventory from './HistoryInventory.svelte';
  import HistoryResearchDetail from './HistoryResearchDetail.svelte';
  import { curatedPolityFor, foldHistorySearch, loadHistoryResearch, type HistoryResearch } from '$lib/data/history-catalogue';
  import { loadHistoryInventory } from '$lib/data/history-inventory';
  import { buildHistoryExport } from '$lib/export/history-export';
  import type { HistoricalTerritoryCollection } from '$lib/map/history-territories';
  import { m, type MessageKey } from '$lib/i18n/messages';
  import { modernTerritorialStatusAt } from '$lib/data/history-modern';
  import {
    historyEventLabel, historyPeriodLabel, historyRulerPeriodLabel, historyYearLabel, localizedDateNote, localizedHistorySummary, localizedHistoryName, localizedPlace, regionLabel
  } from '$lib/data/history-summary';
  import {
    HISTORICAL_POLITIES, HISTORY_EVENTS, HISTORY_MIN_YEAR, HISTORY_MAX_YEAR, HISTORY_LEGACY_CUTOFF_YEAR,
    historyActive, historyRulersAt, historyMostProminent
  } from '$lib/data/history';

  import { historyPolityColor } from '$lib/map/history-map';

  let { year = $bindable(682), selectedId = $bindable() }: { year: number; selectedId?: string } = $props();
  let playing = $state(false);
  let polityQuery = $state('');
  let polityScope = $state<'active' | 'all'>('all');
  let research = $state.raw<HistoryResearch>();
  let researchLoading = $state(true);
  let researchFailed = $state(false);
  let supplementalExpanded = $state(false);
  let detailElement = $state<HTMLElement>();
  const selectedDossier = $derived(research?.features.find(feature => feature.id === selectedId));
  const pendingResearchSelection = $derived(Boolean(selectedId) && researchLoading && !HISTORICAL_POLITIES.some(polity => polity.id === selectedId));
  const additionalDossiers = $derived((research?.features ?? []).filter(feature => !curatedPolityFor(feature)));
  const catalogueCount = $derived(HISTORICAL_POLITIES.length + additionalDossiers.length);
  const active = $derived(historyActive(year));
  const visiblePolities = $derived.by(() => {
    type BrowserEntry = { id: string; name: string; search: string; from?: number; to?: number; ongoing?: boolean; region?: typeof HISTORICAL_POLITIES[number]['region'] };
    let source = HISTORICAL_POLITIES;
    if (polityScope === 'active') source = active;
    const candidates: BrowserEntry[] = source.map(polity => ({ ...polity, name: localizedHistoryName(polity.id, polity.name), search: [localizedHistoryName(polity.id, polity.name), polity.name, polity.id, regionLabel(polity.region), polity.region, localizedPlace(polity), polity.place, polity.placeId].join(' ') }));
    if (polityScope === 'all') {
      for (const dossier of additionalDossiers) {
        const search = [dossier.id, dossier.properties.source_label, ...dossier.properties.aliases,
          dossier.properties.source_claim_wikitext_id, ...dossier.properties.articles.map(article => article.summary)].join(' ');
        candidates.push({ id: dossier.id, name: dossier.properties.source_label, search });
      }
    }
    const queryWords = foldHistorySearch(polityQuery.trim()).split(/\s+/).filter(Boolean);
    const matching = candidates.filter(polity => {
      const searchable = foldHistorySearch(polity.search);
      return queryWords.every(word => searchable.includes(word));
    });
    const exactNames = matching.filter(polity => foldHistorySearch(polity.name) === queryWords.join(' '));
    if (exactNames.length > 0) return exactNames;
    return [...matching].sort((a, b) => {
      const firstNameMatch = queryWords.every(word => foldHistorySearch(a.name).includes(word));
      const secondNameMatch = queryWords.every(word => foldHistorySearch(b.name).includes(word));
      if (firstNameMatch !== secondNameMatch) {
        if (firstNameMatch) return -1;
        return 1;
      }
      return a.name.localeCompare(b.name);
    });
  });
  const selected = $derived(active.find(item => item.id === selectedId) ?? historyMostProminent(year));
  const detailLabel = $derived.by(() => {
    if (pendingResearchSelection) return m.loading_data();
    if (selectedDossier) return selectedDossier.properties.name;
    if (selected) return localizedHistoryName(selected.id, selected.name);
    return m.history_no_records();
  });
  const selectedResearch = $derived.by(() => {
    if (!selected) return [];
    return (research?.features ?? []).filter(dossier => curatedPolityFor(dossier) === selected.id);
  });
  $effect(() => {
    void selectedId;
    supplementalExpanded = false;
    detailElement?.scrollTo({ top: 0 });
  });
  const modernStatuses = $derived.by(() => {
    if (year < 1945) return [];
    return [
      { name: m.history_modern_region_wng(), phase: modernTerritorialStatusAt('western-new-guinea', year) },
      { name: m.history_modern_region_timor(), phase: modernTerritorialStatusAt('timor-leste', year) }
    ];
  });
  const nearest = $derived([...HISTORY_EVENTS].reverse().find(event => event.year <= year));
  const timelineTicks = [HISTORY_MIN_YEAR, 400, 1000, 1500, HISTORY_MAX_YEAR];
  function timelinePosition(value: number): number {
    return (value - HISTORY_MIN_YEAR) / (HISTORY_MAX_YEAR - HISTORY_MIN_YEAR) * 100;
  }
  $effect(() => {
    if (selectedDossier || pendingResearchSelection) return;
    if (!active.some(item => item.id === selectedId)) selectedId = selected?.id;
  });

  function clearResearchSelection() {
    if (selectedDossier || pendingResearchSelection) selectedId = undefined;
  }
  const currentRulers = $derived(selected ? historyRulersAt(selected, year) : []);

  /** Reduced-motion readers get one slow step per milestone instead of a fast 25-year sweep. */
  function prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function togglePlayback() {
    if (playing) {
      playing = false;
      return;
    }
    if (year >= HISTORY_MAX_YEAR) year = HISTORY_MIN_YEAR;
    polityScope = 'active';
    polityQuery = '';
    clearResearchSelection();
    playing = true;
  }

  function advanceOneStep() {
    if (prefersReducedMotion()) {
      const nextMilestone = HISTORY_EVENTS.map(event => event.year).find(value => value > year);
      year = nextMilestone ?? HISTORY_MAX_YEAR;
    } else {
      const nextStep = Math.min(HISTORY_MAX_YEAR, year + 25);
      const nextMilestone = HISTORY_EVENTS.find(event => event.year > year && event.year <= nextStep);
      if (nextMilestone) year = nextMilestone.year;
      else year = nextStep;
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
    loadHistoryResearch().then(data => research = data).catch(error => {
      researchFailed = true;
      console.warn('Historical research catalogue unavailable', error);
    }).finally(() => researchLoading = false);
    const visibility = () => { if (document.hidden) playing = false; };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  });

  function jump(step: -1 | 1) {
    playing = false;
    clearResearchSelection();
    const years = HISTORY_EVENTS.map(event => event.year);
    const next = step === 1 ? years.find(value => value > year) : years.filter(value => value < year).at(-1);
    year = next ?? (step === 1 ? HISTORY_MAX_YEAR : HISTORY_MIN_YEAR);
  }

  function choosePolity(id: string) {
    const dossier = additionalDossiers.find(feature => feature.id === id);
    if (dossier) {
      playing = false;
      selectedId = id;
      return;
    }
    const polity = HISTORICAL_POLITIES.find(item => item.id === id);
    if (!polity) return;
    playing = false;
    if (year < polity.from || year > polity.to) {
      year = Math.max(HISTORY_MIN_YEAR, Math.min(HISTORY_MAX_YEAR, Math.round((polity.from + polity.to) / 2)));
    }
    selectedId = id;
  }

  async function loadExportTerritories(path: string): Promise<HistoricalTerritoryCollection> {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Historical territory export failed: ${response.status} (${path})`);
    const territories: HistoricalTerritoryCollection = await response.json();
    if (territories.type !== 'FeatureCollection' || !Array.isArray(territories.features)) {
      throw new Error('Invalid historical territory collection');
    }
    return territories;
  }

  async function buildHistoryExportDataset() {
    const snapshotYear = year;
    playing = false;
    const [legacyTerritories, modernTerritories, rendered, inventory, dossiers] = await Promise.all([
      loadExportTerritories('/data/history-territories.geojson'),
      loadExportTerritories('/data/history-modern-source.geojson'),
      loadExportTerritories('/data/history-territories-render.geojson'),
      loadHistoryInventory(), loadHistoryResearch()
    ]);
    const territories: HistoricalTerritoryCollection = {
      type: 'FeatureCollection', features: [...legacyTerritories.features, ...modernTerritories.features]
    };
    return {
      ...buildHistoryExport({ territories, inventory, research: dossiers, renderedTerritories: rendered, year: snapshotYear }),
      title: m.history_title(), scope: m.history_catalogue_scope()
    };
  }

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
    <div class="playback-controls">
      <button class="step" type="button" onclick={() => jump(-1)} title={m.history_previous()} aria-label={m.history_previous()}><SkipBack size={18} /></button>
      <button type="button" onclick={togglePlayback} aria-label={playing ? m.map_pause() : m.map_play()} aria-pressed={playing} class="play">
        {#if playing}<Pause size={20}/>{:else}<Play size={20}/>{/if}
      </button>
      <button class="step" type="button" onclick={() => jump(1)} title={m.history_next()} aria-label={m.history_next()}><SkipForward size={18} /></button>
    </div>
    <div class="year-slider">
      <input type="range" min={HISTORY_MIN_YEAR} max={HISTORY_MAX_YEAR} step="1" value={year} oninput={event => { year = Number(event.currentTarget.value); playing = false; clearResearchSelection(); }} aria-label={m.history_year()} aria-valuetext={historyYearLabel(year)} />
      <div class="timeline-ticks" aria-hidden="true">
        {#each timelineTicks as tick (tick)}
          <span class:first={tick === HISTORY_MIN_YEAR} class:last={tick === HISTORY_MAX_YEAR} style={`left:${timelinePosition(tick)}%`}>{historyYearLabel(tick)}</span>
        {/each}
      </div>
    </div>
  </div>

  {#if nearest}
    <aside class="milestone info-card" aria-live="off"><span class="milestone-mark" aria-hidden="true">i</span><span><strong>{historyYearLabel(nearest.year)}</strong><span class="milestone-copy">{historyEventLabel(nearest.year)}</span></span></aside>
  {/if}

  {#if modernStatuses.length}
    <aside class="modern-status bento-card">
      <h5>{m.history_territorial_status()}</h5>
      <dl>{#each modernStatuses as region (region.name)}{#if region.phase}<div><dt>{region.name}</dt><dd>{m[region.phase.translationKey as MessageKey]()}</dd></div>{/if}{/each}</dl>
      <p class="caution">{#if year === 1945}{m.history_modern_claim()}{:else if year >= 2025}{m.history_reference_land()}{:else}{m.history_modern_reconstruction()}{/if}</p>
      <p class="caution">{m.history_modern_caution()}</p>
    </aside>
  {/if}
  <p class="caution">{m.history_cartography_warning()} · <a href="https://github.com/Seshat-Global-History-Databank/cliopatria" target="_blank" rel="noreferrer">Cliopatria, Bennett et al. ({m.history_adapted()})</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></p>

  <div class="history-details">
    <section class="active-list polity-browser bento-card" aria-label={m.history_browse_all()} aria-busy={researchLoading && polityScope === 'all'}>
      <header class="browser-heading">
        <h4><span class="bento-icon" aria-hidden="true"><Landmark size={21} /></span>{m.history_browse_all()}</h4>
        <span class="result-count" aria-live="polite">{visiblePolities.length} / {polityScope === 'active' ? active.length : catalogueCount}</span>
      </header>
      <label class="search-label" for="polity-search">{m.history_search()}</label>
      <div class="search-well"><Search size={18} aria-hidden="true" /><input id="polity-search" class="polity-search" type="search" bind:value={polityQuery} oninput={() => playing = false} placeholder={m.history_search_hint()} autocomplete="off" /></div>
      <div class="scope-tabs" role="group" aria-label={m.history_scope()}>
        <button type="button" aria-pressed={polityScope === 'active'} class:current={polityScope === 'active'} onclick={() => { polityScope = 'active'; clearResearchSelection(); }}><span>{m.history_scope_active()}</span><span class="scope-count">{active.length}</span></button>
        <button type="button" aria-pressed={polityScope === 'all'} class:current={polityScope === 'all'} onclick={() => polityScope = 'all'}><span>{m.history_scope_all()}</span><span class="scope-count">{catalogueCount}</span></button>
      </div>
      {#if visiblePolities.length === 0}
        <p class="search-empty" role="status">{#if researchLoading && polityScope === 'all'}{m.loading_data()}{:else if !polityQuery && polityScope === 'active'}{m.history_no_records()}{:else}{m.history_search_empty()}{/if}</p>
      {:else}
        <div class="polity-results polity-choices">
          {#each visiblePolities as item (item.id)}
            <button type="button" class="polity-result" class:selected={selectedId === item.id} onclick={() => choosePolity(item.id)} aria-pressed={selectedId === item.id}>
              <span class="dot" style={'--tone:' + historyPolityColor(item.id)} aria-hidden="true"></span>
              <span class="result-copy">
                <strong><span>{item.name}</span>{#if selectedId === item.id}<Check size={16} aria-hidden="true" />{/if}</strong>
                {#if item.region}<span class="result-region">{regionLabel(item.region)}</span>{/if}
              </span>
              {#if item.from !== undefined && item.to !== undefined}
                <span class="result-period">{historyPeriodLabel(item.from, item.to, item.ongoing)}</span>
              {:else}
                <span class="result-period research-badge" title={m.history_research_detail()}>{m.history_research_badge()}</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </section>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (The scrollable region must be keyboard-accessible.) -->
    <section class="polity-detail scroll-area bento-card" bind:this={detailElement} tabindex="0" aria-label={detailLabel}>
      {#if pendingResearchSelection}
        <p role="status">{m.loading_data()}</p>
      {:else if selectedDossier && research}
        <HistoryResearchDetail dossier={selectedDossier} {research} />
      {:else if selected}
        <header class="detail-heading">
          <div class="detail-title">
            <span class="detail-kicker">{regionLabel(selected.region)}</span>
            <h4>{localizedHistoryName(selected.id, selected.name)}</h4>
          </div>
          <span class="period">{historyPeriodLabel(selected.from, selected.to, selected.ongoing)}</span>
        </header>
        {#if localizedPlace(selected)}<p class="place">{localizedPlace(selected)}</p>{/if}
        <p class="summary">{localizedHistorySummary(selected)}</p>
        <section class="detail-section" aria-labelledby="rulers-heading">
          <h5 id="rulers-heading">{m.history_rulers()}</h5>
          {#if currentRulers.length}<p class="current-ruler">{currentRulers.map(r => r.name).join(' · ')}</p>{/if}
          {#if selected.rulers.length}
            <ul class="rulers">{#each selected.rulers as ruler (`${ruler.name}:${ruler.from ?? ''}:${ruler.to ?? ''}`)}
              <li><span>{ruler.name}</span>{#if ruler.from !== undefined}<span class="ruler-years">{historyRulerPeriodLabel(ruler)}</span>{/if}{#if ruler.uncertain} <small>{m.history_ruler_uncertain()}</small>{/if}</li>
            {/each}</ul>
          {:else}<p>{m.history_no_rulers()}</p>{/if}
        </section>
        {#if selected.to === HISTORY_LEGACY_CUTOFF_YEAR}<p class="caution">{m.history_legacy_cutoff()}</p>{/if}
        {#if selected.dateNote}<p class="caution">{localizedDateNote(selected)}</p>{/if}
        <section class="detail-section" aria-labelledby="sources-heading">
          <h5 id="sources-heading">{m.history_sources()}</h5>
          <ul class="sources">{#each selected.sources as url (url)}<li><a href={url} target="_blank" rel="noreferrer">{new URL(url).hostname}</a></li>{/each}</ul>
        </section>
        {#if selectedResearch.length > 0 && research}
          <details class="supplemental-research" bind:open={supplementalExpanded}>
            <summary>{m.history_research_detail()} · {selectedResearch.length}</summary>
            {#if supplementalExpanded}<div class="supplemental-body">{#each selectedResearch as dossier (dossier.id)}<HistoryResearchDetail {dossier} {research} embedded />{/each}</div>{/if}
          </details>
        {/if}
      {:else}
        <p>{m.history_no_records()}</p>
      {/if}
    </section>
  </div>
  <HistoryInventory query={polityQuery} />
  {#if researchFailed}<p class="caution">{m.history_catalogue_incomplete()}</p>{/if}
  <footer class="downloads">
    <DataExport buildDataset={buildHistoryExportDataset} />
    <small>{m.history_export_detail()}</small>
  </footer>
</section>

<style>
  .history-panel { margin-top:16px;display:grid;gap:16px;min-width:0;padding:20px;border-radius:22px;background:var(--surface);box-shadow:var(--clay-pressed);container-type:inline-size; }
  .history-heading {display:flex;align-items:flex-start;gap:12px;justify-content:space-between}
  h3,h4,h5,p {margin:0} h3{font-size:1.15rem} h4{font-size:1rem} h5{font-size:.83rem}
  p {font-size:.85rem;line-height:1.6;color:var(--muted)}
  .era {white-space:nowrap;background:var(--panel);padding:8px 12px;border-radius:12px;font-weight:900;color:var(--text);font-variant-numeric:tabular-nums}
  .playback {display:flex;align-items:center;gap:16px;padding:12px 14px;border:1px solid var(--border);border-radius:20px;background:var(--panel);box-shadow:inset 0 2px 5px var(--shadow)}
  .playback-controls {display:flex;align-items:center;gap:8px;flex:none}
  .playback button {flex:none;display:grid;place-items:center;padding:0;border:0;border-radius:50%;cursor:pointer;transition:transform 120ms,box-shadow 120ms}
  .playback .play{width:52px;height:52px;background:radial-gradient(circle at 32% 26%,color-mix(in srgb,var(--accent) 70%,#fff),var(--accent));color:var(--on-accent,#fff);box-shadow:0 4px 0 color-mix(in srgb,var(--accent) 60%,#000),inset 0 2px 2px #ffffff66}
  .playback .step{width:44px;height:44px;background:radial-gradient(circle at 32% 26%,var(--surface),var(--mint));color:var(--accent-strong);box-shadow:0 4px 0 var(--border),inset 0 2px 2px var(--clay-highlight),inset 0 -3px 4px var(--shadow)}
  .playback button:active{transform:translateY(2px);box-shadow:0 1px 0 var(--border),inset 0 2px 4px var(--shadow)}
  .playback button:focus-visible,.year-slider input:focus-visible{outline:3px solid var(--accent);outline-offset:4px}
  .year-slider{flex:1;min-width:0;padding:0 0 20px}
  .year-slider input{display:block;appearance:none;-webkit-appearance:none;width:100%;height:44px;margin:0;background:transparent;cursor:pointer}
  .year-slider input::-webkit-slider-runnable-track{height:8px;border-radius:999px;background:linear-gradient(to right,#ac9566 0% 34.13%,#bd8069 34.13% 59.73%,#658c83 59.73% 81.06%,#777ca7 81.06% 93.86%,#a67d9d 93.86% 100%);box-shadow:inset 0 2px 3px #0003}
  .year-slider input::-moz-range-track{height:8px;border-radius:999px;background:linear-gradient(to right,#ac9566 0% 34.13%,#bd8069 34.13% 59.73%,#658c83 59.73% 81.06%,#777ca7 81.06% 93.86%,#a67d9d 93.86% 100%);box-shadow:inset 0 2px 3px #0003}
  .year-slider input::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;margin-top:-8px;border:3px solid var(--surface);border-radius:50%;background:var(--text);box-shadow:0 2px 4px var(--shadow),0 0 0 1px var(--border)}
  .year-slider input::-moz-range-thumb{width:18px;height:18px;border:3px solid var(--surface);border-radius:50%;background:var(--text);box-shadow:0 2px 4px var(--shadow),0 0 0 1px var(--border)}
  .timeline-ticks{position:relative;margin:0 12px;height:0;font-size:.7rem;color:var(--muted);font-variant-numeric:tabular-nums}
  .timeline-ticks span{position:absolute;top:-2px;white-space:nowrap;transform:translateX(-50%)}
  .timeline-ticks .first{transform:none}.timeline-ticks .last{transform:translateX(-100%)}
  .milestone {display:flex;align-items:center;gap:11px;padding:12px 14px;border:1px solid color-mix(in srgb,var(--accent) 28%,var(--border));border-radius:17px;background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 9%,var(--surface)),var(--panel));box-shadow:0 3px 0 -1px var(--border),inset 0 2px 1px var(--clay-highlight);font-weight:650}
  .milestone > span:last-child{display:grid;gap:2px;min-width:0}.milestone strong{font-variant-numeric:tabular-nums;color:var(--text)}.milestone-copy{font-size:.82rem;line-height:1.45;color:var(--muted)}
  .milestone-mark{display:grid;place-items:center;flex:none;width:30px;height:30px;border-radius:11px;background:var(--mint);color:var(--accent-strong);font:900 .95rem Georgia,serif;box-shadow:inset 0 2px 1px var(--clay-highlight),0 2px 0 var(--border)}
  .dot{display:inline-block;width:10px;height:10px;flex:none;border-radius:50%;background:var(--tone)}
  .modern-status{display:grid;gap:10px;padding:16px}.modern-status dl{display:grid;gap:9px;margin:0;font-size:.8rem}.modern-status dl div{display:grid;gap:3px}.modern-status dt{font-weight:850;color:var(--accent-strong)}.modern-status dd{margin:0;color:var(--text);line-height:1.5}
  .caution {font-size:.76rem} .history-details{display:grid;grid-template-columns:minmax(280px,.9fr) minmax(0,1.1fr);align-items:stretch;gap:16px}
  .active-list,.polity-detail{display:grid;align-content:start;gap:14px;padding:18px;min-width:0;height:36rem;box-sizing:border-box}
  .active-list{grid-template-rows:auto auto auto auto minmax(0,1fr)}
  .bento-card{border:1px solid var(--border);border-radius:24px;background:linear-gradient(145deg,var(--surface),var(--panel));box-shadow:0 5px 0 -1px var(--border),inset 2px 2px 3px var(--clay-highlight),inset -2px -3px 6px var(--shadow)}
  .browser-heading h4{display:flex;align-items:center;gap:10px;line-height:1.35;font-size:1.02rem;min-width:0;overflow-wrap:anywhere}
  .bento-icon{display:grid;place-items:center;flex:none;width:40px;height:40px;border-radius:14px;background:var(--mint);color:var(--accent-strong);box-shadow:0 3px 0 var(--border),inset 2px 2px 3px var(--clay-highlight)}
  .browser-heading{display:flex;align-items:center;justify-content:space-between;gap:10px}.result-count{flex:none;padding:6px 9px;border:1px solid var(--border);border-radius:11px;background:var(--surface);box-shadow:0 2px 0 var(--border),inset 1px 1px 2px var(--clay-highlight);font-size:.74rem;font-weight:850;color:var(--muted);font-variant-numeric:tabular-nums}
  .search-label{font-size:.78rem;font-weight:800;color:var(--text)}
  .search-well{display:flex;align-items:center;gap:9px;padding:0 13px;border:1px solid var(--border);border-radius:16px;background:var(--surface);box-shadow:inset 2px 3px 5px var(--shadow),inset -1px -1px 2px var(--clay-highlight);color:var(--muted)}
  .search-well :global(svg){flex:none}.polity-search{flex:1 1 auto;display:block;appearance:none;-webkit-appearance:none;width:auto;max-width:none;min-width:0;min-height:50px;margin:0;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;color:var(--text);font:inherit;font-size:1rem;outline:none}
  .search-well:focus-within{border-color:var(--accent);outline:3px solid color-mix(in srgb,var(--accent) 45%,transparent);outline-offset:2px}
  .scope-tabs button:focus-visible,.polity-result:focus-visible{outline:3px solid color-mix(in srgb,var(--accent) 65%,transparent);outline-offset:2px}
  .scope-tabs{display:grid;grid-template-columns:1fr 1fr;gap:7px}
  .scope-tabs button{display:flex;align-items:center;justify-content:center;gap:8px;min-width:0;min-height:44px;padding:9px;border:1px solid var(--border);border-radius:15px;background:linear-gradient(155deg,var(--surface),var(--panel));box-shadow:0 3px 0 -1px var(--border),inset 1px 2px 2px var(--clay-highlight);color:var(--muted);font:inherit;font-size:.76rem;font-weight:800;cursor:pointer}
  .scope-tabs button > span:first-child{min-width:0;overflow-wrap:anywhere}.scope-count{flex:none;min-width:22px;padding:2px 5px;border-radius:7px;background:var(--surface);font-size:.72rem;font-variant-numeric:tabular-nums}
  .scope-tabs button.current{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,var(--surface));color:var(--text)}
  .polity-results{display:flex;flex-direction:column;align-items:stretch;gap:10px;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:7px 7px 10px;scroll-padding-block:7px;scrollbar-width:thin;scrollbar-color:var(--accent) var(--panel)}
  .polity-result{display:flex;flex:0 0 auto;align-items:center;gap:10px;width:100%;height:auto;max-height:none;min-height:64px;padding:10px 12px;border:1px solid var(--border);border-radius:18px;background:linear-gradient(155deg,var(--surface),var(--panel));color:var(--text);text-align:left;font:inherit;cursor:pointer;box-shadow:0 4px 0 -2px var(--border),inset 1px 2px 2px var(--clay-highlight);transition:border-color 140ms,box-shadow 140ms}
  .polity-result :global(svg){flex:none;color:var(--accent-strong)}.polity-result:active,.scope-tabs button:active{box-shadow:inset 2px 3px 5px var(--shadow)}
  .polity-result:hover{border-color:color-mix(in srgb,var(--accent) 48%,var(--border))}
  .polity-result.selected{border-color:var(--accent);background:linear-gradient(150deg,color-mix(in srgb,var(--accent) 11%,var(--surface)),var(--panel));font-weight:850}
  .result-copy{display:grid;flex:1 1 auto;justify-items:start;gap:3px;min-width:0}.result-copy strong{display:flex;align-items:center;gap:6px;min-width:0;font-size:.9rem;line-height:1.4}.result-copy strong > span{min-width:0;overflow-wrap:anywhere}.result-region{font-size:.73rem;line-height:1.4;color:var(--muted)}
  .result-period{flex:none;max-width:44%;padding:4px 7px;border-radius:8px;background:var(--panel);box-shadow:inset 1px 1px 3px var(--shadow);font-size:.72rem;font-weight:750;line-height:1.4;text-align:right;overflow-wrap:anywhere;color:var(--muted);font-variant-numeric:tabular-nums}.research-badge{background:var(--mint);color:var(--accent-strong)}
  .search-empty{padding:12px;border:1px dashed var(--border);border-radius:12px;background:var(--surface);color:var(--muted)}
  .polity-detail{overflow-y:auto;scrollbar-gutter:stable;background:linear-gradient(145deg,var(--surface),var(--panel));box-shadow:0 4px 0 -1px var(--border),inset 2px 2px 4px var(--clay-highlight),inset -2px -3px 6px var(--shadow)}
  .detail-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding-bottom:10px;border-bottom:1px solid var(--border)}
  .detail-title{display:grid;justify-items:start;gap:10px;min-width:0}.detail-kicker{padding:5px 9px;border-radius:10px;background:var(--mint);box-shadow:0 2px 0 var(--border),inset 1px 1px 2px var(--clay-highlight);font-size:.75rem;font-weight:850;letter-spacing:.04em;color:var(--accent-strong)}
  .detail-heading h4{font-size:1.18rem;line-height:1.25;text-wrap:pretty;overflow-wrap:anywhere}
  .period{flex:none;padding:6px 9px;border:1px solid var(--border);border-radius:999px;background:var(--panel);font-size:.75rem;font-weight:850;color:var(--text);font-variant-numeric:tabular-nums;box-shadow:inset 1px 1px 2px var(--clay-highlight)}
  .detail-section{display:grid;gap:9px;padding:13px;border:1px solid var(--border);border-radius:17px;background:var(--panel);box-shadow:inset 1px 1px 3px var(--clay-highlight),0 2px 0 -1px var(--border)}.detail-section h5{color:var(--accent-strong)}
  .polity-result .dot{width:12px;height:12px;border:2px solid var(--surface);box-shadow:0 1px 3px var(--shadow)}
  .place{font-size:.77rem;font-weight:750;color:var(--muted)}
  .summary{padding:12px 14px;border:1px solid var(--border);border-radius:14px;background:var(--panel);color:var(--text);line-height:1.7;box-shadow:inset 1px 1px 3px var(--shadow)}
  .polity-detail ul{padding-left:0;margin:0;list-style:none;font-size:.82rem;line-height:1.55;color:var(--text)}
  .rulers{display:grid;gap:5px}.rulers li{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:7px 9px;border-radius:10px;background:color-mix(in srgb,var(--surface) 78%,transparent)}
  .ruler-years{flex:none;font-size:.74rem;font-variant-numeric:tabular-nums;color:var(--muted)}
  .polity-detail li small{color:var(--muted)}.sources{display:flex;flex-wrap:wrap;gap:6px 12px}.sources a{display:inline-flex;align-items:center;min-height:44px;color:var(--accent-strong);overflow-wrap:anywhere}
  .current-ruler{padding:8px 10px;border-radius:11px;background:color-mix(in srgb,var(--accent) 12%,var(--surface));font-size:.82rem;font-weight:900;color:var(--text)}.downloads{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
  .supplemental-research{min-width:0}.supplemental-research summary{min-height:44px;padding:11px 12px;border:1px solid var(--border);border-radius:14px;background:var(--panel);box-shadow:0 3px 0 -1px var(--border),inset 1px 2px 2px var(--clay-highlight);font-size:.82rem;font-weight:800;cursor:pointer}.supplemental-research summary:focus-visible{outline:3px solid var(--accent);outline-offset:2px}.supplemental-body{display:grid;gap:14px;padding:14px 0}
  .polity-detail:focus-visible{outline:3px solid color-mix(in srgb,var(--accent) 60%,transparent);outline-offset:2px}
  .downloads small{flex-basis:100%;font-size:.73rem;color:var(--muted)}
  @container(max-width:620px){.history-heading{flex-wrap:wrap}.history-details{grid-template-columns:1fr}.active-list,.polity-detail{height:34rem}.detail-heading{flex-wrap:wrap}.playback{flex-wrap:wrap;gap:4px 12px}.playback-controls{width:100%;justify-content:center}.year-slider{flex-basis:100%}.timeline-ticks span:nth-child(2),.timeline-ticks span:nth-child(4){display:none}}
  @media(prefers-reduced-motion:reduce){.playback button,.polity-result{transition:none}}
</style>
