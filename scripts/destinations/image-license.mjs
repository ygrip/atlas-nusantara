import { photoLicenseUrl, isCommonsImageUrl } from '../../src/lib/data/photo-license.js';

const LICENSE_NAMES = new Map([
  ['CC BY 4.0', 'CC-BY-4.0'], ['CC BY 3.0', 'CC-BY-3.0'],
  ['CC BY 2.5', 'CC-BY-2.5'], ['CC BY 2.0', 'CC-BY-2.0'],
  ['CC BY-SA 4.0', 'CC-BY-SA-4.0'], ['CC BY-SA 3.0', 'CC-BY-SA-3.0'],
  ['CC BY-SA 2.5', 'CC-BY-SA-2.5'], ['CC BY-SA 2.0', 'CC-BY-SA-2.0'],
  ['CC0', 'CC0-1.0'], ['Public domain', 'Public-domain']
]);

export function metadataText(value = '') {
  if (typeof value !== 'string') return '';
  return value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#(?:0?39|x27);/gi, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, ' ').trim();
}

export function canonicalLicenseUrl(value) {
  try {
    const url = new URL(value);
    if (url.hostname !== 'creativecommons.org' || !['http:', 'https:'].includes(url.protocol)) return undefined;
    if (url.username || url.password || url.search || url.hash) return undefined;
    let pathname = url.pathname.replace(/\/deed(?:\.[a-z-]+)?\/?$/i, '/');
    if (!pathname.endsWith('/')) pathname += '/';
    return 'https://creativecommons.org' + pathname;
  } catch {
    return undefined;
  }
}

export function creatorCredit(creator, attribution = '') {
  if (attribution && attribution !== creator) return creator + ' · ' + attribution;
  return creator;
}

/** Commons file-page metadata, not a search-result credit, establishes the license. */
export function verifyCommonsPhoto(page, retrievedAt) {
  const info = page?.imageinfo?.[0];
  const metadata = info?.extmetadata;
  if (!Number.isFinite(Date.parse(retrievedAt)) || !metadata || page.imagerepository !== 'local') return undefined;
  if (!['image/jpeg', 'image/webp', 'image/png'].includes(info.mime) || info.mediatype !== 'BITMAP') return undefined;
  if (metadata.NonFree?.value && metadata.NonFree.value !== 'false') return undefined;
  if (metadata.Restrictions?.value?.trim()) return undefined;
  const license = LICENSE_NAMES.get(metadata.LicenseShortName?.value);
  if (!license) return undefined;
  const licenseUrl = photoLicenseUrl(license);
  if (canonicalLicenseUrl(metadata.LicenseUrl?.value) !== licenseUrl) return undefined;
  const creator = metadataText(metadata.Artist?.value);
  if (!creator) return undefined;
  const attribution = metadataText(metadata.Attribution?.value);
  const credit = creatorCredit(creator, attribution);
  if (credit.length > 1500) return undefined;
  if (/non[- ]?commercial|no derivatives|all rights reserved/i.test(metadata.UsageTerms?.value ?? '')) return undefined;
  if (!isCommonsImageUrl(info.thumburl)) return undefined;
  if (!info.descriptionurl?.startsWith('https://commons.wikimedia.org/wiki/File:')) return undefined;
  if (!/^File:[^<>\r\n]{1,240}$/.test(page.title) || !Number.isSafeInteger(page.pageid)) return undefined;
  if (!Number.isFinite(Date.parse(info.timestamp)) || typeof info.sha1 !== 'string' || !info.sha1) return undefined;
  return {
    image: { url: info.thumburl, descriptionUrl: info.descriptionurl, credit, license, licenseUrl,
      reviewedAt: retrievedAt },
    evidence: { fileTitle: page.title, pageId: page.pageid, fileTimestamp: info.timestamp,
      fileSha1: info.sha1, metadataRetrievedAt: retrievedAt,
      licenseMetadataUrl: metadata.LicenseUrl.value, creator, attribution, licenseReview: 'commons-file-metadata-v1' }
  };
}
