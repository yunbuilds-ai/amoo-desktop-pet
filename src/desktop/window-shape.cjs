function regionFor({ art, controls }, mask, bounds) {
  const fit = ([x, y, w, h]) => {
    const left = Math.max(0, Math.floor(x));
    const top = Math.max(0, Math.floor(y));
    const right = Math.min(bounds.width, Math.ceil(x + w));
    const bottom = Math.min(bounds.height, Math.ceil(y + h));
    return right > left && bottom > top ? { x:left, y:top, width:right-left, height:bottom-top } : null;
  };
  const regions = controls.map(fit);
  if (art && mask.length) {
    const [x,y,w,h] = art;
    const dx = w / mask[0].length;
    const dy = h / mask.length;
    for (const [index, row] of mask.entries()) {
      let start = -1;
      for (let col = 0; col <= row.length; col++) {
        if (row[col] && start === -1) start = col;
        if (!row[col] && start !== -1) {
          // Keep a small edge margin for antialiasing and motion between frames.
          regions.push(fit([x+start*dx-2,y+index*dy-2,(col-start)*dx+4,dy+4]));
          start = -1;
        }
      }
    }
  }
  return regions.filter(Boolean);
}

module.exports = { regionFor };
