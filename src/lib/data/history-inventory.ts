/** Source occurrences stay separate from the curated, dated history catalogue. */
export interface HistoryInventoryEntry {
  type: 'Feature';
  id: string;
  geometry: null;
  properties: {
    name: string; aliases: string[]; source_label: string; letter: string;
    source_entry: number; review_status: 'unreviewed_inventory';
    period: null; summary: null; rulers: never[];
    article_url: string | null; source_url: string;
  };
}
export interface HistoryInventory {
  type: 'FeatureCollection';
  metadata: {
    [key: string]: string | number;
    source_url: string; entry_count: number;
  };
  features: HistoryInventoryEntry[];
}
let pending: Promise<HistoryInventory> | undefined;

export function loadHistoryInventory(): Promise<HistoryInventory> {
  if (!pending) pending = fetchInventory().catch(error => {
    pending = undefined;
    throw error;
  });
  return pending;
}

async function fetchInventory(): Promise<HistoryInventory> {
  const response = await fetch('/data/history-inventory.geojson');
  if (!response.ok) throw new Error(`Historical inventory failed: ${response.status}`);
  const collection: HistoryInventory = await response.json();
  if (collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)
    || collection.metadata?.entry_count !== collection.features.length
    || !collection.features.every(feature => feature.type === 'Feature' && feature.geometry === null
      && typeof feature.properties?.name === 'string' && Array.isArray(feature.properties.aliases)
      && feature.properties.source_url.startsWith('https://id.wikipedia.org/'))) {
    throw new Error('Invalid historical discovery inventory');
  }
  return collection;
}
