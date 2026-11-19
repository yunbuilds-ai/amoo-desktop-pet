# Third-party notices

## dsh-pet · MIT

Copyright (c) 2026 PC2005-cloud. The [complete MIT notice](src/desktop/dsh-pet/LICENSE) accompanies the source and the portable build.

Upstream revision: [725088735a3ecc0933fae2c13e38beed87903ba7](https://github.com/PC2005-cloud/dsh-pet/commit/725088735a3ecc0933fae2c13e38beed87903ba7). Paths below are relative to the upstream `dsh-pet/` directory. The unmodified entries were byte-compared against the checked-out commit, with line endings normalized for comparison.

| Local path | Upstream path | Changes |
| --- | --- | --- |
| `src/desktop/dsh-pet/desktop-geometry.js` | `runtime/electron-helper/desktop-geometry.js` | Unmodified |
| `src/desktop/dsh-pet/pointer-target.js` | `runtime/electron-helper/pointer-target.js` | Unmodified |
| `src/desktop/dsh-pet/range.js` | `runtime/electron-helper/range.js` | Unmodified |
| `src/desktop/dsh-pet/taskbar-watchdog.js` | `runtime/electron-helper/taskbar-watchdog.js` | Unmodified |
| `src/desktop/dsh-pet/topmost-watchdog.js` | `runtime/electron-helper/topmost-watchdog.js` | Unmodified |
| `src/desktop/dsh-pet/tray-platform.js` | `runtime/electron-helper/tray-platform.js` | Unmodified |
| `src/desktop/dsh-pet/shared/types.ts` | `src/shared/types.ts` | Unmodified |
| `src/desktop/dsh-pet/shared/displays.ts` | `src/shared/displays.ts` | Unmodified |
| `src/desktop/dsh-pet/shared/physics/constants.ts` | `src/shared/physics/constants.ts` | Unmodified |
| `src/desktop/dsh-pet/shared/physics/contact.ts` | `src/shared/physics/contact.ts` | Unmodified |
| `src/desktop/dsh-pet/shared/physics/release.ts` | `src/shared/physics/release.ts` | Unmodified |
| `src/desktop/dsh-pet/shared/physics/spring.ts` | `src/shared/physics/spring.ts` | Unmodified |
| `src/desktop/dsh-pet/shared/physics/throw.ts` | `src/shared/physics/throw.ts` | Unmodified |
| `src/pet/dsh-pet-pickers.mjs` | `src/shared/pickers.ts` | Extracts weighted category selection, removes TS annotations, and injects the random function. Timing is handled by the desktop adapter. |

## Electron · MIT and third-party notices

The Windows portable archive includes [Electron 45.4.1](https://github.com/electron/electron/releases/tag/v45.4.1) from the official win32-x64 archive pinned in [runtime.lock.json](runtime.lock.json). Its `electron/LICENSE` and full `electron/LICENSES.chromium.html` accompany the distribution, including Chromium and bundled media components. No other npm runtime dependencies or compiler runtime redistributables are added by the app.

## Media, fonts and sound

See [ASSETS_LICENSE.md](ASSETS_LICENSE.md) for the separately gated art. No third-party character artwork, fonts, or sound files from the reference desktop projects are included. The bundled system runtime may render with the Windows fonts already installed on the host.
