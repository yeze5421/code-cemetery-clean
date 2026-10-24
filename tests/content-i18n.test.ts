import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localizeProject } from '../src/i18n/content';
import { DEMO_PROJECTS, DEFAULT_SETTINGS } from '../src/data/demo';
import { epitaphGenerator } from '../src/plugins/epitaphs/humor';
import {
  annualPngExporter,
  formatPosterDate,
  wrapPosterText,
} from '../src/plugins/exporters/annual-png';
import { classifyProjects } from '../src/core/service';
import { PluginRegistry } from '../src/core/registry';
import type { EpitaphStyle, Project } from '../src/core/types';

test('demo localization produces English display copies without changing persisted fields', () => {
  const original = structuredClone(DEMO_PROJECTS[0]);
  const view = localizeProject(original, 'en');
  assert.notEqual(view, original);
  assert.match(view.epitaph, /to-do list/);
  assert.equal(view.name, original.name);
  assert.equal(view.createdAt, original.createdAt);
  assert.deepEqual(original, DEMO_PROJECTS[0]);
  assert.deepEqual(localizeProject(original, 'zh-CN'), original);
});

test('custom demo fields and real repository content remain untouched by display localization', () => {
  const edited = {
    ...DEMO_PROJECTS[0],
    epitaph: '我的专属墓志铭',
    description: 'A custom description',
  };
  const view = localizeProject(edited, 'en');
  assert.equal(view.epitaph, edited.epitaph);
  assert.equal(view.description, edited.description);
  assert.equal(view.cause, 'Too many ideas, not enough hours');
  const actual: Project = { ...DEMO_PROJECTS[0], source: 'local' };
  assert.deepEqual(localizeProject(actual, 'en'), actual);
});

test('English epitaphs support every style and do not invent an unknown commit count', () => {
  for (const style of ['witty', 'gentle', 'poetic'] as EpitaphStyle[]) {
    const copies = Array.from({ length: 5 }, (_, variant) =>
      epitaphGenerator.generate({ ...DEMO_PROJECTS[0], commits: null }, style, variant, 'en'),
    );
    assert.ok(copies.every((copy) => !/[\u3400-\u9fff]/.test(copy.epitaph + copy.cause)));
    assert.ok(copies.some((copy) => copy.epitaph.includes('commit count is still unknown')));
    assert.ok(copies.every((copy) => !/commit \d/.test(copy.epitaph)));
    assert.deepEqual(
      epitaphGenerator.generate(DEMO_PROJECTS[0], style),
      epitaphGenerator.generate(DEMO_PROJECTS[0], style, 0, 'zh-CN'),
    );
  }
});

test('domain generation accepts locale while preserving existing memorial writing', () => {
  const registry = new PluginRegistry().register(epitaphGenerator);
  const fresh = { ...DEMO_PROJECTS[0], epitaph: '', cause: '' };
  const [english] = classifyProjects(
    [fresh],
    DEFAULT_SETTINGS,
    registry,
    new Date('2026-10-23'),
    'en',
  );
  assert.ok(!/[\u3400-\u9fff]/.test(english.epitaph + english.cause));
  const [existing] = classifyProjects(
    [DEMO_PROJECTS[0]],
    DEFAULT_SETTINGS,
    registry,
    undefined,
    'en',
  );
  assert.equal(existing.epitaph, DEMO_PROJECTS[0].epitaph);
});

test('English poster wrapping keeps words together and handles oversized tokens', () => {
  const measure = {
    measureText: (text: string) => ({ width: Array.from(text).length }) as TextMetrics,
  };
  assert.deepEqual(wrapPosterText(measure, 'Hello wonderful world', 15, 'en'), [
    'Hello wonderful',
    'world',
  ]);
  assert.deepEqual(wrapPosterText(measure, 'Superlongtoken', 5, 'en'), ['Super', 'longt', 'oken']);
  assert.deepEqual(wrapPosterText(measure, '春天还会来', 3, 'zh-CN'), ['春天还', '会来']);
  assert.equal(formatPosterDate('invalid', 'en'), 'Unknown date');
  assert.equal(formatPosterDate('invalid'), '日期未知');
});

test('English PNG renders translated demo content and labels without Chinese UI text', async () => {
  const output: string[] = [];
  const ctx: Record<string, unknown> = {
    measureText: (text: string) => ({ width: Array.from(text).length * 10 }),
    fillText: (text: string) => output.push(text),
  };
  for (const method of [
    'beginPath',
    'moveTo',
    'lineTo',
    'stroke',
    'quadraticCurveTo',
    'closePath',
    'fill',
    'save',
    'restore',
    'translate',
    'scale',
    'arc',
    'roundRect',
    'fillRect',
    'strokeRect',
  ])
    ctx[method] = () => {};
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      fonts: { ready: Promise.resolve() },
      createElement: () => ({
        getContext: () => ctx,
        toBlob: (callback: (blob: Blob) => void) =>
          callback(new Blob(['png'], { type: 'image/png' })),
      }),
    },
  });
  try {
    const blob = await annualPngExporter.export({
      year: 'all',
      ownerName: DEFAULT_SETTINGS.ownerName,
      projects: DEMO_PROJECTS,
      locale: 'en',
    });
    assert.equal(blob.type, 'image/png');
    assert.ok(output.includes('My Project Graveyard'));
    assert.ok(output.includes('Caretaker: An anonymous developer'));
    assert.ok(output.includes('DEMO DATA · FOR EXPLORATION'));
    assert.ok(
      output.every((text) => !/[\u3400-\u9fff]/.test(text)),
      output.join('\n'),
    );
  } finally {
    if (original) Object.defineProperty(globalThis, 'document', original);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
