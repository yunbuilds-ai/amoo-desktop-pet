// A coarse Windows region follows the actually displayed alpha, not a poster.
// The three-cell envelope retains motion through a two-source-frame IPC delay.
export const HIT_MASK_WIDTH = 48;
export const HIT_MASK_HEIGHT = 60;

export function buildHitMask(alpha, previous = null) {
  const w = HIT_MASK_WIDTH, h = HIT_MASK_HEIGHT;
  if (!alpha || alpha.length !== w * h) return null;
  const current = Array.from({length:h}, (_,y) =>
    Array.from({length:w}, (_,x) => alpha[y*w+x] > 3 ? 1 : 0));
  if (!current.some(row => row.some(Boolean))) return null;
  const shape = Array.from({length:h}, () => Array(w).fill(0));
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    if (!current[y][x] && !previous?.[y]?.[x]) continue;
    for (let yy=Math.max(0,y-3);yy<=Math.min(h-1,y+3);yy++)
      for (let xx=Math.max(0,x-3);xx<=Math.min(w-1,x+3);xx++) shape[yy][xx]=1;
  }
  return {current,shape};
}
