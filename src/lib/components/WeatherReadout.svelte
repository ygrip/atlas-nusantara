<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { forecastStepAt, type ForecastSnapshot, type ForecastStep } from '$lib/map/weather';

  let { forecast, code, time, name }: { forecast: ForecastSnapshot; code: string; time?: string; name: string } = $props();

  const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  /** Steps at the chosen time for the city itself, or for every city of a province. */
  const steps = $derived.by(() => {
    const matches: ForecastStep[] = [];
    for (const point of forecast.points) {
      if (point.code !== code && !point.code.startsWith(code + '.')) continue;
      if (!time) continue;
      const step = forecastStepAt(point, time);
      if (step) matches.push(step);
    }
    return matches;
  });

  const summary = $derived.by(() => {
    if (steps.length === 0) return undefined;
    const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    // Vector-average the wind so opposite directions cancel instead of averaging angles.
    const east = average(steps.map(step => -Math.sin((step.wd * Math.PI) / 180) * step.ws));
    const north = average(steps.map(step => -Math.cos((step.wd * Math.PI) / 180) * step.ws));
    const towards = (Math.atan2(east, north) * 180) / Math.PI;
    const from = (towards + 180 + 360) % 360;
    const descriptions = new Map<string, number>();
    for (const step of steps) descriptions.set(step.desc, (descriptions.get(step.desc) ?? 0) + 1);
    const dominant = [...descriptions.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return {
      temperature: Math.round(average(steps.map(step => step.t))),
      humidity: Math.round(average(steps.map(step => step.hu))),
      clouds: Math.round(average(steps.map(step => step.tcc))),
      speed: Math.round(Math.hypot(east, north)),
      from: COMPASS[Math.round(from / 45) % 8],
      arrow: towards,
      description: dominant,
      points: steps.length
    };
  });
</script>

{#if summary}
  <aside class="weather-readout" aria-live="polite">
    <p class="readout-name">{name}</p>
    <p class="readout-desc">{summary.description}</p>
    <dl>
      <div><dt>{m.weather_temperature()}</dt><dd>{summary.temperature}°C</dd></div>
      <div><dt>{m.weather_wind()}</dt><dd><span class="arrow" style={`transform: rotate(${summary.arrow}deg)`} aria-hidden="true">↑</span> {summary.speed} km/h {summary.from}</dd></div>
      <div><dt>{m.weather_humidity()}</dt><dd>{summary.humidity}%</dd></div>
      <div><dt>{m.weather_clouds()}</dt><dd>{summary.clouds}%</dd></div>
    </dl>
  </aside>
{/if}

<style>
  .weather-readout { position: absolute; right: 14px; top: 14px; z-index: 2; width: min(230px, calc(100% - 28px)); padding: 12px 14px; border-radius: 18px; background: color-mix(in srgb, var(--surface, #fffaf2) 88%, transparent); backdrop-filter: blur(8px); box-shadow: 0 12px 28px -16px #00000066, inset 0 1px 0 #ffffff99; font-size: .78rem; }
  .readout-name { margin: 0; font-weight: 900; font-size: .9rem; line-height: 1.25; }
  .readout-desc { margin: 2px 0 8px; opacity: .8; }
  dl { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; margin: 0; }
  dt { font-size: .6rem; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; opacity: .65; }
  dd { margin: 0; font-weight: 800; white-space: nowrap; }
  .arrow { display: inline-block; }
  @media (max-width: 700px) { .weather-readout { top: 8px; right: 8px; width: 180px; padding: 8px 10px; } }
</style>
