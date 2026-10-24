export type ProjectSource = 'local' | 'github' | 'demo';
export type ProjectStatus = 'buried' | 'alive' | 'revived';
export type EpitaphStyle = 'witty' | 'gentle' | 'poetic';
export type Locale = 'zh-CN' | 'en';
export interface Project {
  id: string;
  name: string;
  description: string;
  source: ProjectSource;
  path?: string;
  url?: string;
  createdAt: string;
  lastCommitAt: string;
  commits: number | null;
  language: string;
  stars?: number;
  archived?: boolean;
  status: ProjectStatus;
  epitaph: string;
  cause: string;
  flowers: number;
  manualStatus?: boolean;
}
export interface Settings {
  dormantDays: number;
  epitaphStyle: EpitaphStyle;
  ownerName: string;
  enabledPlugins: string[];
}
export interface AppState {
  projects: Project[];
  settings: Settings;
  hasScanned: boolean;
}
export interface PluginMeta {
  id: string;
  name: string;
  description: string;
  version: string;
  kind: 'source' | 'detector' | 'epitaph' | 'exporter';
}
export interface ScanOptions {
  locale?: Locale;
  rootPath?: string;
  username?: string;
  maxDepth?: number;
}
export interface ScanResult {
  projects: Project[];
  warnings: string[];
  scannedCount: number;
}
export interface SourcePlugin extends PluginMeta {
  kind: 'source';
  scan(options: ScanOptions): Promise<ScanResult>;
}
export interface DetectorPlugin extends PluginMeta {
  kind: 'detector';
  classify(project: Project, settings: Settings, now?: Date): ProjectStatus;
}
export interface EpitaphPlugin extends PluginMeta {
  kind: 'epitaph';
  generate(
    project: Project,
    style: EpitaphStyle,
    variant?: number,
    locale?: Locale,
  ): { epitaph: string; cause: string };
}
export interface ExportOptions {
  locale?: Locale;
  year: number | 'all';
  ownerName: string;
  projects: Project[];
}
export interface ExporterPlugin extends PluginMeta {
  kind: 'exporter';
  export(options: ExportOptions): Promise<Blob>;
}
export type CemeteryPlugin = SourcePlugin | DetectorPlugin | EpitaphPlugin | ExporterPlugin;
