import type { DesktopBridge, DesktopReply } from '../../desktop/contracts';
import { readLocale } from '../i18n/preference';
declare global {
  interface Window {
    cemeteryDesktop?: DesktopBridge;
  }
}
export function getDesktop() {
  return typeof window !== 'undefined' ? window.cemeteryDesktop : undefined;
}
export function unwrapDesktop<T>(reply: DesktopReply<T>): T {
  if (reply.error) throw new Error(reply.error);
  return reply.value as T;
}
export async function saveDesktopPoster(url: string, filename: string) {
  const desktop = getDesktop();
  if (!desktop) return;
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  return unwrapDesktop(await desktop.savePoster(bytes, filename, readLocale()));
}
