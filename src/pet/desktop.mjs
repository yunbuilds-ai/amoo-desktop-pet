import { makeActor } from './actor.mjs';
import { presentDesktop } from './desktop-presenter.mjs';
import { buildHitMask, HIT_MASK_WIDTH, HIT_MASK_HEIGHT } from './hit-mask.mjs';

const stage = document.querySelector('.pet-stage');
const poster = stage.querySelector('img');
const native = window.aommWindow;
let actor, preferences, quiet = false, moving = false, suppressClickUntil = 0;
native.onMotionSettings(value=>{
  preferences=value;
  actor?.configure(value);
});
native.onCollision(()=>{
  actor?.react('confused');
});

native.onQuiet(value => {
  quiet = value === true;
  actor?.quiet(quiet);
});

native.onDragging(active => {
  if (moving && !active) suppressClickUntil = performance.now()+200;
  moving = active;
  stage.toggleAttribute('data-moving',active);
  actor?.drag(active);
});

stage.addEventListener('pointerdown', event => {
  if (event.button===0 && event.isTrusted) native.dragStart(true);
});

stage.addEventListener('click', () => {
  if (!moving && performance.now()>=suppressClickUntil) actor?.react('tap');
});

function trackShape(manifest,view) {
  const buffer = document.createElement('canvas');
  buffer.width = HIT_MASK_WIDTH;
  buffer.height = HIT_MASK_HEIGHT;
  const context = buffer.getContext('2d',{willReadFrequently:true});
  let previous, lastShape, frame, nextSample = 0;

  function displayedMask(art) {
    if (!context || art[2]<=0 || art[3]<=0) return manifest.hitMask;
    try {
      context.clearRect(0,0,buffer.width,buffer.height);
      let painted = false;
      for (const surface of view ? [view] : stage.querySelectorAll('video,canvas,img')) {
        const style = getComputedStyle(surface);
        if (surface.hidden || style.display==='none' || style.visibility==='hidden') continue;
        if (surface.tagName==='VIDEO' && surface.readyState<2) continue;
        if (surface.tagName==='IMG' && (!surface.complete || !surface.naturalWidth)) continue;
        context.globalAlpha=Number(style.opacity);
        context.drawImage(surface,0,0,buffer.width,buffer.height);
        painted = true;
      }
      context.globalAlpha=1;
      if (!painted) return lastShape || manifest.hitMask;
      const rgba = context.getImageData(0,0,buffer.width,buffer.height).data;
      const alpha = new Uint8Array(buffer.width*buffer.height);
      for (let index=0;index<alpha.length;index++) alpha[index]=rgba[index*4+3];
      const mask=buildHitMask(alpha,previous);
      if (!mask) return lastShape || manifest.hitMask;
      previous=mask.current;
      lastShape=mask.shape;
      return lastShape;
    } catch { return lastShape || manifest.hitMask; }
  }

  function measure() {
    const rect=stage.getBoundingClientRect();
    const [w,h]=manifest.designSize;
    const scale=Math.min(rect.width/w,rect.height/h);
    const art=[rect.x+(rect.width-w*scale)/2,rect.y+(rect.height-h*scale)/2,w*scale,h*scale];
    native.hitRegions(art,[],displayedMask(art));
  }

  const observer=new ResizeObserver(measure);
  observer.observe(stage);
  const update=now=>{
    if (now>=nextSample) {
      measure();
      nextSample=now+1000/24;
    }
    frame=requestAnimationFrame(update);
  };
  frame=requestAnimationFrame(update);
  window.addEventListener('pagehide',()=>{
    cancelAnimationFrame(frame);
    observer.disconnect();
  },{once:true});
}

actor = await makeActor(stage,poster,document.createElement('span'));
actor.quiet(quiet);
if (preferences) actor.configure(preferences);
let presented;
if (actor.manifest) {
  const [width,height] = actor.manifest.designSize;
  presented = presentDesktop(stage,width,height);
  trackShape(actor.manifest,presented.view);
}
await actor.start();
await presented?.firstFrame;
requestAnimationFrame(() => native.firstFrame());
