<script lang="ts">
  import { onMount } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import { activeWarnings, eventColor, eventLabel, EVENT_KINDS, kindLabel, loadHazards, severityColor, type DisasterEvent, type EventKind, type HazardSnapshot, type HazardWarning } from '$lib/data/hazards';

  let { kind }: { kind: 'reports' | 'warnings' } = $props();
  let snapshot = $state<HazardSnapshot | undefined>();
  let loading = $state(true);

  const MAX_VISIBLE = 50;
  let kindFilter = $state<EventKind | 'all'>('all');
  const filteredEvents = $derived.by((): DisasterEvent[] => {
    if (!snapshot) return [];
    const matching = snapshot.events.items.filter(event => kindFilter === 'all' || event.kind === kindFilter);
    return [...matching].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  });
  const events = $derived(filteredEvents.slice(0, MAX_VISIBLE));
  function countOf(kind: EventKind): number {
    return snapshot?.events.items.filter(event => event.kind === kind).length ?? 0;
  }
  function impactText(event: DisasterEvent): string {
    const impact = event.impact;
    if (!impact) return '';
    const parts: string[] = [];
    if (impact.deaths) parts.push(m.hazard_impact_deaths() + ' ' + impact.deaths);
    if (impact.missing) parts.push(m.hazard_impact_missing() + ' ' + impact.missing);
    if (impact.injured) parts.push(m.hazard_impact_injured() + ' ' + impact.injured);
    if (impact.housesDamaged) parts.push(m.hazard_impact_houses() + ' ' + impact.housesDamaged);
    return parts.join(' · ');
  }
  const warnings = $derived.by((): HazardWarning[] => {
    if (!snapshot) return [];
    return activeWarnings(snapshot, Date.now());
  });
  const heading = $derived.by(() => {
    if (kind === 'reports') return m.layer_disaster_reports();
    return m.layer_weather_hazards();
  });

  onMount(() => {
    let active = true;
    const refresh = () => {
      void loadHazards().then(value => {
        if (!active) return;
        if (value) snapshot = value;
        loading = false;
      });
    };
    refresh();
    const timer = setInterval(() => { if (!document.hidden && navigator.onLine) refresh(); }, 15 * 60_000);
    return () => { active = false; clearInterval(timer); };
  });

  function date(value: string) { return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
</script>

<section class="hazard-panel" aria-label={heading} aria-busy={loading}>
  <header>
    <div>
      <h3>{heading}</h3>
      <p>{#if kind === 'reports'}{m.hazard_reports_details()}{:else}{m.hazard_warnings_details()}{/if}</p>
    </div>
    <span class="source-badge">{#if kind === 'reports'}BNPB · PetaBencana · ANTARA · GDELT{:else}BMKG · CAP{/if}</span>
  </header>
  {#if loading}<p role="status">{m.loading_data()}</p>
  {:else if snapshot}
    <div class="hazard-summary">
      <strong>{#if kind === 'reports'}{filteredEvents.length}{:else}{warnings.length}{/if}</strong>
      <span>{#if kind === 'reports'}{m.hazard_reports_count()}{:else}{m.hazard_warnings_count()}{/if}</span>
      <small>{m.ingested_time()}: {date(snapshot.fetchedAt)}</small>
    </div>
    {#if kind === 'reports'}
      <div class="kind-filter" role="group" aria-label={m.hazard_kind_all()}>
        <button type="button" aria-pressed={kindFilter === 'all'} onclick={() => kindFilter = 'all'}>{m.hazard_kind_all()} · {snapshot.events.items.length}</button>
        {#each EVENT_KINDS as eventKind (eventKind)}
          <button type="button" aria-pressed={kindFilter === eventKind} onclick={() => kindFilter = eventKind}>{kindLabel(eventKind)} · {countOf(eventKind)}</button>
        {/each}
      </div>
      {#if events.length === 0}<p role="status">{m.hazard_none_reports()}</p>{/if}
      <ol class="hazard-list">
        {#each events as event (event.id)}
          <li><span class="type-chip" style={`--chip: ${eventColor(event.type)}`}>{eventLabel(event.type)}</span>
            <div>
              {#if event.url}<strong><a href={event.url} target="_blank" rel="noopener noreferrer">{event.title} ↗</a></strong>
              {:else}<strong>{event.title}</strong>{/if}
              {#if event.place && event.place !== event.title}<p>{event.place}{#if event.precision === 'province'} · {m.hazard_location_approximate()}{/if}</p>{/if}
              {#if impactText(event)}<p class="impact">{impactText(event)}</p>{/if}
              <time datetime={event.occurredAt}>{kindLabel(event.kind)} · {event.source} · {date(event.occurredAt)}{#if event.floodDepthCm !== undefined} · {event.floodDepthCm} cm{/if}</time></div></li>
        {/each}
      </ol>
    {:else}
      {#if warnings.length === 0}<p role="status">{m.hazard_none_warnings()}</p>{/if}
      <ol class="hazard-list">
        {#each warnings as warning (warning.id)}
          <li><span class="type-chip" style={`--chip: ${severityColor(warning.severity)}`}>{warning.severity ?? warning.event}</span>
            <div><strong>{warning.headline}</strong>
              <p>{warning.areaDescriptions}</p>
              <time datetime={warning.expires}>{m.hazard_valid_until()} {date(warning.expires)} · <a href={warning.sourceLink} target="_blank" rel="noreferrer">CAP ↗</a></time></div></li>
        {/each}
      </ol>
    {/if}
    {#if kind === 'reports' && snapshot}
      {#each snapshot.events.sources as eventSource (eventSource.id)}<p class="hazard-attribution">{eventSource.attribution} <a href={eventSource.termsUrl} target="_blank" rel="noopener noreferrer">{eventSource.name} ↗</a></p>{/each}
    {:else if snapshot}<p class="hazard-attribution">{snapshot.warnings.attribution} <a href={snapshot.warnings.termsUrl} target="_blank" rel="noopener noreferrer">BMKG ↗</a></p>{/if}
  {:else}<p role="status">{m.data_unavailable()}</p>{/if}
</section>

<style>
  .hazard-panel { margin-top: 20px; padding: 20px; border-radius: 22px; background: var(--surface); box-shadow: var(--clay-pressed); }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; } h3 { margin: 0 0 6px; } p { margin: 0; font-size: .85rem; color: var(--muted); }
  .source-badge { padding: 6px 10px; border-radius: 12px; background: var(--peach); font-size: .75rem; font-weight: 900; white-space: nowrap; }
  .hazard-summary { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; padding: 16px 0; }.hazard-summary strong { font-size: 2rem; }.hazard-summary small { margin-left: auto; color: var(--muted); }
  .hazard-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; max-height: 360px; overflow: auto; list-style: none; margin: 0; padding: 4px; }
  li { display: flex; gap: 12px; align-items: flex-start; padding: 12px; border-radius: 16px; background: var(--panel); min-width: 0; } li strong { font-size: .8rem; display: block; overflow-wrap: anywhere; } li p { font-size: .75rem; margin-top: 4px; overflow-wrap: anywhere; }
  time { display: block; font-size: .72rem; color: var(--muted); margin-top: 4px; }
  .type-chip { flex: none; padding: 4px 9px; border-radius: 10px; background: var(--chip); color: #fff; font-size: .68rem; font-weight: 900; text-shadow: 0 1px 1px #0003; }
  .hazard-attribution { margin-top: 10px; font-size: .72rem; line-height: 1.5; } a { text-decoration: underline; }
  .kind-filter { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
  .kind-filter button { min-height: 36px; padding: 6px 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: inherit; font-size: .75rem; font-weight: 800; }
  .kind-filter button[aria-pressed='true'] { background: var(--accent); color: #fff; }
  .impact { font-weight: 800; color: var(--text); }
  @media(max-width: 700px) { .hazard-list { grid-template-columns: minmax(0, 1fr); } header { flex-wrap: wrap; } }
</style>
