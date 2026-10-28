import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadSubjectRegistry, loadCommonsPages, loadCommonsCategoryMembers, saveJson } from './image-discovery.mjs';
import { buildSubjectIndex, matchDestination, normalizeName } from './image-matching.mjs';
import { verifyCommonsPhoto } from './image-license.mjs';
import { applyImageRegistry, destinationFingerprint, IMAGE_REVIEW_POLICY, readImageRegistry } from './image-publication.mjs';
import { writeDestinationCatalog } from './catalog-output.mjs';

export async function loadDestinationCatalog(directory) {
  const index = JSON.parse(await readFile(path.join(directory, 'index.json'), 'utf8'));
  if (!Array.isArray(index.provinces) || index.provinces.length !== 38) throw Error('Expected the full 38-province destination index');
  const shards = {};
  const places = [];
  const ids = new Set();
  for (const summary of index.provinces) {
    if (!/^\d{2}$/.test(summary.provinceCode) || shards[summary.provinceCode]) throw Error('Invalid or duplicate province shard');
    const shard = JSON.parse(await readFile(path.join(directory, 'provinces', summary.provinceCode + '.json'), 'utf8'));
    if (!Array.isArray(shard.landmarks) || shard.landmarks.length !== summary.count) throw Error('Destination shard count mismatch');
    for (const place of shard.landmarks) {
      if (ids.has(place.id) || place.provinceCode !== summary.provinceCode) throw Error('Invalid destination identity in shard');
      ids.add(place.id); places.push(place);
    }
    shards[summary.provinceCode] = shard;
  }
  if (places.length !== index.coverage.totalRecords) throw Error('Full catalog count mismatch');
  return { index, shards, places };
}

export function selectLocationMatches(places, subjects) {
  const subjectIndex = buildSubjectIndex(subjects);
  const matches = [];
  const outcomes = [];
  let nameCandidates = 0;
  for (const place of places) {
    if (subjectIndex.has(normalizeName(place.name))) nameCandidates++;
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lon)) {
      outcomes.push({ id: place.id, status: 'no-verified-destination-coordinate' });
      continue;
    }
    const match = matchDestination(place, subjectIndex);
    if (!match) {
      outcomes.push({ id: place.id, status: 'no-unambiguous-exact-name-and-location-match' });
      continue;
    }
    matches.push({ place, ...match });
  }
  return { matches, outcomes, nameCandidates };
}

function verifiedEntry(match, subject, pages, categories = new Map()) {
  const photos = [];
  const seen = new Set();
  const sourceTitles = (subject.imageTitles ?? []).filter(Boolean);
  const categoryTitles = (subject.commonsCategories ?? []).flatMap(category => categories.get(category) ?? []);
  for (const title of [...sourceTitles, ...categoryTitles]) {
    if (seen.has(title)) continue;
    const metadata = pages.get(title);
    if (!metadata) continue;
    const photo = verifyCommonsPhoto(metadata.page, metadata.retrievedAt);
    if (!photo || seen.has(photo.evidence.fileTitle)) continue;
    seen.add(photo.evidence.fileTitle);
    photos.push({
      subject: { ...match.subject, imageTitle: title }, locationEvidence: match.evidence,
      image: photo.image, licenseEvidence: { ...photo.evidence, requestedTitle: title }
    });
    if (photos.length === 8) break;
  }
  if (!photos.length) return undefined;
  return {
    destinationId: match.place.id,
    destinationFingerprint: destinationFingerprint(match.place),
    ...photos[0],
    ...(photos.length > 1 ? { photos } : {})
  };
}

export function reviewMatchedPhotos(matches, subjects, pages, categories = new Map()) {
  const byId = new Map(subjects.map(subject => [subject.id, subject]));
  const entries = [];
  const outcomes = [];
  for (const match of matches) {
    const subject = byId.get(match.subject.id);
    const entry = verifiedEntry(match, subject, pages, categories);
    if (entry) {
      entries.push(entry);
      outcomes.push({ id: match.place.id, status: 'verified-image', subjectId: subject.id,
        fileTitle: entry.licenseEvidence.fileTitle });
    } else outcomes.push({ id: match.place.id, status: 'no-photo-passes-license-credit-or-restriction-policy', subjectId: subject.id });
  }
  entries.sort((left, right) => left.destinationId.localeCompare(right.destinationId));
  return { entries, outcomes };
}

/**
 * Do not regress existing licensed photos when the source's subject registry is
 * incomplete or image/category membership changes. Both old and newly discovered
 * photos must still pass the full downstream publication proof verification.
 */
export function mergeVerifiedRegistries(existing, discovered) {
  if (!existing) return discovered;
  if (existing.policy !== IMAGE_REVIEW_POLICY) throw Error('Unexpected existing photo review policy');
  const byId = new Map(existing.entries.map(entry => [entry.destinationId, entry]));
  for (const entry of discovered.entries) {
    const old = byId.get(entry.destinationId);
    if (!old) { byId.set(entry.destinationId, entry); continue; }
    if (old.destinationFingerprint !== entry.destinationFingerprint) {
      // The publisher will reject stale old evidence if a source landmark moved.
      byId.set(entry.destinationId, entry);
      continue;
    }
    const oldPhotos = old.photos ?? [old];
    const newPhotos = entry.photos ?? [entry];
    const photos = [];
    const seen = new Set();
    for (const photo of [...oldPhotos, ...newPhotos]) {
      const file = photo.licenseEvidence?.fileTitle;
      if (!file || seen.has(file)) continue;
      seen.add(file);
      photos.push({ subject: photo.subject, locationEvidence: photo.locationEvidence,
        image: photo.image, licenseEvidence: photo.licenseEvidence });
      if (photos.length === 8) break;
    }
    byId.set(entry.destinationId, {
      destinationId: entry.destinationId,
      destinationFingerprint: entry.destinationFingerprint,
      ...photos[0],
      ...(photos.length > 1 ? { photos } : {})
    });
  }
  const entries = [...byId.values()].sort((a, b) => a.destinationId.localeCompare(b.destinationId));
  const licensedPhotos = entries.reduce((sum, entry) => sum + (entry.photos?.length ?? 1), 0);
  return {
    ...discovered,
    coverage: {
      ...discovered.coverage,
      licensedImages: entries.length,
      licensedPhotos,
      distinctImageFiles: new Set(entries.flatMap(entry =>
        (entry.photos ?? [entry]).map(photo => photo.licenseEvidence.fileTitle))).size,
      withoutPublishedImage: discovered.coverage.evaluatedDestinations - entries.length
    },
    entries
  };
}

export async function publishImageRegistry(directory, catalog, registry) {
  const result = applyImageRegistry(catalog.index, catalog.shards, registry);
  if (result.rejected || result.missingDestinations) throw Error('Image registry no longer matches the current destination catalog');
  await saveJson(path.join(directory, 'image-metadata.json'), registry);
  await writeDestinationCatalog(directory, catalog.index, catalog.shards);
  return result;
}

export async function discoverCatalogImages({ catalogDirectory, cacheDirectory, publish = false }) {
  const catalog = await loadDestinationCatalog(catalogDirectory);
  const subjects = await loadSubjectRegistry(cacheDirectory);
  const locations = selectLocationMatches(catalog.places, subjects.subjects);
  console.log('Full catalog evaluated:', catalog.places.length, 'name candidates:', locations.nameCandidates,
    'verified subject locations:', locations.matches.length);
  const byId = new Map(subjects.subjects.map(subject => [subject.id, subject]));
  const categoryNames = locations.matches.flatMap(match => byId.get(match.subject.id).commonsCategories ?? []);
  const categories = await loadCommonsCategoryMembers(categoryNames, cacheDirectory);
  const titles = locations.matches.flatMap(match => {
    const subject = byId.get(match.subject.id);
    return [...(subject.imageTitles ?? []),
      ...(subject.commonsCategories ?? []).flatMap(category => categories.get(category) ?? [])];
  });
  const pages = await loadCommonsPages(titles, cacheDirectory);
  const reviewed = reviewMatchedPhotos(locations.matches, subjects.subjects, pages, categories);
  const outcomes = [...locations.outcomes, ...reviewed.outcomes].sort((left, right) => left.id.localeCompare(right.id));
  const timestamps = [subjects.fetchedAt, ...[...pages.values()].map(page => page.retrievedAt)].sort();
  const discovered = { schemaVersion: 1, policy: IMAGE_REVIEW_POLICY,
    discoveredAt: timestamps[timestamps.length - 1],
    catalogFingerprint: createHash('sha256').update(catalog.places.map(destinationFingerprint).sort().join('\n')).digest('hex'),
    sources: { subjectRegistry: subjects.source, subjectRegistryFetchedAt: subjects.fetchedAt,
      subjectCount: subjects.subjects.length, ambiguousSubjectCoordinates: subjects.ambiguousCoordinates,
      scope: subjects.scope, commons: 'https://commons.wikimedia.org/',
      categoryCount: categories.size },
    coverage: { evaluatedDestinations: catalog.places.length, exactNameCandidates: locations.nameCandidates,
      verifiedLocationMatches: locations.matches.length, licensedImages: reviewed.entries.length,
      licensedPhotos: reviewed.entries.reduce((count, entry) => count + (entry.photos?.length ?? 1), 0),
      distinctImageFiles: new Set(reviewed.entries.flatMap(entry =>
        (entry.photos ?? [entry]).map(photo => photo.licenseEvidence.fileTitle))).size,
      withoutPublishedImage: catalog.places.length - reviewed.entries.length },
    verification: 'Automated name, subject-coordinate, and file-license metadata verification; not human visual review.',
    entries: reviewed.entries };
  const existing = await readImageRegistry(path.join(catalogDirectory, 'image-metadata.json'));
  const registry = mergeVerifiedRegistries(existing, discovered);
  await saveJson(path.join(cacheDirectory, 'image-metadata.json'), registry);
  await saveJson(path.join(cacheDirectory, 'discovery-results.json'), { policy: registry.policy,
    discoveredAt: registry.discoveredAt, coverage: registry.coverage, outcomes });
  if (publish) await publishImageRegistry(catalogDirectory, catalog, registry);
  return registry.coverage;
}
