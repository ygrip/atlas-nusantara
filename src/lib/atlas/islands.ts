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
export const ISLAND_GROUP_COLORS: Record<IslandGroup, { light: [string, string]; dark: [string, string] }> = {
  sumatra: { light: ['#f3c3a0', '#d99a72'], dark: ['#c98f6b', '#8d5f45'] },
  java: { light: ['#d4c6ef', '#a998cf'], dark: ['#a594cc', '#6e5f94'] },
  'nusa-tenggara': { light: ['#f4dc9a', '#d4b664'], dark: ['#c9ad62', '#8a743b'] },
  kalimantan: { light: ['#b9dcc4', '#84b494'], dark: ['#7fae8f', '#4d7a5c'] },
  sulawesi: { light: ['#b6d3ea', '#80a8c8'], dark: ['#7ea3c2', '#4d7091'] },
  maluku: { light: ['#f1b7b1', '#d0857e'], dark: ['#c4827c', '#87524d'] },
  papua: { light: ['#cfe0a6', '#a2b872'], dark: ['#9cb36d', '#677a40'] }
};

const GROUP_BY_PREFIX: Record<string, IslandGroup> = {
  '1': 'sumatra', '2': 'sumatra', '3': 'java', '5': 'nusa-tenggara', '6': 'kalimantan', '7': 'sulawesi', '9': 'papua'
};

export function islandGroupOf(code: string): IslandGroup {
  const province = code.slice(0, 2);
  if (province.startsWith('8')) return 'maluku';
  return GROUP_BY_PREFIX[province[0]] ?? 'sumatra';
}
