import type { Project } from './types';

/** Complete 24-hour days; future or unknown dates never imply abandonment. */
export function dormantDays(project: Pick<Project, 'lastCommitAt'>, now = new Date()): number {
  const timestamp = new Date(project.lastCommitAt).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.floor((now.getTime() - timestamp) / 86_400_000));
}

export function formatMonth(date: string): string {
  const value = new Date(date);
  if (!Number.isFinite(value.getTime())) return '日期未知';
  return `${value.getUTCFullYear()}.${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
}
