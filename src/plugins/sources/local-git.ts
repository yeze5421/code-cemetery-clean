import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { Locale, Project, ScanOptions, ScanResult, SourcePlugin } from '../../core/types.js';
import { createTranslator } from '../../i18n/translate.js';

const exec = promisify(execFile);
const excluded = new Set([
  'node_modules',
  'vendor',
  'dist',
  'build',
  'coverage',
  '__pycache__',
  '$recycle.bin',
  'system volume information',
  'windows',
  'program files',
  'program files (x86)',
  'programdata',
  'appdata',
  '.git',
  '.svn',
  '.hg',
  '.venv',
  'venv',
]);
const languages: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.py': 'Python',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.cs': 'C#',
  '.cpp': 'C++',
  '.c': 'C',
  '.rb': 'Ruby',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.swift': 'Swift',
  '.kt': 'Kotlin',
  '.php': 'PHP',
  '.html': 'HTML',
  '.css': 'CSS',
  '.dart': 'Dart',
};
export interface LocalGitRuntime {
  executable?: string;
  environment?: NodeJS.ProcessEnv;
}
async function runGit(directory: string, args: string[], runtime: LocalGitRuntime) {
  const result = await exec(runtime.executable ?? 'git', ['-C', directory, ...args], {
    timeout: 10000,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
    env: {
      ...process.env,
      ...runtime.environment,
      GIT_OPTIONAL_LOCKS: '0',
      GIT_TERMINAL_PROMPT: '0',
    },
  });
  return result.stdout.trim();
}
function githubRemote(remote: string): string | undefined {
  try {
    const url = new URL(remote.replace(/^git@github\.com:/i, 'https://github.com/'));
    if (url.hostname.toLowerCase() !== 'github.com') return undefined;
    const parts = url.pathname
      .replace(/\/+$/, '')
      .replace(/\.git$/i, '')
      .split('/')
      .filter(Boolean);
    if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_.-]+$/.test(part)))
      return undefined;
    // Rebuild from the validated host/path; never persist credentials, queries or fragments.
    return `https://github.com/${parts.join('/')}`;
  } catch {
    return undefined;
  }
}
async function readRepository(
  directory: string,
  warnings: string[],
  locale: Locale,
  runtime: LocalGitRuntime,
): Promise<Project> {
  const git = (directory: string, args: string[]) => runGit(directory, args, runtime);
  const t = createTranslator(locale);
  const info = await stat(directory);
  const fallback = (info.birthtimeMs > 0 ? info.birthtime : info.mtime).toISOString();
  let createdAt = fallback;
  let lastCommitAt = fallback;
  let commits = 0;
  let language = t('未识别');
  const url = githubRemote(await git(directory, ['remote', 'get-url', 'origin']).catch(() => ''));
  try {
    await git(directory, ['rev-parse', '--verify', 'HEAD']);
    const [count, last, roots, files] = await Promise.all([
      git(directory, ['rev-list', '--count', 'HEAD']),
      git(directory, ['log', '-1', '--format=%cI', 'HEAD']),
      git(directory, ['log', '--max-parents=0', '--format=%cI', 'HEAD']),
      git(directory, ['ls-files', '-z']),
    ]);
    commits = Number.parseInt(count, 10);
    lastCommitAt = new Date(last).toISOString();
    const rootDates = roots
      .split(/\r?\n/)
      .map((date) => Date.parse(date))
      .filter(Number.isFinite);
    createdAt = rootDates.length ? new Date(Math.min(...rootDates)).toISOString() : lastCommitAt;
    const tally = new Map<string, number>();
    for (const file of files.split('\0')) {
      const lang = languages[path.extname(file).toLowerCase()];
      if (lang) tally.set(lang, (tally.get(lang) ?? 0) + 1);
    }
    language = [...tally].sort((a, b) => b[1] - a[1])[0]?.[0] ?? t('未识别');
  } catch (error) {
    // Empty repositories have no HEAD. Other git failures must remain visible.
    try {
      const refs = await git(directory, ['for-each-ref', '--format=%(refname)']);
      if (refs) throw error;
      warnings.push(
        t('{name} 尚无提交，日期使用目录创建时间。', { name: path.basename(directory) }),
      );
    } catch {
      throw new Error(
        t('无法读取 {name} 的 Git 历史，请检查 Git 安装及仓库访问权限。', {
          name: path.basename(directory),
        }),
      );
    }
  }
  return {
    id: `local-${createHash('sha256')
      .update(process.platform === 'win32' ? directory.toLowerCase() : directory)
      .digest('hex')
      .slice(0, 20)}`,
    name: path.basename(directory),
    description: t('从本地 Git 历史发现的项目'),
    source: 'local',
    path: directory,
    ...(url ? { url } : {}),
    createdAt,
    lastCommitAt,
    commits,
    language,
    status: 'alive',
    epitaph: '',
    cause: '',
    flowers: 0,
  };
}

export async function scanLocalGit(
  options: ScanOptions,
  runtime: LocalGitRuntime = {},
): Promise<ScanResult> {
  const locale = options.locale ?? 'zh-CN';
  const t = createTranslator(locale);
  if (typeof options.rootPath !== 'string' || !path.isAbsolute(options.rootPath))
    throw new Error(t('请输入有效的绝对目录路径，例如 C:\\Projects。'));
  let root: string;
  try {
    root = await realpath(options.rootPath);
    if (!(await stat(root)).isDirectory()) throw new Error();
  } catch {
    throw new Error(t('扫描目录不存在或无法访问。'));
  }
  const maxDepth = options.maxDepth ?? 5;
  if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 12)
    throw new Error(t('扫描深度须为 0 到 12 的整数。'));
  const projects: Project[] = [];
  const warnings: string[] = [];
  const queue = [{ directory: root, depth: 0 }];
  const started = Date.now();
  let visited = 0;
  let truncatedDepth = false;
  while (queue.length) {
    if (visited >= 20000 || projects.length >= 1000 || Date.now() - started > 120000) {
      warnings.push(
        t(
          '扫描已达到本轮安全上限（20,000 个目录、1,000 个仓库或 120 秒），请缩小目录范围继续扫描。',
        ),
      );
      break;
    }
    const entry = queue.shift()!;
    visited++;
    let children;
    try {
      children = await readdir(entry.directory, { withFileTypes: true });
    } catch {
      if (warnings.length < 30)
        warnings.push(t('跳过无权读取的目录：{directory}', { directory: entry.directory }));
      continue;
    }
    if (
      children.some((child) => child.name === '.git' && (child.isDirectory() || child.isFile()))
    ) {
      try {
        projects.push(await readRepository(entry.directory, warnings, locale, runtime));
      } catch (error) {
        if (warnings.length < 30) warnings.push((error as Error).message);
      }
    }
    for (const child of children) {
      if (
        !child.isDirectory() ||
        child.isSymbolicLink() ||
        excluded.has(child.name.toLowerCase()) ||
        child.name.startsWith('.')
      )
        continue;
      if (entry.depth >= maxDepth) {
        truncatedDepth = true;
        continue;
      }
      queue.push({ directory: path.join(entry.directory, child.name), depth: entry.depth + 1 });
    }
  }
  if (truncatedDepth)
    warnings.push(
      t('只扫描到第 {depth} 层目录；更深的项目可通过调整深度或选择子目录扫描。', {
        depth: maxDepth,
      }),
    );
  return { projects, warnings, scannedCount: projects.length };
}
export const localGitSource: SourcePlugin = {
  id: 'local-git',
  name: '本地 Git',
  description: '只读扫描选定目录中的 Git 仓库',
  version: '1.0.0',
  kind: 'source',
  scan: scanLocalGit,
};
