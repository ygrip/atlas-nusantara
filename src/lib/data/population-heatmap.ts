import { m } from '$lib/i18n/messages';
import { getLocale } from '$lib/paraglide/runtime.js';
import { classIndex, HEAT_COLORS, logClassBounds, type RegionHeatmap } from '$lib/map/heatmap';
import { provinceYear, type PopulationData } from './population-contract';

/** Millions above one million persons, otherwise thousands; the source unit is thousand persons. */
function compactPopulation(thousands: number): string {
  const locale = getLocale();
  if (thousands >= 1000) {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(thousands / 1000) + ' ' + m.population_million_short();
  }
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(thousands) + ' ' + m.population_thousand_short();
}

/** Colours every province with comparable data in this year; others stay on the neutral base colour. */
export function populationHeatmap(data: PopulationData, year: number): RegionHeatmap {
  const entries = data.provinces.flatMap(province => {
    const entry = provinceYear(data, province.code, year);
    if (!entry) return [];
    return [{ code: province.code, population: entry.population }];
  });
  const bounds = logClassBounds(entries.map(item => item.population), HEAT_COLORS.length);
  const colors: Record<string, string> = {};
  const valueText: Record<string, string> = {};
  for (const item of entries) {
    colors[item.code] = HEAT_COLORS[classIndex(item.population, bounds)];
    valueText[item.code] = compactPopulation(item.population);
  }
  const legend = HEAT_COLORS.map((color, index) => {
    if (bounds.length === 0) return { color, label: '' };
    return { color, label: compactPopulation(bounds[index]) + ' – ' + compactPopulation(bounds[index + 1]) };
  });
  return { title: m.layer_population() + ' · ' + year, colors, valueText, legend };
}
