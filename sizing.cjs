function sizedBounds(scale,area,old){
 const max=Math.max(.6,Math.min(1.5,(area.width-12)/440,(area.height-12)/580));
 scale=Math.max(.6,Math.min(max,scale));
 const width=Math.round(440*scale),height=Math.round(580*scale);
 return {scale,maxScale:max,bounds:{width,height,x:Math.round(Math.max(area.x,Math.min(area.x+area.width-width,old.x+old.width/2-width/2))),y:Math.round(Math.max(area.y,Math.min(area.y+area.height-height,old.y+old.height-height)))}};
}
module.exports={sizedBounds};
