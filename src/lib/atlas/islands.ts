/** Island groups by the first digit pair of the Kemendagri province code. Used for colour, legend and table filters. */
export type IslandGroup = 'sumatra' | 'java' | 'nusa-tenggara' | 'kalimantan' | 'sulawesi' | 'maluku' | 'papua';

export const ISLAND_GROUP_NAMES: Record<IslandGroup, string> = {
  sumatra: 'Sumatra',
  java: 'Jawa',
  'nusa-tenggara': 'Bali & Nusa Tenggara',
  kalimantan: 'Kalimantan',
  sulawesi: 'Sulawesi',
  maluku: 'Maluku',
  papua: 'Papua'
};

export const ISLAND_GROUPS = Object.keys(ISLAND_GROUP_NAMES) as IslandGroup[];

/** Light and dark clay tones per group: [top, side]. */
/** Seven distinct island families within red, green, and brass-gold; preserve text labels. */
export const ISLAND_GROUP_COLORS: Record<IslandGroup, { light: [string, string]; dark: [string, string] }> = {
  sumatra: { light: ['#f2bfc2', '#d9959d'], dark: ['#cf919b', '#8e5965'] },
  java: { light: ['#d88794', '#b55768'], dark: ['#c96d7b', '#813c4a'] },
  'nusa-tenggara': { light: ['#efd9ae', '#c9ae75'], dark: ['#d9bc7d', '#95763f'] },
  kalimantan: { light: ['#b5d7be', '#84b094'], dark: ['#8ebb9c', '#527960'] },
  sulawesi: { light: ['#d3e0bb', '#abc48e'], dark: ['#acbf8f', '#718456'] },
  maluku: { light: ['#f2d6d5', '#d6a9ad'], dark: ['#d4a2a6', '#94666d'] },
  papua: { light: ['#d8c49c', '#b69d70'], dark: ['#baa06c', '#826a43'] }
};

const GROUP_BY_PREFIX: Record<string, IslandGroup> = {
  '1': 'sumatra', '2': 'sumatra', '3': 'java', '5': 'nusa-tenggara', '6': 'kalimantan', '7': 'sulawesi', '9': 'papua'
};

export function islandGroupOf(code: string): IslandGroup {
  const province = code.slice(0, 2);
  if (province.startsWith('8')) return 'maluku';
  return GROUP_BY_PREFIX[province[0]] ?? 'sumatra';
}
