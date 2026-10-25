// Keep the drag's original size: Windows DIP/native-pixel round trips can grow it.
function dragPlacement(cursor,bounds){
 const origin={...cursor},size={...bounds};let last={...cursor};
 return point=>{
  if(point.x===last.x&&point.y===last.y)return null;
  last={...point};
  return {x:Math.round(size.x+point.x-origin.x),y:Math.round(size.y+point.y-origin.y),width:size.width,height:size.height};
 };
}
module.exports={dragPlacement};
