const {app,powerMonitor,screen}=require('electron'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),assert=require('node:assert/strict');
module.exports=async function(win,runtime){
 const evaluate=code=>win.webContents.executeJavaScript(code),sleep=ms=>new Promise(r=>setTimeout(r,ms)),out=path.join(__dirname,'qa'),checks={};fs.mkdirSync(out,{recursive:true});
 async function waitFor(test,label,timeout=6500){const start=Date.now();while(Date.now()-start<timeout){if(await test())return;await sleep(100);}throw Error('Waiting for '+label);}
 const expectedProfile=path.join(__dirname,'qa','outside-profile-'+process.pid);if(!process.argv.includes('--qa')||path.resolve(app.getPath('userData'))!==path.resolve(expectedProfile)||runtime.engine.list().length!==0)throw Error('Outside-click QA requires a new isolated empty profile');
 await evaluate(`petQA.setState('idle');petQA.openMenu('todos');`);
 const first=runtime.upsert({text:'点外收起测试第一件',deadline:new Date(Date.now()+5*60000).toISOString()});runtime.upsert({text:'点外收起测试第二件',deadline:new Date(Date.now()+10*60000).toISOString()});
 await evaluate(`petQA.closeMenus()`);await waitFor(()=>evaluate(`!document.getElementById('bubble').hidden`),'bubble');
 const original=await evaluate(`document.getElementById('bubble-text').textContent`);await waitFor(async()=>runtime.state().presence.clickObserverActive,'observer flag');
 checks.noOperationStays=await evaluate(`!document.getElementById('bubble').hidden`);await sleep(18000);checks.noOperationStays=checks.noOperationStays&&await evaluate(`!document.getElementById('bubble').hidden&&document.getElementById('bubble-text').textContent===${JSON.stringify(original)}`);
 win.emit('blur');await sleep(500);checks.blurAloneStays=await evaluate(`!document.getElementById('bubble').hidden&&document.getElementById('bubble-text').textContent===${JSON.stringify(original)}`);
 // Register the actual Windows observer only while this test bubble is visible.
 // No physical clicks are injected and no real activity is retained.
 const native=require('./presence-service.cjs').createPresence({app,powerMonitor});
 try{native.observeClicks(true);await waitFor(async()=>native.status().clickObserverActive,'native click subscription');checks.nativeObserverRegistered=true;win.moveTop();await sleep(200);
  const bounds=win.getContentBounds(),local=await evaluate(`(()=>{const b=document.getElementById('bubble').getBoundingClientRect(),f=document.getElementById('pet').getBoundingClientRect();return {bubble:{x:b.x+b.width/2,y:b.y+24},fox:{x:f.x+f.width*451/720,y:f.y+f.height*390/620}};})()`);
  const helper=path.join(__dirname,'native','presence-helper.exe');
  const protectedAt=point=>{const p=screen.dipToScreenPoint(point),raw=execFileSync(helper,['--hit-test',String(process.pid),String(p.x),String(p.y)],{windowsHide:true,encoding:'utf8',timeout:4000});return JSON.parse(raw.trim()).value;};
  checks.nativeBubbleProtected=protectedAt({x:bounds.x+local.bubble.x,y:bounds.y+local.bubble.y});checks.nativeFoxProtected=protectedAt({x:bounds.x+local.fox.x,y:bounds.y+local.fox.y});checks.nativeTransparentSpaceOutside=!protectedAt({x:bounds.x+3,y:bounds.y+3});checks.nativeBeyondWindowOutside=!protectedAt({x:bounds.x-15,y:bounds.y-15});
  native.observeClicks(false);await waitFor(async()=>!native.status().clickObserverActive,'native subscription stop');checks.nativeObserverStopped=true;
 }finally{native.dispose();}
 win.hide();await waitFor(async()=>!runtime.state().presence.clickObserverActive,'hidden window stops observation');checks.hiddenWindowStopsObserver=true;win.show();await waitFor(async()=>runtime.state().presence.clickObserverActive,'visible window resumes observation');checks.visibleWindowResumesObserver=true;
 await evaluate(`(()=>{const b=document.getElementById('bubble'),r=b.getBoundingClientRect();b.dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true,clientX:r.x+r.width/2,clientY:r.y+24}));})()`);await sleep(150);checks.clickInsideStays=await evaluate(`!document.getElementById('bubble').hidden`);
 runtime.testPresence('outside-click');await waitFor(()=>evaluate(`document.getElementById('bubble').hidden&&document.getElementById('pending-reminders').hidden&&document.getElementById('panel').hidden&&document.getElementById('orbit').hidden`),'outside collapses UI');checks.outsideLeavesOnlyFox=true;checks.tasksUncompleted=!runtime.engine.list().find(t=>t.id===first.id).done;checks.observerDisabled=!runtime.state().presence.clickObserverActive;
 await sleep(1800);checks.noImmediateNext=await evaluate(`document.getElementById('bubble').hidden`);
 fs.writeFileSync(path.join(out,'outside-collapsed.png'),(await win.webContents.capturePage()).toPNG());
 await evaluate(`(()=>{const c=document.getElementById('pet'),r=c.getBoundingClientRect(),x=r.x+r.width*451/720,y=r.y+r.height*390/620;c.dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true,clientX:x,clientY:y,screenX:100,screenY:100}));c.dispatchEvent(new PointerEvent('pointerup',{button:0,bubbles:true,clientX:x,clientY:y,screenX:100,screenY:100}));})()`);
 await waitFor(()=>evaluate(`!document.getElementById('bubble').hidden&&document.getElementById('bubble-text').textContent===${JSON.stringify(original)}`),'fox reopens');checks.foxReopensSame=true;
 await evaluate(`document.body.dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true,clientX:1,clientY:1}))`);await waitFor(()=>evaluate(`document.getElementById('bubble').hidden`),'local blank click');checks.localBlankClickCloses=true;
 checks.errors=(await evaluate('petQA.snapshot().errors')).length===0;
 fs.writeFileSync(path.join(out,'outside-click-report.json'),JSON.stringify(checks,null,2));for(const [name,ok]of Object.entries(checks))assert(ok,'Outside click check failed: '+name);
 if(fs.existsSync(path.join(out,'last-error.txt')))fs.unlinkSync(path.join(out,'last-error.txt'));
};
