import type { DetectorPlugin, EpitaphPlugin, Locale, Project, Settings } from './types';
import type { PluginRegistry } from './registry';
import { dormantDays } from './dates';

export function classifyProjects(
  projects: Project[],
  settings: Settings,
  registry: PluginRegistry,
  now = new Date(),
  locale: Locale = 'zh-CN',
): Project[] {
  const enabled = (id: string) => settings.enabledPlugins.includes(id);
  const detector = registry.list('detector').find((plugin) => enabled(plugin.id)) as
    DetectorPlugin | undefined;
  const writer = registry.list('epitaph').find((plugin) => enabled(plugin.id)) as
    EpitaphPlugin | undefined;
  return projects.map((project) => {
    const result = {
      ...project,
      status: detector?.classify(project, settings, now) ?? project.status,
    };
    if (!result.epitaph && writer)
      Object.assign(result, writer.generate(result, settings.epitaphStyle, 0, locale));
    return result;
  });
}

/** Treat HTTPS, SSH, git://, case, trailing slashes and .git as one GitHub repository. */
export function canonicalRepositoryUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const value = url.trim().replace(/^git@([^:]+):/, 'https://$1/');
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    if (host !== 'github.com') return undefined;
    const parts = parsed.pathname
      .replace(/\/+$/, '')
      .replace(/\.git$/i, '')
      .split('/')
      .filter(Boolean);
    return parts.length === 2 ? `${host}/${parts.join('/').toLowerCase()}` : undefined;
  } catch {
    return undefined;
  }
}

function identityKeys(project: Project): string[] {
  const keys = [`id:${project.id}`];
  // Example projects should never absorb an actual repository with the same name.
  if (project.source === 'demo') return keys;
  const remote = canonicalRepositoryUrl(project.url);
  if (remote) keys.push(`remote:${remote}`);
  if (project.path) {
    const path = project.path.replace(/\\/g, '/').replace(/\/+$/, '');
    keys.push(`path:${/^[a-z]:/i.test(path) ? path.toLowerCase() : path}`);
  }
  return keys;
}

/** Refresh discovered facts while preserving the user's words, flowers and manual status. */
export function mergeProjects(existing: Project[], incoming: Project[]): Project[] {
  const merged: Project[] = [];
  const indexes = new Map<string, number>();
  for (const project of [...existing, ...incoming]) {
    const keys = identityKeys(project);
    const index = keys.map((key) => indexes.get(key)).find((value) => value !== undefined);
    if (index === undefined) {
      merged.push({ ...project });
      for (const key of keys) indexes.set(key, merged.length - 1);
      continue;
    }
    const previous = merged[index];
    const previousActivity = Date.parse(previous.lastCommitAt);
    const incomingActivity = Date.parse(project.lastCommitAt);
    // A remote scan can lag unpushed local work. Keep each commit count paired
    // with the activity snapshot it describes rather than downgrading that work.
    const keepPreviousHistory =
      previous.source !== project.source && previousActivity > incomingActivity;
    const sameSnapshot = previousActivity === incomingActivity;
    const combined: Project = {
      ...previous,
      ...project,
      id: previous.id,
      path: project.path ?? previous.path,
      url: project.url ?? previous.url,
      // Preserve the local affordance for a repository seen through both providers.
      source: previous.source === 'local' || project.source === 'local' ? 'local' : project.source,
      lastCommitAt: keepPreviousHistory ? previous.lastCommitAt : project.lastCommitAt,
      commits: keepPreviousHistory
        ? previous.commits
        : (project.commits ?? (sameSnapshot ? previous.commits : null)),
      flowers: previous.flowers,
      epitaph: previous.epitaph || project.epitaph,
      cause: previous.epitaph ? previous.cause : project.cause,
      manualStatus: previous.manualStatus ?? project.manualStatus,
      status: previous.manualStatus ? previous.status : project.status,
    };
    merged[index] = combined;
    for (const key of [...keys, ...identityKeys(combined)]) indexes.set(key, index);
  }
  return merged;
}

export function getStats(projects: Project[], now = new Date()) {
  const buried = projects.filter((project) => project.status === 'buried');
  return {
    total: projects.length,
    buried: buried.length,
    alive: projects.filter((project) => project.status === 'alive').length,
    revived: projects.filter((project) => project.status === 'revived').length,
    commits: projects.reduce((sum, project) => sum + (project.commits ?? 0), 0),
    unknownCommitCounts: projects.filter((project) => project.commits === null).length,
    flowers: projects.reduce((sum, project) => sum + project.flowers, 0),
    longestDormancy: Math.max(0, ...buried.map((project) => dormantDays(project, now))),
  };
}
