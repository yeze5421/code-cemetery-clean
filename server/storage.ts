import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AppState, Project } from '../src/core/types.js';

export function defaultState(): AppState {
  return {
    projects: [],
    settings: {
      dormantDays: 90,
      epitaphStyle: 'witty',
      ownerName: '一位不愿透露姓名的开发者',
      enabledPlugins: ['local-git', 'github', 'dormancy', 'epitaph', 'annual-png'],
    },
    hasScanned: false,
  };
}
const text = (value: unknown, max = 1000): value is string =>
  typeof value === 'string' && value.length <= max;
const date = (value: unknown) => text(value, 50) && Number.isFinite(Date.parse(value));
const natural = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function validProject(value: unknown): value is Project {
  if (!value || typeof value !== 'object') return false;
  const p = value as Project;
  return (
    text(p.id, 200) &&
    p.id.length > 0 &&
    text(p.name, 300) &&
    p.name.length > 0 &&
    text(p.description, 3000) &&
    ['local', 'github', 'demo'].includes(p.source) &&
    date(p.createdAt) &&
    date(p.lastCommitAt) &&
    (p.commits === null || natural(p.commits)) &&
    text(p.language, 100) &&
    ['buried', 'alive', 'revived'].includes(p.status) &&
    text(p.epitaph, 2000) &&
    text(p.cause, 500) &&
    natural(p.flowers) &&
    (p.path === undefined || text(p.path, 4096)) &&
    (p.url === undefined ||
      (text(p.url, 2048) &&
        /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(p.url))) &&
    (p.stars === undefined || natural(p.stars)) &&
    (p.archived === undefined || typeof p.archived === 'boolean') &&
    (p.manualStatus === undefined || typeof p.manualStatus === 'boolean')
  );
}
export function validateState(input: unknown): AppState {
  if (!input || typeof input !== 'object') throw new Error('状态数据格式不正确。');
  const state = input as AppState;
  if (
    !Array.isArray(state.projects) ||
    state.projects.length > 5000 ||
    !state.projects.every(validProject)
  )
    throw new Error('项目数据无效，或项目数量超过 5,000。');
  if (new Set(state.projects.map((p) => p.id)).size !== state.projects.length)
    throw new Error('项目 ID 不可重复。');
  const settings = state.settings;
  if (
    !settings ||
    !Number.isInteger(settings.dormantDays) ||
    settings.dormantDays < 1 ||
    settings.dormantDays > 3650 ||
    !['witty', 'gentle', 'poetic'].includes(settings.epitaphStyle) ||
    !text(settings.ownerName, 80) ||
    !Array.isArray(settings.enabledPlugins) ||
    settings.enabledPlugins.length > 100 ||
    !settings.enabledPlugins.every((id) => text(id, 100)) ||
    typeof state.hasScanned !== 'boolean'
  )
    throw new Error('设置数据格式不正确。');
  // Return a clean copy so callers never retain mutable references to persisted data.
  return JSON.parse(JSON.stringify(state)) as AppState;
}
export class StateStore {
  private writes: Promise<void> = Promise.resolve();
  constructor(public readonly filename: string) {}
  async read(): Promise<AppState> {
    await this.writes;
    try {
      return validateState(JSON.parse(await readFile(this.filename, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return defaultState();
      throw new Error('本地数据文件无法读取，原始文件已保留。');
    }
  }
  async write(input: unknown): Promise<AppState> {
    const state = validateState(input);
    const task = this.writes.then(async () => {
      await mkdir(path.dirname(this.filename), { recursive: true });
      const temporary = `${this.filename}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, JSON.stringify(state, null, 2), {
          encoding: 'utf8',
          mode: 0o600,
        });
        await rename(temporary, this.filename);
      } catch {
        await unlink(temporary).catch(() => undefined);
        throw new Error('无法保存本地数据，请检查目录写入权限。');
      }
    });
    this.writes = task.catch(() => undefined);
    await task;
    return state;
  }
}
