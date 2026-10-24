import { useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  CalendarDays,
  Check,
  CircleHelp,
  Code2,
  ExternalLink,
  FolderGit2,
  Github,
  Leaf,
  LoaderCircle,
  Moon,
  RefreshCw,
  Sparkles,
  Sprout,
} from 'lucide-react';
import type { EpitaphStyle, PluginMeta, Project, Settings } from '../core/types';
import { dormantDays, formatMonth } from '../core';
import { Modal } from '../components/Modal';
import { useI18n } from '../i18n/react';
import { getDesktop, unwrapDesktop } from '../services/desktop';
import { DesktopGitHubAccess, PosterDownload } from './desktop-access';

const sourceName = { local: '本地', github: 'GitHub', demo: '示例' };
const styleName: Record<EpitaphStyle, string> = {
  witty: '扎心吐槽',
  gentle: '温柔告别',
  poetic: '文艺追思',
};

export interface ScanDialogProps {
  scanSource: 'local' | 'github';
  onSourceChange: (source: 'local' | 'github') => void;
  rootPath: string;
  onRootPathChange: (path: string) => void;
  username: string;
  onUsernameChange: (username: string) => void;
  dormantDays: number;
  warnings: string[];
  busy: boolean;
  disabled: boolean;
  onScan: () => void;
  onClose: () => void;
}

/** View only. Scanning and all state transitions remain with the application. */
export function ScanDialog(props: ScanDialogProps) {
  const { locale, t } = useI18n();
  const desktop = getDesktop();
  const [folderError, setFolderError] = useState('');
  const {
    scanSource,
    onSourceChange,
    rootPath,
    onRootPathChange,
    username,
    onUsernameChange,
    warnings,
    busy,
    disabled,
    onScan,
    onClose,
  } = props;
  return (
    <Modal
      title={t('把遗忘的项目，带回墓园。')}
      eyebrow="DISCOVER YOUR FORGOTTEN IDEAS"
      onClose={onClose}
    >
      <p className="modal-intro">{t('读取项目的提交足迹，为沉寂的灵感写一段告别。')}</p>
      <div className="segmented">
        <button
          className={scanSource === 'local' ? 'active' : ''}
          onClick={() => onSourceChange('local')}
        >
          <FolderGit2 size={17} />
          {t('本地目录')}
        </button>
        <button
          className={scanSource === 'github' ? 'active' : ''}
          onClick={() => onSourceChange('github')}
        >
          <Github size={17} />
          {t('GitHub 仓库')}
        </button>
      </div>
      {scanSource === 'local' ? (
        <>
          <label className="field">
            {t('项目根目录')}
            <input
              autoComplete="off"
              value={rootPath}
              onChange={(e) => onRootPathChange(e.target.value)}
              placeholder={t('输入项目目录的绝对路径')}
            />
          </label>
          {desktop && (
            <button
              className="quiet-button choose-folder"
              disabled={busy}
              onClick={async () => {
                setFolderError('');
                try {
                  const selected = unwrapDesktop(await desktop.chooseDirectory(locale));
                  if (selected) onRootPathChange(selected);
                } catch (error) {
                  setFolderError((error as Error).message);
                }
              }}
            >
              <FolderGit2 size={16} />
              {t('选择文件夹')}
            </button>
          )}
          {folderError && (
            <p className="error-text" role="alert">
              {folderError}
            </p>
          )}
          <p className="field-hint">
            {t(
              '扫描此目录下最多 5 层的 Git 仓库，自动跳过依赖和系统目录。可重复扫描不同磁盘的项目目录。',
            )}
          </p>
        </>
      ) : (
        <>
          <label className="field">
            {t('GitHub 用户名')}
            <input
              autoComplete="off"
              value={username}
              onChange={(e) => onUsernameChange(e.target.value)}
              placeholder={t('例如 octocat')}
            />
          </label>
          <p className="field-hint">
            {desktop
              ? t('填写自己的 GitHub 用户名即可读取公开仓库；私有仓库可在下方配置访问令牌。')
              : t(
                  '默认读取该用户的公开仓库。私有仓库需在本地服务配置 GITHUB_TOKEN，用户名应与令牌所属账号一致。',
                )}
          </p>
          <DesktopGitHubAccess />
        </>
      )}
      <div className="scan-info">
        <Leaf size={17} />
        <span>
          {t('沉寂达到 {days} 天的项目将自动安息。墓志铭是趣味创作，你可以随时修改或复活项目。', {
            days: props.dormantDays,
          })}
        </span>
      </div>
      {warnings.length > 0 && (
        <div className="warning-list" role="alert">
          {warnings.map((warning, index) => (
            <p key={index}>{warning}</p>
          ))}
        </div>
      )}
      <div className="modal-actions">
        <span className="field-hint">{t('只读取 Git 记录，不修改项目文件')}</span>
        <button className="button" onClick={onScan} disabled={busy || disabled}>
          {busy ? (
            <>
              <LoaderCircle className="spin" size={16} />
              {t('正在寻找遗失的梦…')}
            </>
          ) : (
            <>
              {t('开始扫描')}
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}

export interface PluginDialogProps {
  draft: Settings;
  onChange: (settings: Settings) => void;
  plugins: PluginMeta[];
  onApply: () => void;
  onClose: () => void;
}

export function PluginDialog({ draft, onChange, plugins, onApply, onClose }: PluginDialogProps) {
  const { t } = useI18n();
  function togglePlugin(id: string) {
    onChange({
      ...draft,
      enabledPlugins: draft.enabledPlugins.includes(id)
        ? draft.enabledPlugins.filter((existing) => existing !== id)
        : [...draft.enabledPlugins, id],
    });
  }
  return (
    <Modal title={t('让墓园，按你的方式生长。')} eyebrow="PLUGIN WORKSHOP" wide onClose={onClose}>
      <div className="settings-fields">
        <label className="field">
          {t('墓园主人')}
          <input
            value={draft.ownerName}
            maxLength={40}
            onChange={(e) => onChange({ ...draft, ownerName: e.target.value })}
          />
        </label>
        <label className="field">
          {t('沉寂多少天后安息')}
          <select
            value={draft.dormantDays}
            onChange={(e) => onChange({ ...draft, dormantDays: Number(e.target.value) })}
          >
            {[30, 60, 90, 180, 365].map((days) => (
              <option key={days} value={days}>
                {t('{days} 天', { days })}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {t('新墓志铭的风格')}
          <select
            value={draft.epitaphStyle}
            onChange={(e) => onChange({ ...draft, epitaphStyle: e.target.value as EpitaphStyle })}
          >
            {Object.entries(styleName).map(([value, name]) => (
              <option key={value} value={value}>
                {t(name)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="workshop-title">
        <h3>
          {t('已安装插件')} <span>{plugins.length}</span>
        </h3>
        <span>{t('独立接口 · 按需启用')}</span>
      </div>
      <div className="plugin-list">
        {plugins.map((plugin) => (
          <div className="plugin-item" key={plugin.id}>
            <div className="plugin-icon">
              {plugin.kind === 'source' ? (
                <FolderGit2 size={20} />
              ) : plugin.kind === 'detector' ? (
                <Moon size={20} />
              ) : plugin.kind === 'epitaph' ? (
                <Sparkles size={20} />
              ) : (
                <ArrowDownToLine size={20} />
              )}
            </div>
            <div>
              <h4>
                {t(plugin.name)}
                <small>v{plugin.version}</small>
              </h4>
              <p>{t(plugin.description)}</p>
            </div>
            <button
              role="switch"
              aria-checked={draft.enabledPlugins.includes(plugin.id)}
              aria-label={t('启用 {name}', { name: t(plugin.name) })}
              className={`toggle ${draft.enabledPlugins.includes(plugin.id) ? 'on' : ''}`}
              onClick={() => togglePlugin(plugin.id)}
            >
              <span />
            </button>
          </div>
        ))}
      </div>
      <p className="field-hint">
        <CircleHelp size={13} />{' '}
        {t('规则只判断沉寂，不代表项目真的失败。手动安息或复活的项目会保留你的决定。')}
      </p>
      <div className="modal-actions">
        <button className="quiet-button" onClick={onClose}>
          {t('取消')}
        </button>
        <button className="button" onClick={onApply}>
          {t('保存设置')}
          <Check size={16} />
        </button>
      </div>
    </Modal>
  );
}

export interface ProjectDialogProps {
  project: Project;
  draftEpitaph: string;
  onEpitaphChange: (text: string) => void;
  draftCause: string;
  onCauseChange: (text: string) => void;
  style: EpitaphStyle;
  canReroll: boolean;
  onReroll: () => void;
  onToggleStatus: () => void;
  onSave: () => void;
  onClose: () => void;
}

export function ProjectDialog({
  project,
  draftEpitaph,
  onEpitaphChange,
  draftCause,
  onCauseChange,
  style,
  canReroll,
  onReroll,
  onToggleStatus,
  onSave,
  onClose,
}: ProjectDialogProps) {
  const { t } = useI18n();
  return (
    <Modal
      title={project.name}
      eyebrow={`${t(sourceName[project.source]).toUpperCase()} · ${project.status === 'buried' ? 'REST IN CODE' : 'A STORY STILL UNFOLDING'}`}
      onClose={onClose}
    >
      <div className="detail-facts">
        <span>
          <CalendarDays size={15} />
          {formatMonth(project.createdAt)} — {formatMonth(project.lastCommitAt)}
        </span>
        <span>
          <Code2 size={15} />
          {project.commits === null ? t('提交数未知') : `${project.commits} commits`}
        </span>
        <span>
          <Moon size={15} />
          {t('沉寂 {days} 天', { days: dormantDays(project) })}
        </span>
      </div>
      {project.description && <p className="modal-intro">{project.description}</p>}
      <label className="field">
        {t('墓志铭')}
        <textarea
          value={draftEpitaph}
          maxLength={160}
          rows={3}
          onChange={(e) => onEpitaphChange(e.target.value)}
        />
      </label>
      <label className="field">
        {t('趣味死因')}
        <input value={draftCause} maxLength={100} onChange={(e) => onCauseChange(e.target.value)} />
      </label>
      <div className="detail-tools">
        <button className="quiet-button" disabled={!canReroll} onClick={onReroll}>
          <RefreshCw size={14} />
          {t('换一句 {style}', { style: t(styleName[style]) })}
        </button>
        {project.url && /^https:\/\/github\.com\//.test(project.url) && (
          <a className="quiet-button" href={project.url} target="_blank" rel="noreferrer">
            {t('查看仓库')}
            <ExternalLink size={13} />
          </a>
        )}
      </div>
      {project.path && <p className="path-note">{project.path}</p>}
      <div className="detail-note">
        <Sparkles size={14} />
        {project.source === 'demo'
          ? t('这是演示项目，项目记录与文案仅供体验。')
          : t('墓志铭与死因是趣味创作，日期和提交数来自项目记录。')}
      </div>
      <div className="modal-actions">
        <button className="quiet-button revive-button" onClick={onToggleStatus}>
          {project.status === 'buried' ? (
            <>
              <Sprout size={16} />
              {t('复活这个项目')}
            </>
          ) : (
            <>
              <Moon size={16} />
              {t('让它安息')}
            </>
          )}
        </button>
        <button className="button" onClick={onSave}>
          {t('保存墓志铭')}
          <Check size={16} />
        </button>
      </div>
    </Modal>
  );
}

export interface AnnualDialogProps {
  year: number | 'all';
  years: number[];
  onYearChange: (year: number | 'all') => void;
  exportUrl: string;
  busy: boolean;
  error: string;
  enabled: boolean;
  isDemo: boolean;
  onGenerate: () => void;
  onClose: () => void;
}

export function AnnualDialog({
  year,
  years,
  onYearChange,
  exportUrl,
  busy,
  error,
  enabled,
  isDemo,
  onGenerate,
  onClose,
}: AnnualDialogProps) {
  const { locale, t } = useI18n();
  return (
    <Modal
      title={t('我的项目坟场，年度留念。')}
      eyebrow="A YEAR OF BEAUTIFUL UNFINISHED THINGS"
      wide
      onClose={onClose}
    >
      <p className="modal-intro">{t('把安息的项目排成一张长图，分享给同样「下次一定」的朋友。')}</p>
      <div className="export-controls">
        <label className="field">
          {t('纪念年份')}
          <select
            value={year}
            onChange={(e) =>
              onYearChange(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
          >
            <option value="all">{t('所有年份')}</option>
            {years.map((value) => (
              <option value={value} key={value}>
                {t('{year} 年', { year: value })}
              </option>
            ))}
          </select>
        </label>
        <button className="button" onClick={onGenerate} disabled={busy || !enabled}>
          {busy ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
          {t('生成长图')}
        </button>
      </div>
      <p className="field-hint">
        {t('按最后一次提交的 UTC 年份收录已安息项目。长图不包含本地路径与仓库链接。')}
        {isDemo ? t('当前将导出明确标注的示例项目。') : ''}
      </p>
      {!enabled && <p className="error-text">{t('年度长图插件已停用，请在插件工坊启用。')}</p>}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {exportUrl ? (
        <>
          <div className="export-preview">
            <img src={exportUrl} alt={t('我的项目坟场年度长图预览')} />
          </div>
          <div className="modal-actions">
            <span className="field-hint">{t('PNG · 1080px 宽 · 适合分享')}</span>
            <PosterDownload
              url={exportUrl}
              filename={`${locale === 'en' ? 'my-code-cemetery' : '我的项目坟场'}-${year}.png`}
            />
          </div>
        </>
      ) : (
        <div className="export-placeholder">
          <div className="mini-graves">
            †<span>†</span>†
          </div>
          <h3>{t('那些没填完的坑，也是一年的形状。')}</h3>
          <p>{t('选一个年份，给灵感拍张合照。')}</p>
        </div>
      )}
    </Modal>
  );
}
