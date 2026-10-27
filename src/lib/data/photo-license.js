/** Explicitly supported image licenses; credit by itself is never sufficient. */
const LICENSE_URLS = new Map([
  ['CC-BY-4.0', 'https://creativecommons.org/licenses/by/4.0/'],
  ['CC-BY-3.0', 'https://creativecommons.org/licenses/by/3.0/'],
  ['CC-BY-2.5', 'https://creativecommons.org/licenses/by/2.5/'],
  ['CC-BY-2.0', 'https://creativecommons.org/licenses/by/2.0/'],
  ['CC-BY-SA-4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'],
  ['CC-BY-SA-3.0', 'https://creativecommons.org/licenses/by-sa/3.0/'],
  ['CC-BY-SA-2.5', 'https://creativecommons.org/licenses/by-sa/2.5/'],
  ['CC-BY-SA-2.0', 'https://creativecommons.org/licenses/by-sa/2.0/'],
  ['CC0-1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'],
  ['Public-domain', 'https://creativecommons.org/publicdomain/mark/1.0/']
]);

/** @param {string} license */
export function photoLicenseUrl(license) {
  return LICENSE_URLS.get(license);
}

/** @param {unknown} value */
export function isCommonsImageUrl(value) {
  return typeof value === 'string'
    && /^https:\/\/((?:upload|thumb)\.wikimedia\.org\/|commons\.wikimedia\.org\/wiki\/Special:FilePath\/)/.test(value);
}

/** Shared runtime/publication contract for a fully credited, reusable photo.
 * @param {unknown} value
 */
export function isReusablePhotoMetadata(value) {
  if (!value || typeof value !== 'object') return false;
  const photo = /** @type {Record<string, unknown>} */ (value);
  return isCommonsImageUrl(photo.url)
    && typeof photo.descriptionUrl === 'string' && photo.descriptionUrl.startsWith('https://commons.wikimedia.org/wiki/File:')
    && typeof photo.credit === 'string' && Boolean(photo.credit.trim())
    && typeof photo.license === 'string' && photoLicenseUrl(photo.license) !== undefined
    && photo.licenseUrl === photoLicenseUrl(photo.license)
    && typeof photo.reviewedAt === 'string' && Number.isFinite(Date.parse(photo.reviewedAt));
}
