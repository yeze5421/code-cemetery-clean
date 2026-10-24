// A development integration test of the actual isolated preload/IPC bridge.
// It never opens a user's data directory and is excluded from desktop packages.
const { app, dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const testRoot = process.env.CODE_CEMETERY_TEST_DATA;
if (!testRoot || !path.resolve(testRoot).startsWith(path.join(root, 'artifacts') + path.sep))
  throw new Error('Use an isolated artifacts test directory.');
app.setAppPath(root);
const fixture = path.join(testRoot, 'sample-repository');
const imagePath = path.join(testRoot, 'saved-poster.png');
const resultPath = path.join(testRoot, 'result.json');
const git = path.join(root, 'node_modules/dugite/git/cmd/git.exe');
let checks = {};
const timeout = setTimeout(() => {
  console.error('Desktop integration test timed out');
  app.exit(1);
}, 45000);
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [fixture] });
dialog.showSaveDialog = async () => ({ canceled: false, filePath: imagePath });
app.on('browser-window-created', (_event, window) => {
  window.webContents.once('did-finish-load', async () => {
    try {
      const invoke = (expression) => window.webContents.executeJavaScript(expression);
      const state = await invoke("window.cemeteryDesktop.readState('en')");
      assert.equal(state.error, undefined);
      assert.equal(state.value.projects.length, 0);
      checks.ipcRead = true;
      const directory = await invoke("window.cemeteryDesktop.chooseDirectory('en')");
      assert.equal(directory.value, fixture);
      checks.nativeDirectoryAdapter = true;
      await fs.mkdir(fixture, { recursive: true });
      await fs.writeFile(path.join(fixture, 'main.ts'), 'export const unfinished = true;\n');
      const environment = {
        ...process.env,
        GIT_AUTHOR_NAME: 'Demo',
        GIT_AUTHOR_EMAIL: 'demo@example.invalid',
        GIT_COMMITTER_NAME: 'Demo',
        GIT_COMMITTER_EMAIL: 'demo@example.invalid',
      };
      for (const args of [
        ['init', '--quiet'],
        ['add', '.'],
        ['-c', 'commit.gpgsign=false', 'commit', '-qm', 'A small idea'],
      ])
        execFileSync(git, ['-C', fixture, ...args], { env: environment, windowsHide: true });
      const scanned = await invoke(
        `window.cemeteryDesktop.scan(${JSON.stringify({ source: 'local', rootPath: fixture, maxDepth: 0, locale: 'en' })})`,
      );
      assert.equal(scanned.error, undefined);
      assert.equal(scanned.value.scannedCount, 1);
      assert.equal(scanned.value.projects[0].commits, 1);
      checks.bundledGitThroughIPC = true;
      const snapshot = { ...state.value, projects: scanned.value.projects, hasScanned: true };
      const saved = await invoke(
        `window.cemeteryDesktop.saveState(${JSON.stringify(snapshot)},'en')`,
      );
      assert.equal(saved.value.projects.length, 1);
      checks.ipcSave = true;
      const invalid = await invoke("window.cemeteryDesktop.saveState({},'en')");
      assert.ok(invalid.error);
      checks.invalidStateRejected = true;
      const token = 'ghp_' + 'x'.repeat(36);
      const credential = await invoke(
        `window.cemeteryDesktop.saveCredential(${JSON.stringify(token)},'en')`,
      );
      assert.equal(credential.error, undefined);
      assert.equal(credential.value, true);
      const encrypted = await fs.readFile(path.join(testRoot, 'github-token.bin'));
      assert.equal(encrypted.includes(Buffer.from(token)), false);
      checks.windowsCredentialEncryption = true;
      await invoke("window.cemeteryDesktop.saveCredential('','en')");
      const png = await fs.readFile(path.join(root, 'build-desktop/icon.png'));
      const poster = await invoke(
        `window.cemeteryDesktop.savePoster(new Uint8Array(${JSON.stringify([...png])}),'poster.png','en')`,
      );
      assert.equal(poster.error, undefined);
      assert.equal(poster.value, true);
      assert.deepEqual(await fs.readFile(imagePath), png);
      checks.nativeSaveAdapter = true;
      // Capture the app's own rendered page as a build artifact, without OS screenshot automation.
      const preview = await window.webContents.capturePage();
      assert.ok(!preview.isEmpty());
      await fs.writeFile(path.join(testRoot, 'desktop-preview.png'), preview.toPNG());
      checks.renderedPreview = true;
      await fs.writeFile(resultPath, JSON.stringify({ ok: true, checks }, null, 2));
      console.log(JSON.stringify({ ok: true, checks }));
      clearTimeout(timeout);
      app.quit();
    } catch (error) {
      console.error(error);
      clearTimeout(timeout);
      await fs.writeFile(
        resultPath,
        JSON.stringify({ ok: false, error: String(error), checks }, null, 2),
      );
      app.exit(1);
    }
  });
});
require(path.join(root, 'build-desktop/main.cjs'));
