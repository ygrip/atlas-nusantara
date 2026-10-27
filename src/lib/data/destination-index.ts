import { isDestinationIndex, isProvinceCodeValue } from './destination-validation.js';

export interface ProvinceDestinations {
  provinceCode: string;
  count: number;
  natural: number;
  built: number;
  unknown?: number;
  shard: string;
}

export interface DestinationIndex {
  schemaVersion: 2;
  national?: string;
  fetchedAt: string;
  source: string;
  sourceUrl: string;
  scope: string;
  license: string;
  attribution: string;
  coverage: {
    totalRecords: number;
    geocodedRecords: number;
    classifiedRecords: number;
    /** Number of destinations with one or more verified photographs. */
    licensedImages: number;
    /** Number of individually credited photographs, including gallery extras. */
    licensedPhotos?: number;
    sourceCoveragePercent: number | null;
  };
  provinces: ProvinceDestinations[];
}

export function isProvinceCode(code: string): boolean {
  return isProvinceCodeValue(code);
}

export function validateDestinationIndex(value: unknown): value is DestinationIndex {
  return isDestinationIndex(value);
}
