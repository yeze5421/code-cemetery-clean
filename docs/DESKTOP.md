# Code Cemetery Desktop

## Install and run

Supported release: Windows 10/11, 64-bit.

Run `Code-Cemetery-Windows-Setup-x64.exe` to install, then open **Code Cemetery** from the desktop shortcut. Alternatively, fully extract `Code-Cemetery-Windows-x64.zip` and open `Code Cemetery.exe`. Keep the accompanying runtime and `resources` folders.

The desktop release includes Electron, Node.js, and Git. End users do not need to install those tools, open a browser, enter an address, or keep a terminal running.

## Find your projects

- **Local projects:** choose **Discover → Local folder → Choose folder → Start scan**. The app looks for repositories containing `.git`, up to five levels below the chosen folder. Plain code folders without Git records are not detected yet.
- **GitHub:** choose **GitHub repositories** and enter a username. Public repositories need no login. To read your own private repositories, expand **Private repositories (optional)**, save a read-only access token, and scan the same account's username.
- **Posters:** open **Year in review**, create a preview, and choose **Save to computer**. A native Save dialog lets you select a PNG destination.
- **Language:** use the language switch in the upper-right corner. Existing custom writing is preserved.

Local scanning, editing, epitaph generation, and poster export work offline. GitHub scans require internet access. The app reads Git records and does not modify or upload the original project files.

## Data and credentials

Project records and settings are saved as `state.json` in the current user's operating-system application-data directory for Code Cemetery. Optional GitHub tokens are stored separately as `github-token.bin` using operating-system encryption. They are not included in project records or exported pictures.

On Windows, token encryption uses DPAPI. Other software running under the same signed-in Windows account may still be able to decrypt those credentials; the encrypted file is not a substitute for protecting your system account.

The desktop app and optional Web service use separate data directories. Scan your project folders again to bring projects into the desktop app. The original Web records remain in `.data/state.json`.

Release packages exclude the development machine's real project records, credentials, screenshots, and testing output. New installations start with clearly marked fictional examples.

## Build

Contributors need Node.js 24 and internet access for the initial dependency installation. The package manager downloads Electron and dugite's embedded Git distribution from their official upstream releases.

```sh
npm ci --include=dev
npm run desktop
npm run dist:desktop
```

If dependency installation scripts were skipped, run `npm rebuild electron dugite`.

Build outputs appear in `release/`: the Windows installer, portable ZIP, and unpacked application directory. Upload the installer, ZIP, and SHA-256 checksums as release assets, keeping the stable filenames used by the README download links. Do not upload the whole development directory.

The current release is unsigned. Maintainers can sign future builds with their own code-signing certificate. macOS and Linux releases have not been built or tested.

## Runtime boundary

The main process loads the interface from local files and does not start an HTTP listener. Data access goes through `desktop/contracts.ts`.

The renderer uses context isolation, sandboxing, and disabled Node integration. The main process validates the sender window, frame, entry URL, and inputs. Native dialogs handle folder selection and PNG destinations. Git execution, credential encryption, and persistence stay in the main process.

See [ARCHITECTURE.md](ARCHITECTURE.md) and [THIRD_PARTY.md](THIRD_PARTY.md).
