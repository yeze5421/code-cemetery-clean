import { app, BrowserWindow, dialog, ipcMain, Menu, safeStorage, session, shell } from 'electron';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { StateStore } from '../server/storage';
import { scanLocalGit } from '../src/plugins/sources/local-git';
import { scanGitHub } from '../src/plugins/sources/github';
import { createTranslator, normalizeLocale } from '../src/i18n/translate';
import { CredentialStore } from './credentials';
import { isRepositoryURL, isTrustedFrame, validatePoster, validateScanInput } from './policy';

app.setName('Code Cemetery');
// This override is available only to unpackaged development/test builds.
const testDataPath = !app.isPackaged && process.env.CODE_CEMETERY_TEST_DATA;
if (testDataPath) app.setPath('userData', path.resolve(testDataPath));
const entryPath = path.join(app.getAppPath(), 'dist', 'index.html');
const gitRoot = app.isPackaged
  ? path.join(process.resourcesPath, 'git')
  : path.join(app.getAppPath(), 'node_modules', 'dugite', 'git');
const gitExecutable = path.join(gitRoot, process.platform === 'win32' ? 'cmd/git.exe' : 'bin/git');
let mainWindow: BrowserWindow | null = null;
let scanning = false;
let stateStore: StateStore;
let credentials: CredentialStore;

function handle(
  channel: string,
  localeIndex: number,
  operation: (...args: any[]) => Promise<unknown>,
) {
  ipcMain.handle(channel, async (event, ...args) => {
    const locale = normalizeLocale(localeIndex < 0 ? args[0]?.locale : args[localeIndex]);
    const t = createTranslator(locale);
    if (
      !mainWindow ||
      event.sender !== mainWindow.webContents ||
      !event.senderFrame ||
      event.senderFrame.routingId !== event.sender.mainFrame.routingId ||
      !isTrustedFrame(event.senderFrame.url, entryPath)
    )
      return { error: t('已阻止不受信任的桌面请求。') };
    try {
      return { value: await operation(...args) };
    } catch (error) {
      return { error: t((error as Error).message || '操作失败，请稍后重试') };
    }
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 880,
    minWidth: 920,
    minHeight: 680,
    backgroundColor: '#121d18',
    title: 'Code Cemetery',
    show: false,
    icon: path.join(app.getAppPath(), 'build-desktop', 'icon.png'),
    webPreferences: {
      preload: path.join(app.getAppPath(), 'build-desktop', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isRepositoryURL(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedFrame(url, entryPath)) event.preventDefault();
  });
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  await mainWindow.loadFile(entryPath);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.focus();
  });
  app
    .whenReady()
    .then(async () => {
      Menu.setApplicationMenu(null);
      session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
        callback(false),
      );
      session.defaultSession.setPermissionCheckHandler(() => false);
      // Desktop renderer is offline; only the main process can contact GitHub.
      session.defaultSession.webRequest.onBeforeRequest((details, callback) =>
        callback({
          cancel: !['file:', 'blob:', 'data:', 'devtools:'].some((prefix) =>
            details.url.startsWith(prefix),
          ),
        }),
      );
      session.defaultSession.webRequest.onHeadersReceived((details, callback) =>
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'",
            ],
          },
        }),
      );
      stateStore = new StateStore(path.join(app.getPath('userData'), 'state.json'));
      credentials = new CredentialStore(path.join(app.getPath('userData'), 'github-token.bin'), {
        available: () => safeStorage.isAsyncEncryptionAvailable(),
        encrypt: (token) => safeStorage.encryptStringAsync(token),
        decrypt: async (data) => (await safeStorage.decryptStringAsync(data)).result,
      });
      handle('cemetery:read', 0, () => stateStore.read());
      handle('cemetery:save', 1, (state) => stateStore.write(state));
      handle('cemetery:scan', -1, async (input) => {
        const options = validateScanInput(input);
        const t = createTranslator(options.locale ?? 'zh-CN');
        if (scanning) throw new Error(t('已有扫描进行中，请等待本轮完成。'));
        scanning = true;
        try {
          const state = await stateStore.read();
          if (
            !state.settings.enabledPlugins.includes(
              options.source === 'local' ? 'local-git' : 'github',
            )
          )
            throw new Error(t('此来源插件已停用，请在插件设置中启用。'));
          return options.source === 'local'
            ? await scanLocalGit(options, {
                executable: gitExecutable,
                environment: {
                  GIT_EXEC_PATH: path.join(
                    gitRoot,
                    process.platform === 'win32' ? 'ucrt64/libexec/git-core' : 'libexec/git-core',
                  ),
                },
              })
            : await scanGitHub(options, await credentials.read());
        } finally {
          scanning = false;
        }
      });
      handle('cemetery:choose-directory', 0, async (locale) => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
          title: createTranslator(normalizeLocale(locale))('选择项目文件夹'),
          properties: ['openDirectory'],
        });
        return canceled ? null : (filePaths[0] ?? null);
      });
      handle('cemetery:credential-status', 0, async () => Boolean(await credentials.read()));
      handle('cemetery:credential-save', 1, (token) => credentials.save(token));
      handle('cemetery:save-poster', 2, async (bytes, filename, locale) => {
        const poster = validatePoster(bytes, filename);
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow!, {
          title: createTranslator(normalizeLocale(locale))('保存年度长图'),
          defaultPath: path.join(app.getPath('pictures'), poster.filename),
          filters: [{ name: 'PNG', extensions: ['png'] }],
        });
        if (canceled || !filePath) return false;
        await writeFile(filePath, poster.bytes);
        return true;
      });
      await createWindow();
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) void createWindow();
      });
    })
    .catch(() => {
      dialog.showErrorBox(
        'Code Cemetery',
        '无法启动桌面应用。请重新解压完整程序后重试。\nUnable to start. Extract the complete application and try again.',
      );
      app.quit();
    });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
