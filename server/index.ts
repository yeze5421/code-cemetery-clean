import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { localGitSource } from '../src/plugins/sources/local-git.js';
import { githubSource } from '../src/plugins/sources/github.js';
import type { SourcePlugin } from '../src/core/types.js';
import { StateStore } from './storage.js';
import { createTranslator, normalizeLocale } from '../src/i18n/translate.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export interface ServerOptions {
  statePath?: string;
  production?: boolean;
  port?: number;
  sources?: SourcePlugin[];
}
export function createApp(options: ServerOptions = {}) {
  const app = express();
  const port = options.port ?? 4317;
  const store = new StateStore(options.statePath ?? path.join(projectRoot, '.data', 'state.json'));
  const sources = new Map(
    (options.sources ?? [localGitSource, githubSource]).map((plugin) => [plugin.id, plugin]),
  );
  const allowed = new Set([
    `127.0.0.1:${port}`,
    `localhost:${port}`,
    '127.0.0.1:5173',
    'localhost:5173',
  ]);
  let scanning = false;
  app.disable('x-powered-by');
  app.use('/api', (req, res, next) => {
    res.locals.locale = normalizeLocale(req.headers['accept-language']);
    const t = createTranslator(res.locals.locale);
    res.locals.t = t;
    if (!allowed.has(req.headers.host ?? '')) {
      res.status(403).json({ error: t('只允许从本机访问扫描服务。') });
      return;
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.origin;
      if (
        req.headers['sec-fetch-site'] === 'cross-site' ||
        (origin && ![...allowed].some((host) => origin === `http://${host}`))
      ) {
        res.status(403).json({ error: t('已阻止来自其他网页的请求。') });
        return;
      }
      if (!req.is('application/json')) {
        res.status(415).json({ error: t('请求须使用 JSON 格式。') });
        return;
      }
    }
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '10mb' }));
  app.get('/api/health', (_req, res) =>
    res.json({
      ok: true,
      version: '1.0.0',
      githubTokenConfigured: Boolean(process.env.GITHUB_TOKEN),
    }),
  );
  app.get('/api/state', async (_req, res) => {
    try {
      res.json(await store.read());
    } catch (error) {
      res.status(503).json({ error: res.locals.t((error as Error).message) });
    }
  });
  app.put('/api/state', async (req, res) => {
    try {
      res.json(await store.write(req.body));
    } catch (error) {
      res.status(400).json({ error: res.locals.t((error as Error).message) });
    }
  });
  app.post('/api/scan', async (req, res) => {
    if (scanning) {
      res.status(409).json({ error: res.locals.t('已有扫描进行中，请等待本轮完成。') });
      return;
    }
    const sourceId = req.body?.source === 'local' ? 'local-git' : req.body?.source;
    const plugin = sources.get(sourceId);
    if (!plugin) {
      res.status(400).json({ error: res.locals.t('不支持此扫描来源。') });
      return;
    }
    scanning = true;
    try {
      const state = await store.read();
      if (!state.settings.enabledPlugins.includes(plugin.id)) {
        res.status(400).json({ error: res.locals.t('此来源插件已停用，请在插件设置中启用。') });
        return;
      }
      const result = await plugin.scan({
        locale: res.locals.locale,
        rootPath: req.body.rootPath,
        username: req.body.username,
        maxDepth: req.body.maxDepth,
      });
      res.json(result);
    } catch (error) {
      res
        .status(400)
        .json({ error: res.locals.t((error as Error).message || '扫描失败，请稍后重试。') });
    } finally {
      scanning = false;
    }
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: res.locals.t('此接口不存在。') }));
  if (options.production) {
    const directory = path.join(projectRoot, 'dist');
    app.use(express.static(directory));
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(directory, 'index.html')));
  }
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    res
      .status(error?.type === 'entity.too.large' ? 413 : 400)
      .json({
        error: (res.locals.t ?? createTranslator('zh-CN'))(
          error?.type === 'entity.too.large' ? '请求数据过大。' : '请求格式不正确。',
        ),
      });
  };
  app.use(errorHandler);
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const envFile = path.join(projectRoot, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const port = Number(process.env.PORT || 4317);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error('PORT 须为 1024–65535 的端口号。');
  const app = createApp({ port, production: process.argv.includes('--production') });
  app.listen(port, '127.0.0.1', () => console.log(`Code Cemetery API: http://127.0.0.1:${port}`));
}
