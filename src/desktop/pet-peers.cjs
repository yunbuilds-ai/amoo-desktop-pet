'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {randomBytes}=require('node:crypto');

function contact(a,b,margin=0) {
  const overlapX=Math.min(a.right,b.right)-Math.max(a.left,b.left);
  const overlapY=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
  return overlapX>=8-margin && overlapY>=10-margin;
}

function peers({directory,state,onContact,clock=Date.now,interval=50}) {
  fs.mkdirSync(directory,{recursive:true});
  const id=randomBytes(8).toString('hex');
  const file=path.join(directory,id+'.json');
  const temp=file+'.tmp';
  const overlapping=new Map();
  let stamp=0, previous='';
  function tick() {
    const now=clock();
    const here=state();
    const key=JSON.stringify(here);
    if (key!==previous || now-stamp>=450) {
      try {
        fs.writeFileSync(temp,JSON.stringify({...here,stamp:now}));
        fs.renameSync(temp,file);
        stamp=now; previous=key;
      } catch { /* A busy file is refreshed on the next tick. */ }
    }
    if (!here.visible) { overlapping.clear(); return; }
    const present=new Set();
    for (const name of fs.readdirSync(directory)) {
      if (!/^[0-9a-f]{16}\.json$/.test(name) || name===id+'.json') continue;
      try {
        const peer=JSON.parse(fs.readFileSync(path.join(directory,name),'utf8'));
        if (!peer.visible || !Number.isFinite(peer.stamp) || now-peer.stamp>1500 ||
            !['left','top','right','bottom'].every(key=>Number.isFinite(peer[key]))) continue;
        const old=overlapping.get(name);
        if (!contact(here,peer,old?13:0)) continue;
        present.add(name);
        if (old==='notified' || (!here.moving && !peer.moving)) {
          if (!old) overlapping.set(name,'touching');
          continue;
        }
        overlapping.set(name,'notified');
        const direction=here.left+here.right < peer.left+peer.right ? -1 : 1;
        onContact(direction);
      } catch { /* A peer can disappear between directory listing and reading. */ }
    }
    for (const name of overlapping.keys()) if (!present.has(name)) overlapping.delete(name);
  }
  const timer=setInterval(()=>{
    try { tick(); } catch { /* Local tracking failure must not stop the pet. */ }
  },interval);
  timer.unref();
  return () => {
    clearInterval(timer);
    for (const name of [file,temp]) {
      try { fs.unlinkSync(name); } catch { /* No published presence remains. */ }
    }
  };
}

module.exports={peers,contact};
