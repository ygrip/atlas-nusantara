import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { commonsFileTitle, registrySubjects, loadSubjectRegistry, loadCommonsPages } from '../../scripts/destinations/image-discovery.mjs';

function binding(id, label, coordinate = 'Point(110 -7)', image = 'Lake.jpg') {
  return { item: { value: 'http://www.wikidata.org/entity/' + id }, label: { value: label },
    coordinates: { value: coordinate }, image: { value: 'http://commons.wikimedia.org/wiki/Special:FilePath/' + image } };
}

test('normalizes Commons filenames and rejects non-Commons or unsafe source URLs', () => {
  assert.equal(commonsFileTitle('http://commons.wikimedia.org/wiki/Special:FilePath/Lake_Toba.jpg'), 'File:Lake Toba.jpg');
  assert.equal(commonsFileTitle('https://example.org/wiki/Special:FilePath/Lake.jpg'), undefined);
  assert.equal(commonsFileTitle('https://commons.wikimedia.org/wiki/Special:FilePath/%3Cscript%3E.jpg'), undefined);
});

test('deduplicates subject aliases but quarantines conflicting subject coordinates', () => {
  const result = registrySubjects([binding('Q1', 'Danau Contoh'), binding('Q1', 'Lake Example'),
    binding('Q2', 'Ambiguous'), binding('Q2', 'Ambiguous', 'Point(111 -7)')]);
  assert.equal(result.subjects.length, 1);
  assert.deepEqual(result.subjects[0].labels, ['Danau Contoh', 'Lake Example']);
  assert.equal(result.ambiguousCoordinates, 1);
});

test('paginates the bulk registry completely and resumes without repeating network requests', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'nusantara-image-registry-'));
  let requests = 0;
  const rows = [binding('Q1', 'Danau Pertama'), binding('Q2', 'Danau Kedua'), binding('Q3', 'Danau Ketiga')];
  const fetcher = async url => {
    requests++;
    const query = new URL(url).searchParams.get('query');
    const offset = Number(query.match(/OFFSET (\d+)/)[1]);
    return Response.json({ results: { bindings: rows.slice(offset, offset + 2) } });
  };
  try {
    const first = await loadSubjectRegistry(directory, { fetcher, pageSize: 2, delayMs: 0 });
    const second = await loadSubjectRegistry(directory, { fetcher, pageSize: 2, delayMs: 0 });
    assert.equal(first.subjects.length, 3);
    assert.equal(first.complete, true);
    assert.equal(requests, 4); // P18 and P373 each need two short pages.
    assert.equal(first.schemaVersion, 3);
    assert.deepEqual(new Set(first.requests.map(request => request.source)),
      new Set(['featured-photos', 'commons-categories']));
    assert.deepEqual(second, first);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('resolves Commons title redirects and retries maxlag instead of caching it as a missing image', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'nusantara-commons-metadata-'));
  let requests = 0;
  const pauses = [];
  const fetcher = async () => {
    requests++;
    if (requests === 1) return Response.json({ error: { code: 'maxlag', info: 'Please wait' } });
    return Response.json({ query: { normalized: [{ from: 'File:old_name.jpg', to: 'File:Old name.jpg' }],
      redirects: [{ from: 'File:Old name.jpg', to: 'File:New name.jpg' }],
      pages: { 1: { pageid: 1, title: 'File:New name.jpg' } } } });
  };
  try {
    const options = { fetcher, delayMs: 0, pause: async value => { pauses.push(value); } };
    const first = await loadCommonsPages(['File:old_name.jpg'], directory, options);
    const second = await loadCommonsPages(['File:old_name.jpg'], directory, options);
    assert.equal(first.get('File:old_name.jpg').page.title, 'File:New name.jpg');
    assert.deepEqual(second, first);
    assert.equal(requests, 2);
    assert.ok(pauses.includes(5000));
  } finally { await rm(directory, { recursive: true, force: true }); }
});


test('resumes completed Wikidata pages after a timeout in the second source scan', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'atlas-wikidata-restart-'));
  let imageRequests = 0;
  let categoryRequests = 0;
  const row = binding('Q5', 'Candi Contoh');
  function fetcher(url) {
    const query = new URL(url).searchParams.get('query');
    const isCategory = query.includes('wdt:P373');
    if (isCategory) {
      categoryRequests++;
      const error = new Error('Wikidata overloaded'); error.name = 'TimeoutError'; throw error;
    }
    imageRequests++;
    return Response.json({ results: { bindings: [row] } });
  }
  try {
    const options = { fetcher, pageSize: 2, delayMs: 0, timeoutMs: 50, pause: async () => {} };
    await assert.rejects(loadSubjectRegistry(directory, options), /exhausted 4 attempts/);
    assert.equal(imageRequests, 1);
    assert.equal(categoryRequests, 4);
    const resumed = await loadSubjectRegistry(directory, {
      ...options,
      fetcher: url => {
        if (new URL(url).searchParams.get('query').includes('wdt:P373'))
          return Response.json({ results: { bindings: [] } });
        throw Error('Completed P18 page must be read from disk');
      }
    });
    assert.equal(resumed.complete, true);
    assert.equal(resumed.subjects.length, 1);
    assert.equal(imageRequests, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
