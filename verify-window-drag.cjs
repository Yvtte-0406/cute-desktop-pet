const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async function(win,drag){
 const reports=[];let cursor={x:100,y:200};
 try{
  await win.webContents.executeJavaScript("petQA.closeMenus();petQA.setState('lift')");
  for(const scale of [.4,.7,1.2]){
   // The production sizing path is covered by verify.cjs; vary native window sizes here.
   win.setBounds({x:30,y:30,width:Math.max(380,Math.round(300*scale)),height:Math.ceil(300*scale*620/720+410)});await sleep(200);
   const initial=win.getBounds();cursor={x:100,y:200};drag.start(()=>cursor);
   const phases=[];
   for(const offset of [{x:0,y:0},{x:80,y:-20},{x:160,y:40},{x:0,y:0}]){
    cursor={x:100+offset.x,y:200+offset.y};await sleep(250);
    const samples=[];for(let i=0;i<40;i++){samples.push(win.getBounds());await sleep(50)}
    const first=samples[0],range=k=>Math.max(...samples.map(x=>x[k]))-Math.min(...samples.map(x=>x[k]));
    const item={offset,first,last:samples.at(-1),ranges:{x:range('x'),y:range('y'),width:range('width'),height:range('height')}};phases.push(item);
    assert(Object.values(item.ranges).every(x=>x===0),'Stationary window changed geometry');
    assert(Math.abs(first.x-(initial.x+offset.x))<=1&&Math.abs(first.y-(initial.y+offset.y))<=1,'Window did not follow cursor displacement');
    assert(Math.abs(first.width-initial.width)<=2&&Math.abs(first.height-initial.height)<=2,'Window size accumulated during drag');
   }
   drag.stop();const before=win.getBounds();cursor={x:999,y:999};await sleep(150);assert.deepEqual(win.getBounds(),before,'Stopped drag still moved window');
   reports.push({scale,initial,phases,releaseStable:true});
  }
  fs.writeFileSync(path.join(__dirname,'qa','window-drag.json'),JSON.stringify({passed:true,input:'controlled cursor coordinates; real native BrowserWindow and production drag controller',reports},null,2));
 }finally{drag.stop();}
};
