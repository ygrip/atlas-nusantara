import { ISLAND_GROUP_COLORS, type IslandGroup } from '$lib/atlas/islands';

/**
 * Inline custom properties for one island group. Stylesheets choose the light or dark pair:
 * `background: var(--group-top-light)` and, under [data-theme='dark'], `var(--group-top-dark)`.
 */
export function groupStyle(group: IslandGroup): string {
  const colors = ISLAND_GROUP_COLORS[group];
  return [
    '--group-top-light: ' + colors.light[0],
    '--group-side-light: ' + colors.light[1],
    '--group-top-dark: ' + colors.dark[0],
    '--group-side-dark: ' + colors.dark[1]
  ].join('; ');
}
