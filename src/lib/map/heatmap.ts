/** A choropleth: one colour per province code, plus the legend that explains the colours. */
export interface HeatLegendStep { color: string; label: string }

export interface RegionHeatmap {
  title: string;
  /** Province code to fill colour (#rrggbb). Provinces without comparable data are absent. */
  colors: Record<string, string>;
  /** Province code to a short formatted value for tooltips. */
  valueText: Record<string, string>;
  legend: HeatLegendStep[];
}

/** Light (few people) to dark (many people). */
export const HEAT_COLORS = ['#fdf0c9', '#f6c874', '#ee9a4d', '#d3563a', '#8f1d2c'];

/**
 * Sorts values into equal-width classes on a log scale. Population is heavily skewed
 * (Java holds over half of the country), so a linear scale would paint 30 provinces the same pale colour.
 */
export function logClassBounds(values: number[], classCount: number): number[] {
  const positive = values.filter(value => value > 0);
  if (positive.length === 0) return [];
  const low = Math.log(Math.min(...positive));
  const high = Math.log(Math.max(...positive));
  const bounds: number[] = [];
  for (let index = 0; index <= classCount; index++) {
    bounds.push(Math.exp(low + ((high - low) * index) / classCount));
  }
  return bounds;
}

export function classIndex(value: number, bounds: number[]): number {
  const classCount = bounds.length - 1;
  for (let index = 1; index < classCount; index++) {
    if (value < bounds[index]) return index - 1;
  }
  return classCount - 1;
}
