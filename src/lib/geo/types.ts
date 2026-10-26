export type AdminLevel = 'national' | 'province' | 'city-regency';

export interface AdministrativeRegion {
  /** Canonical identity scoped by boundary edition. NEVER use array positions. */
  id: string;
  name: string;
  level: AdminLevel;
  parentId: string | null;
  sourceCode: string;
  source: string;
  boundaryEdition: string;
}

export interface SvgRegion extends AdministrativeRegion {
  /** Pre-projected SVG path, generated offline (not in the browser). */
  path: string;
  bbox: [number, number, number, number];
}

export interface GeometryPackage {
  schemaVersion: 1;
  boundaryEdition: string;
  level: AdminLevel;
  viewBox: string;
  regions: SvgRegion[];
}

/** Retain time semantics. A hazard classification is never a live alert. */
export interface RegionalDataset<T> {
  regionId: string;
  kind: 'forecast' | 'alert' | 'observation' | 'incident' | 'hazard' | 'population';
  sourceId: string;
  sourceUpdatedAt: string | null;
  ingestedAt: string;
  boundaryEdition: string;
  isLive: boolean;
  records: T[];
  attribution: string;
}
