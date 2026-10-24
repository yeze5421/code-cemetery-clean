import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { createApp } from '../server/index';
import { scanLocalGit } from '../src/plugins/sources/local-git';
import { scanGitHub } from '../src/plugins/sources/github';

test('API uses Accept-Language for errors and forwards locale to source plugins', async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'cemetery-api-i18n-'));
  let receivedLocale: string | undefined;
  const app = createApp({
    statePath: path.join(fixture, 'state.json'),
    sources: [
      {
        id: 'local-git',
        name: 'Test',
        description: 'Test',
        version: '1',
        kind: 'source',
        scan: async (options) => {
          receivedLocale = options.locale;
          return { projects: [], warnings: [], scannedCount: 0 };
        },
      },
    ],
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const port = (server.address() as AddressInfo).port;
  const call = (route: string, locale?: string, body?: string) =>
    new Promise<{ status: number; data: { error?: string } }>((resolve, reject) => {
      const request = httpRequest(
        `http://127.0.0.1:${port}${route}`,
        {
          method: body === undefined ? 'GET' : 'POST',
          headers: {
            host: '127.0.0.1:4317',
            'Content-Type': 'application/json',
            ...(locale ? { 'Accept-Language': locale } : {}),
          },
        },
        (response) => {
          let result = '';
          response.setEncoding('utf8');
          response.on('data', (chunk) => {
            result += chunk;
          });
          response.on('end', () =>
            resolve({ status: response.statusCode!, data: JSON.parse(result) }),
          );
        },
      );
      request.on('error', reject);
      request.end(body);
    });
  try {
    assert.equal((await call('/api/missing')).data.error, '此接口不存在。');
    assert.equal(
      (await call('/api/missing', 'en-US,en;q=0.9')).data.error,
      'This API endpoint does not exist.',
    );
    assert.equal(
      (await call('/api/scan', 'en', '{broken')).data.error,
      'The request format is invalid.',
    );
    assert.equal(
      (await call('/api/scan', 'en', JSON.stringify({ source: 'missing' }))).data.error,
      'This scan source is not supported.',
    );
    assert.equal(
      (await call('/api/scan', 'en-GB', JSON.stringify({ source: 'local' }))).status,
      200,
    );
    assert.equal(receivedLocale, 'en');
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(fixture, { recursive: true, force: true });
  }
});

test('local scanner localizes dynamic warnings without changing repository identity', async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'cemetery-local-i18n-'));
  try {
    await promisify(execFile)('git', ['-C', fixture, 'init'], { windowsHide: true });
    const zh = await scanLocalGit({ rootPath: fixture });
    const en = await scanLocalGit({ rootPath: fixture, locale: 'en' });
    assert.equal(zh.projects[0].id, en.projects[0].id);
    assert.match(zh.warnings[0], /尚无提交/);
    assert.match(en.warnings[0], /has no commits yet/);
    assert.ok(en.warnings[0].includes(path.basename(fixture)));
    assert.equal(en.projects[0].language, 'Unknown');
    await assert.rejects(scanLocalGit({ rootPath: '.', locale: 'en' }), /absolute directory path/);
    await assert.rejects(scanGitHub({ username: '../bad', locale: 'en' }), /valid GitHub username/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('GitHub warnings are fully English when a commit request fails', async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_TOKEN;
  globalThis.fetch = (async (input) =>
    String(input).includes('/users/')
      ? new Response(
          JSON.stringify([
            {
              id: 1,
              name: 'an-idea',
              full_name: 'developer/an-idea',
              description: null,
              created_at: '2024-01-01T00:00:00Z',
              pushed_at: '2025-01-01T00:00:00Z',
              language: null,
              stargazers_count: 0,
              archived: false,
              html_url: 'https://github.com/developer/an-idea',
              fork: false,
              owner: { login: 'developer' },
            },
          ]),
        )
      : new Response('{}', { status: 403 })) as typeof fetch;
  try {
    const result = await scanGitHub({ username: 'developer', locale: 'en' });
    assert.equal(result.scannedCount, 1);
    assert.equal(result.projects[0].commits, null);
    assert.equal(result.projects[0].description, 'A project discovered on GitHub');
    assert.ok(result.warnings.some((warning) => warning.includes('commit count is unknown')));
    assert.ok(result.warnings.some((warning) => warning.includes('public repositories')));
    assert.ok(result.warnings.every((warning) => !/[\u3400-\u9fff]/.test(warning)));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalToken;
  }
});
