export function idleHandoff(stage, source) {
  const video=document.createElement('video');
  video.muted=true;
  video.playsInline=true;
  video.loop=true;
  video.hidden=true;
  video.preload='auto';
  stage.append(video);
  let stamp=0;
  let cancelWait;

  function waitFor(ready) {
    return new Promise(resolve=>{
      const events=['loadeddata','canplay','seeked','error'];
      const timer=setTimeout(()=>finish(false),3000);
      function finish(value) {
        clearTimeout(timer);
        for (const name of events) video.removeEventListener(name,check);
        cancelWait=undefined;
        resolve(value);
      }
      function check() {
        if (video.error) finish(false);
        else if (ready()) finish(true);
      }
      cancelWait=()=>finish(false);
      for (const name of events) video.addEventListener(name,check);
      check();
    });
  }

  return {video,
    async warm(seconds) {
      const id=++stamp;
      cancelWait?.();
      video.pause();
      if (!video.getAttribute('src')) video.src=source;
      if (!(await waitFor(()=>video.readyState>=2)) || id!==stamp) return false;
      if (Math.abs(video.currentTime-seconds)>.012) video.currentTime=seconds;
      return (await waitFor(()=>!video.seeking && video.readyState>=2)) && id===stamp;
    },
    dispose() {
      stamp++;
      cancelWait?.();
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.remove();
    },
  };
}
