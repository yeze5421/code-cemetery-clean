import type { Locale, Project, ScanOptions, ScanResult, SourcePlugin } from '../../core/types.js';
import { createTranslator } from '../../i18n/translate.js';

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  created_at: string;
  pushed_at: string | null;
  language: string | null;
  stargazers_count: number;
  archived: boolean;
  html_url: string;
  fork: boolean;
  owner: { login: string };
}
class GitHubError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function request(
  endpoint: string,
  deadline = Date.now() + 15000,
  locale: Locale = 'zh-CN',
  token?: string,
): Promise<Response> {
  const t = createTranslator(locale);
  let response: Response;
  try {
    response = await fetch(`https://api.github.com${endpoint}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Code-Cemetery/1.0',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(Math.max(1, Math.min(15000, deadline - Date.now()))),
    });
  } catch {
    throw new GitHubError(t('无法连接 GitHub，请检查网络后重试。'), 0);
  }
  if (!response.ok && response.status !== 409) {
    const message =
      response.status === 404
        ? t('GitHub 用户或仓库不存在，或当前账号无权访问。')
        : response.status === 401
          ? t('GitHub 访问令牌无效或已过期，请更新后重试。')
          : response.status === 403 || response.status === 429
            ? t('GitHub 请求额度已用尽或访问受限；可稍后重试，或配置访问令牌。')
            : t('GitHub 暂时无法完成请求（{status}）。', { status: response.status });
    throw new GitHubError(message, response.status);
  }
  return response;
}

export async function scanGitHub(
  options: ScanOptions,
  token = process.env.GITHUB_TOKEN,
): Promise<ScanResult> {
  const locale = options.locale ?? 'zh-CN';
  const t = createTranslator(locale);
  const username = typeof options.username === 'string' ? options.username.trim() : '';
  if (!username || !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username))
    throw new Error(t('请输入有效的 GitHub 用户名。'));
  const warnings: string[] = [];
  const deadline = Date.now() + 120000;
  let owned = false;
  if (token) {
    const profile = (await (await request('/user', deadline, locale, token)).json()) as {
      login: string;
    };
    owned = profile.login.toLowerCase() === username.toLowerCase();
  }
  const repositories: Repository[] = [];
  for (let page = 1; page <= 10; page++) {
    if (Date.now() >= deadline) {
      warnings.push(t('本轮扫描已达到 120 秒上限，已保留获取到的仓库，列表可能不完整。'));
      break;
    }
    const endpoint = owned
      ? `/user/repos?affiliation=owner&per_page=100&sort=pushed&page=${page}`
      : `/users/${encodeURIComponent(username)}/repos?type=owner&per_page=100&sort=pushed&page=${page}`;
    try {
      const response = await request(endpoint, deadline, locale, token);
      const batch = (await response.json()) as Repository[];
      repositories.push(
        ...batch.filter((repo) => repo.owner.login.toLowerCase() === username.toLowerCase()),
      );
      if (!response.headers.get('link')?.includes('rel="next"')) break;
      if (page === 10) warnings.push(t('本轮最多读取 1,000 个 GitHub 仓库，结果可能不完整。'));
    } catch (error) {
      if (!repositories.length) throw error;
      warnings.push(t('{message} 已保留成功读取的仓库。', { message: (error as Error).message }));
      break;
    }
  }
  let commitsUnavailable = false;
  const projects: Project[] = [];
  for (const repo of repositories) {
    if (!commitsUnavailable && Date.now() >= deadline) {
      commitsUnavailable = true;
      warnings.push(t('本轮扫描已达到 120 秒上限；剩余仓库保留基本资料。'));
    }
    let lastCommitAt = repo.pushed_at || repo.created_at;
    let commits: number | null = null;
    if (!commitsUnavailable) {
      try {
        const response = await request(
          `/repos/${encodeURIComponent(repo.owner.login)}/${encodeURIComponent(repo.name)}/commits?per_page=1`,
          deadline,
          locale,
          token,
        );
        if (response.status === 409) {
          commits = 0;
          lastCommitAt = repo.created_at;
        } else {
          const entries = (await response.json()) as Array<{
            commit: { committer: { date: string } | null; author: { date: string } | null };
          }>;
          const lastLink = response.headers.get('link')?.match(/<([^>]+)>; rel="last"/);
          commits = lastLink
            ? Number(new URL(lastLink[1]).searchParams.get('page'))
            : entries.length;
          lastCommitAt =
            entries[0]?.commit.committer?.date ||
            entries[0]?.commit.author?.date ||
            repo.created_at;
        }
      } catch (error) {
        if (warnings.length < 20)
          warnings.push(
            t('{name}：{message} 提交数标记为未知，沉寂日期暂用最后推送时间。', {
              name: repo.name,
              message: (error as Error).message,
            }),
          );
        if (error instanceof GitHubError && [0, 401, 403, 429].includes(error.status))
          commitsUnavailable = true;
      }
    }
    projects.push({
      id: `github-${repo.id}`,
      name: repo.name,
      description:
        repo.description || t(repo.fork ? '从 GitHub 发现的 Fork 项目' : '从 GitHub 发现的项目'),
      source: 'github',
      url: repo.html_url,
      createdAt: repo.created_at,
      lastCommitAt,
      commits,
      language: repo.language || t('未识别'),
      stars: repo.stargazers_count,
      archived: repo.archived,
      status: 'alive',
      epitaph: '',
      cause: '',
      flowers: 0,
    });
  }
  if (commitsUnavailable)
    warnings.push(
      t('部分仓库未能读取提交历史：提交数为未知，日期使用最后推送时间，废弃判断仅供参考。'),
    );
  if (!owned)
    warnings.push(
      t('本次扫描仅包含此账号的公开仓库；读取自己的私有仓库需要配置访问令牌，并使用同一个账号的用户名。'),
    );
  return { projects, warnings, scannedCount: projects.length };
}
export const githubSource: SourcePlugin = {
  id: 'github',
  name: 'GitHub',
  description: '通过 GitHub API 扫描账号仓库',
  version: '1.0.0',
  kind: 'source',
  scan: scanGitHub,
};
