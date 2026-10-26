// Hazard data pipeline (CLI): collect -> clean -> classify -> geocode -> merge with stored data -> dedupe -> validate -> write.
// Each source has its own interval (sources/registry.mjs). With --due only the sources whose interval elapsed run;
// the others keep their stored events, so the snapshot is re-aggregated rather than rebuilt.
// Usage: node --experimental-strip-types scripts/pipeline/run.mjs [--due] [--only=bnpb,antara] [--skip=gdelt] [--out=path] [--fresh]
// The browser reads only the written file. A failing source is reported and keeps its stored events; the run fails only if every selected source fails.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { buildSnapshot, fitSnapshot } from './lib/aggregate.mjs';
import { buildGazetteer } from './lib/gazetteer.mjs';
import { isDue, reaggregate, retentionMap } from './lib/schedule.mjs';
import { BMKG_CAP, CAP_INTERVAL_MINUTES, collectBmkgCap } from './sources/bmkg-cap.mjs';
import { EVENT_SOURCES } from './sources/registry.mjs';

const DEFAULT_OUTPUT = 'static/data/observations/hazards.json';

function parseArguments(argv) {
  const options = { only: undefined, skip: [], out: DEFAULT_OUTPUT, due: false, fresh: false };
  for (const argument of argv) {
    if (argument.startsWith('--only=')) options.only = argument.slice(7).split(',');
    if (argument.startsWith('--skip=')) options.skip = argument.slice(7).split(',');
    if (argument.startsWith('--out=')) options.out = argument.slice(6);
    if (argument === '--due') options.due = true;
    if (argument === '--fresh') options.fresh = true;
  }
  return options;
}

async function readPrevious(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return undefined; }
}

function previousStatus(previous, id) {
  return previous?.pipeline?.sources?.find(status => status.id === id);
}

function isSelected(id, options) {
  if (options.skip.includes(id)) return false;
  if (options.only) return options.only.includes(id);
  return true;
}

function shouldRun(id, intervalMinutes, previous, options, now) {
  if (!isSelected(id, options)) return false;
  if (!options.due) return true;
  return isDue(previousStatus(previous, id)?.lastSuccessAt, intervalMinutes, now);
}

async function runSource(source, context) {
  const startedAt = Date.now();
  const status = { id: source.meta.id, name: source.meta.name, status: 'ok', fetched: 0, kept: 0, rejected: {}, durationMs: 0 };
  let events = [];
  try {
    const result = await source.run(context);
    events = result.events;
    status.fetched = result.fetched;
    status.rejected = result.rejected;
    status.kept = events.length;
    status.lastSuccessAt = context.fetchedAt;
    if (result.warnings?.length) status.warnings = result.warnings;
  } catch (error) {
    status.status = 'failed';
    status.error = String(error.message).slice(0, 200);
  }
  status.durationMs = Date.now() - startedAt;
  return { status, events };
}

/** A source that did not run (not due or skipped) keeps its previous status entry and stored events. */
function skippedStatus(source, previous) {
  const before = previousStatus(previous, source.meta.id);
  if (before) return { ...before, skipped: true };
  return { id: source.meta.id, name: source.meta.name, status: 'not-run', fetched: 0, kept: 0, rejected: {} };
}

async function writeAtomically(path, text) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path + '.tmp', text);
  await rename(path + '.tmp', path);
}

async function collectWarnings(context, previous, options) {
  const intervalDue = shouldRun(BMKG_CAP.id, CAP_INTERVAL_MINUTES, previous, options, context.now);
  const stored = previous?.warnings?.items ?? [];
  if (!intervalDue) return { warnings: stored, fetched: 0, rejected: {}, status: 'ok', skipped: true, lastSuccessAt: previousStatus(previous, BMKG_CAP.id)?.lastSuccessAt };
  try {
    const result = await collectBmkgCap(context);
    return { ...result, status: 'ok', lastSuccessAt: context.fetchedAt };
  } catch (error) {
    return { warnings: stored, fetched: 0, rejected: {}, status: 'failed', error: String(error.message).slice(0, 200), lastSuccessAt: previousStatus(previous, BMKG_CAP.id)?.lastSuccessAt };
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const now = Date.now();
  const fetchedAt = new Date(now).toISOString();
  let previous;
  if (!options.fresh) previous = await readPrevious(options.out);
  const context = { gazetteer: await buildGazetteer(), now, fetchedAt };

  const toRun = EVENT_SOURCES.filter(source => shouldRun(source.meta.id, source.intervalMinutes, previous, options, now));
  const results = await Promise.all(toRun.map(source => runSource(source, context)));
  const warningResult = await collectWarnings(context, previous, options);

  const attempted = results.length + (warningResult.skipped ? 0 : 1);
  const failures = results.filter(result => result.status.status === 'failed').length + (warningResult.status === 'failed' ? 1 : 0);
  if (attempted > 0 && failures === attempted) throw Error('Every attempted hazard source failed; keeping the previous snapshot.');

  const storedEvents = previous?.events?.items ?? [];
  const freshEvents = results.flatMap(result => result.events);
  const events = reaggregate(storedEvents, freshEvents, retentionMap(EVENT_SOURCES), now);

  const statuses = EVENT_SOURCES.map(source => {
    const ran = results.find(result => result.status.id === source.meta.id);
    if (ran) return ran.status;
    return skippedStatus(source, previous);
  });
  statuses.push({
    id: BMKG_CAP.id, name: BMKG_CAP.name, status: warningResult.status, fetched: warningResult.fetched, kept: warningResult.warnings.length,
    rejected: warningResult.rejected, lastSuccessAt: warningResult.lastSuccessAt, ...(warningResult.error ? { error: warningResult.error } : {}), ...(warningResult.skipped ? { skipped: true } : {})
  });

  const aggregated = buildSnapshot({
    fetchedAt,
    warnings: {
      source: BMKG_CAP.name, sourceUrl: BMKG_CAP.url, termsUrl: BMKG_CAP.termsUrl, attribution: BMKG_CAP.attribution,
      coverage: warningResult.warnings.length + ' active.', items: warningResult.warnings
    },
    sourceMetas: EVENT_SOURCES.filter(source => isSelected(source.meta.id, options)).map(source => source.meta),
    events, statuses
  });
  const { snapshot, text } = fitSnapshot(aggregated);
  await writeAtomically(options.out, text);
  for (const status of statuses) {
    const tag = status.skipped ? ' (not due)' : '';
    console.log(status.id.padEnd(12), String(status.status).padEnd(8), 'fetched', String(status.fetched).padStart(4), 'kept', String(status.kept).padStart(4), JSON.stringify(status.rejected), status.error ?? '', tag);
  }
  console.log('Wrote', snapshot.events.items.length, 'events,', warningResult.warnings.length, 'warnings to', options.out, '(' + snapshot.pipeline.mergedNews + ' duplicate news merged)');
}

await main();
