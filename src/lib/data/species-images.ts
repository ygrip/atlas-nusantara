import type { SpeciesImage, SpeciesKind } from './species-contract';

export type SpeciesImageSize = 'small' | 'medium' | 'large';

/**
 * Openly licensed photos are in iNaturalist's open-data bucket, which also allows canvas use (CORS).
 * All-rights-reserved photos are only on the main host and can be shown but never drawn onto a share card.
 */
export function speciesImageUrl(image: SpeciesImage, size: SpeciesImageSize): string {
  const file = size + '.' + image.ext;
  if (image.license) return 'https://inaturalist-open-data.s3.amazonaws.com/photos/' + image.id + '/' + file;
  return 'https://static.inaturalist.org/photos/' + image.id + '/' + file;
}

export function speciesImagePage(image: SpeciesImage): string {
  return 'https://www.inaturalist.org/photos/' + image.id;
}

/** Short credit line, for example "© Jorge Rueda · CC BY-NC"; `reservedLabel` is the translated "all rights reserved". */
export function speciesImageCredit(image: SpeciesImage, reservedLabel: string): string {
  const author = image.credit || 'iNaturalist';
  if (!image.license) return '© ' + author + ' · ' + reservedLabel;
  if (image.license === 'cc0') return author + ' · CC0';
  return '© ' + author + ' · ' + image.license.toUpperCase().replace(/-/g, ' ');
}

/** True when the photo may be drawn onto a share card: openly licensed and served with CORS. */
export function isShareablePhoto(image: SpeciesImage): boolean {
  return image.license !== '';
}

/** Local illustration shown when a species has no photo, or its photo fails to load. */
export function speciesPlaceholderPath(kind: SpeciesKind): string {
  return '/illustrations/species/' + kind + '.svg';
}
