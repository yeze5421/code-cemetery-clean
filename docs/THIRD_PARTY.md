# Third-party components

Code Cemetery Desktop uses Electron (MIT; Chromium and other included components retain their respective licenses), React / React DOM / Scheduler (MIT), and Lucide (ISC).

The desktop package includes the unmodified Git distribution downloaded by `dugite` 3.3.1 from the official `desktop/dugite-native` release. Git is GPL-2.0, and its runtime components retain their own licenses. Preserve `resources/git/LICENSE.txt` and the complete license and copyright notices under `resources/git/` when redistributing.

Exact embedded Git version, binary SHA-256 and release URL are recorded by dugite in `node_modules/dugite/script/embedded-git.json`. The desktop build copies that manifest into `build-desktop/` so the packaged application retains it. Upstream build recipes and source information: https://github.com/desktop/dugite-native and https://github.com/git-for-windows/git . If publishing binaries, provide corresponding source and build materials for the exact bundled versions alongside the release as required by the included licenses; retaining notices alone is insufficient.

The application build includes `THIRD-PARTY-LICENSES.txt` with the licenses of bundled frontend modules. Electron's own license and Chromium license notices are included by the packager. Code Cemetery's original source code is licensed under the MIT License in the repository root; third-party components retain their respective licenses.
