import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PluginRegistry,
  canonicalRepositoryUrl,
  classifyProjects,
  dormantDays,
  mergeProjects,
} from '../src/core/index';
import { dormancyDetector } from '../src/plugins/detectors/dormancy';
import { epitaphGenerator } from '../src/plugins/epitaphs/humor';
import { DEFAULT_SETTINGS, DEMO_PROJECTS } from '../src/data/demo';
import type { Project } from '../src/core/types';

const now = new Date('2026-10-23T00:00:00.000Z');
const project: Project = {
  ...DEMO_PROJECTS[0],
  source: 'local',
  id: 'local:a',
  epitaph: '',
  cause: '',
  lastCommitAt: '2026-07-25T00:00:00.000Z',
};

test('dormancy threshold is inclusive and future or invalid dates remain active', () => {
  assert.equal(dormantDays(project, now), 90);
  assert.equal(dormancyDetector.classify(project, DEFAULT_SETTINGS, now), 'buried');
  assert.equal(
    dormancyDetector.classify(
      { ...project, lastCommitAt: '2026-07-25T00:00:01Z' },
      DEFAULT_SETTINGS,
      now,
    ),
    'alive',
  );
  assert.equal(
    dormancyDetector.classify(
      { ...project, lastCommitAt: '2026-12-01T00:00:00Z' },
      DEFAULT_SETTINGS,
      now,
    ),
    'alive',
  );
  assert.equal(
    dormancyDetector.classify({ ...project, lastCommitAt: '' }, DEFAULT_SETTINGS, now),
    'alive',
  );
});

test('manual revival takes priority over stale dates and repository archive flag', () => {
  assert.equal(
    dormancyDetector.classify(
      { ...project, status: 'revived', manualStatus: true, archived: true },
      DEFAULT_SETTINGS,
      now,
    ),
    'revived',
  );
  assert.equal(
    dormancyDetector.classify(
      { ...project, lastCommitAt: now.toISOString(), archived: true },
      DEFAULT_SETTINGS,
      now,
    ),
    'buried',
  );
});

test('registry rejects duplicate IDs and supports disabled plugin behavior', () => {
  const registry = new PluginRegistry().register(dormancyDetector).register(epitaphGenerator);
  assert.throws(() => registry.register(dormancyDetector), /已注册/);
  assert.throws(() => registry.require('missing'), /找不到/);
  assert.equal(registry.list('detector').length, 1);
  const disabled = classifyProjects(
    [{ ...project, status: 'alive' }],
    { ...DEFAULT_SETTINGS, enabledPlugins: [] },
    registry,
    now,
  )[0];
  assert.equal(disabled.status, 'alive');
  assert.equal(disabled.epitaph, '');
  const enabled = classifyProjects([project], DEFAULT_SETTINGS, registry, now)[0];
  assert.equal(enabled.status, 'buried');
  assert.ok(enabled.epitaph);
  assert.equal(project.epitaph, '');
});

test('GitHub identity normalizes SSH and HTTPS without merging arbitrary URLs', () => {
  assert.equal(
    canonicalRepositoryUrl('git@github.com:Alice/Project.git'),
    'github.com/alice/project',
  );
  assert.equal(
    canonicalRepositoryUrl('https://github.com/ALICE/project.git/'),
    'github.com/alice/project',
  );
  assert.equal(canonicalRepositoryUrl('https://evil.test/alice/project'), undefined);
});

test('scan merge preserves user content and coalesces local and GitHub records without mutation', () => {
  const old: Project = {
    ...project,
    url: 'git@github.com:me/repo.git',
    path: 'H:\\code\\repo',
    status: 'revived',
    manualStatus: true,
    flowers: 5,
    epitaph: '我自己的墓志铭',
    cause: '自己写的原因',
  };
  const incoming: Project = {
    ...project,
    id: 'github:1',
    source: 'github',
    url: 'https://github.com/Me/Repo',
    commits: 100,
    status: 'buried',
    flowers: 0,
    name: 'repo',
  };
  const frozenOld = JSON.stringify(old);
  const result = mergeProjects([old], [incoming]);
  assert.equal(result.length, 1);
  assert.equal(result[0].commits, 100);
  assert.equal(result[0].flowers, 5);
  assert.equal(result[0].epitaph, '我自己的墓志铭');
  assert.equal(result[0].cause, '自己写的原因');
  assert.equal(result[0].status, 'revived');
  assert.equal(result[0].source, 'local');
  assert.equal(result[0].path, old.path);
  assert.equal(result[0].id, old.id);
  assert.equal(JSON.stringify(old), frozenOld);
});

test('unknown counts do not replace known counts and demo data cannot absorb actual repos', () => {
  assert.equal(
    mergeProjects([project], [{ ...project, commits: null }])[0].commits,
    project.commits,
  );
  assert.equal(
    mergeProjects([DEMO_PROJECTS[0]], [{ ...project, url: 'https://github.com/me/todo-for-real' }])
      .length,
    2,
  );
});

test('older remote history cannot erase unpushed local activity during deduplication', () => {
  const local: Project = {
    ...project,
    url: 'git@github.com:me/repo.git',
    lastCommitAt: '2026-10-22T12:00:00Z',
    commits: 12,
  };
  const remote: Project = {
    ...project,
    id: 'github:1',
    source: 'github',
    url: 'https://github.com/me/repo',
    lastCommitAt: '2026-02-01T12:00:00Z',
    commits: 3,
  };
  const result = mergeProjects([local], [remote]);
  assert.equal(result.length, 1);
  assert.equal(result[0].lastCommitAt, local.lastCommitAt);
  assert.equal(result[0].commits, 12);
  const registry = new PluginRegistry().register(dormancyDetector);
  assert.equal(classifyProjects(result, DEFAULT_SETTINGS, registry, now)[0].status, 'alive');
});

test('a new activity snapshot with unavailable count is not presented with a stale known count', () => {
  const result = mergeProjects(
    [project],
    [{ ...project, lastCommitAt: '2026-10-22T12:00:00Z', commits: null }],
  );
  assert.equal(result[0].commits, null);
});

test('epitaphs are deterministic, can vary, and never invent unknown commit counts', () => {
  const first = epitaphGenerator.generate(project, 'witty');
  assert.deepEqual(epitaphGenerator.generate(project, 'witty'), first);
  assert.notDeepEqual(epitaphGenerator.generate(project, 'witty', 1), first);
  for (const style of ['witty', 'gentle', 'poetic'] as const) {
    for (let variant = 0; variant < 5; variant++) {
      const result = epitaphGenerator.generate({ ...project, commits: null }, style, variant);
      assert.ok(!/第 \d+ 次 commit/.test(result.epitaph));
    }
  }
});
