import { build } from 'esbuild';
import { Resvg } from '@resvg/resvg-js';
import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(root, 'build-desktop');
await mkdir(output, { recursive: true });
const executable = path.join(
  root,
  'node_modules/dugite/git',
  process.platform === 'win32' ? 'cmd/git.exe' : 'bin/git',
);
await access(executable).catch(() => {
  throw new Error('Bundled Git is missing. Run npm rebuild dugite before packaging.');
});
await Promise.all([
  build({
    entryPoints: [path.join(root, 'desktop/main.ts')],
    outfile: path.join(output, 'main.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['electron'],
    sourcemap: false,
    legalComments: 'eof',
  }),
  build({
    entryPoints: [path.join(root, 'desktop/preload.ts')],
    outfile: path.join(output, 'preload.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['electron'],
    sourcemap: false,
  }),
]);
const svg = await readFile(path.join(root, 'public/favicon.svg'));
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 256 } }).render().asPng();
await writeFile(path.join(output, 'icon.png'), png);
// An ICO may contain a complete PNG image. A size byte of zero means 256px.
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);
await writeFile(path.join(output, 'icon.ico'), Buffer.concat([header, png]));
let notices = await readFile(path.join(root, 'docs/THIRD_PARTY.md'), 'utf8');
for (const name of ['react', 'react-dom', 'scheduler', 'lucide-react']) {
  const location = path.join(root, 'node_modules', name);
  let license;
  for (const filename of ['LICENSE', 'LICENSE.txt', 'LICENSE.md']) {
    try {
      license = await readFile(path.join(location, filename), 'utf8');
      break;
    } catch {
      /* Try next conventional name. */
    }
  }
  if (!license) throw new Error(`Missing dependency license: ${name}`);
  notices += `\n\n----- ${name} -----\n\n${license}`;
}
await writeFile(path.join(output, 'THIRD-PARTY-LICENSES.txt'), notices);
await copyFile(path.join(root, 'docs/DESKTOP.md'), path.join(output, 'DESKTOP.md'));
await copyFile(
  path.join(root, 'node_modules/dugite/script/embedded-git.json'),
  path.join(output, 'embedded-git.json'),
);
console.log('Desktop main, isolated preload, icon and dependency notices built.');
