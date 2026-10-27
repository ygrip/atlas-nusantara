import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyCommonsPhoto } from '../../scripts/destinations/image-license.mjs';

const retrievedAt = '2026-01-18T12:00:00.000Z';
const licenseUrl = 'https://creativecommons.org/licenses/by/4.0/';

function commonsPage(overrides = {}) {
  return {
    title: 'File:Example waterfall.jpg',
    pageid: 12345,
    imagerepository: 'local',
    ...overrides,
    imageinfo: [{
      thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Example.jpg/640px-Example.jpg',
      descriptionurl: 'https://commons.wikimedia.org/wiki/File:Example_waterfall.jpg',
      mime: 'image/jpeg', mediatype: 'BITMAP', timestamp: '2025-06-01T10:20:30Z',
      sha1: '0123456789abcdef0123456789abcdef01234567',
      extmetadata: {
        LicenseShortName: { value: 'CC BY 4.0' }, LicenseUrl: { value: licenseUrl },
        Artist: { value: '<a href="https://example.org">Rini &amp; Budi</a>' },
        NonFree: { value: 'false' }, Restrictions: { value: '' }
      },
      ...(overrides.imageinfo?.[0] ?? {})
    }]
  };
}

test('Commons file metadata accepts a supported license and preserves clean credit and evidence', () => {
  const result = verifyCommonsPhoto(commonsPage(), retrievedAt);
  assert.deepEqual(result.image, {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Example.jpg/640px-Example.jpg',
    descriptionUrl: 'https://commons.wikimedia.org/wiki/File:Example_waterfall.jpg',
    credit: 'Rini & Budi', license: 'CC-BY-4.0', licenseUrl, reviewedAt: retrievedAt
  });
  assert.deepEqual(result.evidence, {
    fileTitle: 'File:Example waterfall.jpg', pageId: 12345,
    fileTimestamp: '2025-06-01T10:20:30Z', fileSha1: '0123456789abcdef0123456789abcdef01234567',
    metadataRetrievedAt: retrievedAt, licenseMetadataUrl: licenseUrl, creator: 'Rini & Budi', attribution: '',
    licenseReview: 'commons-file-metadata-v1'
  });
});

test('accepts the official Commons thumbnail CDN returned by current imageinfo responses', () => {
  const page = commonsPage();
  page.imageinfo[0].thumburl = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Example.jpg/960px-Example.jpg';
  const result = verifyCommonsPhoto(page, retrievedAt);
  assert.equal(result?.image.url, page.imageinfo[0].thumburl);
});

test('Commons custom attribution is retained alongside the creator', () => {
  const page = commonsPage();
  page.imageinfo[0].extmetadata.Attribution = { value: 'Courtesy of <b>Example Archive</b>' };
  const result = verifyCommonsPhoto(page, retrievedAt);
  assert.equal(result.image.credit, 'Rini & Budi · Courtesy of Example Archive');
  assert.equal(result.evidence.attribution, 'Courtesy of Example Archive');
});

for (const [name, change] of [
  ['non-commercial license', info => { info.extmetadata.LicenseShortName.value = 'CC BY-NC 4.0'; }],
  ['unknown license', info => { info.extmetadata.LicenseShortName.value = 'Unknown'; }],
  ['license URL mismatch', info => { info.extmetadata.LicenseUrl.value = 'https://creativecommons.org/licenses/by-sa/4.0/'; }],
  ['license URL on a misleading host', info => { info.extmetadata.LicenseUrl.value = 'https://creativecommons.org.example/licenses/by/4.0/'; }],
  ['restricted file', info => { info.extmetadata.Restrictions.value = 'Non-free use only'; }],
  ['non-free file', info => { info.extmetadata.NonFree.value = 'true'; }],
  ['missing creator credit', info => { info.extmetadata.Artist.value = '  '; }],
  ['untrusted image host', info => { info.thumburl = 'https://images.example.org/example.jpg'; }],
  ['missing file revision metadata', info => { delete info.sha1; }]
]) {
  test(`Commons verification rejects ${name}`, () => {
    const page = commonsPage();
    change(page.imageinfo[0]);
    assert.equal(verifyCommonsPhoto(page, retrievedAt), undefined);
  });
}

test('Commons verification rejects missing file identity and invalid retrieval time', () => {
  const page = commonsPage();
  delete page.pageid;
  assert.equal(verifyCommonsPhoto(page, retrievedAt), undefined);
  assert.equal(verifyCommonsPhoto(commonsPage(), 'not-a-timestamp'), undefined);
});
