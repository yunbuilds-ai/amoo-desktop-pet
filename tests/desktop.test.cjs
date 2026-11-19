'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { resolveAsset } = require('../src/desktop/asset-routes.cjs');
const { normalizeMotion } = require('../src/desktop/motion-settings.cjs');
const { contact } = require('../src/desktop/pet-peers.cjs');
const { regionFor } = require('../src/desktop/window-shape.cjs');

test('private asset protocol resolves only local allowlisted desktop files', () => {
  const local = 'aomm-pet://local';
  const resolve = (suffix,method='GET') => resolveAsset(local+suffix,method,'pet','assets');
  assert.equal(resolve('/pet/desktop.html'),path.join('pet','desktop.html'));
  assert.equal(resolve('/assets/animations/tap.webm'),path.join('assets','animations/tap.webm'));
  for (const route of ['/api/state','/assets/.env','/assets/animations/cube.webp','/pet/%2fdesktop.html',
    '/pet/desktop.html?x=1','/assets/character/%2e%2e/config.json','/assets/animations/idle.webm.exe']) {
    assert.equal(resolve(route),null,route);
  }
  assert.equal(resolve('/pet/desktop.html','POST'),null);
  assert.equal(resolveAsset('https://local/pet/desktop.html','GET','pet','assets'),null);
  assert.equal(resolveAsset('aomm-pet://user@local/pet/desktop.html','GET','pet','assets'),null);
});

test('motion settings keep only existing interactive actions and safe timings', () => {
  const result=normalizeMotion({actions:['tap','unknown','tap','happy'],intervalMs:1});
  assert.deepEqual(result.actions,['tap','happy']);
  assert.ok(result.intervalMs>=5000);
});

test('transparent window shape remains inside its own bounds', () => {
  const shape=regionFor({art:[-20,10,40,32],controls:[]},[[1,1]],{width:60,height:50});
  assert.ok(shape.length>0);
  for (const r of shape) assert.ok(r.x>=0 && r.y>=0 && r.x+r.width<=60 && r.y+r.height<=50);
});

test('collision requires an actual body overlap', () => {
  const a={left:0,top:0,right:20,bottom:30};
  assert.ok(contact(a,{left:10,top:4,right:25,bottom:30}));
  assert.equal(contact(a,{left:17,top:1,right:30,bottom:30}),false);
});
