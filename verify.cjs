const fs=require('node:fs');const path=require('node:path');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async function verify(win){
 const out=path.join(__dirname,'qa');fs.mkdirSync(out,{recursive:true});
 const evaluate=code=>win.webContents.executeJavaScript(code);
 const ready=await evaluate('window.petQA.snapshot().ready');if(!ready)throw Error('动画素材未加载');
 const removedDateFeatures=await evaluate(`({noDateSummary:!document.getElementById('calendar-summary'),noCalendarBridge:typeof petAPI.getCalendarContext==='undefined'&&typeof petAPI.claimCalendarGreeting==='undefined',taskReminderOnly:document.querySelector('[data-content="todos"]').textContent.includes('每30分钟提醒待办')})`);
 if(Object.values(removedDateFeatures).some(v=>!v))throw Error('日期问候相关界面或接口仍存在');
 const interaction=await evaluate(`(async()=>{
  const task={id:'qa-task',text:'测试待办 <安全文本>',done:false};
  await petAPI.saveTasks([task]);const restored=await petAPI.readTasks();
  if(restored[0].text!==task.text)throw Error('待办持久化失败');
  document.getElementById('pet').dispatchEvent(new PointerEvent('pointerdown',{button:0,pointerId:1,screenX:100,screenY:100}));
  document.getElementById('pet').dispatchEvent(new PointerEvent('pointerup',{button:0,pointerId:1,screenX:100,screenY:100}));
  const click=petQA.snapshot().mode==='pet';
  document.getElementById('pet').dispatchEvent(new PointerEvent('pointerdown',{button:0,pointerId:1,screenX:100,screenY:100}));
  document.getElementById('pet').dispatchEvent(new PointerEvent('pointermove',{pointerId:1,screenX:120,screenY:120}));
  const lift=petQA.snapshot().mode==='lift';
  document.getElementById('pet').dispatchEvent(new PointerEvent('pointerup',{pointerId:1,screenX:120,screenY:120}));
  const release=petQA.snapshot().mode==='idle';await petAPI.saveTasks([]);
  return {click,lift,release,persistence:true};
 })()`);
 const textureUploads=await evaluate('window.petQA.snapshot().textureUploads');
 if(textureUploads!==11)throw Error('身体与九条尾巴的图层数量不正确');
 const tailImages=await evaluate('window.petQA.exportTailLayers()');fs.writeFileSync(path.join(__dirname,'assets','layers','closed-reference.png'),Buffer.from(await evaluate('window.petQA.exportClosedFace()'),'base64'));
 const layout=await evaluate('window.petQA.exportTailLayout()');
 fs.writeFileSync(path.join(__dirname,'assets','layers','tail-layout.json'),JSON.stringify(layout,null,2));
 fs.writeFileSync(path.join(__dirname,'assets','layers','tail-layout.js'),'window.preservedTailLayout='+JSON.stringify(layout)+';\n');
 if(tailImages.length!==9)throw Error('尾巴未完整拆分');
 const sourceFidelity=await evaluate('window.petQA.tailSourceFidelity()');
 if(sourceFidelity.checked<500||sourceFidelity.mismatches)throw Error('尾巴可见毛发与原图不一致');
 for(let i=0;i<9;i++)fs.writeFileSync(path.join(__dirname,'assets','layers','tail-'+String(i+1).padStart(2,'0')+'.png'),Buffer.from(tailImages[i],'base64'));
 const preferences=await evaluate(`(async()=>{const original=await petAPI.getPreferences();const small=await petAPI.setScale(.75);const loaded=await petAPI.getPreferences();const large=await petAPI.setScale(1.25);await petAPI.setScale(original.scale);return {small:small.scale,loaded:loaded.scale,large:large.scale,restored:original.scale};})()`);
 if(preferences.small!==.75||preferences.loaded!==.75||preferences.large<=preferences.small)throw Error('桌宠大小调整或保存失败');
 const todoUI=await evaluate(`(async()=>{
  petQA.openMenu('todos');document.getElementById('task').value='报告 <不要作为HTML>';document.getElementById('deadline').value='2026-10-24T18:30';document.getElementById('form').requestSubmit();await new Promise(r=>setTimeout(r,150));
  const saved=await petAPI.readTasks(),li=document.querySelector('#tasks li');
  const result={textSaved:saved[0]?.text==='报告 <不要作为HTML>',deadlineSaved:Boolean(saved[0]?.deadline),deleteOnly:li.querySelectorAll('button').length===1&&!li.querySelector('input'),deadlineShown:Boolean(li.querySelector('time')),safeText:!li.querySelector('img,script'),reminderInTodos:document.querySelector('[data-content="todos"]').contains(document.getElementById('reminders')),onlyThreeIcons:document.querySelectorAll('#orbit button').length===3};
  await petAPI.setReminders(false);await petAPI.setScale(.6);result.preferencePreserved=(await petAPI.getPreferences()).reminders===false;await petAPI.setReminders(true);await petAPI.setScale(${preferences.restored});
  petQA.closeMenus();petQA.setState('idle');petQA.resetReminderClock(0);result.noEarlyReminder=petQA.pollReminders(1799999)==='';result.remindsAt30min=petQA.pollReminders(1800000).includes('报告');
  petQA.openMenu('todos');return result;
 })()`);
 if(Object.values(todoUI).some(v=>!v))throw Error('待办界面或30分钟提醒失败：'+JSON.stringify(todoUI));
 await sleep(150);fs.writeFileSync(path.join(out,'todos-menu.png'),(await win.webContents.capturePage()).toPNG());
 await evaluate(`(async()=>{document.querySelector('#tasks li button').click();await new Promise(r=>setTimeout(r,120));if((await petAPI.readTasks()).length)throw Error('删除待办失败');petQA.closeMenus();petQA.setState('idle');})()`);
 const blinkCoverage=[],faceFrames=[];
 for(const blink of [0,.25,.5,.75,1]){
  await evaluate(`window.petQA.freeze({time:0,blink:${blink},pet:0,lift:0,head:0,earLeft:0,earRight:0,breath:0,bodyY:0,sway:0,mouth:0})`);
  await sleep(120);fs.writeFileSync(path.join(out,'blink-'+blink+'.png'),(await win.webContents.capturePage()).toPNG());
  if(blink===1){const r=await evaluate("(()=>{const r=document.getElementById('pet').getBoundingClientRect();return {x:r.x+r.width*.35,y:r.y+r.height*.03,width:r.width*.53,height:r.height*.59};})()");const captured=await win.webContents.capturePage(),dpi=captured.getSize().width/win.getContentBounds().width;fs.writeFileSync(path.join(out,'closed-face-preview.png'),captured.crop({x:Math.floor(r.x*dpi),y:Math.floor(r.y*dpi),width:Math.floor(r.width*dpi),height:Math.floor(r.height*dpi)}).toPNG());}
  blinkCoverage.push(await evaluate(`(()=>{const c=document.getElementById('pet'),g=c.getContext('webgl');const p=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);let n=0;for(let i=3;i<p.length;i+=4)if(p[i]>128)n++;return n;})()`));
  faceFrames.push(await evaluate(`(()=>{
   const c=document.getElementById('pet'),g=c.getContext('webgl'),pixels=new Uint8Array(c.width*c.height*4);
   g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,pixels);
   const fixed=[],eyes=[],outline=[];
   for(let y=330;y<590;y+=2)for(let x=670;x<1130;x+=2){
    if(y<410&&x<720)continue; // Ear base belongs to the independently moving ear.
    const eye=[[798,450,-.35],[953,397,-.34]].some(([cx,cy,a])=>{const dx=x-cx,dy=y-cy,qx=Math.cos(a)*dx+Math.sin(a)*dy,qy=-Math.sin(a)*dx+Math.cos(a)*dy;return Math.hypot(qx/74,qy/54)<1;});
    const sx=Math.round(35+x/1374*650),sy=Math.round(32+y/1145*548),i=((c.height-1-sy)*c.width+sx)*4;
    (eye?eyes:fixed).push(...pixels.slice(i,i+4));outline.push(pixels[i+3]);
   }
   return {fixed,eyes,outline};
  })()`));
 }
 const baseline=faceFrames[0];let fixedDifference=0,eyeDifference=0,outlineDifference=0;
 for(const frame of faceFrames.slice(1)){
  frame.fixed.forEach((v,i)=>{if(v!==baseline.fixed[i])fixedDifference++;});
  frame.outline.forEach((v,i)=>{if(v!==baseline.outline[i])outlineDifference++;});
 }
 faceFrames.at(-1).eyes.forEach((v,i)=>{if(v!==baseline.eyes[i])eyeDifference++;});
 const faceStability={fixedDifference,outlineDifference,eyeDifference,frames:faceFrames.length};
 if(fixedDifference||outlineDifference||eyeDifference<100)throw Error('闭眼改变了脸部轮廓或眼睛以外的面部，或眼睛未变化：'+JSON.stringify(faceStability));
 await evaluate('window.petQA.freeze(null)');
 if(Math.min(...blinkCoverage)<Math.max(...blinkCoverage)*.98)throw Error('眨眼导致大面积透明闪烁');
 const liftedEdges=[];
 for(const sway of [-.2,.2]){
  await evaluate(`window.petQA.freeze({time:2,blink:0,pet:0,lift:1,head:${-sway*.45},earLeft:.12,earRight:-.1,breath:0,bodyY:-32,sway:${sway},mouth:0})`);
  await sleep(150);fs.writeFileSync(path.join(out,'lift-sway-'+sway+'.png'),(await win.webContents.capturePage()).toPNG());
  liftedEdges.push(await evaluate(`(()=>{const c=document.getElementById('pet'),g=c.getContext('webgl'),p=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);let edge=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if((x<2||x>=c.width-2||y<2||y>=c.height-2)&&p[(y*c.width+x)*4+3]>30)edge++;return edge;})()`));
 }
 await evaluate('window.petQA.freeze(null)');
 if(liftedEdges.some(x=>x>0))throw Error('拖拽摆动超出绘图区域');
 await evaluate("window.petQA.openMenu('size')");await sleep(150);fs.writeFileSync(path.join(out,'size-menu.png'),(await win.webContents.capturePage()).toPNG());
 const menu=await evaluate(`(()=>{const c=document.getElementById('pet').getBoundingClientRect(),p=document.getElementById('panel').getBoundingClientRect(),n=document.getElementById('orbit').getBoundingClientRect(),b=document.querySelector('[data-pane="size"]').getBoundingClientRect();return {panelAboveArc:p.bottom<n.top,arcAboveFox:n.bottom<c.top+25,buttonHit:petQA.hitTest(b.x+b.width/2,b.y+b.height/2),arcGapPasses:!petQA.hitTest(n.x+163,n.y+80),contentVisible:document.getElementById('pet-size').getBoundingClientRect().bottom<p.bottom,bottomHintRemoved:!document.getElementById('hint')};})()`);
 if(Object.values(menu).some(v=>!v))throw Error('弧形菜单位置或透明区域点击判断失败');
 await evaluate("window.petQA.closeMenus()");
 const hits=await evaluate(`(()=>{const r=document.getElementById('pet').getBoundingClientRect();return {transparent:petQA.hitTest(r.x+2,r.y+2),fox:petQA.hitTest(r.x+r.width*451/720,r.y+r.height*390/620)};})()`);
 if(hits.transparent||!hits.fox)throw Error('狐狸轮廓点击判断失败');
 const video=await evaluate('window.petQA.record()');fs.writeFileSync(path.join(out,'animation-preview.webm'),Buffer.from(video,'base64'));
 const report={interaction,preferences,todoUI,removedDateFeatures,menu,hits,continuousAnimation:{textureUploads,tailCount:tailImages.length,sourceFidelity,blinkCoverage,faceStability,liftedEdges},performance:await evaluate('window.petQA.snapshot()')};
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));
 if(!interaction.click||!interaction.lift||!interaction.release||report.performance.errors.length)throw Error('交互检查失败');
};
