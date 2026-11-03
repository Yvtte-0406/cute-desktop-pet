// Windows native input/paint region, derived from visible fur and menu controls.
(function(){
function shape(canvas,gl){
 const r=canvas.getBoundingClientRect(),pixels=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);const rects=[];
 // One logical-pixel scanline with a small fringe preserves antialiased white fur.
 const width=Math.ceil(r.width),height=Math.ceil(r.height);
 for(let y=0;y<height;y++){const sy=canvas.height-1-Math.min(canvas.height-1,Math.floor(y/r.height*canvas.height));let start=-1;for(let x=0;x<=width;x++){const sx=Math.min(canvas.width-1,Math.floor(x/r.width*canvas.width)),on=x<width&&pixels[(sy*canvas.width+sx)*4+3]>2;if(on&&start<0)start=x;if(!on&&start>=0){rects.push({x:Math.max(0,Math.floor(r.x+start)-2),y:Math.max(0,Math.floor(r.y+y)-2),width:x-start+4,height:5});start=-1;}}}
 const panel=document.getElementById('panel');if(!panel.hidden){const b=panel.getBoundingClientRect();rects.push({x:Math.max(0,Math.floor(b.x)-8),y:Math.max(0,Math.floor(b.y)-8),width:Math.ceil(b.width)+16,height:Math.ceil(b.height)+16});}
 const nav=document.getElementById('orbit');if(!nav.hidden){for(const button of nav.querySelectorAll('button')){const b=button.getBoundingClientRect(),radius=b.width/2;for(let y=0;y<b.height;y+=2){const half=Math.sqrt(Math.max(0,radius*radius-Math.pow(y-radius,2)));rects.push({x:Math.floor(b.x+radius-half)-2,y:Math.floor(b.y+y)-2,width:Math.ceil(half*2)+4,height:5});}const label=button.querySelector('span').getBoundingClientRect();rects.push({x:Math.floor(label.x),y:Math.floor(label.y),width:Math.ceil(label.width),height:Math.ceil(label.height)});}
  // The decorative arc remains visible without a filled semicircle.
  const n=nav.getBoundingClientRect(),arc=window.menuArc;for(let a=arc.start;a<=arc.end;a+=.25){const p=arc.point(a);rects.push({x:Math.floor(n.x+p.x)-2,y:Math.floor(n.y+p.y)-2,width:5,height:5});}}
 const marker=document.getElementById('pending-reminders');if(marker&&!marker.hidden){const b=marker.getBoundingClientRect();rects.push({x:Math.floor(b.x),y:Math.floor(b.y),width:Math.ceil(b.width),height:Math.ceil(b.height)});}
 rects.push(...window.bubbleFrame.rectangles());
 return rects.filter(b=>b.width>0&&b.height>0);
}
window.petShape={shape};
})();
