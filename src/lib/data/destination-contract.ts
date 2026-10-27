import { isReusablePhotoMetadata } from './photo-license.js';
import { isDestinationCatalog } from './destination-validation.js';

export type LandmarkKind = 'natural' | 'built' | 'unknown';
export interface DestinationPhoto {
  url: string;
  descriptionUrl: string;
  credit: string;
  license: string;
  licenseUrl: string;
  reviewedAt: string;
}

export function validateDestinationPhoto(value: unknown): value is DestinationPhoto {
  return isReusablePhotoMetadata(value);
}

export interface Landmark {
  id: string;
  provinceCode: string;
  name: string;
  kind: LandmarkKind;
  officialId?: string;
  sourceDistrict?: string;
  /** Optional verified coordinates for future provider imports, never guessed from a name. */
  lon?: number;
  lat?: number;
  /** Optional Commons file title, e.g. "File:Example.jpg". */
  commonsFile?: string;
  /** Backward-compatible featured photo. Equals images[0] when a gallery exists. */
  image?: DestinationPhoto;
  /** One to eight independently credited, verified Commons photos. */
  images?: DestinationPhoto[];
  sourceUrl?: string;
}
export interface DestinationCatalog {
  schemaVersion: 1;
  fetchedAt: string;
  source: string;
  sourceUrl: string;
  scope: string;
  landmarks: Landmark[];
}
export function validateDestinationCatalog(value: unknown): value is DestinationCatalog {
  return isDestinationCatalog(value);
}
