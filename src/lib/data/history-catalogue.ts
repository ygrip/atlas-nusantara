import { HISTORICAL_POLITIES } from './history.ts';
import type { HistoryInventoryEntry } from './history-inventory.ts';

export interface HistoryArticle {
  title: string; url: string; language: string; summary: string; revision: number;
  reported_fields: { field: string; source_expression: string }[];
  reference_urls: string[]; license: string; attribution: string;
}
export interface HistoryDossier extends Omit<HistoryInventoryEntry, 'properties'> {
  properties: Omit<HistoryInventoryEntry['properties'], 'review_status'> & {
    review_status: string;
    source_claim_wikitext_id: string;
    identity_ambiguous: boolean;
    articles: HistoryArticle[];
    book_mentions?: { book_title: string; file: string; pages: number[]; matched_labels: string[]; ambiguous_labels: string[] }[];
    web_research?: {
      factual_claim: string | null; uncertain_or_missing: string; evidence_status: string;
      sources: { title: string; url: string; type: string }[];
    } | null;
    genealogy_sections: { name: string; from_pdf_page: number; to_pdf_page: number; source_id: string; identity_review_required: boolean }[];
  };
}
export interface HistoryResearch {
  type: 'FeatureCollection';
  metadata: Record<string, unknown>;
  features: HistoryDossier[];
  genealogy_sections: { name: string; pages: { pdf_page: number; text: string }[] }[];
  genealogy_cross_references: { alias: string; target: string; pdf_page: number }[];
}

export function foldHistorySearch(value: string): string {
  return value.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '');
}

export function normalizePolityName(name: string): string {
  return foldHistorySearch(name)
    .replace(/\b(kerajaan|kesultanan|kadipaten|kepangeranan|kingdom|sultanate)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const curatedIdsByName = new Map<string, string[]>();
for (const polity of HISTORICAL_POLITIES) {
  const name = normalizePolityName(polity.name);
  const ids = curatedIdsByName.get(name) ?? [];
  ids.push(polity.id);
  curatedIdsByName.set(name, ids);
}

/** Exact labels are navigation links, not a historical assertion of continuity. Homonyms stay unresolved. */
export function curatedPolityFor(dossier: HistoryDossier): string | undefined {
  if (dossier.properties.identity_ambiguous) return undefined;
  const matches = new Set<string>();
  for (const name of [dossier.properties.name, ...dossier.properties.aliases]) {
    for (const id of curatedIdsByName.get(normalizePolityName(name)) ?? []) matches.add(id);
  }
  if (matches.size === 1) return [...matches][0];
  return undefined;
}

let pending: Promise<HistoryResearch> | undefined;
export function loadHistoryResearch(): Promise<HistoryResearch> {
  if (!pending) pending = fetchResearch().catch(error => {
    pending = undefined;
    throw error;
  });
  return pending;
}
async function fetchResearch(): Promise<HistoryResearch> {
  const response = await fetch('/data/history-research.geojson');
  if (!response.ok) throw new Error(`Historical research failed: ${response.status}`);
  const data: HistoryResearch = await response.json();
  if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)
    || !data.features.every(feature => feature.geometry === null && Array.isArray(feature.properties.articles)
      && Array.isArray(feature.properties.genealogy_sections))) throw new Error('Invalid historical research dossiers');
  return data;
}

/** Source markup is shown as text, never injected as HTML. */
export function historySourceClaim(markup: string): string {
  return markup.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target, label) => label ?? target)
    .replace(/'{2,}/g, '');
}
