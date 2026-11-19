import { pick } from './behavior.mjs';
import { idleHandoff } from './idle-handoff.mjs';

const ASSETS = '/assets/';
const ASSET_TIMEOUT = 4500;

function withTimeout(work) {
  let timeout;
  const deadline = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error('动作准备超时')), ASSET_TIMEOUT);
  });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timeout));
}

export async function makeActor(stage, fallback, note) {
  const video = stage.querySelector('video');
  const canvas = stage.querySelector('canvas');
  const context = canvas.getContext('2d');
  let manifest, settings, current, pending, animation = true, visible = !document.hidden;
  let reportFrame = 0;
  let sample;
  let mediaTime=0;
  let generation = 0, raf = 0, alphaVideo = false, dragging = false;
  const atlases = new Map();
  const compatibility = new Set();
  let lastAmbient, ambientAt = 0, greeted = false, quiet = false;
  let handoff, warmed, warming, poseFrames={}, ambient, cutAt, usePose=true;
  let preferences={enabled:true,matchPose:true,intervalMs:8500,actions:['greet','tap','happy']};
  const idleOffset = name => usePose ? poseFrames[name] || 0 : 0;
  function warmIdle(name) {
    if (!manifest.motions[name] || manifest.motions[name].loop) return;
    const playing={name,seconds:idleOffset(name)};
    warming=playing;
    warmed=undefined;
    if (handoff) void handoff.warm(playing.seconds).then(ready=>{
      if (warming===playing && ready) warmed=playing;
    });
    void loadAtlas(manifest.motions.idle.fallbackAtlas).catch(()=>{});
  }
  const canAmbient = () => !dragging && !pending &&
    (!current || current === 'idle') && animation && visible && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loops = name => manifest?.motions[name]?.loop === true;
  const still = () => {
    current = null;
    video.hidden = canvas.hidden = true;
    if (handoff) handoff.video.hidden=true;
    fallback.hidden = false;
    fallback.src = ASSETS + 'character/poster.png';
    delete stage.dataset.motion;
    stage.dataset.renderer = 'character-poster';
  };
  const stop = () => {
    video.pause(); handoff?.video.pause(); cancelAnimationFrame(raf);
    video.style?.removeProperty('transform');
    canvas.style?.removeProperty('transform');
  };
  const invalidate = () => { generation++; pending = null; current = null; finishSample('hidden'); stop(); };
  const expose = surface => {
    fallback.hidden = true;
    video.hidden = surface !== video;
    if (handoff) handoff.video.hidden=surface!==handoff.video;
    canvas.hidden = surface !== canvas;
  };
  function loadAtlas(spec) {
    if (!atlases.has(spec.file)) {
      const image = new Image();
      image.src = ASSETS + spec.file;
      const ready = withTimeout(image.decode()).then(() => image).catch(error => {
        atlases.delete(spec.file);
        throw error;
      });
      atlases.set(spec.file, ready);
      if (atlases.size > 3) atlases.delete(atlases.keys().next().value);
    }
    return atlases.get(spec.file);
  }
  const basic = new Set(['idle','greet','tap','reply','confused','happy','thinking','remind']);
  function holdVisiblePose() {
    if (!context) return false;
    if (canvas.hidden) {
      const visibleVideo=!video.hidden ? video : handoff?.video;
      if (!visibleVideo || visibleVideo.hidden || visibleVideo.readyState<2) return false;
      context.clearRect(0,0,canvas.width,canvas.height);
      context.drawImage(visibleVideo,0,0,canvas.width,canvas.height);
    }
    expose(canvas);
    return true;
  }
  const done = ticket => {
    if (ticket !== generation) return;
    finishSample('ended');
    const previous=current;
    if (warmed?.name===previous && handoff.video.readyState>=2 && !handoff.video.seeking) {
      const target=handoff.video;
      const active=++generation;
      expose(target);
      current='idle';
      stage.dataset.motion='idle';
      stage.dataset.renderer='transparent-webm';
      stage.dataset.handoff='preloaded';
      void target.play().catch(()=>{
        if (generation===active) void play('idle',true,true,idleOffset(previous));
      });
      return;
    }
    const keepPose=basic.has(previous);
    current=null;
    void play('idle',false,keepPose,idleOffset(previous));
  };
  function play(name, atlasOnly = false, keepPose=false, offset=0) {
    if (!animation || !visible) return Promise.resolve({ ok: false, reason: 'PLAYBACK_DISABLED' });
    if (pending?.name === name) return pending.result;
    if (current === name && !pending && !atlasOnly) return Promise.resolve({ ok: true, renderer: stage.dataset.renderer });
    const spec = manifest?.motions?.[name];
    if (!spec) return Promise.resolve({ ok: false, reason: 'MOTION_NOT_AVAILABLE' });
    finishSample('interrupted');
    keepPose = (keepPose || (basic.has(current) && basic.has(name))) && holdVisiblePose();
    const ticket = ++generation;
    const result = start(name, spec, ticket, atlasOnly || compatibility.has(name), keepPose, offset).finally(() => {
      if (ticket === generation) pending = null;
    });
    pending = { name, result };
    return result;
  }
  async function start(name, spec, ticket, atlasOnly, keepPose, offset) {
    const matched=preferences.matchPose;
    const superseded = { ok: false, reason: 'PLAYBACK_SUPERSEDED' };
    const ready = (surface, renderer) => {
      expose(surface);
      current = name;
      usePose=matched;
      cutAt=renderer==='transparent-webm' && !matched && spec.bodyFrames ? {ticket,frame:spec.bodyFrames-1} : null;
      mediaTime=0;
      delete stage.dataset.handoff;
      stage.dataset.motion = name;
      warmIdle(name);
      stage.dataset.renderer = renderer;
      note.textContent = renderer === 'rgba-atlas' ? '橙金少女 · 兼容动画' : '橙金少女 · 外观待验收';
      return { ok: true, renderer };
    };
    if (alphaVideo && !atlasOnly) {
      try {
        stop();
        if (!keepPose) still();
        video.loop = spec.loop;
        video.onended = () => done(ticket);
        if (video.getAttribute('src') !== ASSETS + spec.file) video.src = ASSETS + spec.file;
        if (offset>0 || video.currentTime!==0) video.currentTime=offset;
        await withTimeout(video.play());
        if (ticket !== generation) return superseded;
        if (video.readyState < 2 || video.paused) throw new Error('视频首帧尚未就绪');
        return ready(video, 'transparent-webm');
      } catch {
        if (ticket !== generation) return superseded;
        video.pause();
        compatibility.add(name);
      }
    }
    try {
      const atlas = spec.fallbackAtlas;
      if (!atlas || !context) throw new Error('透明兼容格式不可用');
      const image = await loadAtlas(atlas);
      if (ticket !== generation) return superseded;
      stop();
      const began = performance.now();
      let last = -1;
      const [w,h] = atlas.frameSize;
      const tick = now => {
        if (ticket !== generation) return;
        const frame = Math.max(0, Math.floor(((now-began)/1000+offset)*atlas.fps));
        const end=matched || !spec.bodyFallbackFrames ? atlas.frames : spec.bodyFallbackFrames;
        if (!spec.loop && frame >= end) return done(ticket);
        const index = frame % atlas.frames;
        if (index !== last) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, index%atlas.columns*w, Math.floor(index/atlas.columns)*h,
            w,h,0,0,canvas.width,canvas.height);
            mediaTime=index/atlas.fps;
          recordFrame(now,index/atlas.fps,index);
          last = index;
        }
        raf = requestAnimationFrame(tick);
      };
      tick(began);
      return ready(canvas, 'rgba-atlas');
    } catch {
      if (ticket !== generation) return superseded;
      stop();
      still();
      note.textContent = '角色动作载入失败 · 已显示橙金少女静态图';
      return { ok: false, reason: 'MOTION_LOAD_FAILED' };
    }
  }

  async function load() {
    const response = await fetch(ASSETS + 'character/manifest.json', { redirect: 'error' });
    if (!response.ok) throw new Error('角色包清单缺失');
    manifest = await response.json();
    try {
      const rules = await fetch('/pet/behaviors.json', { redirect: 'error' });
      if (rules.ok) settings = await rules.json();
    } catch { /* The core state mapping remains available. */ }
    try {
      const result=await fetch('/pet/idle-poses.json',{redirect:'error'});
      if (result.ok) poseFrames=await result.json();
    } catch { /* Idle starts from its original first frame. */ }
    const [w,h] = manifest.designSize;
    canvas.width = w;
    canvas.height = h;
    const probe = document.createElement('video');
    try {
      await withTimeout(new Promise((resolve, reject) => {
        probe.onloadeddata = resolve;
        probe.onerror = reject;
        probe.preload = 'auto';
        probe.src = ASSETS + manifest.motions.idle.file;
      }));
      context.drawImage(probe,0,0,w,h);
      alphaVideo = context.getImageData(0,0,1,1).data[3] === 0;
      context.clearRect(0,0,w,h);
    } catch { alphaVideo = false; }
    finally {
      probe.onloadeddata = probe.onerror = null;
      probe.removeAttribute('src');
      probe.load();
    }
    if (alphaVideo) handoff=idleHandoff(stage,ASSETS+manifest.motions.idle.file);
  }
  try { await load(); }
  catch (error) { note.textContent = error.message + ' · 静态回退'; still(); }
  const visibility = () => {
    visible = !document.hidden;
    if (!visible) {
      holdVisiblePose();
      invalidate();
    } else {
      void play('idle',false,!canvas.hidden);
    }
  };
  video.addEventListener('error', () => {
    // During preparation play() handles failure. Here the active stream failed later.
    if (!pending && current && !video.hidden) {
      compatibility.add(current);
      void play(current, true);
    }
  });
  document.addEventListener('visibilitychange', visibility);
  function recordFrame(now, media, presented) {
    if (!sample || current !== sample.name || sample.frames.length >= 450) return;
    sample.frames.push([now,media,presented]);
  }
  function finishSample(reason) {
    if (!sample) return;
    const row=sample;
    sample=undefined;
    const gaps=row.frames.slice(1).map(([now],i)=>now-row.frames[i][0]);
    const missing=row.frames.slice(1).reduce((sum,[,media],i)=>
      sum+Math.max(0,Math.round((media-row.frames[i][1])*row.fps)-1),0);
    const missedCallbacks=row.frames.slice(1).reduce((sum,[,,presented],i)=>
      sum+Math.max(0,presented-row.frames[i][2]-1),0);
    row.result={name:row.name,renderer:row.renderer,fps:row.fps,reason,
      samples:row.frames.length,missing,missedCallbacks,
      maxGapMs:Math.round(Math.max(0,...gaps)),
      gapsOverTwoFrames:gaps.filter(gap=>gap>2000/row.fps+4).length,
      reportedDropped:row.renderer==='transparent-webm' ?
        Math.max(0,(video.getVideoPlaybackQuality?.().droppedVideoFrames ?? 0)-row.initialDropped) : null,
      frames:row.frames};
    row.resolve(row.result);
  }
  function countDecodedFrames(_now, metadata) {
    if (sample) stage.dataset.presentedFrames = String(metadata.presentedFrames);
    if (!video.hidden) {
      mediaTime=metadata.mediaTime;
      recordFrame(metadata.expectedDisplayTime ?? _now,metadata.mediaTime,metadata.presentedFrames);
      if (cutAt?.ticket===generation && Math.round(metadata.mediaTime*24)>=cutAt.frame) {
        const {ticket}=cutAt;
        cutAt=null;
        // A vFC runs just before presentation. Leave the final body frame on
        // screen before promoting idle, but before the next 24 fps tail frame.
        const wait=Math.min(34,Math.max(24,(metadata.expectedDisplayTime ?? _now)-_now+20));
        setTimeout(()=>done(ticket),wait);
      }
    }
    reportFrame = video.requestVideoFrameCallback(countDecodedFrames);
  }
  if (typeof video.requestVideoFrameCallback === 'function') {
    reportFrame = video.requestVideoFrameCallback(countDecodedFrames);
  }
  function scheduleAmbient() {
    clearInterval(ambient);
    if (!settings || !preferences.enabled || preferences.actions.length===0) return;
    const allowed={...settings,event:settings.event.filter(item=>preferences.actions.includes(item.action))};
    ambient=setInterval(async()=>{
      if (quiet || !canAmbient() || performance.now()<ambientAt) return;
      const name=pick('event',allowed,manifest.motions,lastAmbient);
      if (name && (await scheduled('event',name)).ok) lastAmbient=name;
    },preferences.intervalMs);
  }
  scheduleAmbient();
  function scheduled(pool, action) {
    if (!manifest || !settings) return Promise.resolve({ok:false,reason:'NOT_IN_TRIGGER_POOL'});
    const name = pool === 'greeting' ? settings.greeting :
      pick(pool, { ...settings, [pool]: (settings[pool] || []).filter(entry => entry.action === action) },manifest.motions);
    if (name !== action || !manifest.motions[name]) return Promise.resolve({ok:false,reason:'NOT_IN_TRIGGER_POOL'});
    if (dragging)
      return Promise.resolve({ok:false,reason:'DRAGGING'});
    return play(name);
  }
  window.addEventListener('pagehide', () => {
    finishSample('pagehide');
    document.removeEventListener('visibilitychange', visibility);
    invalidate();
    clearInterval(ambient);
    handoff?.dispose();
    video.removeAttribute('src');
    if (reportFrame) video.cancelVideoFrameCallback(reportFrame);
    video.load();
    atlases.clear();
  }, { once: true });
  return {
    manifest,
    get motion() { return current; },
    async start() {
      const result = await play('idle');
      if (result.ok && settings?.greeting && canAmbient() && !greeted) {
        greeted = true;
        void scheduled('greeting',settings.greeting).then(playback => {
          if (playback.ok) lastAmbient=settings.greeting;
        });
      }
      return result;
    },
    quiet(value) { quiet=value; },
    configure(value) {
      preferences=value;
      scheduleAmbient();
    },
    preview(name) { return play(name); },
    async measure(name, forceAtlas=false) {
      if (dragging) return {reason:'DRAGGING'};
      const played=await play(name,forceAtlas);
      if (!played.ok || current!==name) return {reason:played.reason || 'PLAYBACK_SUPERSEDED'};
      const fps=played.renderer==='rgba-atlas' ? manifest.motions[name].fallbackAtlas.fps : manifest.motions[name].fps;
      return new Promise(resolve=>{
        finishSample('superseded');
        sample={resolve,name,renderer:played.renderer,fps,frames:[],
          initialDropped:video.getVideoPlaybackQuality?.().droppedVideoFrames ?? 0};
      });
    },
    scheduled,
    interruptPreview() { return play('idle'); },
    react(name) {
      const next = name.toLowerCase();
      if (next === 'tap') {
        if (!canAmbient() || performance.now() < ambientAt) return;
        const action = settings && pick('click', settings, manifest.motions, lastAmbient) || 'tap';
        void play(action).then(result => {
          if (result.ok) {
            lastAmbient = action;
            ambientAt = performance.now() + (manifest.motions[action].cooldownMs ?? 500);
          }
        });
        return;
      }
      void play(next);
    },
    drag(on) {
      if (dragging === on) return;
      dragging = on;
    },
    animate(on) {
      animation = on;
      if (!on) { invalidate(); still(); }
      else void play('idle');
    }
  };
}
