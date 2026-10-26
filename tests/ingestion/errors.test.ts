import assert from 'node:assert/strict';
import { test } from 'node:test';
import { errorPresentation, reportUnexpectedError } from '../../src/lib/errors.ts';

const presentationCases: Array<[number, string, string, boolean]> = [
  [404, '404', '404', false],
  [401, '403', '404', false],
  [403, '403', '404', false],
  [429, '429', '500', true],
  [503, '503', '500', true],
  [500, '500', '500', true],
  [502, '500', '500', true],
  [418, 'other', '404', false]
];

for (const [status, group, illustration, retry] of presentationCases) {
  test(`errorPresentation maps ${status} to the ${group} group`, () => {
    const presentation = errorPresentation(status);
    assert.equal(presentation.group, group);
    assert.equal(presentation.illustration, illustration);
    assert.equal(presentation.retry, retry);
  });
}

test('client errors return a safe title without an incident id', () => {
  const result = reportUnexpectedError(new Error('secret token abc123'), 404, 'client');
  assert.equal(result.incidentId, undefined);
  assert.equal(result.message, errorPresentation(404).fallbackTitle);
});

test('server errors return an incident id and never leak the raw error message', () => {
  const logged: unknown[][] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => { logged.push(args); };
  try {
    const result = reportUnexpectedError(new TypeError('password=hunter2'), 500, 'server');
    assert.match(result.incidentId ?? '', /^[0-9a-f-]{36}$/);
    assert.ok(!result.message.includes('hunter2'));
    assert.ok(!JSON.stringify(logged).includes('hunter2'));
    assert.ok(JSON.stringify(logged).includes('TypeError'));
  } finally {
    console.error = originalConsoleError;
  }
});

test('custom error subclasses are logged as UnknownError', () => {
  class SecretError extends Error { constructor() { super('x'); this.name = 'SecretError'; } }
  const logged: unknown[][] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => { logged.push(args); };
  try {
    reportUnexpectedError(new SecretError(), 500, 'client');
    assert.ok(JSON.stringify(logged).includes('UnknownError'));
    assert.ok(!JSON.stringify(logged).includes('SecretError'));
  } finally {
    console.error = originalConsoleError;
  }
});
