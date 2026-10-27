import { photoLicenseUrl, isCommonsImageUrl } from './photo-license.js';
import type { DestinationPhoto } from './destination-contract';

interface ImageInfo {
  thumburl?: string;
  descriptionurl?: string;
  extmetadata?: Record<string, { value?: string }>;
}

export async function loadCommonsPhoto(filename: string, signal: AbortSignal): Promise<DestinationPhoto | undefined> {
  const params = new URLSearchParams({ action: 'query', format: 'json', origin: '*',
    titles: 'File:' + filename, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '900' });
  const response = await fetch('https://commons.wikimedia.org/w/api.php?' + params, { signal });
  if (!response.ok) throw Error('Commons photo metadata unavailable');
  const payload = await response.json();
  const pages = Object.values(payload.query?.pages ?? {}) as Array<{ imageinfo?: ImageInfo[] }>;
  const info = pages[0]?.imageinfo?.[0];
  const metadata = info?.extmetadata;
  if (!info?.thumburl || !isCommonsImageUrl(info.thumburl)
    || !info.descriptionurl?.startsWith('https://commons.wikimedia.org/wiki/File:') || !metadata) return undefined;
  let license = (metadata.LicenseShortName?.value ?? '').replace(/ /g, '-');
  if (license === 'CC0') license = 'CC0-1.0';
  const licenseUrl = photoLicenseUrl(license);
  const credit = (metadata.Artist?.value ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();
  if (!licenseUrl || !credit) return undefined;
  return { url: info.thumburl, descriptionUrl: info.descriptionurl, credit, license, licenseUrl,
    reviewedAt: new Date().toISOString() };
}
