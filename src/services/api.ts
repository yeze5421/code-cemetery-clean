import { readLocale } from '../i18n/preference';
import { createTranslator } from '../i18n/translate';
import { getDesktop, unwrapDesktop } from './desktop';

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const locale = readLocale();
  const t = createTranslator(locale);
  const desktop = getDesktop();
  if (desktop) {
    const method = options?.method ?? 'GET';
    if (path === '/api/state' && method === 'GET')
      return unwrapDesktop(await desktop.readState(locale)) as T;
    if (path === '/api/state' && method === 'PUT')
      return unwrapDesktop(await desktop.saveState(JSON.parse(String(options?.body)), locale)) as T;
    if (path === '/api/scan' && method === 'POST')
      return unwrapDesktop(
        await desktop.scan({ ...JSON.parse(String(options?.body)), locale }),
      ) as T;
    throw new Error(t('此接口不存在。'));
  }
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'Accept-Language': locale, ...options?.headers },
  });
  const data = await response.json().catch(() => ({ error: t('服务返回了无法识别的响应') }));
  if (!response.ok)
    throw new Error(typeof data.error === 'string' ? t(data.error) : t('操作失败，请稍后重试'));
  return data as T;
}
