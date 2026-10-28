import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../../src/service-worker.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;

for (const scenario of [
  { name: 'enabled', enabled: true, fail: false, shown: 1, warnings: 0 },
  { name: 'disabled', enabled: false, fail: false, shown: 0, warnings: 0 },
  { name: 'unreadable settings', enabled: true, fail: true, shown: 0, warnings: 1 }
]) {
  test(`push delivery respects ${scenario.name} notification preferences`, async () => {
    const handlers = new Map();
    const shown = [];
    const warnings = [];
    const notification = { id: 'test-warning', title: 'Test warning', body: 'Test body', url: 'https://www.bmkg.go.id/', source: 'bmkg', expiresAt: '2099-01-01T00:00:00Z' };
    vm.runInNewContext(compiled, {
      exports: {},
      console: { warn: (...args) => warnings.push(args) },
      self: {
        addEventListener: (name, handler) => handlers.set(name, handler),
        registration: { showNotification: async (...args) => shown.push(args) }
      },
      require: name => {
        if (name === '$service-worker') return { build: [], files: [], version: 'test' };
        if (name.endsWith('notification-payload')) return { parseNotification: () => notification };
        if (name.endsWith('cache-policy')) return { isDeferredAtlasAsset: () => false };
        if (name.endsWith('notification-settings')) return { readNotificationsEnabled: async () => {
          if (scenario.fail) throw Error('Storage unavailable');
          return scenario.enabled;
        } };
        throw Error('Unexpected service worker import: ' + name);
      }
    });
    let completion;
    handlers.get('push')({ data: { json: () => ({}) }, waitUntil: promise => { completion = promise; } });
    await completion;
    assert.deepEqual({ shown: shown.length, warnings: warnings.length }, { shown: scenario.shown, warnings: scenario.warnings });
  });
}
