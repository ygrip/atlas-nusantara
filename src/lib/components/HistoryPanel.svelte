<script lang="ts">
  import { onMount } from 'svelte';
  import { Download, Pause, Play, SkipBack, SkipForward } from 'lucide-svelte';
  import { m } from '$lib/i18n/messages';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import { localizedHistorySummary } from '$lib/data/history-summary';
  import {
    HISTORICAL_POLITIES, HISTORY_EVENTS, HISTORY_MIN_YEAR, HISTORY_MAX_YEAR,
    historyActive, historyRulersAt, historyCategoryAt
  } from '$lib/data/history';

  let { year = $bindable(682) }: { year: number } = $props();
  let playing = $state(false);
  let focusId = $state<string>();
  let showAll = $state(false);
  const active = $derived(historyActive(year));
  const selected = $derived(active.find(item => item.id === focusId) ?? active[0]);
  const nearest = $derived([...HISTORY_EVENTS].reverse().find(event => event.year <= year));
  const currentRulers = $derived(selected ? historyRulersAt(selected, year) : []);

  $effect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      year = Math.min(HISTORY_MAX_YEAR, year + 25);
      if (year >= HISTORY_MAX_YEAR) playing = false;
    }, 520);
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
    focusId = id;
  }

  function save(name: string, content: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadJson() {
    save('atlas-nusantara-history-pre1945.json',
      JSON.stringify({
        schemaVersion: 1,
        cutoff: HISTORY_MAX_YEAR,
        reference: 'https://id.wikipedia.org/wiki/Sejarah_Nusantara',
        cartography: 'schematic influence zones, NOT historical or modern borders',
        licenseNote: 'Original curated summaries; verify individual cited sources and geometries before reuse.',
        polities: HISTORICAL_POLITIES,
        events: HISTORY_EVENTS
      }, null, 2) + '\n', 'application/json;charset=utf-8');
  }

  function cell(value: unknown): string {
    let text = String(value ?? '').replace(/"/g, '""');
    // Spreadsheet programs interpret certain text prefixes as formulas.
    if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
    return '"' + text + '"';
  }

  function downloadCsv() {
    const header = ['id','name','from','to','category','place','summary_en','summary_id','rulers','zones','sources'];
    const rows = HISTORICAL_POLITIES.map(p => [
      p.id,p.name,p.from,p.to,p.category,p.place,p.summary.en,p.summary.id,
      p.rulers.map(r => r.name + (r.from ? ' (' + r.from + '–' + (r.to ?? '?') + ')' : '')).join('; '),
      JSON.stringify(p.zones),p.sources.join('; ')
    ]);
    save('atlas-nusantara-history-pre1945.csv',
      [header, ...rows].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n',
      'text/csv;charset=utf-8');
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
    <span class="era">{year < 0 ? Math.abs(year) + ' BCE' : year + ' CE'}</span>
  </header>

  <div class="playback" role="group" aria-label={m.history_timeline()}>
    <button type="button" onclick={() => jump(-1)} title={m.history_previous()} aria-label={m.history_previous()}><SkipBack size={18} /></button>
    <button type="button" onclick={() => { if (year >= HISTORY_MAX_YEAR) year = HISTORY_MIN_YEAR; playing = !playing; }} aria-label={playing ? m.map_pause() : m.map_play()} aria-pressed={playing} class="play">
      {#if playing}<Pause size={18}/>{m.map_pause()}{:else}<Play size={18}/>{m.map_play()}{/if}
    </button>
    <label class="year-slider">
      <span class="sr-only">{m.history_year()}</span>
      <input type="range" min={HISTORY_MIN_YEAR} max={HISTORY_MAX_YEAR} step="1" value={year} oninput={event => { year = Number(event.currentTarget.value); playing = false; }} aria-label={m.history_year()} />
      <span class="bounds"><span>400 BCE</span><span>1944 CE</span></span>
    </label>
    <button type="button" onclick={() => jump(1)} title={m.history_next()} aria-label={m.history_next()}><SkipForward size={18} /></button>
  </div>

  {#if nearest}
    <p class="milestone" aria-live="off"><strong>{nearest.year < 0 ? Math.abs(nearest.year) + ' BCE' : nearest.year}</strong> · {getLocale() === 'id' || getLocale() === 'ms' ? nearest.id : nearest.en}</p>
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
          <button type="button" class:selected={selected?.id === item.id} onclick={() => focusId = item.id} aria-pressed={selected?.id === item.id}>
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
    <div class="polity-detail">
      {#if selected}
        <h4>{selected.name} <small>{selected.from}–{selected.to} CE</small></h4>
        <p class="place">{selected.place}</p>
        <p class="summary">{localizedHistorySummary(selected)}</p>
        <h5>{m.history_rulers()}</h5>
        {#if currentRulers.length}<p class="current-ruler">{currentRulers.map(r => r.name).join(' · ')}</p>{/if}
        {#if selected.rulers.length}
          <ul>{#each selected.rulers as ruler (ruler.name)}
            <li>{ruler.name}{#if ruler.from !== undefined} ({ruler.from}–{ruler.to ?? '?'}){/if}{#if ruler.note} <small>{ruler.note}</small>{/if}</li>
          {/each}</ul>
        {:else}<p>{m.history_no_rulers()}</p>{/if}
        {#if selected.dateNote}<p class="caution">{selected.dateNote}</p>{/if}
        <h5>{m.history_sources()}</h5>
        <ul class="sources">{#each selected.sources as url (url)}<li><a href={url} target="_blank" rel="noreferrer">{new URL(url).hostname}</a></li>{/each}</ul>
      {:else}
        <p>{m.history_no_records()}</p>
      {/if}
    </div>
  </div>
  <footer class="downloads">
    <button type="button" onclick={downloadJson}><Download size={16}/>{m.history_download_json()}</button>
    <button type="button" onclick={downloadCsv}><Download size={16}/>{m.history_download_csv()}</button>
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
  .playback button,.downloads button,.all-toggle {border:1px solid var(--border);border-radius:14px;background:var(--panel);color:var(--text);min-height:40px;padding:7px 12px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;box-shadow:0 3px 0 var(--border)}
  .playback .play{background:var(--surface);font-weight:900} .playback button:active,.downloads button:active{transform:translateY(2px);box-shadow:0 1px 0 var(--border)}
  .year-slider{display:grid;flex:1;min-width:0;gap:4px} .year-slider input{width:100%;accent-color:var(--accent)}
  .bounds{display:flex;justify-content:space-between;font-size:.7rem;color:var(--muted);font-variant-numeric:tabular-nums}
  .milestone {padding:10px 12px;border-radius:12px;background:var(--panel);font-weight:650}
  .legend{display:flex;gap:8px 14px;flex-wrap:wrap;font-size:.75rem;color:var(--muted)}
  .legend span{display:inline-flex;align-items:center;gap:5px}.legend i,.dot{display:inline-block;width:10px;height:10px;flex:none;border-radius:50%;background:var(--tone)}
  .caution {font-size:.76rem} .history-details{display:grid;grid-template-columns:minmax(0,.7fr) minmax(0,1.3fr);gap:14px}
  .active-list,.polity-detail{display:grid;align-content:start;gap:11px;padding:14px;background:var(--panel);border-radius:18px;min-width:0}
  .polity-choices{display:flex;flex-wrap:wrap;gap:7px;max-height:220px;overflow:auto}
  .polity-choices button{background:var(--surface);color:var(--text);padding:7px 10px;border:1px solid var(--border);border-radius:12px;font-size:.76rem;cursor:pointer;display:inline-flex;align-items:center;gap:7px}
  .polity-choices button.selected{border-color:var(--accent);box-shadow:inset 0 2px 4px var(--shadow);font-weight:900}
  select{width:100%;padding:11px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--text)}
  h4 small{font-weight:600;font-size:.77rem;color:var(--muted)}.place{font-weight:800}
  .summary{color:var(--text)}.polity-detail ul{padding-left:19px;margin:0;font-size:.8rem;line-height:1.75;color:var(--text)}
  .polity-detail li small{color:var(--muted)}.sources{display:flex;flex-wrap:wrap;gap:6px 24px}.sources a{color:var(--accent-strong);overflow-wrap:anywhere}
  .current-ruler{font-weight:900;color:var(--text)}.downloads{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
  .downloads small{flex-basis:100%;font-size:.73rem;color:var(--muted)}
  .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
  @media(max-width:620px){.history-heading{flex-wrap:wrap}.history-details{grid-template-columns:1fr}.playback{gap:4px}.playback button{padding:7px}.playback button.play{font-size:.8rem}}
  @media(prefers-reduced-motion:reduce){.playback button,.downloads button{transition:none}}
</style>
