const EARTH_RADIUS_METERS = 6371008.8;
const MAX_DISTANCE_METERS = 250;
const GENERIC_NAMES = new Set([
  'air terjun', 'candi', 'danau', 'kolam renang', 'museum', 'pantai', 'pulau', 'taman',
  'taman wisata', 'taman nasional', 'wisata alam', 'desa wisata', 'waterpark', 'water park',
  'waterboom', 'pemandian air panas', 'camping ground', 'kebun binatang', 'taman rekreasi'
]);
const GENERIC_WORDS = new Set([
  'air', 'terjun', 'panas', 'candi', 'danau', 'kolam', 'renang', 'museum', 'pantai', 'pulau', 'taman',
  'wisata', 'nasional', 'alam', 'desa', 'kampung', 'kota', 'kabupaten', 'masjid', 'gereja', 'gua', 'goa',
  'bukit', 'gunung', 'hutan', 'pinus', 'sungai', 'situ', 'waduk', 'pemandian', 'pasir', 'putih',
  'indah', 'baru', 'lama', 'umum', 'besar', 'kecil', 'raya', 'dtw', 'obyek', 'objek', 'rekreasi'
]);
const ENTITY_ID_PATTERN = /^Q[1-9]\d*$/;
const SAFE_FILE_TITLE_PATTERN = /^File:[^\u0000-\u001f\u007f<>\[\]{}|"'`]{1,220}$/;

export function normalizeName(value) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('id')
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function hasValidCoordinates(latitude, longitude) {
  return typeof latitude === 'number' && Number.isFinite(latitude)
    && typeof longitude === 'number' && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

function isSafeFileTitle(value) {
  return typeof value === 'string' && SAFE_FILE_TITLE_PATTERN.test(value)
    && value.startsWith('File:') && value.slice('File:'.length).trim().length > 0;
}

function distanceMeters(firstLatitude, firstLongitude, secondLatitude, secondLongitude) {
  const toRadians = degrees => degrees * Math.PI / 180;
  const latitudeDifference = toRadians(secondLatitude - firstLatitude);
  const longitudeDifference = toRadians(secondLongitude - firstLongitude);
  const firstLatitudeRadians = toRadians(firstLatitude);
  const secondLatitudeRadians = toRadians(secondLatitude);
  const haversine = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(firstLatitudeRadians) * Math.cos(secondLatitudeRadians)
      * Math.sin(longitudeDifference / 2) ** 2;
  const boundedHaversine = Math.min(1, Math.max(0, haversine));
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(boundedHaversine));
}

function validSubject(subject) {
  return subject && typeof subject === 'object'
    && typeof subject.id === 'string' && ENTITY_ID_PATTERN.test(subject.id)
    && Array.isArray(subject.labels) && hasValidCoordinates(subject.lat, subject.lon)
    && (isSafeFileTitle(subject.imageTitle)
      || Array.isArray(subject.commonsCategories)
        && subject.commonsCategories.some(category => typeof category === 'string' && category.trim()));
}

/** Build an exact normalized-name index over geolocated Wikidata image subjects. */
export function buildSubjectIndex(subjects) {
  const byName = new Map();
  const byId = new Map();
  if (!Array.isArray(subjects)) return byName;

  for (const subject of subjects) {
    if (!validSubject(subject)) continue;
    const existing = byId.get(subject.id);
    if (existing) continue;
    const indexedSubject = {
      id: subject.id,
      labels: [...new Set(subject.labels.filter(label => typeof label === 'string' && label.trim()))],
      lat: subject.lat,
      lon: subject.lon,
      imageTitle: subject.imageTitle,
      commonsCategories: subject.commonsCategories ?? []
    };
    byId.set(indexedSubject.id, indexedSubject);

    const keys = new Set(indexedSubject.labels.map(normalizeName).filter(Boolean));
    for (const key of keys) {
      const matches = byName.get(key) ?? [];
      matches.push(indexedSubject);
      byName.set(key, matches);
    }
  }
  return byName;
}

/** Match only a distinctive exact name with independently verified coordinates. */
export function matchDestination(place, index) {
  if (!place || typeof place !== 'object' || !(index instanceof Map)) return undefined;
  if (typeof place.name !== 'string' || !hasValidCoordinates(place.lat, place.lon)) return undefined;
  const normalizedName = normalizeName(place.name);
  if (!normalizedName || GENERIC_NAMES.has(normalizedName)) return undefined;
  const distinctive = normalizedName.split(' ').some(word => word.length >= 3 && /\p{L}/u.test(word) && !GENERIC_WORDS.has(word));
  if (!distinctive) return undefined;

  const namedSubjects = index.get(normalizedName);
  if (!namedSubjects) return undefined;
  const nearbySubjects = [];
  for (const subject of namedSubjects) {
    const distance = distanceMeters(place.lat, place.lon, subject.lat, subject.lon);
    if (distance <= MAX_DISTANCE_METERS) nearbySubjects.push({ subject, distance });
  }
  if (nearbySubjects.length !== 1) return undefined;

  const { subject, distance } = nearbySubjects[0];
  const matchedLabel = subject.labels.find(label => normalizeName(label) === normalizedName);
  if (!matchedLabel) return undefined;
  return {
    subject,
    evidence: {
      method: 'exact-name-and-subject-coordinate',
      verification: 'automated',
      subjectId: subject.id,
      matchedLabel,
      distanceMeters: distance,
      subjectLat: subject.lat,
      subjectLon: subject.lon,
      sourceUrl: 'https://www.wikidata.org/wiki/' + subject.id
    }
  };
}


const CAMERA_RADIUS_METERS = 350;

/**
 * An exact distinctive place-name phrase inside the Commons FILE name, and the
 * file page's geotagged point of view near the destination. The image's geotag
 * is not automatically assumed to be its subject: both checks are required.
 */
export function matchCommonsFileToDestination(place, fileTitle, camera) {
  if (!place || typeof place.name !== 'string'
    || !hasValidCoordinates(place.lat, place.lon)
    || !hasValidCoordinates(camera?.lat, camera?.lon)
    || !isSafeFileTitle(fileTitle)) return undefined;
  const placeName = normalizeName(place.name);
  const filename = normalizeName(fileTitle.slice('File:'.length).replace(/\.[^.]+$/, ''));
  const distinctive = placeName.split(' ').some(word =>
    word.length >= 3 && /\p{L}/u.test(word) && !GENERIC_WORDS.has(word));
  if (!distinctive || placeName.length < 8 || GENERIC_NAMES.has(placeName)) return undefined;
  // Preserve token boundaries: "Sari" must not match "Sarimukti".
  const phraseMatch = (' ' + filename + ' ').includes(' ' + placeName + ' ');
  const placeTokens = placeName.split(' ');
  const fileTokens = filename.split(' ');
  const sharedPrefix = placeTokens.slice(0, fileTokens.length).join(' ') === filename
    && fileTokens.length >= 2 && fileTokens.length >= placeTokens.length - 1
    && fileTokens.some(word => word.length >= 4 && !GENERIC_WORDS.has(word));
  if (!phraseMatch && !sharedPrefix) return undefined;
  const distance = distanceMeters(place.lat, place.lon, camera.lat, camera.lon);
  if (distance > CAMERA_RADIUS_METERS) return undefined;
  return {
    method: 'commons-file-title-and-nearby-geotag',
    verification: 'automated',
    fileTitle,
    matchedLabel: place.name,
    photoLat: camera.lat,
    photoLon: camera.lon,
    distanceMeters: distance,
    sourceUrl: 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(fileTitle.replace(/ /g, '_'))
  };
}


const WIKIPEDIA_RADIUS_METERS = 2000;

/**
 * A Wikipedia page is a publication candidate only when its subject is the
 * same distinctly named, geolocated destination. Search rank is never proof.
 * Parenthetical disambiguators must identify the place's own region.
 */
export function matchWikipediaArticleToDestination(place, page, language) {
  if (!place || typeof place.name !== 'string'
    || !hasValidCoordinates(place.lat, place.lon)
    || !['id', 'en'].includes(language)
    || !page || page.ns !== 0 || !Number.isSafeInteger(page.pageid)
    || typeof page.title !== 'string') return undefined;
  const name = normalizeName(place.name);
  if (!name || name.length < 8 || GENERIC_NAMES.has(name)
    || !name.split(' ').some(word => word.length >= 3
      && /\p{L}/u.test(word) && !GENERIC_WORDS.has(word))) return undefined;
  const match = page.title.match(/^(.*?)\s+\(([^()]+)\)$/);
  const title = match ? match[1] : page.title;
  if (normalizeName(title) !== name) return undefined;
  if (match) {
    const region = normalizeName([place.sourceDistrict, place.sourceProvince].filter(Boolean).join(' '));
    const qualifier = normalizeName(match[2]);
    if (!qualifier || !(' ' + region + ' ').includes(' ' + qualifier + ' ')) return undefined;
  }
  const coordinates = (page.coordinates ?? []).filter(point =>
    hasValidCoordinates(point.lat, point.lon));
  if (coordinates.length !== 1) return undefined;
  const point = coordinates[0];
  const distance = distanceMeters(place.lat, place.lon, point.lat, point.lon);
  if (distance > WIKIPEDIA_RADIUS_METERS) return undefined;
  return {
    method: 'wikipedia-exact-article-and-coordinate', verification: 'automated',
    articleLanguage: language, articleId: page.pageid, articleTitle: page.title,
    matchedLabel: place.name, articleLat: point.lat, articleLon: point.lon,
    distanceMeters: distance,
    sourceUrl: 'https://' + language + '.wikipedia.org/wiki/'
      + encodeURIComponent(page.title.replace(/ /g, '_'))
  };
}
