'use strict';

const path = require('node:path');

const pet = new Set(['actor.mjs','behavior.mjs','behaviors.json','companion.css',
  'desktop-presenter.mjs','desktop.html','desktop.mjs','dsh-pet-pickers.mjs',
  'hit-mask.mjs','idle-handoff.mjs','idle-poses.json']);
const character = new Set(['character/manifest.json','character/poster.png','character/tray.png']);
const animation = /^animations\/(?:idle|greet|tap|reply|happy|confused|thinking|remind)\.(?:webm|webp|png)$/;

function resolveAsset(raw, method, petRoot, assetRoot) {
  if (method !== 'GET') return null;
  let url;
  try { url = new URL(raw); }
  catch { return null; }
  if (url.protocol !== 'aomm-pet:' || url.host !== 'local' || url.username || url.password || url.search)
    return null;
  const pathname = url.pathname;
  if (pathname.startsWith('/pet/')) {
    const file = pathname.slice('/pet/'.length);
    return pet.has(file) ? path.join(petRoot,file) : null;
  }
  if (pathname.startsWith('/assets/')) {
    const file = pathname.slice('/assets/'.length);
    return character.has(file) || animation.test(file) ? path.join(assetRoot,file) : null;
  }
  return null;
}

module.exports = { resolveAsset };
