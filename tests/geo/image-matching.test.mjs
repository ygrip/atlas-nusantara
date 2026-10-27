import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSubjectIndex, matchDestination } from '../../scripts/destinations/image-matching.mjs';

function subject(id, labels, lat = -8.0219, lon = 112.9524, imageTitle = 'File:Bromo.jpg') {
  return { id, labels, lat, lon, imageTitle };
}

function destination(name = 'Bromo', lat = -8.0219, lon = 112.9524) {
  return { id: 'sisparnas-1', name, lat, lon, provinceCode: '35' };
}

test('matches exact normalized Indonesian names with nearby Wikidata subject coordinates', () => {
  const index = buildSubjectIndex([
    subject('Q123', ['Gunung Bromo', 'gunung—Bromo', 'Gunung Bromo'])
  ]);
  const match = matchDestination(destination(' GUNUNG  Bromo! '), index);

  assert.ok(match);
  assert.equal(match.subject.id, 'Q123');
  assert.equal(match.evidence.method, 'exact-name-and-subject-coordinate');
  assert.equal(match.evidence.verification, 'automated');
  assert.equal(match.evidence.matchedLabel, 'Gunung Bromo');
  assert.equal(match.evidence.sourceUrl, 'https://www.wikidata.org/wiki/Q123');
  assert.ok(match.evidence.distanceMeters <= 250);
});

test('normalizes accented Unicode labels without fuzzy matching', () => {
  const index = buildSubjectIndex([subject('Q234', ['Café Puncak'], -6.2, 106.8, 'File:Cafe.jpg')]);
  assert.equal(matchDestination(destination('CAFE Puncak', -6.2, 106.8), index)?.subject.id, 'Q234');
  assert.equal(matchDestination(destination('Café Puncak Timur', -6.2, 106.8), index), undefined);
});

test('rejects source/subject coordinates outside the 250-meter radius', () => {
  const index = buildSubjectIndex([subject('Q345', ['Bromo'], -8.0219, 112.9524)]);
  assert.equal(matchDestination(destination('Bromo', -8.0319, 112.9524), index), undefined);
});

test('rejects generic names and destinations without valid coordinates', () => {
  const index = buildSubjectIndex([
    subject('Q456', ['Pantai']), subject('Q457', ['Air Terjun']),
    subject('Q458', ['Museum']), subject('Q459', ['Kolam Renang'])
  ]);
  for (const name of ['Pantai', 'Air Terjun', 'Museum', 'Kolam Renang']) {
    assert.equal(matchDestination(destination(name), index), undefined);
  }
  assert.equal(matchDestination(destination('Pantai Kuta'), index), undefined);
  assert.equal(matchDestination(destination('Bromo', undefined, 112.9524), index), undefined);
  assert.equal(matchDestination(destination('Bromo', -8.0219, NaN), index), undefined);
});

test('rejects invalid subject coordinates, entity IDs, and unsafe Commons titles', () => {
  const index = buildSubjectIndex([
    subject('Q560', ['Bromo'], NaN, 112.9524),
    subject('Q561', ['Bromo'], -8.0219, 112.9524, 'File: <script>.jpg'),
    subject('Q0', ['Bromo']), subject('not-a-QID', ['Bromo'])
  ]);
  assert.equal(matchDestination(destination(), index), undefined);
});

test('rejects distinct nearby Wikidata entities instead of selecting the nearest', () => {
  const index = buildSubjectIndex([
    subject('Q670', ['Bromo']),
    subject('Q671', ['Bromo'], -8.022, 112.9524)
  ]);
  assert.equal(matchDestination(destination(), index), undefined);
});

test('deduplicates aliases and repeated records for the same Wikidata entity', () => {
  const index = buildSubjectIndex([
    subject('Q780', ['Goa Jomblang', 'Jomblang Cave', 'Goa Jomblang']),
    subject('Q780', ['Goa Jomblang'])
  ]);
  const match = matchDestination(destination('Jomblang Cave'), index);
  assert.equal(match?.subject.id, 'Q780');
  assert.equal(match.evidence.matchedLabel, 'Jomblang Cave');
});
