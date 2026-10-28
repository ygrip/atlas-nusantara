import { m } from '$lib/i18n/messages';
import { getLocale } from '$lib/paraglide/runtime.js';
import type { RegionHeatmap } from '$lib/map/heatmap';
import { LANGUAGE_CLASS_MAXIMUMS, languageClassIndex, type LanguageData } from './languages-contract';

/** Pale (few languages) to dark (many), the same ramp as the population map. */
const LANGUAGE_COLORS = ['#fdf0c9', '#f6c874', '#ee9a4d', '#d3563a', '#8f1d2c'];

function classLabel(index: number): string {
  const format = new Intl.NumberFormat(getLocale());
  const upper = LANGUAGE_CLASS_MAXIMUMS[index];
  if (index === LANGUAGE_CLASS_MAXIMUMS.length) return format.format(LANGUAGE_CLASS_MAXIMUMS[index - 1] + 1) + '+';
  if (index === 0) return '1 – ' + format.format(upper);
  return format.format(LANGUAGE_CLASS_MAXIMUMS[index - 1] + 1) + ' – ' + format.format(upper);
}

/** One colour per province from its number of local languages. */
export function languageHeatmap(data: LanguageData): RegionHeatmap {
  const colors: Record<string, string> = {};
  const valueText: Record<string, string> = {};
  for (const province of data.provinces) {
    colors[province.code] = LANGUAGE_COLORS[languageClassIndex(province.count)];
    valueText[province.code] = m.language_count({ count: province.count });
  }
  const legend = LANGUAGE_COLORS.map((color, index) => ({ color, label: classLabel(index) }));
  return { title: m.layer_languages(), colors, valueText, legend, note: m.language_heatmap_note() };
}
