import { m } from './messages';
import type { IslandGroup } from '$lib/atlas/islands';

/** Translated display names for geographic island groups; canonical region IDs stay unchanged. */
const names: Record<IslandGroup, () => string> = {
  sumatra: m.island_group_sumatra,
  java: m.island_group_java,
  'nusa-tenggara': m.island_group_nusa_tenggara,
  kalimantan: m.island_group_kalimantan,
  sulawesi: m.island_group_sulawesi,
  maluku: m.island_group_maluku,
  papua: m.island_group_papua
};

export function islandGroupLabel(group: IslandGroup): string {
  return names[group]();
}
