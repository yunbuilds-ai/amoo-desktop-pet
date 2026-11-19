const { app, BrowserWindow, Menu, Tray, globalShortcut, ipcMain, nativeImage, protocol, screen, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const readline = require('node:readline');
const { regionFor } = require('./window-shape.cjs');

const { buildDeskGeometry } = require('./dsh-pet/desktop-geometry.js');
const { parseRange } = require('./dsh-pet/range.js');
const { trayPlatform } = require('./dsh-pet/tray-platform.js');
const { topmostLevel } = require('./dsh-pet/topmost-watchdog.js');
const { shouldRunTaskbarWatchdog, TASKBAR_WATCHDOG_TICK_MS } = require('./dsh-pet/taskbar-watchdog.js');
const { makeWindowThrow, nativeCoordinate } = require('./throw-window.cjs');
const { normalizeMotion, motionMenu } = require('./motion-settings.cjs');
const { peers } = require('./pet-peers.cjs');
const { randomBytes } = require('node:crypto');
const { artFootprint, artLimits, currentFootprint, inside } = require('./visible-bounds.cjs');

const root = path.resolve(__dirname, '..', '..');
const petRoot = path.join(root, 'src', 'pet');
const assetRoot = path.join(root, 'assets');
const { resolveAsset } = require('./asset-routes.cjs');
const instance = process.argv.find(value => /^--aomm-instance=[a-f0-9]{16}$/.test(value))?.split('=')[1];
const profile = path.join(root, 'cache', instance ? 'desktop-' + instance : 'desktop-profile');
const desktopURL = 'aomm-pet://local/pet/desktop.html';
const position = path.join(profile, 'window.json');
const character = JSON.parse(fs.readFileSync(path.join(assetRoot,'character','manifest.json'),'utf8'));
let win, tray, passthrough = false, pinned = true, scale = 1;
let dragOrigin, ignored = false;
let regions, shapeKey, mask = [];
let manuallyHidden = false, fullscreenHidden = false, fullscreenProbe, frameReady = false;
let taskbarTimer, quiet = false;
let flight, dragThrow = false, stopPeers, saveRetry;
let motion=normalizeMotion();

fs.mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
app.setPath('sessionData', profile);
app.setPath('crashDumps', profile);
for (const option of ['disable-background-networking','disable-component-update',
  'disable-domain-reliability','no-pings']) app.commandLine.appendSwitch(option);
protocol.registerSchemesAsPrivileged([{ scheme: 'aomm-pet',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

function fail(status, error) {
  return Response.json({ ok: false, error }, { status });
}

async function serve(request) {
  const file = resolveAsset(request.url,request.method,petRoot,assetRoot);
  if (!file) return fail(404, '未知资源');
  let buffer;
  try { buffer = await fs.promises.readFile(file); }
  catch { return fail(404, '未知资源'); }
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.frag': 'text/plain',
    '.webm': 'video/webm', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
  const range = path.extname(file) === '.webm' ? parseRange(request.headers.get('range'), buffer.length) : null;
  if (range === 'unsatisfiable') return new Response(null, { status: 416,
    headers: { 'Content-Range': 'bytes */' + buffer.length, 'Accept-Ranges': 'bytes' } });
  if (range) {
    const { start: first, end: last } = range;
    return new Response(buffer.subarray(first,last+1), { status:206, headers: {
      'Content-Type':'video/webm', 'Accept-Ranges':'bytes',
      'Content-Length':String(last-first+1), 'Content-Range':'bytes '+first+'-'+last+'/'+buffer.length
    } });
  }
  return new Response(buffer, {
    headers: { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
      'Content-Length': String(buffer.length) }
  });
}

function restore() {
  try { return JSON.parse(fs.readFileSync(position, 'utf8')); }
  catch { return {}; }
}

function bounds(saved) {
  const displays = screen.getAllDisplays();
  const primaryId = screen.getPrimaryDisplay().id;
  const geometry = buildDeskGeometry(displays,primaryId,process.platform);
  const primary = geometry.workAreas[geometry.primaryIndex];
  const x = Number.isFinite(saved.x) ? saved.x : primary.x + primary.width - 345;
  const y = Number.isFinite(saved.y) ? saved.y : primary.y + primary.height - 515;
  const nearest = screen.getDisplayNearestPoint({ x:x+160*scale, y:y+260*scale });
  const area = geometry.workAreas[displays.findIndex(display => display.id === nearest.id)] || primary;
  const width = Math.min(area.width, Math.round(320 * scale));
  const height = Math.min(area.height, Math.round(470 * scale));
  const limits = artLimits(area, artFootprint({width,height},character.visibleBounds));
  return {x:inside(x,limits.minX,limits.maxX),y:inside(y,limits.minY,limits.maxY),width,height};
}

function save() {
  if (!win || win.isDestroyed()) return;
  const temporary=position+'.tmp';
  try {
    fs.writeFileSync(temporary,JSON.stringify({...win.getBounds(),scale,pinned,quiet,dragThrow,motion}));
    fs.renameSync(temporary,position);
    clearTimeout(saveRetry); saveRetry=undefined;
  } catch (error) {
    if (!saveRetry && ['EBUSY','EACCES','EPERM'].includes(error.code)) {
      saveRetry=setTimeout(()=>{
        save(); saveRetry=undefined;
      },250);
      saveRetry.unref();
    } else if (!['EBUSY','EACCES','EPERM'].includes(error.code)) {
      console.error('桌宠设置保存失败',error.code || error.name);
    }
  }
}

function changeMotion(change) {
  motion=normalizeMotion({...motion,...change});
  win.webContents.send('companion:motion-settings',motion);
  trayMenu();
  save();
}

function addPet() {
  const instance=randomBytes(8).toString('hex');
  const folder=path.join(root,'cache','desktop-'+instance);
  const previous=win.getBounds();
  const area=screen.getDisplayMatching(previous).workArea;
  const shift=previous.x+(previous.width/2)>area.x+area.width/2 ? -170 : 170;
  try {
    fs.mkdirSync(folder,{recursive:true});
    fs.writeFileSync(path.join(folder,'window.json'),JSON.stringify({x:previous.x+shift,y:previous.y-24,
      scale,pinned,quiet,dragThrow,motion}),{flag:'wx'});
    const child=spawn(process.execPath,[__dirname,'--aomm-instance='+instance],{detached:true,stdio:'ignore',windowsHide:true});
    child.on('error',error=>console.error('新增桌宠失败',error.code || error.name));
    child.unref();
  } catch (error) { console.error('新增桌宠失败',error.code || error.name); }
}

function bodyRect() {
  const window=win.getBounds();
  const footprint=currentFootprint(regions?.art,mask) || artFootprint(window,character.visibleBounds);
  return {left:window.x+footprint.left,top:window.y+footprint.top,
    right:window.x+footprint.right,bottom:window.y+footprint.bottom,
    visible:win.isVisible() && motion.collisions,moving:!!dragOrigin?.moved || flight.running};
}

function show() {
  manuallyHidden = false;
  passthrough = false;
  setIgnored(false);
  updateVisibility();
  trayMenu();
}

function hide() {
  endDrag(false);
  flight?.stop();
  manuallyHidden = true;
  updateVisibility();
  trayMenu();
}

function updateVisibility() {
  if (!frameReady) return;
  if (manuallyHidden || fullscreenHidden) win.hide();
  else {
    if (!win.isVisible()) win.showInactive();
    // Reapply the saved choice after native show: the constructor flag may
    // be lost while a transparent Windows window is initially hidden.
    if (win.isAlwaysOnTop() !== pinned) win.setAlwaysOnTop(pinned,topmostLevel(process.platform));
  }
  updateQuiet();
}

function watchFullscreen() {
  const helper = path.join(__dirname,'FullscreenProbe.exe');
  if (process.platform !== 'win32' || !fs.existsSync(helper)) return;
  fullscreenProbe = spawn(helper,[String(process.pid)],{ windowsHide:true, stdio:['ignore','pipe','ignore'] });
  fullscreenProbe.on('error', () => {});
  readline.createInterface({ input:fullscreenProbe.stdout }).on('line',value => {
    if (value !== '0' && value !== '1') return;
    fullscreenHidden = value === '1';
    updateVisibility();
  });
  fullscreenProbe.on('exit',() => {
    fullscreenHidden = false;
    if (win && !win.isDestroyed()) updateVisibility();
  });
}

function setIgnored(value) {
  if (value === ignored) return;
  ignored = value;
  win.setIgnoreMouseEvents(value, { forward: true });
}

function updateShape() {
  if (!regions || !win || win.isDestroyed() || typeof win.setShape !== 'function') return;
  const bounds = win.getContentBounds();
  // Keep the artwork rectangle during a grab so changing frames do not clip at the old silhouette.
  const shape = dragOrigin ? regionFor({controls:[regions.art,...regions.controls]},[],bounds) :
    regionFor(regions, mask, bounds);
  const key = JSON.stringify(shape);
  if (key === shapeKey) return;
  try { win.setShape(shape); } catch (error) { console.error('Desktop region:', error.message); return; }
  shapeKey = key;
}

function moveDrag(cursor) {
  if (!dragOrigin) return;
  const dx = cursor.x - dragOrigin.cursor.x;
  const dy = cursor.y - dragOrigin.cursor.y;
  if (!dragOrigin.moved && Math.hypot(dx,dy) < 5) return;
  if (dx === dragOrigin.dx && dy === dragOrigin.dy) return;
  if (!dragOrigin.moved) win.webContents.send('companion:dragging',true);
  Object.assign(dragOrigin,{moved:true,dx,dy});
  flight.sample(dx,dy);
  const x=nativeCoordinate(dragOrigin.x+dx),y=nativeCoordinate(dragOrigin.y+dy);
  if (x!==null && y!==null) win.setPosition(x,y);
}

function endDrag(allowThrow) {
  if (!dragOrigin) return;
  const {moved,probe,mayThrow} = dragOrigin;
  dragOrigin = null;
  if (probe.exitCode === null) probe.kill();
  win.webContents.send('companion:dragging',false);
  if (moved) win.setBounds(bounds(win.getBounds()));
  updateShape();
  if (moved && (!mayThrow || allowThrow!==true || !dragThrow || !flight.release())) save();
}

function zoom(amount) {
  if (![.85, 1, 1.2, 1.35].includes(amount)) return;
  scale = amount;
  win.setBounds(bounds(win.getBounds()));
  save();
}

function updateQuiet() {
  win.webContents.send('companion:quiet',quiet || manuallyHidden || fullscreenHidden);
}

function quietMode() {
  quiet = !quiet;
  updateQuiet();
  trayMenu();
  save();
}

function trayMenu() {
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示', enabled: manuallyHidden || passthrough, click: show },
    { label: '隐藏', enabled: !manuallyHidden, click: hide },
    { label: '置顶', type: 'checkbox', checked: pinned,
      click: item => { pinned = item.checked; win.setAlwaysOnTop(pinned,topmostLevel(process.platform)); save(); } },
    { label: '点击穿透', type: 'checkbox', checked: passthrough,
      click: item => { passthrough = item.checked; setIgnored(passthrough); trayMenu(); } },
    { label: '缩放', submenu: [.85, 1, 1.2, 1.35].map(amount => ({
      label: Math.round(amount * 100) + '%', click: () => zoom(amount) })) },
    { label: '回到默认位置', click: () => { show(); win.setBounds(bounds({})); save(); } },
    { label: '安静模式', type: 'checkbox', checked: quiet, click: quietMode },
    { label: '拖拽甩动', type: 'checkbox', checked: dragThrow,
      click: item => { dragThrow = item.checked; if (!dragThrow) flight?.stop(); save(); } },
    motionMenu(motion,changeMotion),
    { label: '新增同款桌宠', click:addPet },
    { label: '退出', click: () => app.quit() }
  ]));
}

function receive(channel, handler) {
  ipcMain.on('companion:' + channel, (event, ...values) => {
    if (event.sender === win?.webContents && event.senderFrame?.url === desktopURL) handler(...values);
  });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) show(); });
  app.on('before-quit', () => { endDrag(false); stopPeers?.(); clearTimeout(saveRetry); clearInterval(taskbarTimer); flight?.stop(); globalShortcut.unregisterAll(); fullscreenProbe?.kill(); });
  app.whenReady().then(async () => {
    try {
      mask = JSON.parse(fs.readFileSync(path.join(assetRoot,'character','manifest.json'),'utf8')).hitMask;
    } catch { mask = []; }
    protocol.handle('aomm-pet', serve);
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      callback({ cancel: !details.url.startsWith('aomm-pet://local/') });
    });
    const saved = restore();
    if ([.85, 1, 1.2, 1.35].includes(saved.scale)) scale = saved.scale;
    pinned = saved.pinned !== false;
    quiet = saved.quiet === true;
    dragThrow = saved.dragThrow === true;
    motion=normalizeMotion(saved.motion);
    win = new BrowserWindow({ ...bounds(saved), frame: false, transparent: true, alwaysOnTop: pinned,
      skipTaskbar: true, show: false, hasShadow: false,
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false,
        sandbox: true, contextIsolation: true, webSecurity: true, backgroundThrottling: false } });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('context-menu', () => { if (!passthrough) tray.popUpContextMenu(); });
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.webContents.on('will-attach-webview', event => event.preventDefault());
    flight = makeWindowThrow({win, screen,
      geometry: (displays,id) => buildDeskGeometry(displays,id,process.platform), settled: save, footprint: size => currentFootprint(regions?.art,mask) || artFootprint(size,character.visibleBounds)});
    stopPeers=peers({directory:path.join(root,'cache','presence'),state:bodyRect,onContact:direction=>{
      flight.bump(direction);
      win.webContents.send('companion:collision');
    }});
    win.on('moved', () => { if (!flight.running && !dragOrigin) save(); });
    win.on('resize',updateShape);
    win.on('close', save);
    screen.on('display-added', () => win.setBounds(bounds(win.getBounds())));
    screen.on('display-removed', () => win.setBounds(bounds(win.getBounds())));
    screen.on('display-metrics-changed', () => win.setBounds(bounds(win.getBounds())));
    tray = new Tray(nativeImage.createFromPath(path.join(assetRoot,'character','tray.png')));
    tray.setToolTip('Amoo 桌宠');
    tray.on('double-click', show);
    if (trayPlatform(process.platform).leftClickPopsMenu) tray.on('click', () => {
      if (manuallyHidden || passthrough) show();
      else tray.popUpContextMenu();
    });
    if (shouldRunTaskbarWatchdog(process.platform)) {
      taskbarTimer = setInterval(() => {
        if (!win.isDestroyed()) win.setSkipTaskbar(true);
      },TASKBAR_WATCHDOG_TICK_MS);
      taskbarTimer.unref();
    }
    trayMenu();
    receive('first-frame',()=>{
      if (frameReady) return;
      frameReady=true;
      updateVisibility();
    });
    receive('hide', hide);
    receive('scale', zoom);
    receive('regions', (art, controls, alphaMask) => {
      const valid = value => Array.isArray(value) && value.length === 4 &&
        value.every(item => Number.isFinite(item) && Math.abs(item) <= 8192) && value[2] > 0 && value[3] > 0;
      if (!valid(art) || !Array.isArray(controls) || controls.length > 20 || !controls.every(valid)) return;
      // This IPC already checks the exact owning webContents and frame URL.
      // Accept only the fixed, binary mask; never arbitrary native regions.
      if (alphaMask !== undefined && (!Array.isArray(alphaMask) || alphaMask.length !== 60 ||
          !Array.from(alphaMask).every(row => Array.isArray(row) && row.length === 48 &&
            Array.from(row).every(value => value === 0 || value === 1)))) return;
      if (alphaMask) mask = alphaMask;
      regions = { art, controls };
      updateShape();
    });
    receive('drag-start', allowThrow => {
      if (dragOrigin) return;
      flight.begin();
      const cursor = screen.getCursorScreenPoint();
      const probe = spawn(path.join(__dirname,'PointerDrag.exe'),[],{windowsHide:true,stdio:['ignore','pipe','ignore']});
      dragOrigin = {...win.getBounds(),cursor,moved:false,probe,mayThrow:allowThrow===true};
      updateShape();
      const samples = readline.createInterface({input:probe.stdout});
      samples.on('line', line => {
        if (dragOrigin?.probe !== probe) return;
        if (line === 'up') { endDrag(true); return; }
        if (!/^-?\d+,-?\d+$/.test(line)) return;
        const [x,y] = line.split(',').map(Number);
        moveDrag(screen.screenToDipPoint({x,y}));
      });
      probe.on('error',() => { if (dragOrigin?.probe===probe) endDrag(false); });
      probe.on('close',() => { if (dragOrigin?.probe===probe) endDrag(false); });
    });
    win.webContents.on('did-start-navigation', () => endDrag(false));
    win.webContents.on('did-finish-load',()=>{
      updateQuiet(); win.webContents.send('companion:motion-settings',motion);
    });
    await win.loadURL(desktopURL);
    globalShortcut.register('CommandOrControl+Alt+Shift+P', show);
    watchFullscreen();
    // A renderer failure must still leave a recoverable static window.
    setTimeout(()=>{
      if (!frameReady && win && !win.isDestroyed()) {
        frameReady=true;
        updateVisibility();
      }
    },5500).unref();
  });
}
