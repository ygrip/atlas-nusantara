<script lang="ts">
  import { onMount } from 'svelte';
  import { Cloud, CloudRain, Droplets, Thermometer, Wind } from 'lucide-svelte';
  import { m } from '$lib/i18n/messages';
  import { weatherConditionKey } from '$lib/i18n/weather-condition';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import { loadCurrentForecast, loadWeatherHistory, MAX_NEIGHBOUR_KM, regionHistory, type DailyValues, type WeatherHistory } from '$lib/data/weather-history';
  import { METRIC_DEFINITIONS } from '$lib/data/weather-history-chart';
  import { forecastTimes, nearestTimeIndex, type ForecastSnapshot } from '$lib/map/weather';
  import { summariseWeather } from '$lib/map/weather-summary';
  import { loadProvinceDirectory } from '$lib/directory/province-directory';
  import TabList from './TabList.svelte';
  import SnapshotPanel from './SnapshotPanel.svelte';
  import WeatherHistoryChart from './WeatherHistoryChart.svelte';

  /** regionCode is the selected province or city; without it the panel describes Indonesia as a whole. */
  let { regionCode, regionName }: { regionCode?: string; regionName?: string } = $props();

  let tab = $state('current');
  let history = $state<WeatherHistory>();
  let forecast = $state<ForecastSnapshot>();
  let historyFailed = $state(false);
  let loadingHistory = $state(true);
  let metricId = $state('tmean');
  let names = $state(new Map<string, string>());

  const tabs = $derived([
    { id: 'current', label: m.weather_tab_current() },
    { id: 'history', label: m.weather_tab_history() }
  ]);
  const scopeName = $derived(regionName ?? m.level_national());
  const metric = $derived(METRIC_DEFINITIONS.find(item => item.id === metricId) ?? METRIC_DEFINITIONS[0]);
  const metricIcons = { tmean: Thermometer, rain: CloudRain, hu: Droplets, tcc: Cloud, ws: Wind };
  const metricLabels = $derived({ tmean: m.weather_temperature(), rain: m.weather_rain(), hu: m.weather_humidity(), tcc: m.weather_clouds(), ws: m.weather_wind() });

  const selected = $derived(history ? regionHistory(history, regionCode) : undefined);
  const national = $derived(history ? regionHistory(history, undefined) : undefined);
  const reference = $derived.by(() => {
    if (!selected || selected.scope === 'national') return undefined;
    return national?.series;
  });
  const roundedDistance = $derived(selected?.neighbour ? Math.max(1, Math.round(selected.neighbour.distanceKm)) : 0);
  const neighbourName = $derived(selected?.neighbour ? names.get(selected.neighbour.code) ?? selected.neighbour.code : '');
  const emptyNote = $derived(m.weather_history_empty({ name: scopeName, distance: MAX_NEIGHBOUR_KM }));

  const forecastTime = $derived.by(() => {
    if (!forecast) return undefined;
    const times = forecastTimes(forecast);
    if (times.length === 0) return undefined;
    return times[nearestTimeIndex(times, Date.now())];
  });
  const current = $derived.by(() => {
    if (!forecast || !regionCode) return undefined;
    return summariseWeather(forecast, regionCode, forecastTime);
  });
  const currentNeighbourName = $derived(current?.neighbour ? names.get(current.neighbour.code) ?? current.neighbour.code : '');

  /** The 150 kB history file is downloaded the first time its tab is opened, not with the page. */
  let historyRequested = false;
  $effect(() => {
    if (tab !== 'history' || historyRequested) return;
    historyRequested = true;
    loadWeatherHistory()
      .then(value => {
        if (value) history = value; else historyFailed = true;
      })
      .catch(error => { historyFailed = true; console.warn('Weather history unavailable', error); })
      .finally(() => { loadingHistory = false; });
  });

  onMount(() => {
    let active = true;
    loadCurrentForecast()
      .then(value => { if (active && value) forecast = value; })
      .catch(error => console.warn('Current forecast unavailable', error));
    loadProvinceDirectory()
      .then(rows => {
        if (!active) return;
        const next = new Map<string, string>();
        for (const row of rows) {
          next.set(row.code, row.name);
          for (const city of [...row.regencies, ...row.municipalities]) next.set(city.code, city.name);
        }
        names = next;
      })
      .catch(error => console.warn('Region names unavailable', error));
    return () => { active = false; };
  });

  function number(value: number | null, digits: number): string {
    if (value === null) return '–';
    return new Intl.NumberFormat(getLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  }
  function dayText(day: string): string {
    return new Intl.DateTimeFormat(getLocale(), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(day + 'T12:00:00Z'));
  }
  function date(value: string): string {
    return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium' }).format(new Date(value));
  }
  function column(values: DailyValues | undefined, index: number): number | null {
    return values?.[index] ?? null;
  }
</script>

<section class="weather-panel" aria-label={m.layer_forecast()}>
  <TabList prefix="weather" {tabs} bind:value={tab} label={m.weather_tabs_label()} />

  <div role="tabpanel" id="weather-panel-current" aria-labelledby="weather-tab-current" hidden={tab !== 'current'}>
    <h3>{m.weather_current_heading({ name: scopeName })}</h3>
    {#if !regionCode}
      <p class="hint">{m.weather_current_hint()}</p>
    {:else if current}
      <dl class="summary">
        <div><dt>{m.weather_temperature()}</dt><dd>{current.temperature}°C</dd><small>{m[weatherConditionKey(current.description)]()}</small></div>
        <div><dt>{m.weather_wind()}</dt><dd>{current.speed} km/h</dd><small>{current.from}</small></div>
        <div><dt>{m.weather_humidity()}</dt><dd>{current.humidity}%</dd></div>
        <div><dt>{m.weather_clouds()}</dt><dd>{current.clouds}%</dd></div>
      </dl>
      {#if current.neighbour}
        <p class="notice" role="note">{m.weather_neighbour_note({ name: scopeName, nearest: currentNeighbourName, distance: Math.max(1, Math.round(current.neighbour.distanceKm)) })}</p>
      {/if}
    {:else if forecast}
      <p class="hint" role="status">{m.data_unavailable()}</p>
    {/if}
    <SnapshotPanel kind="warning" {regionCode} />
  </div>

  <div role="tabpanel" id="weather-panel-history" aria-labelledby="weather-tab-history" hidden={tab !== 'history'} aria-busy={loadingHistory}>
    <h3>{m.weather_history_heading({ name: scopeName })}</h3>
    <p class="hint">{m.weather_history_desc()}</p>
    {#if loadingHistory}
      <p role="status">{m.loading_data()}</p>
    {:else if historyFailed || !history}
      <p role="alert">{m.data_unavailable()}</p>
    {:else}
      <!-- A row that scrolls sideways on narrow screens; it must be focusable so keyboard users can reach every measure. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="measure-scroll scroll-area" tabindex="0">
        <div class="measure-picker" role="group" aria-label={m.weather_history_measure()}>
          {#each METRIC_DEFINITIONS as item (item.id)}
            {@const MeasureIcon = metricIcons[item.id]}
            <button type="button" aria-pressed={item.id === metricId} onclick={() => { metricId = item.id; }}>
              <MeasureIcon size={22} aria-hidden="true" /><span>{metricLabels[item.id]}</span><small>{item.unit}</small>
            </button>
          {/each}
        </div>
      </div>

      {#if selected?.neighbour}
        <p class="notice" role="note">{m.weather_neighbour_note({ name: scopeName, nearest: neighbourName, distance: roundedDistance })}</p>
      {:else if selected && selected.scope !== 'city'}
        <p class="notice" role="note">{m.weather_history_scope({ count: selected.cities })}</p>
      {:else if !selected}
        <p class="notice" role="status">{emptyNote}</p>
      {/if}

      <WeatherHistoryChart days={history.days} {metric} label={m.weather_history_heading({ name: scopeName }) + ' · ' + metricLabels[metric.id]} series={selected?.series} {reference} emptyMessage={m.weather_history_no_data()} />

      {#if selected}
        <ul class="legend" aria-hidden="true">
          <li><span class="swatch line"></span>{scopeName}</li>
          {#if reference}<li><span class="swatch dashed"></span>{m.level_national()}</li>{/if}
          {#if metric.id === 'tmean'}<li><span class="swatch band"></span>{m.weather_history_range()}</li>{/if}
        </ul>

        <div class="table-scroll">
          <table class="history-table">
            <caption class="visually-hidden">{m.weather_history_caption({ name: scopeName })}</caption>
            <thead>
              <tr>
                <th scope="col">{m.weather_history_day()}</th>
                <th scope="col">{m.weather_temperature()} °C</th>
                <th scope="col">{m.weather_rain()} mm</th>
                <th scope="col">{m.weather_humidity()} %</th>
                <th scope="col">{m.weather_clouds()} %</th>
                <th scope="col">{m.weather_wind()} km/h</th>
              </tr>
            </thead>
            <tbody>
              {#each history.days as day, index (day)}
                <tr>
                  <th scope="row">{dayText(day)}</th>
                  <td>{number(column(selected.series.tmean, index), 1)} <small>({number(column(selected.series.tmin, index), 1)}–{number(column(selected.series.tmax, index), 1)})</small></td>
                  <td>{number(column(selected.series.rain, index), 1)}</td>
                  <td>{number(column(selected.series.hu, index), 0)}</td>
                  <td>{number(column(selected.series.tcc, index), 0)}</td>
                  <td>{number(column(selected.series.ws, index), 1)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

      <p class="source-note">{m.weather_history_source()} <a href={history.sourceUrl} target="_blank" rel="noreferrer">{history.source} ↗</a> · {m.weather_fetched()} {date(history.fetchedAt)}</p>
    {/if}
  </div>
</section>

<style>
  .weather-panel { margin-top: 20px; padding: 20px; border-radius: 22px; background: var(--surface); box-shadow: var(--clay-pressed); display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; min-width: 0; }
  [role='tabpanel'] { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; min-width: 0; }
  [role='tabpanel'][hidden] { display: none; }
  h3 { margin: 0; }
  p { margin: 0; font-size: .85rem; color: var(--muted); }
  .notice { padding: 10px 14px; border-radius: 14px; background: var(--sky); color: var(--text); font-size: .8rem; font-weight: 700; line-height: 1.5; }

  .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 0; }
  .summary div { padding: 12px 14px; border-radius: 16px; background: var(--panel); min-width: 0; }
  .summary dt { font-size: .72rem; font-weight: 800; color: var(--muted); }
  .summary dd { margin: 4px 0 0; font-size: 1.2rem; font-weight: 900; font-variant-numeric: tabular-nums; }
  .summary small { color: var(--muted); font-weight: 700; overflow-wrap: anywhere; }

  .measure-scroll { overflow-x: auto; overflow-y: hidden; padding: 4px 4px 12px; margin-inline: -4px; scroll-snap-type: x proximity; scrollbar-width: thin; }
  .measure-picker { display: flex; gap: 10px; width: max-content; min-width: 100%; }
  .measure-picker button { display: grid; justify-items: center; gap: 3px; flex: 1 0 104px; min-height: 84px; padding: 10px 14px; border: 0; border-radius: 20px; background: linear-gradient(165deg, var(--surface), var(--panel)); color: var(--text); font: inherit; font-weight: 850; cursor: pointer; scroll-snap-align: start; box-shadow: var(--clay-shadow); transition: transform .15s ease, box-shadow .15s ease; }
  .measure-picker button span { font-size: .8rem; white-space: nowrap; }
  .measure-picker button small { color: var(--muted); font-size: .68rem; font-weight: 700; }
  .measure-picker button:hover { transform: translateY(-2px); }
  .measure-picker button[aria-pressed='true'] { background: var(--accent); color: var(--on-accent); box-shadow: var(--clay-pressed); }
  .measure-picker button[aria-pressed='true'] small { color: inherit; opacity: .85; }
  .measure-picker button:focus-visible { outline: 3px solid var(--accent-strong); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { .measure-picker button { transition: none; } }

  .legend { display: flex; flex-wrap: wrap; gap: 16px; margin: 0; padding: 0; list-style: none; font-size: .75rem; font-weight: 800; }
  .legend li { display: inline-flex; align-items: center; gap: 7px; }
  .swatch { width: 22px; height: 0; border-top: 3px solid var(--chart-red); border-radius: 2px; }
  .swatch.dashed { border-top: 3px dashed var(--muted); }
  .swatch.band { height: 12px; border: 0; border-radius: 4px; background: var(--chart-red); opacity: .25; }

  .table-scroll { overflow-x: auto; }
  .history-table { width: 100%; border-collapse: collapse; font-size: .78rem; font-variant-numeric: tabular-nums; }
  .history-table th, .history-table td { padding: 6px 8px; text-align: right; border-bottom: 1px solid var(--border); white-space: nowrap; }
  .history-table thead th { font-size: .7rem; color: var(--muted); }
  .history-table thead th:first-child, .history-table tbody th { text-align: left; }
  .history-table small { color: var(--muted); }

  .source-note { font-size: .72rem; }
  .source-note a { text-decoration: underline; }

  @media (max-width: 760px) { .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
