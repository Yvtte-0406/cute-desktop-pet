// Keep the main connected silhouette; discard fragments from neighboring cells.
// Runs only during loading and never changes the original artwork file.
function cleanSpritePixels(pixels,width,height){
 const n=width*height,labels=new Int32Array(n),queue=new Int32Array(n);
 let label=0,best=0,bestSize=0;const sizes=[];
 for(let start=0;start<n;start++){
  if(labels[start]||pixels[start*4+3]<12)continue;
  label++;let head=0,tail=1;queue[0]=start;labels[start]=label;
  while(head<tail){const p=queue[head++],x=p%width,y=Math.floor(p/width);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const nx=x+dx,ny=y+dy;if(nx<0||nx>=width||ny<0||ny>=height)continue;
    const q=ny*width+nx;if(!labels[q]&&pixels[q*4+3]>=12){labels[q]=label;queue[tail++]=q;}
   }
  }
  sizes.push(tail);if(tail>bestSize){best=label;bestSize=tail;}
 }
 let removed=0;
 for(let p=0;p<n;p++){
  if(!pixels[p*4+3]||labels[p]===best)continue;
  let preserve=false;
  // Preserve low-alpha antialiasing immediately beside the main fur silhouette.
  if(pixels[p*4+3]<12){const x=p%width,y=Math.floor(p/width);
   for(let dy=-2;dy<=2&&!preserve;dy++)for(let dx=-2;dx<=2;dx++){
    const nx=x+dx,ny=y+dy;if(nx>=0&&nx<width&&ny>=0&&ny<height&&labels[ny*width+nx]===best){preserve=true;break;}
   }
  }
  if(!preserve){pixels[p*4+3]=0;removed++;}
 }
 return {removedPixels:removed,mainPixels:bestSize,discardedComponents:sizes.filter((_,i)=>i+1!==best).length};
}
if(typeof module!=='undefined')module.exports={cleanSpritePixels};
else window.spriteTools={cleanSpritePixels};
