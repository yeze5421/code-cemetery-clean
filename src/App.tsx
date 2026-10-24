import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronDown,
  Code2,
  Flower2,
  FolderGit2,
  Github,
  Leaf,
  LoaderCircle,
  Plug,
  Plus,
  Search,
  Skull,
  Sparkles,
  Sprout,
  X,
  CalendarDays,
  Moon,
  SlidersHorizontal,
} from 'lucide-react';
import type {
  AppState,
  Project,
  Settings,
  ScanResult,
  EpitaphPlugin,
  ExporterPlugin,
} from './core/types';
import { classifyProjects, mergeProjects, formatMonth } from './core';
import { DEMO_PROJECTS, DEFAULT_SETTINGS } from './data/demo';
import { browserRegistry as registry, sourceMetadata } from './bootstrap';

import { GraveyardArt } from './components/GraveyardArt';
import { ScanDialog, PluginDialog, ProjectDialog, AnnualDialog } from './features/dialogs';
import { api } from './services/api';
import { SaveQueue } from './services/save-queue';
import { useI18n } from './i18n/react';
import { LanguageSwitcher } from './i18n/LanguageSwitcher';
import { localizeProject } from './i18n/content';
import { getDesktop } from './services/desktop';

const plugins = [...sourceMetadata, ...registry.list()];
const currentYear = new Date().getFullYear();
const sourceName = { local: '本地', github: 'GitHub', demo: '示例' };

const languageColors: Record<string, string> = {
  TypeScript: '#6fa3b7',
  JavaScript: '#c2b66c',
  Python: '#7d9dbe',
  Rust: '#bb8d72',
  Go: '#82b7aa',
  Vue: '#82a982',
  HTML: '#c58c6d',
  CSS: '#9a8fb6',
  Unknown: '#778371',
};

function Logo() {
  return (
    <span className="logo-mark">
      <Code2 size={21} />
      <span />
    </span>
  );
}
function TombMark({ index = 0 }: { index?: number }) {
  return (
    <div className={`tomb-mark tomb-mark-${index % 3}`} aria-hidden="true">
      <span>{index % 3 === 0 ? '†' : index % 3 === 1 ? '⌘' : '</>'}</span>
      <i />
    </div>
  );
}

export default function App() {
  const { locale, t } = useI18n();
  const [state, setState] = useState<AppState>({
    projects: [],
    settings: DEFAULT_SETTINGS,
    hasScanned: false,
  });
  const [ready, setReady] = useState(false),
    [saveError, setSaveError] = useState(''),
    [bootError, setBootError] = useState('');
  const [modal, setModal] = useState<'scan' | 'annual' | 'plugins' | null>(null),
    [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState(''),
    [source, setSource] = useState('all'),
    [status, setStatus] = useState('buried'),
    [sort, setSort] = useState('recent');
  const [toast, setToast] = useState(''),
    [busy, setBusy] = useState(false),
    [scanSource, setScanSource] = useState<'local' | 'github'>('local');
  const [rootPath, setRootPath] = useState(''),
    [username, setUsername] = useState(''),
    [warnings, setWarnings] = useState<string[]>([]);
  const [year, setYear] = useState<number | 'all'>(currentYear),
    [exportUrl, setExportUrl] = useState(''),
    [exportBusy, setExportBusy] = useState(false),
    [exportError, setExportError] = useState('');
  const [draftEpitaph, setDraftEpitaph] = useState(''),
    [draftCause, setDraftCause] = useState('');
  const [settingsDraft, setSettingsDraft] = useState<Settings>(DEFAULT_SETTINGS);
  const saveVersion = useRef(0),
    hasChanged = useRef(false),
    epitaphVariant = useRef(0);
  const saveQueue = useRef(
    new SaveQueue<AppState>((snapshot) =>
      api('/api/state', { method: 'PUT', body: JSON.stringify(snapshot) }),
    ),
  );
  const notify = useCallback((message: string) => setToast(message), []);
  const closeModal = useCallback(() => {
    setModal(null);
    setSelectedId(null);
  }, []);
  useEffect(() => {
    let alive = true;
    api<AppState>('/api/state')
      .then((data) => {
        if (!alive) return;
        setState({
          ...data,
          projects:
            data.projects.length || data.hasScanned
              ? classifyProjects(data.projects, data.settings, registry, undefined, locale)
              : DEMO_PROJECTS.map((p) => ({ ...p })),
        });
        setReady(true);
      })
      .catch((e) => {
        if (alive) {
          setBootError(e.message);
          setReady(true);
          setState({
            projects: DEMO_PROJECTS.map((p) => ({ ...p })),
            settings: DEFAULT_SETTINGS,
            hasScanned: false,
          });
        }
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4200);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!ready || !hasChanged.current || bootError) return;
    const version = ++saveVersion.current;
    saveQueue.current
      .enqueue(state)
      .then(() => {
        if (version === saveVersion.current) setSaveError('');
      })
      .catch((e) => {
        if (version === saveVersion.current) setSaveError(e.message);
      });
  }, [state, ready, bootError]);
  useEffect(
    () => () => {
      if (exportUrl) URL.revokeObjectURL(exportUrl);
    },
    [exportUrl],
  );
  useEffect(() => {
    setExportUrl('');
    setExportError('');
    setToast('');
  }, [locale]);
  const updateState = (updater: (old: AppState) => AppState) => {
    hasChanged.current = true;
    setState(updater);
  };
  const setProjects = (updater: (old: Project[]) => Project[]) =>
    updateState((s) => ({ ...s, projects: updater(s.projects) }));
  const selected = state.projects.find((p) => p.id === selectedId);
  const activeWriter = registry
    .list('epitaph')
    .find((p) => state.settings.enabledPlugins.includes(p.id)) as EpitaphPlugin | undefined;
  const activeExporter = registry
    .list('exporter')
    .find((p) => state.settings.enabledPlugins.includes(p.id)) as ExporterPlugin | undefined;
  const isDemo = !state.hasScanned && state.projects.every((p) => p.source === 'demo');
  const buried = state.projects.filter((p) => p.status === 'buried');
  const visible = useMemo(
    () =>
      state.projects
        .map((p) => localizeProject(p, locale))
        .filter(
          (p) =>
            (status === 'all' || p.status === status) &&
            (source === 'all' || p.source === source) &&
            `${p.name} ${p.language} ${p.epitaph} ${p.description}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === 'commits'
            ? (b.commits ?? 0) - (a.commits ?? 0)
            : sort === 'flowers'
              ? b.flowers - a.flowers
              : new Date(a.lastCommitAt).getTime() - new Date(b.lastCommitAt).getTime(),
        ),
    [state.projects, query, source, status, sort, locale],
  );
  const years = Array.from(
    new Set([currentYear, ...state.projects.map((p) => new Date(p.lastCommitAt).getUTCFullYear())]),
  )
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
  const flowerCount = state.projects.reduce((n, p) => n + p.flowers, 0);
  const commitCount = buried.reduce((n, p) => n + (p.commits ?? 0), 0);
  const draftBaseline = useRef({ epitaph: '', cause: '' });
  const openProject = (project: Project) => {
    const view = localizeProject(project, locale);
    draftBaseline.current = { epitaph: view.epitaph, cause: view.cause };
    setDraftEpitaph(view.epitaph);
    setDraftCause(view.cause);
    setSelectedId(project.id);
  };
  const giveFlower = (id: string) => {
    setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, flowers: p.flowers + 1 } : p)));
    notify(t('留下一朵小花。它来过，也认真过。'));
  };
  const openAnnual = () => {
    setExportError('');
    setExportUrl('');
    setModal('annual');
  };
  async function scan() {
    if (busy) return;
    if (!state.settings.enabledPlugins.includes(scanSource === 'local' ? 'local-git' : 'github')) {
      notify(t('请先在插件工坊启用这个扫描器'));
      return;
    }
    if (
      (scanSource === 'local' && !rootPath.trim()) ||
      (scanSource === 'github' && !username.trim())
    ) {
      notify(t('请填写扫描目录或 GitHub 用户名'));
      return;
    }
    setBusy(true);
    setWarnings([]);
    try {
      await saveQueue.current.enqueue(state);
      const result = await api<ScanResult>('/api/scan', {
        method: 'POST',
        body: JSON.stringify({
          source: scanSource,
          rootPath: rootPath.trim(),
          username: username.trim(),
          maxDepth: 5,
        }),
      });
      updateState((s) => ({
        ...s,
        projects: classifyProjects(
          mergeProjects(
            !s.hasScanned && s.projects.every((p) => p.source === 'demo') ? [] : s.projects,
            result.projects,
          ),
          s.settings,
          registry,
          undefined,
          locale,
        ),
        hasScanned: true,
      }));
      setWarnings(result.warnings);
      setSource('all');
      setStatus('buried');
      notify(t('发现 {count} 个项目，墓园已更新', { count: result.scannedCount }));
      if (!result.warnings.length) setModal(null);
    } catch (e) {
      setWarnings([(e as Error).message]);
    } finally {
      setBusy(false);
    }
  }
  async function generateExport() {
    setExportBusy(true);
    setExportError('');
    try {
      if (!activeExporter) throw new Error(t('请先启用一个长图导出插件'));
      const blob = await activeExporter.export({
        locale,
        year,
        ownerName: state.settings.ownerName,
        projects: state.projects,
      });
      setExportUrl(URL.createObjectURL(blob));
    } catch (e) {
      setExportError((e as Error).message);
    } finally {
      setExportBusy(false);
    }
  }
  const applySettings = () => {
    updateState((s) => ({
      ...s,
      settings: settingsDraft,
      projects: classifyProjects(s.projects, settingsDraft, registry, undefined, locale),
    }));
    setModal(null);
    notify(t('墓园规则已更新'));
  };
  const openSettings = () => {
    setSettingsDraft({ ...state.settings, enabledPlugins: [...state.settings.enabledPlugins] });
    setModal('plugins');
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#" aria-label={t('代码墓地首页')}>
          <Logo />
          <span>
            {t('代码墓地')}
            <small>CODE CEMETERY</small>
          </span>
        </a>
        <nav aria-label={t('主导航')}>
          <button
            className={!modal ? 'nav-active' : ''}
            onClick={() => {
              closeModal();
              document.getElementById('cemetery')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            {t('我的墓园')}
          </button>
          <button onClick={openAnnual}>
            {t('年度祭典')}
            <span className="nav-dot" />
          </button>
          <button onClick={openSettings}>{t('插件工坊')}</button>
        </nav>
        <div className="header-actions">
          <LanguageSwitcher />
          <span className="local-status">
            <i />
            {t(getDesktop() ? '桌面版 · 本地运行' : '本地运行')}
          </span>
          <button className="button button-small" onClick={() => setModal('scan')}>
            <Plus size={16} />
            {t('发现项目')}
          </button>
        </div>
      </header>
      <main>
        {(bootError || saveError) && (
          <div className="error-banner" role="alert">
            {bootError
              ? t('本地服务未连接，当前展示示例：{error}', { error: bootError })
              : t('保存失败：{error}', { error: saveError })}
            <button onClick={() => location.reload()}>{t('重新连接')}</button>
          </div>
        )}
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow hero-eyebrow">
              <span className="tiny-cross">✦</span> A RESTING PLACE FOR YOUR SIDE PROJECTS
            </div>
            <h1>
              {t('这里，长眠着')}
              <br />
              <span>{t('未完成的伟大想法。')}</span>
            </h1>
            <p>
              {t('总有一些项目，开始于「改变世界」，结束于「下次一定」。')}
              <br />
              {t('为那些没来得及长大的灵感，留一块墓碑。')}
            </p>
            <div className="hero-actions">
              <button className="button" onClick={() => setModal('scan')}>
                <FolderGit2 size={17} />
                {t('扫描我的项目')}
                <ArrowRight size={17} />
              </button>
              <button className="text-button" onClick={openAnnual}>
                {t('生成年度墓园')}
                <ArrowDownToLine size={15} />
              </button>
            </div>
            <div className="hero-note">
              <span />
              {t('代码会沉寂，想法永不删除。')}
            </div>
          </div>
          <div className="hero-visual">
            <div className="art-label">
              THE GARDEN OF UNFINISHED THINGS<span>{t('独立开发者精神栖息地 · 01')}</span>
            </div>
            <GraveyardArt />
          </div>
        </section>
        <section className="statistics" aria-label={t('墓园统计')}>
          <div className="stat">
            <span>
              <Skull size={16} />
              {t('安息的项目')}
            </span>
            <strong>
              {buried.length.toString().padStart(2, '0')}
              <small>{t('座')}</small>
            </strong>
            <em>{t('每一个，都曾是下一个大事')}</em>
          </div>
          <div className="stat">
            <span>
              <Code2 size={16} />
              {buried.some((p) => p.commits === null) ? t('已知的 Commit') : t('封存的 Commit')}
            </span>
            <strong>
              {commitCount.toLocaleString()}
              <small>{t('次')}</small>
            </strong>
            <em>{t('至少，git 记得你努力过')}</em>
          </div>
          <div className="stat">
            <span>
              <Flower2 size={16} />
              {t('收到的小花')}
            </span>
            <strong>
              {flowerCount.toString().padStart(2, '0')}
              <small>{t('朵')}</small>
            </strong>
            <em>{t('献给那些无疾而终的热爱')}</em>
          </div>
          <div className="stat">
            <span>
              <Sprout size={16} />
              {t('等待下一次春天')}
            </span>
            <strong>
              {state.projects
                .filter((p) => p.status === 'revived')
                .length.toString()
                .padStart(2, '0')}
              <small>{t('个')}</small>
            </strong>
            <em>{t('说不定，明天就想起来了')}</em>
          </div>
        </section>
        <section className="cemetery-section" id="cemetery">
          <div className="section-heading">
            <div className="section-title">
              <h2>
                {t('我的墓园')}
                <span>{buried.length}</span>
              </h2>
              <p>{t('每一块墓碑背后，都有一个曾经熬夜的你。')}</p>
            </div>
            <div className="section-actions">
              {isDemo && (
                <span className="demo-badge">
                  <Sparkles size={12} />
                  {t('示例墓园')}
                </span>
              )}
              <button className="quiet-button" onClick={openSettings}>
                <SlidersHorizontal size={15} />
                {t('管理墓园')}
              </button>
            </div>
          </div>
          <div className="filter-bar">
            <div className="filter-tabs" role="group" aria-label={t('来源筛选')}>
              {[
                { id: 'all', name: t('全部项目'), icon: null },
                { id: 'local', name: t('本地项目'), icon: <FolderGit2 size={14} /> },
                { id: 'github', name: 'GitHub', icon: <Github size={14} /> },
              ].map((t) => (
                <button
                  key={t.id}
                  className={source === t.id ? 'active' : ''}
                  onClick={() => setSource(t.id)}
                >
                  {t.icon}
                  {t.name}
                  {t.id === 'all' && <span>{state.projects.length}</span>}
                </button>
              ))}
            </div>
            <div className="filter-right">
              <label className="search-box">
                <Search size={15} />
                <input
                  aria-label={t('搜索项目')}
                  placeholder={t('寻找一个未完成的梦…')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button onClick={() => setQuery('')} aria-label={t('清空搜索')}>
                    <X size={13} />
                  </button>
                )}
              </label>
              <div className="select-wrap">
                <select
                  aria-label={t('排序方式')}
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="recent">{t('沉寂最久')}</option>
                  <option value="commits">{t('Commit 最多')}</option>
                  <option value="flowers">{t('小花最多')}</option>
                </select>
                <ChevronDown size={13} />
              </div>
            </div>
          </div>
          <div className="status-row">
            <div>
              {[
                { id: 'buried', label: t('已安息') },
                { id: 'alive', label: t('还在生长') },
                { id: 'revived', label: t('已复活') },
                { id: 'all', label: t('所有状态') },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setStatus(t.id)}
                  className={status === t.id ? 'active' : ''}
                >
                  {t.label}
                  <span>
                    {t.id === 'all'
                      ? state.projects.length
                      : state.projects.filter((p) => p.status === t.id).length}
                  </span>
                </button>
              ))}
            </div>
            <span className="threshold-note">
              <Moon size={12} />
              {t('沉寂 {days} 天，暂且安息', { days: state.settings.dormantDays })}
            </span>
          </div>
          {!ready ? (
            <div className="empty-state">
              <LoaderCircle className="spin" />
              <h3>{t('正在推开墓园的门…')}</h3>
            </div>
          ) : visible.length === 0 ? (
            <div className="empty-state">
              <Sprout size={35} />
              <h3>{query ? t('这里没有找到这个梦') : t('这片土地，还很安静。')}</h3>
              <p>
                {query
                  ? t('试试另一个名字，或清空搜索条件。')
                  : source === 'all'
                    ? t('扫描一个项目目录，让被遗忘的想法有个归宿。')
                    : t('这个来源下还没有符合条件的项目。')}
              </p>
              <button
                className="button button-small"
                onClick={() => (query ? setQuery('') : setModal('scan'))}
              >
                {query ? t('清空搜索') : t('发现项目')}
                <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <div className="grave-grid">
              {visible.map((project, index) => (
                <article
                  key={project.id}
                  className={`grave-card ${project.status !== 'buried' ? 'living-card' : ''}`}
                >
                  <button
                    className="grave-main"
                    onClick={() => openProject(project)}
                    aria-label={t('查看 {name} 墓碑', { name: project.name })}
                  >
                    <div className="grave-top">
                      <span className="project-source">
                        {project.source === 'github' ? (
                          <Github size={13} />
                        ) : project.source === 'local' ? (
                          <FolderGit2 size={13} />
                        ) : (
                          <Sparkles size={12} />
                        )}{' '}
                        {t(sourceName[project.source])}
                      </span>
                      <span className="rip-label">
                        {project.status === 'buried'
                          ? 'REST IN CODE'
                          : project.status === 'revived'
                            ? 'HELLO AGAIN'
                            : 'STILL GROWING'}
                      </span>
                    </div>
                    <TombMark index={index} />
                    <h3>{project.name}</h3>
                    <div className="project-dates">
                      {formatMonth(project.createdAt)}
                      <span>—</span>
                      {project.status === 'buried' ? formatMonth(project.lastCommitAt) : t('至今')}
                    </div>
                    <p className="epitaph">「{project.epitaph}」</p>
                    <div className="grave-divider">
                      <span>✦</span>
                    </div>
                    <div className="cause-line">
                      <span>{t('死因')}</span>
                      {project.status === 'buried'
                        ? project.cause
                        : t('故事还在继续，暂不盖棺定论。')}
                    </div>
                  </button>
                  <footer className="grave-footer">
                    <span className="language">
                      <i style={{ background: languageColors[project.language] ?? '#9aab88' }} />
                      {['Unknown', '未识别'].includes(project.language)
                        ? t('未知语言')
                        : project.language}
                    </span>
                    <span className="commit-label">{project.commits ?? '?'} commits</span>
                    <button
                      className="flower-button"
                      onClick={() => giveFlower(project.id)}
                      aria-label={t('给 {name} 献花', { name: project.name })}
                    >
                      <Flower2 size={16} />
                      <span>{project.flowers}</span>
                    </button>
                  </footer>
                </article>
              ))}
            </div>
          )}
          <div className="cemetery-bottom">
            <span className="line" />
            <Leaf size={15} />
            <span>
              {isDemo
                ? t('这些是示例故事，扫描后会换成你的真实项目。')
                : t('不是每个想法都要抵达终点。出发过，就很好。')}
            </span>
            <span className="line" />
          </div>
        </section>
        <section className="annual-banner">
          <div className="annual-emblem">
            <CalendarDays size={29} />
            <span>{currentYear}</span>
          </div>
          <div>
            <span className="eyebrow">YOUR YEAR IN UNFINISHED PROJECTS</span>
            <h2>{t('今年的坑，也值得一张全家福。')}</h2>
            <p>{t('把你的项目坟场，变成一张扎心又好笑的年度长图。')}</p>
          </div>
          <button className="button button-outline" onClick={openAnnual}>
            {t('生成我的年度墓园')}
            <ArrowUpRightIcon />
          </button>
        </section>
      </main>
      <footer className="site-footer">
        <span>
          <Logo />
          {t('代码墓地')}
          <i>·</i>
          {t('献给所有永远有新想法的人')}
        </span>
        <span>
          Built with unfinished love.<span className="footer-cross">✦</span>
          <button onClick={openSettings}>
            {t('可插拔，自由生长')}
            <Plug size={12} />
          </button>
        </span>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      {modal === 'scan' && (
        <ScanDialog
          scanSource={scanSource}
          onSourceChange={setScanSource}
          rootPath={rootPath}
          onRootPathChange={setRootPath}
          username={username}
          onUsernameChange={setUsername}
          dormantDays={state.settings.dormantDays}
          warnings={warnings}
          busy={busy}
          disabled={!!bootError}
          onScan={scan}
          onClose={closeModal}
        />
      )}
      {modal === 'plugins' && (
        <PluginDialog
          draft={settingsDraft}
          onChange={setSettingsDraft}
          plugins={plugins}
          onApply={applySettings}
          onClose={closeModal}
        />
      )}
      {selected && (
        <ProjectDialog
          project={localizeProject(selected, locale)}
          draftEpitaph={draftEpitaph}
          onEpitaphChange={setDraftEpitaph}
          draftCause={draftCause}
          onCauseChange={setDraftCause}
          style={state.settings.epitaphStyle}
          canReroll={!!activeWriter}
          onReroll={() => {
            if (!activeWriter) return;
            const result = activeWriter.generate(
              selected,
              state.settings.epitaphStyle,
              ++epitaphVariant.current,
              locale,
            );
            setDraftEpitaph(result.epitaph);
            setDraftCause(result.cause);
          }}
          onToggleStatus={() => {
            setProjects((ps) =>
              ps.map((p) =>
                p.id === selected.id
                  ? {
                      ...p,
                      epitaph:
                        draftEpitaph === draftBaseline.current.epitaph
                          ? p.epitaph
                          : draftEpitaph.trim() || p.epitaph,
                      cause:
                        draftCause === draftBaseline.current.cause
                          ? p.cause
                          : draftCause.trim() || p.cause,
                      status: p.status === 'buried' ? 'revived' : 'buried',
                      manualStatus: true,
                    }
                  : p,
              ),
            );
            closeModal();
            notify(
              selected.status === 'buried'
                ? t('春天到了，项目已复活。')
                : t('已为这个项目留下一块墓碑。'),
            );
          }}
          onSave={() => {
            setProjects((ps) =>
              ps.map((p) =>
                p.id === selected.id
                  ? {
                      ...p,
                      epitaph:
                        draftEpitaph === draftBaseline.current.epitaph
                          ? p.epitaph
                          : draftEpitaph.trim() || p.epitaph,
                      cause:
                        draftCause === draftBaseline.current.cause
                          ? p.cause
                          : draftCause.trim() || p.cause,
                    }
                  : p,
              ),
            );
            closeModal();
            notify(t('墓志铭已刻好。'));
          }}
          onClose={closeModal}
        />
      )}
      {modal === 'annual' && (
        <AnnualDialog
          year={year}
          years={years}
          onYearChange={(value) => {
            setYear(value);
            setExportUrl('');
          }}
          exportUrl={exportUrl}
          busy={exportBusy}
          error={exportError}
          enabled={!!activeExporter}
          isDemo={isDemo}
          onGenerate={generateExport}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={16} style={{ transform: 'rotate(-35deg)' }} />;
}
