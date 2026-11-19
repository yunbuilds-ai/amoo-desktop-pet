'use strict';

function artFootprint({width,height}, visible = [0,0,1,1]) {
  // The desk view keeps a fixed box while chat and status open as overlays.
  const stageHeight = height*.56;
  const artWidth = Math.min(width,stageHeight*4/5);
  const artHeight = artWidth*5/4;
  const x = (width-artWidth)/2;
  const y = height*.29+(stageHeight-artHeight)/2;
  const [left,top,right,bottom] = visible;
  return {left:Math.floor(x+left*artWidth),top:Math.floor(y+top*artHeight),
    right:Math.ceil(x+right*artWidth),bottom:Math.ceil(y+bottom*artHeight)};
}

function artLimits(area, foot) {
  return {minX:area.x-foot.left,minY:area.y-foot.top,
    maxX:area.x+area.width-foot.right,maxY:area.y+area.height-foot.bottom};
}

function currentFootprint(art, mask) {
  if (!art || !mask?.length || !mask[0]?.length) return null;
  let left=mask[0].length, right=0, top=mask.length, bottom=0;
  for (const [y,row] of mask.entries()) {
    for (const [x,solid] of row.entries()) if (solid) {
      left=Math.min(left,x); right=Math.max(right,x+1);
      top=Math.min(top,y); bottom=Math.max(bottom,y+1);
    }
  }
  if (left>=right || top>=bottom) return null;
  const [x,y,width,height]=art;
  return {left:Math.floor(x+width*left/mask[0].length)-2,
    top:Math.floor(y+height*top/mask.length)-2,
    right:Math.ceil(x+width*right/mask[0].length)+2,
    bottom:Math.ceil(y+height*bottom/mask.length)+2};
}

function inside(value, min, max) { return Math.round(Math.max(min,Math.min(max,value))); }

module.exports = { artFootprint, artLimits, currentFootprint, inside };
