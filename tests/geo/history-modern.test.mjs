import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HISTORY_PRESENT_YEAR,
  MODERN_MILESTONES,
  MODERN_STATUS_PHASES,
  modernMilestonesAt,
  modernTerritorialStatusAt
} from '../../src/lib/data/history-modern.ts';

const regions = ['western-new-guinea', 'timor-leste'];

for (const region of regions) {
  test(`${region} annual status phases cover 1945 through the present without gaps or overlaps`, () => {
    const phases = MODERN_STATUS_PHASES.filter(phase => phase.region === region).sort((a, b) => a.annualFrom - b.annualFrom);
    assert.ok(phases.length >= 2);
    assert.equal(phases[0].annualFrom, 1945);
    assert.equal(phases.at(-1).annualTo, HISTORY_PRESENT_YEAR);
    for (let index = 0; index < phases.length; index++) {
      const phase = phases[index];
      assert.ok(phase.annualFrom <= phase.annualTo, phase.id);
      if (index > 0) assert.equal(phase.annualFrom, phases[index - 1].annualTo + 1, `${region} gap or overlap before ${phase.id}`);
      assert.equal(modernTerritorialStatusAt(region, phase.annualFrom)?.id, phase.id);
      assert.equal(modernTerritorialStatusAt(region, phase.annualTo)?.id, phase.id);
    }
  });
}

test('exact-dated phase intervals are contiguous across every administrative transition', () => {
  const transitions = [
    ['western-new-guinea-dutch-administration', 'western-new-guinea-untea-administration'],
    ['western-new-guinea-untea-administration', 'western-new-guinea-indonesian-administration'],
    ['timor-leste-portuguese-administration', 'timor-leste-indonesian-occupation'],
    ['timor-leste-indonesian-occupation', 'timor-leste-un-transition-administration'],
    ['timor-leste-un-transition-administration', 'timor-leste-independent-state']
  ];
  for (const [beforeId, afterId] of transitions) {
    const before = MODERN_STATUS_PHASES.find(phase => phase.id === beforeId);
    const after = MODERN_STATUS_PHASES.find(phase => phase.id === afterId);
    assert.ok(before?.to && after?.from);
    const nextDay = new Date(`${before.to}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    assert.equal(after.from, nextDay.toISOString().slice(0, 10), `${beforeId} -> ${afterId}`);
  }
});

test('annual views apply the documented post-transition convention at key boundaries', () => {
  const cases = [
    ['western-new-guinea', 1945, 'western-new-guinea-dutch-administration'],
    ['western-new-guinea', 1949, 'western-new-guinea-dutch-administration'],
    ['western-new-guinea', 1961, 'western-new-guinea-dutch-administration'],
    ['western-new-guinea', 1962, 'western-new-guinea-untea-administration'],
    ['western-new-guinea', 1963, 'western-new-guinea-indonesian-administration'],
    ['western-new-guinea', 1969, 'western-new-guinea-indonesian-administration'],
    ['western-new-guinea', HISTORY_PRESENT_YEAR, 'western-new-guinea-indonesian-administration'],
    ['timor-leste', 1945, 'timor-leste-portuguese-administration'],
    ['timor-leste', 1974, 'timor-leste-portuguese-administration'],
    ['timor-leste', 1975, 'timor-leste-indonesian-occupation'],
    ['timor-leste', 1976, 'timor-leste-indonesian-occupation'],
    ['timor-leste', 1998, 'timor-leste-indonesian-occupation'],
    ['timor-leste', 1999, 'timor-leste-un-transition-administration'],
    ['timor-leste', 2001, 'timor-leste-un-transition-administration'],
    ['timor-leste', 2002, 'timor-leste-independent-state'],
    ['timor-leste', HISTORY_PRESENT_YEAR, 'timor-leste-independent-state']
  ];
  for (const [region, year, expectedId] of cases) {
    assert.equal(modernTerritorialStatusAt(region, year)?.id, expectedId, `${region} ${year}`);
  }
});

test('exact status intervals preserve transition dates rather than rounding to years', () => {
  const phase = id => MODERN_STATUS_PHASES.find(item => item.id === id);
  assert.equal(phase('western-new-guinea-dutch-administration')?.from, null);
  assert.equal(phase('western-new-guinea-dutch-administration')?.fromPrecision, 'year');
  assert.equal(phase('western-new-guinea-dutch-administration')?.annualFrom, 1945);
  assert.match(phase('western-new-guinea-dutch-administration')?.note.en ?? '', /does not document a handover on 1 January/);
  assert.equal(phase('western-new-guinea-dutch-administration')?.to, '1962-09-30');
  assert.equal(phase('western-new-guinea-untea-administration')?.from, '1962-10-01');
  assert.equal(phase('western-new-guinea-untea-administration')?.to, '1963-04-30');
  assert.equal(phase('western-new-guinea-indonesian-administration')?.from, '1963-05-01');
  assert.equal(phase('timor-leste-portuguese-administration')?.from, null);
  assert.equal(phase('timor-leste-portuguese-administration')?.fromPrecision, 'year');
  assert.equal(phase('timor-leste-portuguese-administration')?.annualFrom, 1945);
  assert.equal(phase('timor-leste-portuguese-administration')?.to, '1975-12-06');
  assert.equal(phase('timor-leste-indonesian-occupation')?.from, '1975-12-07');
  assert.equal(phase('timor-leste-indonesian-occupation')?.to, '1999-10-24');
  assert.equal(phase('timor-leste-un-transition-administration')?.from, '1999-10-25');
  assert.equal(phase('timor-leste-un-transition-administration')?.to, '2002-05-19');
  assert.equal(phase('timor-leste-independent-state')?.from, '2002-05-20');
});

test('milestones preserve declaration, transfer, occupation, disputed process, withdrawal and independence as separate events', () => {
  const dates = new Map(MODERN_MILESTONES.map(event => [event.id, event.date]));
  assert.equal(dates.get('indonesia-proclaimed-independence'), '1945-08-17');
  assert.equal(dates.get('dutch-transfer-federal-indonesia'), '1949-12-27');
  assert.equal(dates.get('untea-begins-west-new-guinea-administration'), '1962-10-01');
  assert.equal(dates.get('untea-transfers-west-new-guinea-to-indonesia'), '1963-05-01');
  assert.equal(dates.get('west-new-guinea-act-of-free-choice'), '1969-07-14');
  assert.equal(dates.get('indonesia-invades-east-timor'), '1975-12-07');
  assert.equal(dates.get('indonesia-annexes-east-timor-unrecognized'), '1976-07-17');
  assert.equal(dates.get('east-timor-rejects-autonomy'), '1999-08-30');
  assert.equal(dates.get('untaet-begins-east-timor-administration'), '1999-10-25');
  assert.equal(dates.get('indonesian-withdrawal-east-timor-complete'), '1999-10-31');
  assert.equal(dates.get('timor-leste-independence'), '2002-05-20');
  assert.equal(modernMilestonesAt(1999).map(event => event.id).join(','), 'east-timor-rejects-autonomy,untaet-begins-east-timor-administration,indonesian-withdrawal-east-timor-complete');
  assert.equal(modernMilestonesAt(2002).find(event => event.id === 'timor-leste-independence')?.date, '2002-05-20');
});

test('disputed events do not imply recognized annexation or an ordinary provincial secession', () => {
  const annexation = MODERN_MILESTONES.find(event => event.id === 'indonesia-annexes-east-timor-unrecognized');
  const independence = MODERN_MILESTONES.find(event => event.id === 'timor-leste-independence');
  const withdrawal = MODERN_MILESTONES.find(event => event.id === 'indonesian-withdrawal-east-timor-complete');
  const act = MODERN_MILESTONES.find(event => event.id === 'west-new-guinea-act-of-free-choice');
  assert.match(annexation.note.en, /did not recognize/i);
  assert.match(annexation.note.id, /tidak mengakuinya/i);
  assert.equal(independence.kind, 'independence');
  assert.equal(withdrawal.date, '1999-10-31');
  assert.notEqual(withdrawal.date, independence.date);
  assert.match(act.note.en, /remains disputed/i);
  assert.match(act.note.en, /did not determine that the process was fair/i);
});

test('every phase and milestone has stable IDs, translation keys, bilingual notes and HTTPS sources', () => {
  for (const records of [MODERN_STATUS_PHASES, MODERN_MILESTONES]) {
    const ids = records.map(record => record.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const record of records) {
      assert.match(record.translationKey, /^history_/);
      if ('date' in record) assert.match(record.date, /^\d{4}-\d{2}-\d{2}$/);
      if ('from' in record) {
        assert.ok(['day', 'year'].includes(record.fromPrecision));
        if (record.from) assert.match(record.from, /^\d{4}-\d{2}-\d{2}$/);
        if (record.to) assert.match(record.to, /^\d{4}-\d{2}-\d{2}$/);
      }
      assert.ok(record.note.en.trim());
      assert.ok(record.note.id.trim());
      assert.ok(record.sources.length > 0);
      assert.ok(record.sources.every(source => source.startsWith('https://')), record.id);
    }
  }
});

test('invalid years return no annual status', () => {
  for (const year of [1944, 1945.5, NaN, HISTORY_PRESENT_YEAR + 1]) {
    assert.equal(modernTerritorialStatusAt('timor-leste', year), undefined);
  }
  assert.equal(modernTerritorialStatusAt('timor-leste', 1999.5), undefined);
  assert.equal(modernMilestonesAt(1999.5).length, 0);
  assert.equal(modernMilestonesAt(1999).length, 3);
});
