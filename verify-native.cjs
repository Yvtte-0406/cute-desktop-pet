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
  const traces=[];const click=async p=>{const bounds=win.getContentBounds(),q=screen.dipToScreenPoint({x:Math.round(bounds.x+p.x),y:Math.round(bounds.y+p.y)});const r=await execute('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'qa-click.ps1'),'-X',String(q.x),'-Y',String(q.y),'-Handle',win.getNativeWindowHandle().readBigUInt64LE().toString(),'-RatioX',String(p.x/bounds.width),'-RatioY',String(p.y/bounds.height)],{windowsHide:true});traces.push(r.stdout);await sleep(150);};
  await click(points.clear);const clearClicks=Number(fs.readFileSync(counter,'utf8'));
  await click(points.fox);const foxClicks=Number(fs.readFileSync(counter,'utf8'));const pose=await win.webContents.executeJavaScript('petQA.snapshot().mode');
  const report={transparentClickReachedUnderlay:clearClicks===1,foxClickBlockedUnderlay:foxClicks===1,foxClickTriggeredPet:pose==='pet',clearClicks,foxClicks,traces,rootHandle:win.getNativeWindowHandle().readBigUInt64LE().toString(),underHandle:fs.readFileSync(counter+'.hwnd','utf8')};
  fs.writeFileSync(path.join(__dirname,'qa','native-clickthrough.json'),JSON.stringify(report,null,2));if(!report.transparentClickReachedUnderlay||!report.foxClickBlockedUnderlay||!report.foxClickTriggeredPet)throw Error('原生透明点击检查失败');
 }finally{under.kill();}
};
