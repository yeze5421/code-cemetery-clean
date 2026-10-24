import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  selectExportProjects,
  estimateExportDimensions,
  formatPosterDate,
  annualPngExporter,
} from '../src/plugins/exporters/annual-png';
import type { Project } from '../src/core/types';

const base: Project = {
  id: 'one',
  name: 'one',
  description: '',
  source: 'local',
  createdAt: '2024-01-01T00:00:00Z',
  lastCommitAt: '2024-03-03T00:00:00Z',
  commits: 3,
  language: 'TypeScript',
  status: 'buried',
  epitaph: '想法很多，时间很少。',
  cause: '下次一定',
  flowers: 0,
};

test('annual export includes only buried projects in selected UTC year, without mutating input', () => {
  const projects: Project[] = [
    base,
    { ...base, id: 'two', lastCommitAt: '2025-01-01T00:00:00Z' },
    { ...base, id: 'alive', status: 'alive' },
    { ...base, id: 'revived', status: 'revived' },
  ];
  const result = selectExportProjects({ year: 2024, ownerName: '', projects });
  assert.deepEqual(
    result.map((p) => p.id),
    ['one'],
  );
  assert.equal(projects.length, 4);
  assert.notEqual(result, projects);
});

test('all years are sorted newest first and unknown commit counts are retained', () => {
  const projects: Project[] = [
    base,
    { ...base, id: 'new', commits: null, lastCommitAt: '2026-03-01T00:00:00Z' },
  ];
  const result = selectExportProjects({ year: 'all', ownerName: 'test', projects });
  assert.deepEqual(
    result.map((p) => p.id),
    ['new', 'one'],
  );
  assert.equal(result[0].commits, null);
  assert.equal(projects[0].id, 'one');
});

test('date output uses UTC and invalid input is labelled unknown', () => {
  assert.equal(formatPosterDate('2026-01-01T01:00:00+08:00'), '2025.12.31');
  assert.equal(formatPosterDate('not-a-date'), '日期未知');
});

test('estimated height grows by rows, keeps width at 1080px', () => {
  assert.equal(estimateExportDimensions(1).width, 1080);
  assert.equal(estimateExportDimensions(1).height, estimateExportDimensions(2).height);
  assert.ok(estimateExportDimensions(3).height > estimateExportDimensions(2).height);
});

test('server-side accidental use fails with a readable message', async () => {
  await assert.rejects(
    annualPngExporter.export({ year: 'all', ownerName: '', projects: [base] }),
    /浏览器/,
  );
});
