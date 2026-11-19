# Windows x64 build

Use Windows x64, Python 3.12+, the Windows .NET Framework C# compiler and the archive listed in [runtime.lock.json](../runtime.lock.json). Node.js 24+ runs the source tests. The app contains no npm runtime dependencies.

Download the pinned Electron archive directly from the lock's URL. The build tool checks its SHA-256 against the lock before extraction. The complete Electron and Chromium notices travel with the portable package.

```powershell
npm test
python tools/build_portable.py --runtime path/to/electron-v45.4.1-win32-x64.zip --assets path/to/approved-pack --output dist
```

Extract the ZIP to a writable directory and open `AOMM Companion.exe`. The three local Windows executables are compiled from the C# source in `src/desktop`. The bundle has no installer. Local settings and renderer caches are created under the portable directory on first run.

The character pack supplies `character/app.ico` with 16, 32, 48 and 256 pixel images for the launcher and window, and `character/tray.png` for the notification area.

Keep finished release ZIPs as GitHub Release assets. The [local playback example](../examples/README.md) shows how to call an action from the renderer.
