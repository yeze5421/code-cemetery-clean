# Modular pluggable architecture

Code Cemetery separates where projects come from, how inactivity is classified, how epitaphs are written, and how posters are exported. Plugins implement contracts from `src/core/types.ts`; the domain layer combines them, while the interface handles presentation.

## Data flow

```text
React interface
  |-- transport adapter --> Desktop IPC or local HTTP --> SourcePlugin
  |                                                       |
  |-- domain services <------ merge / classify / write <--- Project[]
  |      |-- DetectorPlugin
  |      '-- EpitaphPlugin
  |-- state adapter --> validated atomic JSON persistence
  '-- ExporterPlugin --> local Canvas --> PNG Blob
```

The desktop main process and optional Node service read the filesystem and GitHub credentials. The renderer handles presentation and drawing. Source implementations are never imported by the browser composition root.

## Directory responsibilities

| Directory | Responsibility |
| --- | --- |
| `src/core/` | Contracts, registry, merging, classification, dates |
| `src/bootstrap.ts` | Browser plugin composition root |
| `src/features/` | Scan, settings, memorial, export, and desktop views |
| `src/services/` | Transport selection and serialized saves |
| `src/plugins/sources/` | Local Git and GitHub readers |
| `src/plugins/detectors/` | Dormancy rules |
| `src/plugins/epitaphs/` | Deterministic local writing |
| `src/plugins/exporters/` | Poster selection, layout, and rendering |
| `src/i18n/` | Shared catalogs and language preferences |
| `src/data/` | Explicitly fictional demo records |
| `desktop/` | Main process, isolated bridge, encryption, input policies |
| `server/` | Optional HTTP adapter and shared state persistence |
| `scripts/` | Desktop build, launcher, and isolated integration test |
| `tests/` | Domain, adapter, translation, and boundary behavior |

## Contracts

Every plugin has a stable `id`, `name`, `description`, `version`, and discriminating `kind`.

```ts
interface SourcePlugin extends PluginMeta {
  kind: 'source';
  scan(options: ScanOptions): Promise<ScanResult>;
}
interface DetectorPlugin extends PluginMeta {
  kind: 'detector';
  classify(project: Project, settings: Settings, now?: Date): ProjectStatus;
}
interface EpitaphPlugin extends PluginMeta {
  kind: 'epitaph';
  generate(project: Project, style: EpitaphStyle, variant?: number, locale?: Locale):
    { epitaph: string; cause: string };
}
interface ExporterPlugin extends PluginMeta {
  kind: 'exporter';
  export(options: ExportOptions): Promise<Blob>;
}
```

A `Project` preserves source, dates, language, and commit count. Unavailable counts are `null`, never an invented zero. Status is `buried`, `alive`, or `revived`; `manualStatus` preserves an explicit user decision. Rescans preserve flowers and custom writing.

A `ScanResult` includes projects, scanned count, and warnings. A partial or rate-limited result must not be presented as a complete scan.

## Desktop transport

`src/services/api.ts` chooses the isolated desktop bridge when available, otherwise the local HTTP adapter. `desktop/contracts.ts` defines the limited operations: read/save state, scan, choose a directory, read credential status, save a credential, and save a PNG.

`desktop/main.ts` is the desktop composition root. It injects the bundled Git path into the local reader and the decrypted token into the GitHub reader. State lives in the operating-system application-data directory. No HTTP server is started.

`desktop/preload.ts` exposes specific methods, never raw IPC, filesystem access, or command execution. The main process validates the sender window, top-level frame, entry URL, and inputs. Native dialogs handle user-selected folders and destinations. The renderer is sandboxed, isolated, and has Node integration disabled.

## Add a plugin

1. Implement the relevant contract under `src/plugins/` with a unique stable ID.
2. Register browser plugins in `src/bootstrap.ts`. Register sources in the desktop composition root and, when needed, the HTTP service's source list or injected `sources`.
3. Provide metadata and enabled-state handling in the settings view.
4. Test external boundaries and failure cases. Keep core services dependent on contracts.

A new source may require a scan-form option and input fields. A new exporter may require the corresponding download extension. Plugins are registered at build time; arbitrary remote plugin code is not downloaded or executed.

Where a kind supports one active implementation, the first enabled registered implementation is used. Saves run in edit order, and scan results merge into the latest state to preserve edits made during a scan.

## Optional local HTTP API

| Method | Path | Input / output |
| --- | --- | --- |
| GET | `/api/health` | Service status |
| GET | `/api/state` | Current `AppState` |
| PUT | `/api/state` | Validated, atomically saved `AppState` |
| POST | `/api/scan` | `{ source, rootPath?, username?, maxDepth? }` to `ScanResult` |

Vite proxies `/api` to port 4317 during development. Production Web mode serves the built frontend and API from the same Node service. The service binds to `127.0.0.1` and checks Host and Origin for mutations and scans.

Web mode reads `GITHUB_TOKEN` from the environment. An optional root `.env` is loaded with `process.loadEnvFile()`; existing terminal variables take precedence. The token is never returned to the renderer. Desktop credentials use the separate encrypted store.

## Source semantics

Local dates and counts use commits reachable from the current `HEAD`; unique commits on other branches are not combined. The local reader accepts an explicit Git executable and environment, allowing the desktop distribution to work without a system Git installation.

GitHub uses the repository's `created_at` as its birth date, not necessarily its first commit. Last-commit dates and counts come from the default branch. If history cannot be read, the count stays `null`, inactivity uses `pushed_at` or creation time, and a warning explains the fallback.

Public repositories can be read by username. Private repository reads require a permitted token whose account matches the requested username. Repository metadata and commit records are read through the GitHub API; source files are not downloaded.

## Annual posters

`annualPngExporter.export({ year, ownerName, projects, locale })` returns a PNG `Blob`; `year` is a UTC year or `'all'`.

- Include only buried projects, filtered by the last commit's UTC year, newest first.
- Measure actual Canvas text widths and derive card heights from complete content.
- Wrap English at word boundaries, with grapheme-safe fallback for oversized identifiers.
- Use a 1080px canvas, limited to 30,000px height. Report oversized exports instead of silently dropping projects.
- Preserve source dates and unknown counts. Clearly label fictional demo projects.
- Omit local paths, repository links, credentials, and source code. Owner names, project names, and writing remain visible.

`selectExportProjects()` is a pure filter. `estimateExportDimensions()` provides an estimate; final size follows font measurement.

## Verification and extension

Detectors accept an optional `now` for boundary tests. Source adapters can be tested with temporary repositories and mocked HTTP responses. Desktop tests cover bundled Git without PATH, credential storage, input policies, and transport selection. The integration harness uses a separate test data directory.

Potential extensions include incremental indexing, more sources, additional languages, and new exporters. An AI writer can be added as a separate epitaph plugin; built-in writing requires no model service.
