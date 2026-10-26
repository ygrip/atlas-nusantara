// PetaBencana.id crowd-sourced reports (last 7 days). Unverified citizen reports; text is user generated and cleaned.
import { fetchText } from '../lib/http.mjs';
import { makeEvent, RejectionCounter } from '../lib/event.mjs';
import { cleanText } from '../lib/text.mjs';

export const PETABENCANA = {
  id: 'petabencana', name: 'PetaBencana.id', url: 'https://docs.petabencana.id/routes/laporan-urun-daya',
  termsUrl: 'https://docs.petabencana.id/informasi-lisensi-data',
  attribution: 'Crowdsourced reports: PetaBencana.id, licensed CC BY-NC 4.0 (non-commercial, attribution). Unverified citizen reports, not official warnings.'
};
const REPORTS_URL = 'https://data.petabencana.id/reports?geoformat=geojson&timeperiod=604800';
const TYPES = ['flood', 'earthquake', 'wind', 'haze', 'fire', 'volcano'];
const MAX_REPORTS = 1500;

export function eventsFromReports(features, rejections) {
  const events = [];
  for (const feature of features.slice(0, MAX_REPORTS)) {
    const properties = feature.properties ?? {};
    const [lon, lat] = feature.geometry?.coordinates ?? [];
    const type = properties.disaster_type;
    if (!TYPES.includes(type)) { rejections.add('unsupported-type'); continue; }
    const text = cleanText(properties.text ?? '', 240);
    const place = cleanText(properties.tags?.city ?? '', 120);
    const depth = Number(properties.report_data?.flood_depth);
    try {
      events.push(makeEvent({
        id: 'petabencana:' + properties.pkey, kind: 'citizen', source: PETABENCANA.name, type,
        title: text || place || type, occurredAt: properties.created_at, place, precision: 'point', lon, lat,
        floodDepthCm: Number.isFinite(depth) ? depth : undefined
      }));
    } catch (error) {
      rejections.add(error.message);
    }
  }
  return events;
}

export async function collectPetaBencana() {
  const rejections = new RejectionCounter();
  const payload = JSON.parse(await fetchText(REPORTS_URL));
  const features = payload?.result?.features;
  if (!Array.isArray(features)) throw Error('Unexpected PetaBencana report format');
  return { events: eventsFromReports(features, rejections), fetched: features.length, rejected: rejections.toObject(), warnings: [] };
}
