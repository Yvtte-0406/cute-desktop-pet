const BASE_WIDTH=300,MIN_SCALE=.4,MAX_SCALE=1.5,MENU_SPACE=410;
function sizedBounds(scale,area,old){
 const max=Math.max(MIN_SCALE,Math.min(MAX_SCALE,(area.width-12)/BASE_WIDTH,(area.height-MENU_SPACE-12)/(BASE_WIDTH*620/720)));
 scale=Math.max(MIN_SCALE,Math.min(max,scale));
 const width=Math.min(area.width,Math.max(380,Math.round(BASE_WIDTH*scale))),height=Math.min(area.height,Math.ceil(BASE_WIDTH*scale*620/720+MENU_SPACE));
 return {scale,maxScale:max,bounds:{width,height,x:Math.round(Math.max(area.x,Math.min(area.x+area.width-width,old.x+old.width/2-width/2))),y:Math.round(Math.max(area.y,Math.min(area.y+area.height-height,old.y+old.height-height)))}};
}
module.exports={sizedBounds,BASE_WIDTH,MIN_SCALE,MAX_SCALE};
