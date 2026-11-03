// A2 marshmallow bubble: the SVG and native input region share the same path.
(function(){
 const bubble=document.getElementById('bubble'),svg=document.getElementById('bubble-frame'),path=svg.querySelector('path'),mask=document.createElement('canvas');let rows=[];
 function update(){
  if(bubble.hidden)return;const b=bubble.getBoundingClientRect(),fox=document.getElementById('pet').getBoundingClientRect(),w=Math.round(b.width),h=Math.round(b.height);if(w<10||h<10)return;
  const r=Math.min(52,h*.4,w*.19),bottom=h-1,right=w-1,tip=Math.max(r+12,Math.min(w-r-28,fox.x+fox.width*.63-b.x));
  const d='M '+(1+r)+' 1 H '+(right-r)+' A '+r+' '+r+' 0 0 1 '+right+' '+(1+r)+' V '+(bottom-r)+' A '+r+' '+r+' 0 0 1 '+(right-r)+' '+bottom+' H '+(tip+22)+' Q '+(tip+14)+' '+(bottom+12)+' '+tip+' '+(bottom+21)+' Q '+(tip+7)+' '+(bottom+8)+' '+(tip+7)+' '+bottom+' H '+(1+r)+' A '+r+' '+r+' 0 0 1 1 '+(bottom-r)+' V '+(1+r)+' A '+r+' '+r+' 0 0 1 '+(1+r)+' 1 Z';
  svg.setAttribute('viewBox','0 0 '+w+' '+(h+22));path.setAttribute('d',d);
  mask.width=w;mask.height=h+22;const g=mask.getContext('2d',{willReadFrequently:true}),p=new Path2D(d);g.fillStyle='#fff';g.strokeStyle='#fff';g.lineWidth=1.4;g.fill(p);g.stroke(p);const pixels=g.getImageData(0,0,mask.width,mask.height).data;rows=[];
  for(let y=0;y<mask.height;y++){let a=-1,last=-1;for(let x=0;x<w;x++)if(pixels[(y*w+x)*4+3]>2){if(a<0)a=x;last=x;}if(a>=0)rows.push({x:a-1,y:y-1,width:last-a+3,height:3});}
 }
 function rectangles(){if(bubble.hidden)return [];const b=bubble.getBoundingClientRect();return rows.map(r=>({x:Math.floor(b.x+r.x),y:Math.floor(b.y+r.y),width:r.width,height:r.height}));}
 new ResizeObserver(update).observe(bubble);window.bubbleFrame={update,rectangles};
})();
