const fs=require('node:fs'),path=require('node:path');
module.exports=async function(win,out){
 const result=await win.webContents.executeJavaScript(`(()=>{
  const neutral={time:0,blink:0,pet:0,lift:0,head:0,earLeft:0,earRight:0,breath:0,bodyY:0,sway:0,mouth:0};
  const gl=rig.gl,c=document.getElementById('pet'),tails=[];
  for(let index=0;index<9;index++){
   const frames=[];
   for(const time of [0,1.8,3.6,5.4,7.2]){
    rig.render({...neutral,time},index);const p=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,p);
    let area=0;for(let i=3;i<p.length;i+=4)if(p[i]>128)area++;frames.push({p,area});
   }
   let maxChanged=0;for(const f of frames.slice(1)){let changed=0;for(let i=0;i<f.p.length;i+=4)if(f.p.slice(i,i+4).some((v,k)=>Math.abs(v-frames[0].p[i+k])>8))changed++;maxChanged=Math.max(maxChanged,changed);}
   tails.push({index,areas:frames.map(f=>f.area),areaRatio:Math.min(...frames.map(f=>f.area))/Math.max(...frames.map(f=>f.area)),changedPixels:maxChanged});
  }
  const connectivity=tailLayers.map((c,index)=>{
   const b=tailLayout[index],w=c.width,h=c.height,p=c.getContext('2d').getImageData(0,0,w,h).data,seen=new Uint8Array(w*h),queue=new Int32Array(w*h);
   const start=Math.round(b.root[1]-b.offset[1])*w+Math.round(b.root[0]-b.offset[0]);let head=0,count=0,total=0;
   for(let k=0;k<w*h;k++)if(p[k*4+3]>32)total++;
   if(p[start*4+3]>32){queue[count++]=start;seen[start]=1;}
   while(head<count){const k=queue[head++],x=k%w,y=Math.floor(k/w);for(const n of [x>0?k-1:-1,x<w-1?k+1:-1,y>0?k-w:-1,y<h-1?k+w:-1])if(n>=0&&!seen[n]&&p[n*4+3]>32){seen[n]=1;queue[count++]=n;}}
   return {index,connectedToRoot:count/total,total};
  });
  const junctions=[];
  for(const lift of [0,1])for(let time=0;time<=40;time+=.5){
   const sway=lift?Math.sin(time)*.2:0,bodyY=lift?-32:0;rig.render({...neutral,time,lift,sway,bodyY});const p=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,p);
   for(let index=0;index<9;index++){const r=tailLayout[index].root,dy=lift*(r[1]-550)*.028+bodyY,x=r[0]-880,y=r[1]+dy-410,sx=35+(880+Math.cos(sway)*x-Math.sin(sway)*y)/1374*650,sy=32+(410+Math.sin(sway)*x+Math.cos(sway)*y)/1145*548;let opaque=0,total=0;for(let oy=-5;oy<=5;oy++)for(let ox=-5;ox<=5;ox++){if(ox*ox+oy*oy>25)continue;total++;const px=Math.round(sx+ox),py=Math.round(sy+oy);if(p[((c.height-1-py)*c.width+px)*4+3]>240)opaque++;}if(opaque!==total)junctions.push({index,time,lift,opaque,total});}
  }
  const seamSamples=[];
  for(const lift of [0,1])for(let time=0;time<=30;time+=1){
   const sway=lift?Math.sin(time)*.2:0,bodyY=lift?-32:0;rig.render({...neutral,time,lift,sway,bodyY});const pixels=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
   for(const [x0,y0] of [[540,385],[560,470],[605,555],[620,650],[560,950],[600,965]]){
    const dy=lift*(tailLayout[4].root[1]-550)*.028+bodyY,x=x0-880,y=y0+dy-410,sx=Math.round(35+(880+Math.cos(sway)*x-Math.sin(sway)*y)/1374*650),sy=Math.round(32+(410+Math.sin(sway)*x+Math.cos(sway)*y)/1145*548),alpha=pixels[((c.height-1-sy)*c.width+sx)*4+3];
    if(alpha<235)seamSamples.push({time,lift,x0,y0,alpha});
   }
  }
  const readFrame=()=>{const p=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
  const angles=Array(9).fill(0),fixed={...neutral,tailAngles:angles};
  rig.shadowsEnabled=false;rig.render(fixed,2);const unshaded=readFrame();
  rig.shadowsEnabled=true;rig.render(fixed,2);const initialShadow=readFrame();
  const movedAngles=[...angles];movedAngles[1]=.06;const moved={...fixed,tailAngles:movedAngles};
  rig.render(moved,2);const movedShadow=readFrame();rig.shadowsEnabled=false;rig.render(moved,2);const unshadedMoved=readFrame();rig.shadowsEnabled=true;
  let shadedPixels=0,movingShadowPixels=0,alphaChanges=0,unshadedChanges=0;
  for(let k=0;k<unshaded.length;k+=4){if(unshaded[k+3]>128&&unshaded[k]-initialShadow[k]>2)shadedPixels++;if(Math.abs(initialShadow[k]-movedShadow[k])>2)movingShadowPixels++;if(initialShadow[k+3]!==movedShadow[k+3])alphaChanges++;for(let ch=0;ch<4;ch++)if(unshaded[k+ch]!==unshadedMoved[k+ch])unshadedChanges++;}
  const shadowMotion={shadedPixels,movingShadowPixels,alphaChanges,unshadedChanges};
  petQA.freeze(neutral);return {tails,connectivity,junctions,seamSamples,shadowMotion,drawOrder:rig.drawOrder,gpuError:gl.getError()};
 })()`);
 fs.writeFileSync(path.join(out,'independent-tails.json'),JSON.stringify(result,null,2));
 if(result.connectivity.some(t=>t.connectedToRoot<.995))throw Error('尾巴存在未连接到尾根的碎片：'+JSON.stringify(result.connectivity));
 if(result.junctions.length)throw Error('尾根在动作周期中露出透明裂口：'+JSON.stringify(result.junctions.slice(0,5)));
 if(result.seamSamples.length)throw Error('尾巴4/5或1/2交界出现透明裂口：'+JSON.stringify(result.seamSamples.slice(0,8)));
 if(result.gpuError)throw Error('绘图错误：'+result.gpuError);
 if(result.drawOrder.indexOf(5)<result.drawOrder.indexOf(4)||result.drawOrder.indexOf(1)<result.drawOrder.indexOf(2))throw Error('尾巴前后关系错误');
 const sm=result.shadowMotion;if(sm.shadedPixels<100||sm.movingShadowPixels<30||sm.alphaChanges||sm.unshadedChanges)throw Error('接触阴影没有独立跟随前方尾巴移动：'+JSON.stringify(sm));
 for(const tail of result.tails){if(tail.changedPixels<100)throw Error('尾巴'+tail.index+'没有独立运动');if(tail.areaRatio<.97)throw Error('尾巴'+tail.index+'蓬松面积变化过大');}
 return result;
};
