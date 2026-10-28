/**
 * Layers that list records per province: the map shows one summary marker per province, selecting a province loads that
 * province's static shard, and the city directory is not used. Destinations, flora and fauna work this way.
 */
const PROVINCE_CATALOG_LAYERS = ['destinations', 'flora', 'fauna'];

export function isProvinceCatalogLayer(layer: string): boolean {
  return PROVINCE_CATALOG_LAYERS.includes(layer);
}
