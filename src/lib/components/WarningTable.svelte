<script lang="ts">
  import { AlertOctagon, AlertTriangle, ChevronRight, ExternalLink, Info, ShieldAlert } from 'lucide-svelte';
  import { m } from '$lib/i18n/messages';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import type { DatasetRecord } from '$lib/data/ingestion/schema';
  import { severityColor } from '$lib/data/hazards';
  import { severityLevel, SEVERITY_LEVELS, splitAreas, timeLeft, type SeverityLevel } from '$lib/data/warning-view';
  import { officialWarningUrl } from '$lib/pwa/notification-payload';
  import MapDialog from './MapDialog.svelte';

  /** Weather warnings as a table. A row opens a dialog with the full advisory, so the table stays readable. */
  let { records, source }: { records: DatasetRecord[]; source: string } = $props();

  interface WarningRow {
    id: string;
    event: string;
    headline: string;
    description: string;
    severity: string;
    level: SeverityLevel;
    urgency: string;
    certainty: string;
    effective: string;
    expires: string;
    areas: string[];
    link?: string;
  }

  const SHORT_AREAS = 2;
  let filter = $state<SeverityLevel | 'all'>('all');
  let openId = $state<string>();
  let now = $state(Date.now());

  const severityLabels: Record<SeverityLevel, () => string> = {
    extreme: m.hazard_severity_extreme, severe: m.hazard_severity_severe, moderate: m.hazard_severity_moderate, minor: m.hazard_severity_minor
  };
  const severityIcons: Record<SeverityLevel, typeof Info> = { extreme: AlertOctagon, severe: ShieldAlert, moderate: AlertTriangle, minor: Info };
  const urgencyLabels: Record<string, () => string> = {
    immediate: m.hazard_urgency_immediate, expected: m.hazard_urgency_expected, future: m.hazard_urgency_future, past: m.hazard_urgency_past
  };

  function text(value: unknown): string {
    if (typeof value === 'string') return value;
    return '';
  }

  function toRow(record: DatasetRecord): WarningRow {
    const properties = record.properties;
    const severity = text(properties.severity);
    return {
      id: record.id,
      event: text(properties.event),
      headline: text(properties.headline),
      description: text(properties.description),
      severity,
      level: severityLevel(severity),
      urgency: text(properties.urgency),
      certainty: text(properties.certainty),
      effective: text(properties.effective),
      expires: text(properties.expires),
      areas: splitAreas(text(properties.areaDescriptions)),
      link: officialWarningUrl(properties.sourceLink, source)
    };
  }

  /** Most severe first; within a severity the warning that ends soonest comes first. */
  function byUrgency(a: WarningRow, b: WarningRow): number {
    const bySeverity = SEVERITY_LEVELS.indexOf(a.level) - SEVERITY_LEVELS.indexOf(b.level);
    if (bySeverity !== 0) return bySeverity;
    return Date.parse(a.expires) - Date.parse(b.expires);
  }

  const rows = $derived(records.map(toRow).sort(byUrgency));
  const counts = $derived.by(() => {
    const totals: Record<SeverityLevel, number> = { extreme: 0, severe: 0, moderate: 0, minor: 0 };
    for (const row of rows) totals[row.level]++;
    return totals;
  });
  const visible = $derived(rows.filter(row => filter === 'all' || row.level === filter));
  const opened = $derived(rows.find(row => row.id === openId));
  const relative = $derived(new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto' }));
  const clock = $derived(new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short' }));

  function endsIn(expires: string): string {
    const left = timeLeft(expires, now);
    if (!left) return '–';
    return relative.format(left.value, left.unit);
  }

  function labelFor(labels: Record<string, () => string>, value: string): string {
    const label = labels[value.toLowerCase()];
    if (label) return label();
    return value;
  }

  function when(value: string): string {
    if (!Number.isFinite(Date.parse(value))) return '–';
    return clock.format(new Date(value));
  }

  function tone(row: WarningRow): string {
    return `--tone: ${severityColor(row.level.charAt(0).toUpperCase() + row.level.slice(1))}`;
  }
</script>

<div class="severity-filter" role="group" aria-label={m.hazard_filter_severity()}>
  <button type="button" aria-pressed={filter === 'all'} onclick={() => { filter = 'all'; }}>{m.hazard_kind_all()} <b>{rows.length}</b></button>
  {#each SEVERITY_LEVELS as level (level)}
    {#if counts[level] > 0}
      <button type="button" aria-pressed={filter === level} style={`--tone: ${severityColor(level.charAt(0).toUpperCase() + level.slice(1))}`} onclick={() => { filter = level; }}>
        <span class="dot" aria-hidden="true"></span>{severityLabels[level]()} <b>{counts[level]}</b>
      </button>
    {/if}
  {/each}
</div>

<!-- svelte-ignore a11y_no_noninteractive_tabindex (a scrollable table must be focusable so keyboard users can scroll it) -->
<div class="warning-scroll scroll-area" tabindex="0" role="region" aria-label={m.warning_table_label()}>
  <table class="warning-table">
    <thead>
      <tr>
        <th scope="col">{m.warning_col_severity()}</th>
        <th scope="col">{m.warning_col_event()}</th>
        <th scope="col" class="areas-col">{m.hazard_areas()}</th>
        <th scope="col" class="ends-col">{m.warning_col_ends()}</th>
        <th scope="col"><span class="visually-hidden">{m.table_details()}</span></th>
      </tr>
    </thead>
    <tbody>
      {#each visible as row (row.id)}
        {@const SeverityIcon = severityIcons[row.level]}
        <tr style={tone(row)}>
          <td><span class={'severity-pill severity-' + row.level}><SeverityIcon size={14} aria-hidden="true" />{severityLabels[row.level]()}</span></td>
          <th scope="row">
            <button type="button" class="row-action" onclick={() => { openId = row.id; now = Date.now(); }} aria-label={m.table_details() + ': ' + (row.headline || row.event)}>
              <strong>{row.event || row.headline}</strong>
              {#if row.headline && row.event}<small>{row.headline}</small>{/if}
              <span class="ends-inline">{m.warning_col_ends()} {endsIn(row.expires)}</span>
            </button>
          </th>
          <td class="areas-col">
            <span class="area-chips">
              {#each row.areas.slice(0, SHORT_AREAS) as area (area)}<span>{area}</span>{/each}
              {#if row.areas.length > SHORT_AREAS}<span class="more">{m.hazard_more_areas({ count: row.areas.length - SHORT_AREAS })}</span>{/if}
            </span>
          </td>
          <td class="ends ends-col">{endsIn(row.expires)}</td>
          <td class="chevron"><ChevronRight size={18} aria-hidden="true" /></td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<MapDialog open={Boolean(opened)} title={opened?.headline || opened?.event || ''} onclose={() => { openId = undefined; }} wide>
  {#if opened}
    {@const OpenedIcon = severityIcons[opened.level]}
    <div class="detail" style={tone(opened)}>
      <div class="detail-pills">
        <span class={'severity-pill severity-' + opened.level}><OpenedIcon size={14} aria-hidden="true" />{severityLabels[opened.level]()}</span>
        {#if opened.urgency}<span class="pill"><small>{m.warning_urgency()}</small> {labelFor(urgencyLabels, opened.urgency)}</span>{/if}
        {#if opened.certainty}<span class="pill"><small>{m.warning_certainty()}</small> {opened.certainty}</span>{/if}
      </div>
      {#if opened.event}<p class="event-name">{opened.event}</p>{/if}
      <dl class="times">
        <div><dt>{m.warning_effective()}</dt><dd><time datetime={opened.effective}>{when(opened.effective)}</time></dd></div>
        <div><dt>{m.hazard_valid_until()}</dt><dd><time datetime={opened.expires}>{when(opened.expires)}</time> <small>({endsIn(opened.expires)})</small></dd></div>
      </dl>
      {#if opened.areas.length > 0}
        <h4>{m.hazard_areas()}</h4>
        <ul class="area-list">{#each opened.areas as area (area)}<li>{area}</li>{/each}</ul>
      {/if}
      {#if opened.description}
        <h4>{m.hazard_full_advisory()}</h4>
        <p class="advisory">{opened.description}</p>
      {/if}
      {#if opened.link}<a class="source-link" href={opened.link} target="_blank" rel="noopener noreferrer">{m.warning_source_link()} · {source} <ExternalLink size={14} aria-hidden="true" /></a>{/if}
    </div>
  {/if}
</MapDialog>

<style>
  .severity-filter { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 12px; }
  .severity-filter button { display: inline-flex; align-items: center; gap: 7px; min-height: 40px; padding: 0 14px; border: 0; border-radius: 14px; color: var(--text); font: inherit; font-size: .78rem; font-weight: 850; cursor: pointer; background: var(--panel); box-shadow: var(--clay-shadow); }
  .severity-filter button b { font-variant-numeric: tabular-nums; opacity: .75; }
  .severity-filter button[aria-pressed='true'] { color: var(--on-accent); background: var(--accent); }
  .severity-filter button:focus-visible { outline: 3px solid var(--accent-strong); outline-offset: 2px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--tone); box-shadow: 0 0 0 2px var(--surface); }

  .warning-scroll { max-width: 100%; min-width: 0; max-height: min(460px, 60vh); overflow: auto; padding: 0 8px 8px; border-radius: 22px; background: var(--panel); box-shadow: var(--clay-pressed); }
  .warning-table { width: 100%; min-width: 620px; border-collapse: separate; border-spacing: 0 8px; font-size: .82rem; }
  .warning-table thead th { position: sticky; top: 0; z-index: 1; padding: 10px 12px 6px; background: var(--panel); color: var(--muted); text-align: left; font-size: .68rem; letter-spacing: .07em; text-transform: uppercase; white-space: nowrap; }
  .warning-table tbody td, .warning-table tbody th { padding: 12px; text-align: left; font-weight: 500; vertical-align: middle; background: linear-gradient(165deg, var(--surface), color-mix(in srgb, var(--surface) 84%, var(--panel))); border-block: 1px solid var(--border); }
  .warning-table tbody tr > :first-child { border-radius: 16px 0 0 16px; border-inline-start: 6px solid var(--tone); }
  .warning-table tbody tr > :last-child { border-radius: 0 16px 16px 0; }
  .warning-table tbody tr { filter: drop-shadow(0 3px 0 var(--border)); transition: transform .15s ease; }
  .warning-table tbody tr:hover { transform: translateY(-1px); }
  .severity-pill { display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px; border-radius: 999px; color: #1c1b18; font-size: .7rem; font-weight: 900; letter-spacing: .03em; white-space: nowrap; background: var(--tone); box-shadow: inset 0 1px 1px #ffffff55, inset 0 -2px 3px #0003; }
  .severity-pill.severity-extreme, .severity-pill.severity-severe { color: #fff; }
  .row-action { display: grid; gap: 2px; width: 100%; min-height: 40px; padding: 0; border: 0; background: transparent; color: var(--text); text-align: left; font: inherit; cursor: pointer; }
  .row-action strong { font-weight: 850; }
  .row-action small { color: var(--muted); font-weight: 600; font-size: .74rem; overflow-wrap: anywhere; }
  .row-action:hover strong { color: var(--accent); }
  .row-action:focus-visible { outline: 3px solid var(--accent-strong); outline-offset: 3px; border-radius: 6px; }
  .area-chips { display: flex; flex-wrap: wrap; gap: 5px; }
  .area-chips span { padding: 3px 9px; border-radius: 999px; font-size: .72rem; font-weight: 700; background: var(--panel); box-shadow: var(--clay-pressed); overflow-wrap: anywhere; }
  .area-chips .more { color: var(--accent-strong); }
  .ends-inline { display: none; margin-top: 2px; color: var(--accent-strong); font-size: .72rem; font-weight: 850; }
  .ends { white-space: nowrap; color: var(--muted); font-weight: 800 !important; font-variant-numeric: tabular-nums; }
  .chevron { width: 38px; color: var(--accent); text-align: center !important; }

  .detail { display: grid; gap: 12px; }
  .detail-pills { display: flex; flex-wrap: wrap; gap: 8px; }
  .pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px; font-size: .74rem; font-weight: 850; background: var(--panel); box-shadow: var(--clay-pressed); }
  .pill small { color: var(--muted); font-weight: 700; }
  .event-name { margin: 0; color: var(--muted); font-weight: 800; }
  .times { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 0; }
  .times div { padding: 12px 14px; border-radius: 16px; background: var(--panel); box-shadow: var(--clay-pressed); min-width: 0; }
  .times dt { font-size: .7rem; font-weight: 800; color: var(--muted); }
  .times dd { margin: 4px 0 0; font-weight: 850; font-variant-numeric: tabular-nums; }
  .times small { color: var(--muted); font-weight: 700; }
  h4 { margin: 4px 0 0; font-size: .9rem; }
  .area-list { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
  .area-list li { padding: 4px 11px; border-radius: 999px; font-size: .76rem; font-weight: 750; background: var(--surface); box-shadow: var(--clay-shadow); }
  .advisory { margin: 0; padding: 14px 16px; border-radius: 18px; background: var(--panel); box-shadow: var(--clay-pressed); line-height: 1.65; font-size: .86rem; overflow-wrap: anywhere; white-space: pre-line; }
  .source-link { display: inline-flex; align-items: center; gap: 6px; justify-self: start; min-height: 44px; padding: 0 16px; border-radius: 14px; background: var(--surface); box-shadow: var(--clay-shadow); font-weight: 850; font-size: .82rem; text-decoration: none; color: var(--accent-strong); }
  .source-link:focus-visible { outline: 3px solid var(--accent-strong); outline-offset: 2px; }

  @media (max-width: 700px) {
    .areas-col, .ends-col { display: none; }
    .ends-inline { display: block; }
    .warning-table { min-width: 0; }
    .times { grid-template-columns: minmax(0, 1fr); }
  }
  @media (prefers-reduced-motion: reduce) { .warning-table tbody tr { transition: none; } }
  @media (forced-colors: active) { .severity-pill, .area-chips span, .pill { border: 1px solid CanvasText; } }
</style>
