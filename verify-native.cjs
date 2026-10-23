const {screen}=require('electron');const fs=require('node:fs'),path=require('node:path');
const {execFile,spawn}=require('node:child_process');const {promisify}=require('node:util');const execute=promisify(execFile);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async function(win){
 const area=screen.getDisplayMatching(win.getBounds()).workArea;win.setPosition(area.x+20,area.y+20);
 await win.webContents.executeJavaScript('petQA.closeMenus()');await sleep(150);
 const b=win.getContentBounds(),origin=screen.dipToScreenPoint({x:b.x,y:b.y}),end=screen.dipToScreenPoint({x:b.x+b.width,y:b.y+b.height});
 const counter=path.join(__dirname,'qa','underlay-count.txt');if(fs.existsSync(counter))fs.unlinkSync(counter);
 const under=spawn(path.join(__dirname,'qa','underlay.exe'),[win.getNativeWindowHandle().readBigUInt64LE().toString(),counter],{windowsHide:false,stdio:'ignore'});
 try{
  for(let i=0;i<100&&!fs.existsSync(counter);i++)await sleep(50);
  if(!fs.existsSync(counter))throw Error('独立测试窗口未启动');win.hide();win.show();win.moveTop();await sleep(200);
  const points=await win.webContents.executeJavaScript(`(()=>{const r=document.getElementById('pet').getBoundingClientRect();return {clear:{x:r.x+5,y:r.y+5},fox:{x:r.x+r.width*451/720,y:r.y+r.height*390/620}};})()`);
  const traces=[];const click=async(p,button='left')=>{const bounds=win.getContentBounds(),q=screen.dipToScreenPoint({x:Math.round(bounds.x+p.x),y:Math.round(bounds.y+p.y)});const r=await execute('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'qa-click.ps1'),'-X',String(q.x),'-Y',String(q.y),'-Handle',win.getNativeWindowHandle().readBigUInt64LE().toString(),'-RatioX',String(p.x/bounds.width),'-RatioY',String(p.y/bounds.height),'-Button',button],{windowsHide:true});traces.push(r.stdout);await sleep(150);};
  await click(points.clear);const clearClicks=Number(fs.readFileSync(counter,'utf8'));
  await click(points.fox);const foxClicks=Number(fs.readFileSync(counter,'utf8'));const pose=await win.webContents.executeJavaScript('petQA.snapshot().mode');
  const report={transparentClickReachedUnderlay:clearClicks===1,foxClickBlockedUnderlay:foxClicks===1,foxClickTriggeredPet:pose==='pet',clearClicks,foxClicks,traces,rootHandle:win.getNativeWindowHandle().readBigUInt64LE().toString(),underHandle:fs.readFileSync(counter+'.hwnd','utf8')};
  await win.webContents.executeJavaScript('petQA.freeze({time:0,blink:0,pet:0,lift:0,head:0,earLeft:0,earRight:0,breath:0,bodyY:0,sway:0,mouth:0})');await sleep(100);
  const beforeBounds=win.getBounds(),changes=[];const changed=()=>changes.push(win.getBounds());win.on('resize',changed);win.on('move',changed);
  const sample=`(()=>{const c=document.getElementById('pet'),r=c.getBoundingClientRect(),gl=c.getContext('webgl'),p=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,p);let hash=2166136261;for(const b of p)hash=Math.imul(hash^b,16777619)>>>0;return {x:r.x,y:r.y,width:r.width,height:r.height,hash};})()`;
  const before=await win.webContents.executeJavaScript(sample);await click(points.fox,'right');
  const opened=await win.webContents.executeJavaScript('!document.getElementById("orbit").hidden');const after=await win.webContents.executeJavaScript(sample);
  await win.webContents.executeJavaScript("petQA.openMenu('todos')");await sleep(120);const detailed=await win.webContents.executeJavaScript(sample);
  await win.webContents.executeJavaScript('petQA.closeMenus()');await sleep(120);const closed=await win.webContents.executeJavaScript(sample);
  win.off('resize',changed);win.off('move',changed);
  report.menuStability={rightClickOpened:opened,noWindowChanges:changes.length===0,boundsUnchanged:JSON.stringify(beforeBounds)===JSON.stringify(win.getBounds()),foxUnchanged:[after,detailed,closed].every(x=>JSON.stringify(x)===JSON.stringify(before))};
  fs.writeFileSync(path.join(__dirname,'qa','native-clickthrough.json'),JSON.stringify(report,null,2));if(!report.transparentClickReachedUnderlay||!report.foxClickBlockedUnderlay||!report.foxClickTriggeredPet||Object.values(report.menuStability).some(v=>!v))throw Error('原生透明点击或右键菜单稳定性检查失败');
 }finally{under.kill();}
};
