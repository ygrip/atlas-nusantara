import type { DailyValues, HistoryMetric } from './weather-history-contract.ts';

export interface MetricDefinition {
  id: HistoryMetric;
  unit: string;
  /** Rain, humidity, cloud and wind start at zero; temperature fits its own range so day-to-day change stays visible. */
  startsAtZero: boolean;
  digits: number;
  /** Fixed top of the axis, for percentages. */
  fixedMax?: number;
}

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  { id: 'tmean', unit: '°C', startsAtZero: false, digits: 1 },
  { id: 'rain', unit: 'mm', startsAtZero: true, digits: 1 },
  { id: 'hu', unit: '%', startsAtZero: true, digits: 0, fixedMax: 100 },
  { id: 'tcc', unit: '%', startsAtZero: true, digits: 0, fixedMax: 100 },
  { id: 'ws', unit: 'km/h', startsAtZero: true, digits: 1 }
];

export interface ValueScale { min: number; max: number; ticks: number[] }

const STEPS = [1, 2, 2.5, 5, 10];

function niceStep(span: number, wantedTicks: number): number {
  const raw = span / wantedTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const factor = STEPS.find(candidate => candidate * magnitude >= raw) ?? 10;
  return factor * magnitude;
}

function present(values: DailyValues[]): number[] {
  return values.flat().filter((value): value is number => value !== null);
}

function tickList(min: number, max: number, step: number): number[] {
  const ticks: number[] = [];
  for (let value = min; value <= max + step / 2; value += step) ticks.push(Math.round(value * 1e6) / 1e6);
  return ticks;
}

/** Axis for the given series. With no values it still returns a sensible empty axis for the metric. */
export function valueScale(series: DailyValues[], metric: MetricDefinition, wantedTicks = 4): ValueScale {
  const values = present(series);
  if (metric.fixedMax !== undefined) return { min: 0, max: metric.fixedMax, ticks: tickList(0, metric.fixedMax, metric.fixedMax / wantedTicks) };
  if (values.length === 0) return emptyScale(metric);
  const largest = Math.max(...values);
  if (metric.startsAtZero) {
    const step = niceStep(Math.max(largest, 1), wantedTicks);
    const max = Math.ceil(largest / step) * step || step;
    return { min: 0, max, ticks: tickList(0, max, step) };
  }
  const smallest = Math.min(...values);
  const span = Math.max(largest - smallest, 2);
  const step = niceStep(span * 1.2, wantedTicks);
  const min = Math.floor((smallest - span * 0.1) / step) * step;
  const max = Math.ceil((largest + span * 0.1) / step) * step;
  return { min, max, ticks: tickList(min, max, step) };
}

function emptyScale(metric: MetricDefinition): ValueScale {
  if (metric.id === 'tmean') return { min: 20, max: 35, ticks: [20, 25, 30, 35] };
  if (metric.id === 'rain') return { min: 0, max: 20, ticks: [0, 5, 10, 15, 20] };
  return { min: 0, max: 40, ticks: [0, 10, 20, 30, 40] };
}

/** SVG path through the values; a missing day breaks the line instead of drawing across the gap. */
export function linePath(values: DailyValues, x: (index: number) => number, y: (value: number) => number): string {
  let path = '';
  let drawing = false;
  values.forEach((value, index) => {
    if (value === null) { drawing = false; return; }
    path += (drawing ? 'L' : 'M') + x(index).toFixed(1) + ' ' + y(value).toFixed(1);
    drawing = true;
  });
  return path;
}

/** Closed shape between a lower and upper series, for the daily low-to-high band. Days missing either side are skipped. */
export function bandPath(lower: DailyValues, upper: DailyValues, x: (index: number) => number, y: (value: number) => number): string {
  const indexes = lower.map((_, index) => index).filter(index => lower[index] !== null && upper[index] !== null);
  if (indexes.length < 2) return '';
  const top = indexes.map((index, step) => (step === 0 ? 'M' : 'L') + x(index).toFixed(1) + ' ' + y(upper[index] as number).toFixed(1));
  const bottom = [...indexes].reverse().map(index => 'L' + x(index).toFixed(1) + ' ' + y(lower[index] as number).toFixed(1));
  return top.join(' ') + ' ' + bottom.join(' ') + ' Z';
}
