import type { CuisineImage } from './cuisine-contract';

export type CuisineImageSize = 'small' | 'medium' | 'large';

const COMMONS_WIDTHS: Record<CuisineImageSize, number> = { small: 250, medium: 500, large: 960 };
const COOKPAD_SIZES: Record<CuisineImageSize, string> = { small: '300x225cq80', medium: '640x480cq80', large: '1200x900cq80' };

/**
 * Photos stay on Wikimedia Commons or Cookpad. Commons photos are read straight from upload.wikimedia.org, which sends CORS
 * headers (the Special:FilePath redirect does not), so they may be drawn onto a share card. Cookpad's image host sends no
 * CORS header, so those photos can be shown but never drawn.
 */
export function cuisineImageUrl(image: CuisineImage, size: CuisineImageSize): string {
  if (image.source === 'commons') return commonsUrl(image, COMMONS_WIDTHS[size]);
  const hash = image.ref.split('/')[1];
  return 'https://img-global.cpcdn.com/recipes/' + hash + '/' + COOKPAD_SIZES[size] + '/photo.jpg';
}

/** A thumbnail at the wanted width, or the original file when it is no wider than that (a thumbnail may not upscale). */
function commonsUrl(image: CuisineImage, wanted: number): string {
  const fileName = image.ref.split('/')[2];
  const base = 'https://upload.wikimedia.org/wikipedia/commons/';
  if ((image.width ?? 0) <= wanted) return base + image.ref;
  return base + 'thumb/' + image.ref + '/' + wanted + 'px-' + fileName;
}

/** The page that shows the photo with its author and licence. */
export function cuisineImagePage(image: CuisineImage): string {
  if (image.source === 'commons') return 'https://commons.wikimedia.org/wiki/File:' + image.ref.split('/')[2];
  return 'https://cookpad.com/id/resep/' + image.ref.split('/')[0];
}

/** Short credit line, for example "Gunawan Kartapranata · CC BY-SA 3.0" or "© Liawati Iskandar · Cookpad". */
export function cuisineImageCredit(image: CuisineImage): string {
  const author = image.credit || 'Wikimedia Commons';
  if (image.source === 'cookpad') return '© ' + author + ' · Cookpad';
  return author + ' · ' + image.license;
}

/** True when the photo may be drawn onto a share card (openly licensed and served with CORS). */
export function isShareableCuisinePhoto(image: CuisineImage): boolean {
  return image.source === 'commons';
}

/** Local illustration shown when a dish has no photo, or its photo fails to load. */
export const CUISINE_PLACEHOLDER_PATH = '/illustrations/cuisine/dish.svg';
