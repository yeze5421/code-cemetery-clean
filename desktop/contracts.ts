import type { AppState, Locale, ScanOptions, ScanResult } from '../src/core/types';

export interface DesktopReply<T> {
  value?: T;
  error?: string;
}
export interface DesktopScanInput extends ScanOptions {
  source: 'local' | 'github';
}
/** Only these operations cross the isolated desktop bridge. No raw IPC or filesystem access. */
export interface DesktopBridge {
  readonly platform: 'desktop';
  readState(locale: Locale): Promise<DesktopReply<AppState>>;
  saveState(state: AppState, locale: Locale): Promise<DesktopReply<AppState>>;
  scan(input: DesktopScanInput): Promise<DesktopReply<ScanResult>>;
  chooseDirectory(locale: Locale): Promise<DesktopReply<string | null>>;
  credentialStatus(locale: Locale): Promise<DesktopReply<boolean>>;
  saveCredential(token: string, locale: Locale): Promise<DesktopReply<boolean>>;
  savePoster(bytes: Uint8Array, filename: string, locale: Locale): Promise<DesktopReply<boolean>>;
}
