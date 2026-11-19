// The decoder/atlas can switch independently of the one displayed bitmap.
export function presentDesktop(stage, width, height) {
  const view = document.createElement('canvas');
  const scratch = document.createElement('canvas');
  const probe = document.createElement('canvas');
  view.className = 'desktop-presentation';
  view.width = scratch.width = width;
  view.height = scratch.height = height;
  probe.width = 16;
  probe.height = 20;
  const output = view.getContext('2d');
  const draft = scratch.getContext('2d');
  const detector = probe.getContext('2d',{willReadFrequently:true});
  let raf, last, resolveFirst, lastDraw = -Infinity;
  const firstFrame = new Promise(resolve=>{resolveFirst=resolve;});
  if (!output || !draft || !detector) {
    resolveFirst();
    return {view:null, firstFrame};
  }
  output.globalCompositeOperation = 'copy';
  draft.globalCompositeOperation = 'copy';
  detector.globalCompositeOperation = 'copy';
  stage.append(view);
  stage.setAttribute('data-composited','');

  function activeSource() {
    const sources = [...stage.querySelectorAll('video,canvas,img')].filter(
      element => element!==view && !element.hidden && getComputedStyle(element).visibility!=='hidden');
    return sources[0];
  }

  function present(now) {
    raf = requestAnimationFrame(present);
    if (now-lastDraw<15) return;
    lastDraw = now;
    const source = activeSource();
    if (!source || (source.tagName==='VIDEO' &&
        (source.seeking || source.readyState<2 || !source.videoWidth)) ||
        (source.tagName==='IMG' && (!source.complete || !source.naturalWidth))) return;
    const key = source.tagName==='VIDEO' ?
      `${source.currentSrc}|${source.getVideoPlaybackQuality().totalVideoFrames}|${source.currentTime}` :
      source.tagName==='IMG' ? source.currentSrc : null;
    if (key!==null && last?.source===source && last.key===key) return;
    try {
      draft.drawImage(source,0,0,width,height);
      detector.drawImage(scratch,0,0,probe.width,probe.height);
      const pixels = detector.getImageData(0,0,probe.width,probe.height).data;
      let occupied = 0;
      for (let i=3;i<pixels.length;i+=4) if (pixels[i]>24) occupied++;
      if (occupied<14) return;
      output.drawImage(scratch,0,0);
      view.style.transform = source.style.transform;
      last = {source,key};
      if (resolveFirst) {
        resolveFirst();
        resolveFirst = null;
      }
    } catch {
      // A decoder or canvas can be unavailable during a resize, seek or swap.
    }
  }
  raf = requestAnimationFrame(present);
  window.addEventListener('pagehide',()=>cancelAnimationFrame(raf),{once:true});
  return {view,firstFrame};
}
