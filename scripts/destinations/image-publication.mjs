import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isReusablePhotoMetadata } from '../../src/lib/data/photo-license.js';
import { buildSubjectIndex, matchDestination } from './image-matching.mjs';
import { canonicalLicenseUrl, creatorCredit } from './image-license.mjs';

export const IMAGE_REVIEW_POLICY = 'commons-wikidata-exact-name-250m-v1';

export function destinationFingerprint(place) {
  return createHash('sha256').update(JSON.stringify([
    place.id, place.name, place.provinceCode, place.lat ?? '', place.lon ?? ''
  ])).digest('hex');
}

export async function readImageRegistry(filename) {
  try { return JSON.parse(await readFile(filename, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}

function verifiedEntry(place, entry) {
  if (entry.destinationFingerprint !== destinationFingerprint(place) || !isReusablePhotoMetadata(entry.image)) return false;
  const license = entry.licenseEvidence;
  const evidence = entry.locationEvidence;
  if (!license || license.licenseReview !== 'commons-file-metadata-v1' || !license.fileSha1
    || !Number.isFinite(Date.parse(license.fileTimestamp)) || !Number.isSafeInteger(license.pageId)
    || license.metadataRetrievedAt !== entry.image.reviewedAt || !evidence || evidence.verification !== 'automated') return false;
  if (canonicalLicenseUrl(license.licenseMetadataUrl) !== entry.image.licenseUrl) return false;
  if (typeof license.creator !== 'string' || !license.creator.trim()
    || typeof license.attribution !== 'string'
    || creatorCredit(license.creator, license.attribution) !== entry.image.credit) return false;
  let descriptionTitle;
  try { descriptionTitle = decodeURIComponent(new URL(entry.image.descriptionUrl).pathname.slice('/wiki/'.length)).replace(/_/g, ' '); }
  catch { return false; }
  if (descriptionTitle !== license.fileTitle) return false;
  if (!entry.subject || entry.subject.imageTitle !== license.requestedTitle
    || entry.subject.id !== evidence.subjectId || evidence.method !== 'exact-name-and-subject-coordinate') return false;
  const match = matchDestination(place, buildSubjectIndex([entry.subject]));
  if (!match || !Number.isFinite(evidence.distanceMeters)
    || Math.abs(match.evidence.distanceMeters - evidence.distanceMeters) >= 0.01) return false;
  const proofFields = ['method', 'verification', 'subjectId', 'matchedLabel', 'subjectLat', 'subjectLon', 'sourceUrl'];
  return proofFields.every(field => evidence[field] === match.evidence[field]);
}

/** Rebuilding source data may retain images only while the destination identity still agrees. */
export function applyImageRegistry(index, shards, registry) {
  if (!registry) return { published: 0, rejected: 0 };
  if (registry.schemaVersion !== 1 || registry.policy !== IMAGE_REVIEW_POLICY || !Array.isArray(registry.entries)) {
    throw Error('Invalid verified image registry');
  }
  const entries = new Map();
  for (const entry of registry.entries) {
    if (!entry.destinationId || entries.has(entry.destinationId)) throw Error('Duplicate destination in image registry');
    entries.set(entry.destinationId, entry);
  }
  let published = 0;
  let photoCount = 0;
  let rejected = 0;
  const reviewedIds = new Set();
  for (const shard of Object.values(shards)) {
    for (const place of shard.landmarks) {
      delete place.image;
      delete place.images;
      const entry = entries.get(place.id);
      if (!entry) continue;
      reviewedIds.add(place.id);
      const photos = entry.photos ?? [entry];
      const validGallery = Array.isArray(photos) && photos.length >= 1 && photos.length <= 8
        && (entry.photos === undefined || JSON.stringify(entry.image) === JSON.stringify(photos[0]?.image))
        && photos.every(photo => verifiedEntry(place, { ...entry, ...photo }))
        && new Set(photos.map(photo => photo.licenseEvidence.fileTitle)).size === photos.length
        && new Set(photos.map(photo => photo.image.descriptionUrl)).size === photos.length;
      if (!validGallery) { rejected++; continue; }
      place.image = { ...photos[0].image };
      if (photos.length > 1) place.images = photos.map(photo => ({ ...photo.image }));
      published++;
      photoCount += photos.length;
    }
  }
  const missingDestinations = entries.size - reviewedIds.size;
  index.coverage.licensedImages = published;
  index.coverage.licensedPhotos = photoCount;
  index.imageEnrichment = { policy: registry.policy, discoveredAt: registry.discoveredAt,
    evaluatedDestinations: registry.coverage?.evaluatedDestinations, publishedImages: published,
    publishedPhotos: photoCount,
    rejectedOrStaleEntries: rejected, missingDestinations,
    registry: '/data/destinations/image-metadata.json',
    verification: 'Automated exact distinctive name and subject coordinate within 250 metres; Commons file license metadata checked. Not a claim of human visual review.' };
  return { published, rejected, missingDestinations };
}
