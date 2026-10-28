import { m } from '$lib/i18n/messages';
import type { CuisineGroup } from './cuisine-contract';

/** Pin and card colour per dish group, so the share card and the group chips agree. */
const GROUP_COLORS: Record<CuisineGroup, string> = {
  rice: '#d9a441', noodles: '#e0884a', soups: '#c4623f', 'meat-fish': '#a9473a', vegetables: '#5e9a4c',
  snacks: '#c97a9b', drinks: '#4f9ac4', condiments: '#b8452f', other: '#8f8070'
};

export function cuisineGroupColor(group: CuisineGroup): string {
  return GROUP_COLORS[group];
}

export function cuisineGroupLabel(group: CuisineGroup): string {
  const labels: Record<CuisineGroup, () => string> = {
    rice: m.cuisine_group_rice, noodles: m.cuisine_group_noodles, soups: m.cuisine_group_soups, 'meat-fish': m.cuisine_group_meat_fish,
    vegetables: m.cuisine_group_vegetables, snacks: m.cuisine_group_snacks, drinks: m.cuisine_group_drinks,
    condiments: m.cuisine_group_condiments, other: m.cuisine_group_other
  };
  return labels[group]();
}
