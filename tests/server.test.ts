import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { request as httpRequest } from 'node:http';
import { scanLocalGit } from '../src/plugins/sources/local-git.js';
import { scanGitHub } from '../src/plugins/sources/github.js';
import { defaultState, StateStore, validateState } from '../server/storage.js';
import { createApp } from '../server/index.js';

const exec = promisify(execFile);
async function runGit(directory: string, args: string[], date?: string) {
  return exec('git', ['-C', directory, ...args], {
    windowsHide: true,
    env: { ...process.env, ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}) },
  });
}
test('local scanner reads actual Git history, skips dependencies, supports worktree .git files', async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'cemetery-scan-'));
  try {
    const repo = path.join(fixture, 'a project with spaces');
    await mkdir(repo);
    await runGit(repo, ['init']);
    await runGit(repo, [
      'remote',
      'add',
      'origin',
      'git@github.com:developer/example-repository.git',
    ]);
    await writeFile(path.join(repo, 'index.ts'), 'export const greeting = "hello";');
    await runGit(repo, ['add', '.']);
    await runGit(
      repo,
      [
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@example.invalid',
        'commit',
        '-m',
        'beginning',
      ],
      '2023-01-01T10:00:00Z',
    );
    await writeFile(path.join(repo, 'index.ts'), 'export const greeting = "goodbye";');
    await runGit(repo, ['add', '.']);
    await runGit(
      repo,
      [
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@example.invalid',
        'commit',
        '-m',
        'last idea',
      ],
      '2024-03-03T10:00:00Z',
    );
    await runGit(repo, [
      'worktree',
      'add',
      '-b',
      'test-worktree',
      path.join(fixture, 'linked worktree'),
    ]);
    const ignored = path.join(fixture, 'node_modules', 'ignored-repository');
    await mkdir(ignored, { recursive: true });
    await runGit(ignored, ['init']);
    const result = await scanLocalGit({ rootPath: fixture, maxDepth: 3 });
    assert.equal(result.projects.length, 2);
    const project = result.projects.find((project) => project.name === 'a project with spaces')!;
    assert.equal(project.commits, 2);
    assert.equal(project.language, 'TypeScript');
    assert.equal(project.url, 'https://github.com/developer/example-repository');
    assert.equal(project.createdAt, '2023-01-01T10:00:00.000Z');
    assert.equal(project.lastCommitAt, '2024-03-03T10:00:00.000Z');
    assert.equal(result.projects[1].commits, 2);
    assert.notEqual(result.projects[0].id, result.projects[1].id);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('empty repositories are represented explicitly and invalid roots are rejected', async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'cemetery-empty-'));
  try {
    await runGit(fixture, ['init']);
    await runGit(fixture, [
      'remote',
      'add',
      'origin',
      'https://fake-secret@github.com/developer/empty.git?private=fake-secret',
    ]);
    const result = await scanLocalGit({ rootPath: fixture, maxDepth: 0 });
    assert.equal(result.projects[0].commits, 0);
    assert.equal(result.projects[0].url, 'https://github.com/developer/empty');
    assert.ok(!JSON.stringify(result.projects).includes('fake-secret'));
    assert.match(result.warnings[0], /尚无提交/);
    await assert.rejects(scanLocalGit({ rootPath: '.' }), /绝对目录/);
    await assert.rejects(scanLocalGit({ rootPath: fixture, maxDepth: 50 }), /扫描深度/);
    await assert.rejects(scanGitHub({ username: '../../somewhere' }), /GitHub 用户名/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('state validation and serialized atomic saves preserve latest values', async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'cemetery-state-'));
  try {
    const store = new StateStore(path.join(fixture, 'data', 'state.json'));
    assert.equal((await store.read()).hasScanned, false);
    const first = defaultState();
    const second = defaultState();
    first.settings.ownerName = '第一个';
    second.settings.ownerName = '最后一个';
    await Promise.all([store.write(first), store.write(second)]);
    assert.equal((await store.read()).settings.ownerName, '最后一个');
    assert.throws(
      () => validateState({ ...second, settings: { ...second.settings, dormantDays: -1 } }),
      /设置/,
    );
    await writeFile(store.filename, '{broken');
    await assert.rejects(store.read(), /原始文件已保留/);
    assert.equal(await readFile(store.filename, 'utf8'), '{broken');
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('API rejects foreign sites, invalid state and disabled source plugins', async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'cemetery-api-'));
  const app = createApp({
    statePath: path.join(fixture, 'state.json'),
    sources: [
      {
        id: 'local-git',
        name: 'Test source',
        description: 'fixture',
        version: '1',
        kind: 'source',
        scan: async () => ({ projects: [], warnings: ['fixture'], scannedCount: 0 }),
      },
    ],
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const headers = {
    host: '127.0.0.1:4317',
    'Content-Type': 'application/json',
    Origin: 'http://127.0.0.1:5173',
  };
  // Native HTTP permits explicit Host headers so this can use a collision-free ephemeral port.
  const call = (
    route: string,
    options: { method?: string; headers?: Record<string, string>; body?: string } = {},
  ) =>
    new Promise<{ status: number; json: () => unknown }>((resolve, reject) => {
      const request = httpRequest(
        `${url}${route}`,
        { method: options.method ?? 'GET', headers: options.headers ?? headers },
        (response) => {
          let body = '';
          response.setEncoding('utf8');
          response.on('data', (chunk) => {
            body += chunk;
          });
          response.on('end', () =>
            resolve({ status: response.statusCode!, json: () => JSON.parse(body) }),
          );
        },
      );
      request.on('error', reject);
      request.end(options.body);
    });
  try {
    assert.equal((await call('/api/health', { headers: { host: 'evil.example' } })).status, 403);
    assert.equal(
      (
        await call('/api/state', {
          method: 'PUT',
          headers: { ...headers, Origin: 'https://evil.example' },
          body: '{}',
        })
      ).status,
      403,
    );
    assert.equal((await call('/api/state', { method: 'PUT', body: '{}' })).status, 400);
    const scan = await call('/api/scan', {
      method: 'POST',
      body: JSON.stringify({ source: 'local', rootPath: fixture }),
    });
    assert.equal(scan.status, 200);
    assert.deepEqual(((await scan.json()) as { warnings: string[] }).warnings, ['fixture']);
    const state = defaultState();
    state.settings.enabledPlugins = [];
    assert.equal(
      (await call('/api/state', { method: 'PUT', body: JSON.stringify(state) })).status,
      200,
    );
    assert.equal(
      (
        await call('/api/scan', {
          method: 'POST',
          body: JSON.stringify({ source: 'local', rootPath: fixture }),
        })
      ).status,
      400,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(fixture, { recursive: true, force: true });
  }
});

test('GitHub scanner follows repository pagination and distinguishes commit dates from pushes', async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_TOKEN;
  const repo = (id: number) => ({
    id,
    name: `project-${id}`,
    full_name: `developer/project-${id}`,
    description: null,
    created_at: '2023-01-01T00:00:00Z',
    pushed_at: '2025-01-01T00:00:00Z',
    language: 'TypeScript',
    stargazers_count: 2,
    archived: false,
    html_url: `https://github.com/developer/project-${id}`,
    fork: false,
    owner: { login: 'developer' },
  });
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('/users/developer/repos')) {
      const page = new URL(url).searchParams.get('page');
      return new Response(JSON.stringify([repo(Number(page))]), {
        headers:
          page === '1'
            ? { link: '<https://api.github.com/users/developer/repos?page=2>; rel="next"' }
            : {},
      });
    }
    if (url.includes('/project-1/commits'))
      return new Response(
        JSON.stringify([{ commit: { committer: { date: '2024-04-03T12:00:00Z' }, author: null } }]),
        {
          headers: {
            link: '<https://api.github.com/repos/developer/project-1/commits?per_page=1&page=8>; rel="last"',
          },
        },
      );
    return new Response(JSON.stringify({ message: 'rate limited' }), { status: 403 });
  }) as typeof fetch;
  try {
    const result = await scanGitHub({ username: 'developer' });
    assert.equal(result.scannedCount, 2);
    assert.equal(result.projects[0].commits, 8);
    assert.equal(result.projects[0].lastCommitAt, '2024-04-03T12:00:00Z');
    assert.equal(result.projects[1].commits, null);
    assert.equal(result.projects[1].lastCommitAt, '2025-01-01T00:00:00Z');
    assert.ok(result.warnings.some((warning) => warning.includes('未知')));
    assert.equal(calls.length, 4);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalToken;
  }
});
