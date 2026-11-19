const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aommWindow', {
  firstFrame: () => ipcRenderer.send('companion:first-frame'),
  onQuiet(callback) { ipcRenderer.on('companion:quiet', (_event,value) => callback(value)); },
  onMotionSettings(callback) { ipcRenderer.on('companion:motion-settings',(_event,value)=>callback(value)); },
  onCollision(callback) { ipcRenderer.on('companion:collision',()=>callback()); },
  onDragging(callback) { ipcRenderer.on('companion:dragging', (_event,value) => callback(value)); },
  dragStart: allowThrow => ipcRenderer.send('companion:drag-start',allowThrow===true),
  hitRegions: (art,controls,mask) => ipcRenderer.send('companion:regions',art,controls,mask)
});
