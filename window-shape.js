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
  const n=nav.getBoundingClientRect();for(let x=22;x<197;x+=2){const dx=(x-109)/87;if(Math.abs(dx)>1)continue;const y=72-50*Math.sqrt(1-dx*dx);rects.push({x:Math.floor(n.x+x),y:Math.floor(n.y+y),width:4,height:4});}}
 const bubble=document.getElementById('bubble');if(!bubble.hidden){const b=bubble.getBoundingClientRect();rects.push({x:Math.floor(b.x)-4,y:Math.floor(b.y)-4,width:Math.ceil(b.width)+8,height:Math.ceil(b.height)+8});}
 return rects.filter(b=>b.width>0&&b.height>0);
}
window.petShape={shape};
})();
