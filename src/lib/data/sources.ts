export type DatasetKind = 'forecast' | 'alert' | 'observation' | 'incident' | 'hazard' | 'population';

export interface SourceDefinition {
  id: string;
  agency: string;
  kind: DatasetKind;
  url: string;
  status: 'planned';
  spatialLevel: string;
  updatePlan: string;
  licensing: string;
}

/** Source catalog only. These entries do NOT imply that live data is available. */
export const sources: SourceDefinition[] = [
  { id: 'bmkg-weather', agency: 'BMKG', kind: 'forecast', url: 'https://data.bmkg.go.id/', status: 'planned', spatialLevel: 'desa/kelurahan', updatePlan: 'Cache by requested location', licensing: 'Review API attribution, rate limits and commercial reuse permissions' },
  { id: 'bmkg-warnings', agency: 'BMKG', kind: 'alert', url: 'https://www.bmkg.go.id/', status: 'planned', spatialLevel: 'affected-area polygons or official regions', updatePlan: 'Poll alerts with expiry checks', licensing: 'Verify supported feed and redistribution terms' },
  { id: 'bmkg-earthquakes', agency: 'BMKG', kind: 'observation', url: 'https://data.bmkg.go.id/', status: 'planned', spatialLevel: 'epicenter coordinates', updatePlan: 'Minutes where allowed', licensing: 'Attribute, honor API terms' },
  { id: 'bnpb-events', agency: 'BNPB Satu Data', kind: 'incident', url: 'https://data.bnpb.go.id/', status: 'planned', spatialLevel: 'provinsi/kabupaten/kota', updatePlan: 'On publication or daily check', licensing: 'Verify dataset-specific reuse terms' },
  { id: 'inarisk-hazards', agency: 'InaRISK', kind: 'hazard', url: 'https://inarisk.bnpb.go.id/', status: 'planned', spatialLevel: 'hazard polygons', updatePlan: 'On official layer revision', licensing: 'Confirm source-layer redistribution rights' },
  { id: 'worldpop', agency: 'WorldPop', kind: 'population', url: 'https://www.worldpop.org/', status: 'planned', spatialLevel: 'modeled gridded estimates', updatePlan: 'Per dataset release', licensing: 'CC BY 4.0; attribution required' }
];
