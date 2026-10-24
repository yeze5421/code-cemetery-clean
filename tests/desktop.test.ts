import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { CredentialStore } from '../desktop/credentials';
import {
  isRepositoryURL,
  isTrustedFrame,
  validateCredential,
  validatePoster,
  validateScanInput,
} from '../desktop/policy';
import { scanLocalGit } from '../src/plugins/sources/local-git';
import { scanGitHub } from '../src/plugins/sources/github';
import { api } from '../src/services/api';

test('desktop bridge rejects foreign frames, arbitrary links, unsafe poster paths and invalid tokens', () => {
  const entry = path.resolve('dist/index.html');
  assert.equal(isTrustedFrame(pathToFileURL(entry).href + '#cemetery', entry), true);
  for (const url of [
    'https://example.invalid/',
    'file:///etc/passwd',
    pathToFileURL(entry).href + '?page=evil',
  ])
    assert.equal(isTrustedFrame(url, entry), false);
  assert.equal(isRepositoryURL('https://github.com/octocat/Hello-World'), true);
  for (const url of [
    'javascript:alert(1)',
    'https://github.com.evil.invalid/a/b',
    'https://github.com/a/b?token=secret',
    'file:///test',
  ])
    assert.equal(isRepositoryURL(url), false);
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(validatePoster(png, '我的项目坟场-2026.png').filename, '我的项目坟场-2026.png');
  assert.throws(() => validatePoster(png, '../secret.png'));
  assert.throws(() => validatePoster(new Uint8Array([1, 2]), 'poster.png'));
  assert.throws(() => validateCredential('not a token'));
  assert.equal(validateCredential(''), '');
  assert.throws(() => validateScanInput({ source: 'shell' }));
});

test('credential storage serializes encrypted updates and refuses plaintext fallback', async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'cemetery-secret-test-'));
  const filename = path.join(fixture, 'token.bin');
  const key = randomBytes(32);
  const storage = new CredentialStore(filename, {
    available: async () => true,
    encrypt: async (value) => {
      const nonce = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, nonce);
      const payload = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
      return Buffer.concat([nonce, cipher.getAuthTag(), payload]);
    },
    decrypt: async (value) => {
      const decipher = createDecipheriv('aes-256-gcm', key, value.subarray(0, 12));
      decipher.setAuthTag(value.subarray(12, 28));
      return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString();
    },
  });
  const first = 'ghp_' + 'a'.repeat(36),
    second = 'ghp_' + 'b'.repeat(36);
  try {
    assert.equal(await storage.read(), '');
    await Promise.all([storage.save(first), storage.save(second)]);
    assert.equal(await storage.read(), second);
    assert.equal((await readFile(filename)).includes(Buffer.from(second)), false);
    const unavailable = new CredentialStore(path.join(fixture, 'unavailable.bin'), {
      available: async () => false,
      encrypt: async () => {
        throw new Error('must not encrypt');
      },
      decrypt: async () => '',
    });
    await assert.rejects(unavailable.save(first), /加密不可用/);
    await storage.save('');
    assert.equal(await storage.read(), '');
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('desktop local scanner uses bundled Git even when system PATH is empty', async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'cemetery-bundled-git-'));
  const executable = path.resolve(
    'node_modules/dugite/git',
    process.platform === 'win32' ? 'cmd/git.exe' : 'bin/git',
  );
  const exec = promisify(execFile);
  const environment = {
    ...process.env,
    PATH: '',
    GIT_EXEC_PATH: path.resolve(
      'node_modules/dugite/git',
      process.platform === 'win32' ? 'ucrt64/libexec/git-core' : 'libexec/git-core',
    ),
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.invalid',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.invalid',
  };
  const git = (args: string[]) =>
    exec(executable, ['-C', fixture, ...args], { env: environment, windowsHide: true });
  try {
    await git(['init', '--quiet']);
    await writeFile(path.join(fixture, 'main.ts'), 'export const resting = true;\n');
    await git(['add', '.']);
    await git(['-c', 'commit.gpgsign=false', 'commit', '-qm', 'First idea']);
    const result = await scanLocalGit(
      { rootPath: fixture, locale: 'en' },
      { executable, environment },
    );
    assert.equal(result.scannedCount, 1);
    assert.equal(result.projects[0].commits, 1);
    assert.equal(result.projects[0].language, 'TypeScript');
    assert.deepEqual(result.warnings, []);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('explicit desktop GitHub credentials override environment and remain outside project records', async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = 'unrelated-environment-token';
  const desktopToken = 'ghp_' + 'c'.repeat(36);
  const received: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request, options?: RequestInit) => {
    received.push(new Headers(options?.headers).get('Authorization') ?? '');
    return new Response(
      JSON.stringify(String(url).endsWith('/user') ? { login: 'developer' } : []),
    );
  }) as typeof fetch;
  try {
    const result = await scanGitHub({ username: 'developer', locale: 'en' }, desktopToken);
    assert.deepEqual(received, [`Bearer ${desktopToken}`, `Bearer ${desktopToken}`]);
    assert.equal(JSON.stringify(result).includes(desktopToken), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalToken;
  }
});

test('desktop frontend transport uses isolated methods instead of opening an HTTP connection', async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousFetch = globalThis.fetch;
  let reads = 0;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      cemeteryDesktop: {
        readState: async () => {
          reads++;
          return { value: { projects: [] } };
        },
      },
    },
  });
  globalThis.fetch = (async () => {
    throw new Error('HTTP must not be used');
  }) as typeof fetch;
  try {
    assert.deepEqual(await api('/api/state'), { projects: [] });
    assert.equal(reads, 1);
    await assert.rejects(api('/api/arbitrary-command'));
  } finally {
    globalThis.fetch = previousFetch;
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
