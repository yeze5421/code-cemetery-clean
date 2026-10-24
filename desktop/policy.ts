import { pathToFileURL } from 'node:url';
import type { DesktopScanInput } from './contracts';

export function isTrustedFrame(actual: string, entryPath: string) {
  return actual.split('#')[0] === pathToFileURL(entryPath).href;
}
export function isRepositoryURL(value: string) {
  return /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(value);
}
export function validateScanInput(value: unknown): DesktopScanInput {
  if (!value || typeof value !== 'object') throw new Error('扫描参数无效。');
  const input = value as DesktopScanInput;
  if (!['local', 'github'].includes(input.source)) throw new Error('不支持此扫描来源。');
  return {
    source: input.source,
    locale: input.locale === 'en' ? 'en' : 'zh-CN',
    rootPath: typeof input.rootPath === 'string' ? input.rootPath.slice(0, 4096) : undefined,
    username: typeof input.username === 'string' ? input.username.slice(0, 100) : undefined,
    maxDepth: input.maxDepth,
  };
}
export function validateCredential(value: unknown): string {
  if (typeof value !== 'string') throw new Error('令牌格式不正确。');
  const token = value.trim();
  if (token && !/^[A-Za-z0-9_]{20,512}$/.test(token)) throw new Error('令牌格式不正确。');
  return token;
}
export function validatePoster(bytes: unknown, filename: unknown) {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength > 64 * 1024 * 1024 ||
    bytes.byteLength < 8 ||
    !Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    throw new Error('图片数据无效。');
  if (typeof filename !== 'string' || !/^[^<>:"/\\|?*\x00-\x1f]{1,150}\.png$/i.test(filename))
    throw new Error('图片文件名无效。');
  return { bytes: Buffer.from(bytes), filename };
}
