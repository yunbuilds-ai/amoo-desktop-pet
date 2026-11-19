'use strict';

const { estimateReleaseVelocity, trimTrail } = require('./dsh-pet/shared/physics/release.ts');
const { DEFAULT_PHYSICS } = require('./dsh-pet/shared/physics/constants.ts');
const { throwStep } = require('./dsh-pet/shared/physics/throw.ts');
const { artLimits } = require('./visible-bounds.cjs');

const STEP = 1/120;
const PHYSICS = { ...DEFAULT_PHYSICS, restitution:.46 };

function nativeCoordinate(value) {
  if (!Number.isFinite(value) || value < -2147483648 || value > 2147483647) return null;
  return Math.round(value) || 0;
}

function makeWindowThrow({ win, screen, geometry, settled, footprint, clock = () => performance.now(),
  setTimer=setInterval, clearTimer=clearInterval }) {
  let timer, flight;
  let trail=[];

  function stop() {
    if (timer===undefined) return;
    clearTimer(timer);
    timer=undefined;
    flight=undefined;
    if (!win.isDestroyed()) settled();
  }

  function sample(x,y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const t=clock();
    trail=trimTrail(trail,t);
    trail.push({x,y,t});
  }

  function tick() {
    if (!flight || win.isDestroyed() || !win.isVisible()) return stop();
    const now=clock();
    flight.debt+=Math.min(.18,Math.max(0,(now-flight.last)/1000));
    flight.last=now;
    let landed=false;
    while (flight.debt>=STEP && !landed) {
      flight.state=throwStep(flight.state,STEP,flight.box,PHYSICS);
      flight.debt-=STEP;
      // Stillness against a wall must never end the fall.
      landed=flight.state.atRest && flight.state.contacts.includes('floor');
    }
    const x=nativeCoordinate(flight.state.x), y=nativeCoordinate(flight.state.y);
    if (x===null || y===null) return stop();
    win.setPosition(x,y);
    if (landed) stop();
  }

  return {
    get running() { return timer!==undefined; },
    begin() { stop(); trail=[]; sample(0,0); },
    sample,
    stop,
    bump(direction) {
      if (flight && flight.state.vx*direction<0) flight.state.vx=-flight.state.vx*.45;
    },
    release() {
      const start=clock();
      const speed=estimateReleaseVelocity(trail,start);
      trail=[];
      if (!speed || win.isDestroyed() || !win.isVisible()) return false;
      const {x,y,width,height}=win.getBounds();
      const selected=screen.getDisplayMatching({x,y,width,height}).id;
      const displays=screen.getAllDisplays();
      const area=geometry(displays,selected).workAreas[displays.findIndex(display=>display.id===selected)];
      if (!area) return false;
      const box=artLimits(area,footprint({width,height}));
      if (!Object.values(box).every(Number.isFinite) || box.minX>box.maxX || box.minY>box.maxY) return false;
      if (speed.vy<0) speed.vy*=1.32;
      flight={box,last:start,debt:0,state:{
        x:Math.max(box.minX,Math.min(box.maxX,x)),y:Math.max(box.minY,Math.min(box.maxY,y)),...speed}};
      timer=setTimer(tick,16);
      return true;
    },
  };
}

module.exports = { makeWindowThrow, nativeCoordinate };
