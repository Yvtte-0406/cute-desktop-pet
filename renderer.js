const $=id=>document.getElementById(id),canvas=$('pet'),api=window.petAPI;
const preview=new URLSearchParams(location.search).get('preview')==='true';
document.body.classList.toggle('preview',preview);
let lastShape=0,ready=false,mode='idle',modeUntil=0,last=0,press=null,dragging=false,velocity=0,tasks=[],bubbleUntil=0,rig,pose,frozenPose=null;
const motion=new window.foxMotion.FoxMotion(),times=[],errors=[];
window.addEventListener('error',e=>errors.push(e.message));
function setState(state,duration=0){mode=state;modeUntil=duration?performance.now()+duration:0;}
function say(text,duration=5500){window.reminderUI?.beforeSay();$('bubble-text').textContent=text;$('bubble').hidden=false;window.bubbleFrame.update();bubbleUntil=duration>0?performance.now()+duration:0;setState('talk',Math.min(duration||3500,3500));window.reminderUI?.afterSay();}
function showError(e){errors.push(e.message);$('error').textContent=e.message;$('panel').hidden=false;}
const loadImage=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('动画图层加载失败：'+src));image.src=src;});
let tailLayers=[];
function cleanArt(image,sx=0,sy=0,w=image.width,h=image.height){const c=document.createElement('canvas');c.width=Math.round(w);c.height=Math.round(h);const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(image,sx,sy,w,h,0,0,c.width,c.height);const pixels=g.getImageData(0,0,c.width,c.height);window.spriteTools.cleanSpritePixels(pixels.data,c.width,c.height);g.putImageData(pixels,0,0);return c;}
let tailLayout=window.reconstructedTailLayout;let closedFace;Promise.all([loadImage('assets/layers/body.png'),loadImage('assets/layers/closed-reference.png'),...Array.from({length:9},(_,i)=>loadImage('assets/tails-overlap-v2/tail-'+String(i+1).padStart(2,'0')+'.png'))]).then(([body,reference,...tails])=>{try{tailLayers=tails.map(image=>{const c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.getContext('2d').drawImage(image,0,0);return c;});closedFace=document.createElement('canvas');closedFace.width=body.width;closedFace.height=body.height;closedFace.getContext('2d').drawImage(reference,0,0,body.width,body.height);rig=new window.foxRig.FoxRig(canvas,cleanArt(body),tailLayers,tailLayout,closedFace);ready=true;}catch(e){showError(e);}}).catch(showError);
function draw(now){
 requestAnimationFrame(draw);if(!ready){last=now;return;}
 const raw=last?now-last:16.7,dt=Math.min(raw/1000,.05);last=now;
 times.push(raw);if(times.length>600)times.shift();
 if(modeUntil&&now>modeUntil)setState('idle');
 if(bubbleUntil&&now>bubbleUntil){if(window.reminderUI?.holdsReading())bubbleUntil=0;else{$('bubble').hidden=true;bubbleUntil=0;window.reminderUI?.expired();}}
 pose=motion.step(dt,mode,velocity);velocity*=Math.exp(-dt*6);
 try{rig.render(frozenPose?{...pose,...frozenPose}:pose);if(!preview&&now-lastShape>65){lastShape=now;api.setShape(window.petShape.shape(canvas,rig.gl));}}catch(e){ready=false;showError(e);}
}
requestAnimationFrame(draw);
let menuOpen=false,activePane=null;
const paneTitles={todos:'待办事项',size:'桌宠大小',settings:'设置'};
function openMenu(pane){window.reminderUI?.menuOpened();menuOpen=true;activePane=pane;$('orbit').hidden=false;$('panel').hidden=!pane;$('bubble').hidden=true;if(pane)$('panel-title').textContent=paneTitles[pane];document.querySelectorAll('[data-content]').forEach(el=>el.hidden=el.dataset.content!==pane);// Transparent desktop areas are handled by native window blur; local clicks use capture.
document.addEventListener('pointerdown',e=>{if(e.button!==0||!menuOpen||e.target.closest('#panel, #orbit button'))return;closeMenus();},true);

document.querySelectorAll('[data-pane]').forEach(el=>el.setAttribute('aria-expanded',String(el.dataset.pane===pane)));updatePetLayout();api.setMenu({open:true,details:Boolean(pane)});window.reminderUI?.syncOutsideWatch();}
function closeMenus(){const wasOpen=menuOpen;menuOpen=false;activePane=null;$('orbit').hidden=true;$('panel').hidden=true;document.querySelectorAll('[data-pane]').forEach(el=>el.setAttribute('aria-expanded','false'));updatePetLayout();api.setMenu({open:false,details:false});if(wasOpen)window.reminderUI?.menuClosed();window.reminderUI?.syncOutsideWatch();}
document.querySelectorAll('[data-pane]').forEach(el=>el.onclick=()=>openMenu(activePane===el.dataset.pane?null:el.dataset.pane));
function hitTest(x,y){
 const el=document.elementFromPoint(x,y);if(!el)return false;
 if(el.closest('#panel')||el.closest('#orbit button')||el.closest('#bubble button, #bubble select, #bubble input, #pending-reminders'))return true;
 if(el!==canvas||!ready)return false;
 const r=canvas.getBoundingClientRect();if(x<r.left||x>=r.right||y<r.top||y>=r.bottom)return false;
 const px=Math.max(0,Math.min(canvas.width-1,Math.floor((x-r.left)/r.width*canvas.width))),py=Math.max(0,Math.min(canvas.height-1,Math.floor((y-r.top)/r.height*canvas.height)));
 const rgba=new Uint8Array(4),gl=rig.gl;gl.readPixels(px,canvas.height-1-py,1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);return rgba[3]>=35;
}
api.onHitProbe(point=>api.replyHit({id:point.id,interactive:dragging||Boolean(press)||hitTest(point.x,point.y)}));
new ResizeObserver(()=>document.body.style.setProperty('--pet-height',canvas.getBoundingClientRect().height+'px')).observe(canvas);
let sizeRevision=0,sizeTimer,requestedScale=1;
function updatePetLayout(){const width=300*requestedScale;document.body.style.setProperty('--pet-width',width+'px');document.body.style.setProperty('--pet-height',(width*620/720)+'px');}
window.addEventListener('resize',updatePetLayout);
function displayScale(scale){$('pet-size').value=Math.round(scale*100);$('size-value').textContent=Math.round(scale*100)+'%';requestedScale=scale;updatePetLayout();}
async function changeScale(scale){const revision=++sizeRevision;try{const result=await api.setScale(scale);if(revision===sizeRevision){displayScale(result.scale);$('pet-size').max=Math.floor(result.maxScale*100);}}catch(e){$('error').textContent='大小保存失败：'+e.message;}}
$('pet-size').addEventListener('input',()=>{const scale=Number($('pet-size').value)/100;$('size-value').textContent=Math.round(scale*100)+'%';clearTimeout(sizeTimer);sizeTimer=setTimeout(()=>changeScale(scale),90);});
$('size-reset').onclick=()=>{clearTimeout(sizeTimer);changeScale(1);};
api.getPreferences().then(p=>{displayScale(p.scale);$('reminders').checked=p.reminders!==false;}).catch(e=>{$('error').textContent='无法读取大小设置：'+e.message;});

canvas.addEventListener('pointerdown',e=>{if(e.button!==0||(e.isTrusted&&!hitTest(e.clientX,e.clientY)))return;press={x:e.screenX,y:e.screenY,lastX:e.screenX};if(e.isTrusted)canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!press)return;velocity=e.screenX-press.lastX;press.lastX=e.screenX;if(!dragging&&Math.hypot(e.screenX-press.x,e.screenY-press.y)>6){dragging=true;window.reminderUI?.suspendLocal('drag');$('bubble').hidden=true;setState('lift');api.startDrag();}});
function release(){if(!press)return;if(dragging){api.stopDrag();setState('idle');window.reminderUI?.menuClosed();}else{setState('pet',2100);window.reminderUI?.foxClick();}press=null;dragging=false;}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',()=>{press=null;dragging=false;api.stopDrag();setState('idle');});api.onCancel(()=>{press=null;dragging=false;closeMenus();setState('idle');window.reminderUI?.menuClosed();});
canvas.addEventListener('contextmenu',e=>{e.preventDefault();if(menuOpen)closeMenus();else openMenu(null);});$('close').onclick=closeMenus;$('quit').onclick=()=>api.quit();
function pollReminders(){return '';}
const reminderClock={reset(){}};
$('reminders').onchange=async()=>{const enabled=$('reminders').checked;try{await api.setReminders(enabled);}catch(e){$('reminders').checked=!enabled;$('error').textContent=e.message;}};

function displayStartup(s){$('autostart').checked=s.enabled;$('autostart').disabled=!s.supported;$('startup-status').textContent=!s.supported?'打包后的应用可设置开机自启':s.enabled?(s.willLaunch?'开机自启已开启':'已登记，请在Windows启动应用中允许阿泠'):'开机自启已关闭';}
api.getStartup().then(displayStartup).catch(()=>{$('startup-status').textContent='自启设置读取失败';});
$('autostart').onchange=async()=>{const enabled=$('autostart').checked;try{displayStartup(await api.setStartup(enabled));}catch(e){$('autostart').checked=!enabled;$('startup-status').textContent='自启设置保存失败';}};
let aiConfigured=false,aiPending=false,reminderRevision=0;
function displayAISettings(s){aiConfigured=s.enabled&&s.hasKey;$('ai-enabled').checked=s.enabled;$('ai-dynamic').checked=s.dynamic;$('ai-limit').value=s.dailyLimit;$('ai-month-budget').value=s.monthBudgetRMB??'';$('ai-input-price').value=s.inputRMB??'';$('ai-output-price').value=s.outputRMB??'';$('api-key').value='';$('api-key').placeholder=s.hasKey?'Key已加密保存；留空表示保留':'未填写，仅使用本地提醒';$('ai-status').textContent=(aiConfigured?'AI已开启':'本地提醒')+' · 今日调用 '+s.usage.calls+'/'+s.usage.limit+' · '+s.model+' · 输入/输出 '+s.usage.inputTokens+'/'+s.usage.outputTokens+' tokens'+(s.usage.priceConfigured?' · 本月估算¥'+s.usage.costRMB.toFixed(4):' · 费用未估算（价格未设置）')+(s.usage.calls>=20?' · 今日用量较多':'');const states={'key-rejected':'Key未通过验证，使用本地提醒','rate-limited':'接口繁忙，使用本地提醒','monthly-limit':'月预算已达限制，使用本地提醒','daily-limit':'今日调用已达上限，使用本地提醒',fallback:'连接或输出异常，使用本地提醒',cooldown:'请求冷却中，使用本地提醒'};if(states[s.usage.status])$('ai-status').textContent+=' · '+states[s.usage.status];}
api.getAISettings().then(displayAISettings).catch(()=>{$('ai-status').textContent='设置读取失败，继续本地提醒';});
$('ai-form').onsubmit=async e=>{e.preventDefault();try{const s=await api.saveAISettings({enabled:$('ai-enabled').checked,dynamic:$('ai-dynamic').checked,apiKey:$('api-key').value,dailyLimit:$('ai-limit').value,monthBudgetRMB:$('ai-month-budget').value,inputRMB:$('ai-input-price').value,outputRMB:$('ai-output-price').value});reminderRevision++;reminderClock.reset();displayAISettings(s);$('ai-status').textContent+=' · 已保存';}catch(e){$('ai-status').textContent=e.message.replace(/^.*?Error: /,'');}};
$('ai-remove').onclick=async()=>{try{displayAISettings(await api.saveAISettings({enabled:false,dynamic:true,apiKey:'',removeKey:true}));reminderRevision++;reminderClock.reset();$('ai-preview').textContent='';}catch(e){$('ai-status').textContent='删除失败，请重试';}};
let previewBusy=false;
async function previewReminder(){if(previewBusy)return null;previewBusy=true;const button=$('ai-preview-button'),label=button.textContent;button.disabled=true;button.textContent='正在生成…';$('ai-preview').textContent='正在准备提醒，最多等待12秒…';$('ai-preview').scrollIntoView({block:'nearest'});
 try{const result=await api.previewAI(),source=result.source?.startsWith('ai')?'AI预览':'本地预览',message=result.message||'爪爪轻敲～先在待办里写下一件要做的事吧，我来陪你开始！';let note='';if(source==='本地预览'){const reasons={'key-rejected':'Key未通过验证，已使用本地提醒','daily-limit':'今日额度已用完，已使用本地提醒',cooldown:'请求冷却中，已使用本地提醒','rate-limited':'接口繁忙，已使用本地提醒',fallback:'连接或输出异常，已使用本地提醒'};note=reasons[result.reason]||'未使用AI，展示本地提醒';}const display=source+'：'+message;$('ai-preview').textContent=display+(note?'（'+note+'）':'');displayAISettings(await api.getAISettings());closeMenus();say(message,0);return {...result,display};
 }catch(error){const display='本地预览：'+(window.foxTodos.reminderText(tasks)||'先添加一件待办吧，我陪你一起完成～');$('ai-preview').textContent=display;closeMenus();say(display,0);return {source:'local',display};}finally{button.disabled=false;button.textContent=label;previewBusy=false;}}
$('ai-preview-button').onclick=previewReminder;
window.petQA={
 showBubbleSample:text=>{closeMenus();say(text||'样式示例：哼，待办可别忘了，记牢啦！',22000);},previewReminder,openMenu,closeMenus,hitTest,pollReminders,resetReminderClock:now=>reminderClock.reset(now),
 tailIntegrity:()=>tailLayout.map((b,i)=>{const c=tailLayers[i],p=c.getContext('2d').getImageData(0,0,c.width,c.height).data,x=Math.round(b.root[0]-b.offset[0]),y=Math.round(b.root[1]-b.offset[1]);const body=rig.image.getContext('2d').getImageData(0,0,1374,1145).data;let opaque=0,covered=0;for(let dy=-18;dy<=18;dy++)for(let dx=-18;dx<=18;dx++){if(p[((y+dy)*c.width+x+dx)*4+3]>200)opaque++;if(body[((b.root[1]+dy)*1374+b.root[0]+dx)*4+3]>240)covered++;}return {index:i,complete:b.complete,rootPixels:opaque,bodyOverlap:covered/1369};}),
 exportClosedFace:()=>closedFace.toDataURL('image/png').split(',')[1],
 exportTailLayout:()=>tailLayout,
 exportTailLayers:()=>tailLayers.map(c=>c.toDataURL('image/png').split(',')[1]),
 setState:s=>{frozenPose=null;if(s==='talk')say('今天也陪你一起完成待办。',20000);else{$('bubble').hidden=true;setState(s);}},
 freeze:p=>{frozenPose=p;if(p&&ready)rig.render({...pose,...p});},
 snapshot:()=>({mode,ready,errors,engine:'body-and-nine-independent-tail-meshes',tailCount:rig?.tailTextures.length,tailOrder:rig?.drawOrder,shadowCount:rig?.occlusion.shadows.length,vertexCount:rig?.vertexCount,textureUploads:rig?.textureUploads,pose:rig?.pose,frameCount:times.length,meanFrameMs:times.reduce((a,b)=>a+b,0)/times.length,p95FrameMs:[...times].sort((a,b)=>a-b)[Math.floor(times.length*.95)]}),
 record:()=>new Promise(resolve=>{
  const chunks=[],stream=canvas.captureStream(60),rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9'});
  rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  rec.onstop=()=>{stream.getTracks().forEach(t=>t.stop());const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}));};
  let dragDemo;rec.start();['idle','talk','pet','lift','idle'].forEach((s,i)=>setTimeout(()=>{window.petQA.setState(s);if(s==='lift'){const start=performance.now();dragDemo=setInterval(()=>velocity=Math.sin((performance.now()-start)/330)*20,16);}else{clearInterval(dragDemo);velocity=0;}},i*4000));setTimeout(()=>{clearInterval(dragDemo);rec.stop();},20000);
 })
};
