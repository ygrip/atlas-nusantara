<script lang="ts">
  import { AlertOctagon, AlertTriangle, ExternalLink, Info, ShieldAlert } from 'lucide-svelte';
  import { m } from '$lib/i18n/messages';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import type { HazardWarning } from '$lib/data/hazards';
  import { severityColor } from '$lib/data/hazards';
  import { countBySeverity, severityLevel, SEVERITY_LEVELS, sortWarnings, splitAreas, timeLeft, type SeverityLevel } from '$lib/data/warning-view';

  let { warnings, now }: { warnings: HazardWarning[]; now: number } = $props();

  const VISIBLE_AREAS = 6;
  let filter = $state<SeverityLevel | 'all'>('all');
  let expanded = $state(new Set<string>());

  const severityLabels: Record<SeverityLevel, () => string> = {
    extreme: m.hazard_severity_extreme, severe: m.hazard_severity_severe, moderate: m.hazard_severity_moderate, minor: m.hazard_severity_minor
  };
  const severityIcons: Record<SeverityLevel, typeof Info> = { extreme: AlertOctagon, severe: ShieldAlert, moderate: AlertTriangle, minor: Info };
  const urgencyLabels: Record<string, () => string> = {
    immediate: m.hazard_urgency_immediate, expected: m.hazard_urgency_expected, future: m.hazard_urgency_future, past: m.hazard_urgency_past
  };

  const counts = $derived(countBySeverity(warnings));
  const visible = $derived(sortWarnings(warnings).filter(warning => filter === 'all' || severityLevel(warning.severity) === filter));
  const relative = $derived(new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto' }));
  const clock = $derived(new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short' }));

  function endsIn(warning: HazardWarning): string {
    const left = timeLeft(warning.expires, now);
    if (!left) return '';
    return relative.format(left.value, left.unit);
  }

  function urgencyOf(warning: HazardWarning): string {
    if (!warning.urgency) return '';
    const label = urgencyLabels[warning.urgency.toLowerCase()];
    if (label) return label();
    return warning.urgency;
  }

  function toggleAreas(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expanded = next;
  }

  function areasOf(warning: HazardWarning): { shown: string[]; hidden: number } {
    const all = splitAreas(warning.areaDescriptions);
    if (expanded.has(warning.id)) return { shown: all, hidden: 0 };
    return { shown: all.slice(0, VISIBLE_AREAS), hidden: Math.max(0, all.length - VISIBLE_AREAS) };
  }
</script>

<div class="severity-filter" role="group" aria-label={m.hazard_filter_severity()}>
  <button type="button" aria-pressed={filter === 'all'} onclick={() => { filter = 'all'; }}>{m.hazard_kind_all()} <b>{warnings.length}</b></button>
  {#each SEVERITY_LEVELS as level (level)}
    {#if counts[level] > 0}
      <button type="button" aria-pressed={filter === level} style={`--tone: ${severityColor(level.charAt(0).toUpperCase() + level.slice(1))}`} onclick={() => { filter = level; }}>
        <span class="dot" aria-hidden="true"></span>{severityLabels[level]()} <b>{counts[level]}</b>
      </button>
    {/if}
  {/each}
</div>

<!-- svelte-ignore a11y_no_noninteractive_tabindex (a scrollable list must be focusable so keyboard users can scroll it) -->
<ol class="warning-list scroll-area" tabindex="0" aria-label={m.layer_weather_hazards()}>
  {#each visible as warning (warning.id)}
    {@const level = severityLevel(warning.severity)}
    {@const SeverityIcon = severityIcons[level]}
    {@const areas = areasOf(warning)}
    {@const remaining = endsIn(warning)}
    <li class="warning-card" style={`--tone: ${severityColor(warning.severity)}`}>
      <div class="warning-top">
        <span class={'severity-pill severity-' + level}><SeverityIcon size={15} aria-hidden="true" />{severityLabels[level]()}</span>
        {#if urgencyOf(warning)}<span class="urgency-pill">{urgencyOf(warning)}</span>{/if}
        {#if remaining}<span class="ends-in">{remaining}</span>{/if}
      </div>
      <h4>{warning.headline}</h4>
      <p class="event-name">{warning.event}</p>
      {#if areas.shown.length > 0}
        <ul class="area-chips" aria-label={m.hazard_areas()}>
          {#each areas.shown as area (area)}<li>{area}</li>{/each}
          {#if areas.hidden > 0}<li class="more"><button type="button" onclick={() => toggleAreas(warning.id)}>{m.hazard_more_areas({ count: areas.hidden })}</button></li>{/if}
        </ul>
        {#if areas.hidden === 0 && expanded.has(warning.id)}<button type="button" class="link-button" onclick={() => toggleAreas(warning.id)}>{m.hazard_fewer_areas()}</button>{/if}
      {/if}
      {#if warning.description}
        <details class="advisory">
          <summary>{m.hazard_full_advisory()}</summary>
          <p>{warning.description}</p>
        </details>
      {/if}
      <footer>
        <span>{m.hazard_valid_until()} <time datetime={warning.expires}>{clock.format(new Date(warning.expires))}</time></span>
        <a href={warning.sourceLink} target="_blank" rel="noopener noreferrer">CAP <ExternalLink size={12} aria-hidden="true" /></a>
      </footer>
    </li>
  {/each}
</ol>

<style>
  .severity-filter { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
  .severity-filter button { display: inline-flex; align-items: center; gap: 7px; min-height: 40px; padding: 0 14px; border: 1px solid var(--border); border-radius: 999px; color: var(--text); font: inherit; font-size: .78rem; font-weight: 800; background: var(--surface); cursor: pointer; box-shadow: 0 2px 0 var(--border); }
  .severity-filter button b { color: inherit; font-weight: 800; font-variant-numeric: tabular-nums; }
  .severity-filter button[aria-pressed='true'] { color: var(--on-accent); border-color: var(--accent); background: var(--accent); }
  .severity-filter button:focus-visible { outline: 3px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 2px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--tone); box-shadow: 0 0 0 2px var(--surface); }

  .warning-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 12px; max-height: 520px; margin: 0; padding: 6px; list-style: none; border-radius: 18px; }
  .warning-card { display: grid; align-content: start; gap: 8px; min-width: 0; padding: 14px 14px 12px 18px; position: relative; overflow: hidden; border: 1px solid var(--border); border-radius: 18px; background: var(--panel); box-shadow: 0 3px 0 var(--border), inset 0 2px 1px var(--clay-highlight); }
  .warning-card::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 6px; background: var(--tone); }
  .warning-top { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .severity-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 999px; color: #1c1b18; font-size: .7rem; font-weight: 900; letter-spacing: .03em; background: var(--tone); }
  .severity-pill.severity-extreme, .severity-pill.severity-severe { color: #fff; }
  .urgency-pill { padding: 4px 9px; border-radius: 999px; font-size: .68rem; font-weight: 850; background: var(--surface); box-shadow: inset 0 0 0 1px var(--border); }
  .ends-in { margin-inline-start: auto; color: var(--muted); font-size: .72rem; font-weight: 800; }
  h4 { margin: 2px 0 0; font-size: .95rem; line-height: 1.3; overflow-wrap: anywhere; }
  .event-name { margin: 0; color: var(--muted); font-size: .76rem; font-weight: 700; }
  .area-chips { display: flex; flex-wrap: wrap; gap: 5px; margin: 0; padding: 0; list-style: none; }
  .area-chips li { padding: 3px 9px; border-radius: 999px; font-size: .72rem; font-weight: 700; background: var(--surface); box-shadow: inset 0 0 0 1px var(--border); overflow-wrap: anywhere; }
  .area-chips li.more { padding: 0; background: none; box-shadow: none; }
  .area-chips li.more button, .link-button { min-height: 28px; padding: 3px 9px; border: 1px dashed var(--accent); border-radius: 999px; color: var(--accent-strong); font: inherit; font-size: .72rem; font-weight: 850; background: transparent; cursor: pointer; }
  .link-button { justify-self: start; }
  .area-chips li.more button:focus-visible, .link-button:focus-visible, .advisory summary:focus-visible, footer a:focus-visible { outline: 3px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 2px; }
  .advisory summary { min-height: 32px; padding-block: 4px; color: var(--accent-strong); font-size: .76rem; font-weight: 850; cursor: pointer; }
  .advisory p { margin: 4px 0 0; color: var(--muted); font-size: .78rem; line-height: 1.55; overflow-wrap: anywhere; }
  footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin-top: 2px; padding-top: 8px; border-top: 1px dashed var(--border); color: var(--muted); font-size: .72rem; }
  footer a { display: inline-flex; align-items: center; gap: 3px; min-height: 28px; font-weight: 850; text-decoration: underline; }
</style>
