const $=id=>document.getElementById(id),canvas=$('pet'),api=window.petAPI;
const preview=new URLSearchParams(location.search).get('preview')==='true';
document.body.classList.toggle('preview',preview);
let lastShape=0,ready=false,mode='idle',modeUntil=0,last=0,press=null,dragging=false,velocity=0,tasks=[],bubbleUntil=0,rig,pose,frozenPose=null;
const motion=new window.foxMotion.FoxMotion(),times=[],errors=[];
window.addEventListener('error',e=>errors.push(e.message));
function setState(state,duration=0){mode=state;modeUntil=duration?performance.now()+duration:0;}
function say(text,duration=5500){$('bubble').textContent=text;$('bubble').hidden=false;bubbleUntil=performance.now()+duration;setState('talk',duration);}
function showError(e){errors.push(e.message);$('error').textContent=e.message;$('panel').hidden=false;}
const loadImage=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('动画图层加载失败：'+src));image.src=src;});
let tailLayers=[];
function cleanArt(image,sx=0,sy=0,w=image.width,h=image.height){const c=document.createElement('canvas');c.width=Math.round(w);c.height=Math.round(h);const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(image,sx,sy,w,h,0,0,c.width,c.height);const pixels=g.getImageData(0,0,c.width,c.height);window.spriteTools.cleanSpritePixels(pixels.data,c.width,c.height);g.putImageData(pixels,0,0);return c;}
let tailLayout=window.preservedTailLayout;let closedFace;Promise.all([loadImage('assets/layers/body.png'),loadImage('assets/layers/closed-reference.png'),...Array.from({length:9},(_,i)=>loadImage('assets/layers/tail-'+String(i+1).padStart(2,'0')+'.png'))]).then(([body,reference,...tails])=>{try{tailLayers=tails.map(image=>{const c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.getContext('2d').drawImage(image,0,0);return c;});closedFace=document.createElement('canvas');closedFace.width=body.width;closedFace.height=body.height;closedFace.getContext('2d').drawImage(reference,0,0,body.width,body.height);rig=new window.foxRig.FoxRig(canvas,cleanArt(body),tailLayers,tailLayout,closedFace);ready=true;}catch(e){showError(e);}}).catch(showError);
function draw(now){
 requestAnimationFrame(draw);if(!ready){last=now;return;}
 const raw=last?now-last:16.7,dt=Math.min(raw/1000,.05);last=now;
 times.push(raw);if(times.length>600)times.shift();
 if(modeUntil&&now>modeUntil)setState('idle');
 if(bubbleUntil&&now>bubbleUntil){$('bubble').hidden=true;bubbleUntil=0;}
 pose=motion.step(dt,mode,velocity);velocity*=Math.exp(-dt*6);
 try{rig.render(frozenPose?{...pose,...frozenPose}:pose);if(!preview&&now-lastShape>65){lastShape=now;api.setShape(window.petShape.shape(canvas,rig.gl));}}catch(e){ready=false;showError(e);}
}
requestAnimationFrame(draw);
let menuOpen=false,activePane=null;
const paneTitles={actions:'动作',todos:'待办事项',size:'桌宠大小',settings:'提醒设置'};
function openMenu(pane){menuOpen=true;activePane=pane;$('orbit').hidden=false;$('panel').hidden=!pane;$('bubble').hidden=true;if(pane)$('panel-title').textContent=paneTitles[pane];document.querySelectorAll('[data-content]').forEach(el=>el.hidden=el.dataset.content!==pane);document.querySelectorAll('[data-pane]').forEach(el=>el.setAttribute('aria-expanded',String(el.dataset.pane===pane)));updatePetLayout();api.setMenu({open:true,details:Boolean(pane)});}
function closeMenus(){menuOpen=false;activePane=null;$('orbit').hidden=true;$('panel').hidden=true;updatePetLayout();api.setMenu({open:false,details:false});}
document.querySelectorAll('[data-pane]').forEach(el=>el.onclick=()=>openMenu(activePane===el.dataset.pane?null:el.dataset.pane));
function hitTest(x,y){
 const el=document.elementFromPoint(x,y);if(!el)return false;
 if(el.closest('#panel')||el.closest('#orbit button'))return true;
 if(el!==canvas||!ready)return false;
 const r=canvas.getBoundingClientRect();if(x<r.left||x>=r.right||y<r.top||y>=r.bottom)return false;
 const px=Math.max(0,Math.min(canvas.width-1,Math.floor((x-r.left)/r.width*canvas.width))),py=Math.max(0,Math.min(canvas.height-1,Math.floor((y-r.top)/r.height*canvas.height)));
 const rgba=new Uint8Array(4),gl=rig.gl;gl.readPixels(px,canvas.height-1-py,1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);return rgba[3]>=35;
}
api.onHitProbe(point=>api.replyHit({id:point.id,interactive:dragging||Boolean(press)||hitTest(point.x,point.y)}));
new ResizeObserver(()=>document.body.style.setProperty('--pet-height',canvas.getBoundingClientRect().height+'px')).observe(canvas);
let sizeRevision=0,sizeTimer,requestedScale=1;
function updatePetLayout(){let width=440*requestedScale;if(activePane)width=Math.min(width,Math.max(180,(window.innerHeight-350)*720/620));document.body.style.setProperty('--pet-width',width+'px');document.body.style.setProperty('--pet-height',(width*620/720)+'px');}
window.addEventListener('resize',updatePetLayout);
function displayScale(scale){$('pet-size').value=Math.round(scale*100);$('size-value').textContent=Math.round(scale*100)+'%';requestedScale=scale;updatePetLayout();}
async function changeScale(scale){const revision=++sizeRevision;try{const result=await api.setScale(scale);if(revision===sizeRevision){displayScale(result.scale);$('pet-size').max=Math.floor(result.maxScale*100);}}catch(e){$('error').textContent='大小保存失败：'+e.message;}}
$('pet-size').addEventListener('input',()=>{const scale=Number($('pet-size').value)/100;$('size-value').textContent=Math.round(scale*100)+'%';clearTimeout(sizeTimer);sizeTimer=setTimeout(()=>changeScale(scale),90);});
$('size-reset').onclick=()=>{clearTimeout(sizeTimer);changeScale(1);};
api.getPreferences().then(p=>displayScale(p.scale)).catch(e=>{$('error').textContent='无法读取大小设置：'+e.message;});

canvas.addEventListener('pointerdown',e=>{if(e.button!==0||(e.isTrusted&&!hitTest(e.clientX,e.clientY)))return;press={x:e.screenX,y:e.screenY,lastX:e.screenX};if(e.isTrusted)canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!press)return;velocity=e.screenX-press.lastX;press.lastX=e.screenX;if(!dragging&&Math.hypot(e.screenX-press.x,e.screenY-press.y)>6){dragging=true;$('bubble').hidden=true;setState('lift');api.startDrag();}});
function release(){if(!press)return;if(dragging){api.stopDrag();setState('idle');}else{setState('pet',2100);}press=null;dragging=false;}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',()=>{press=null;dragging=false;api.stopDrag();setState('idle');});api.onCancel(()=>{press=null;dragging=false;setState('idle');});
canvas.addEventListener('contextmenu',e=>{e.preventDefault();if(menuOpen)closeMenus();else openMenu(null);});$('close').onclick=()=>openMenu(null);$('quit').onclick=()=>api.quit();
document.querySelectorAll('[data-state]').forEach(b=>b.onclick=()=>{const s=b.dataset.state;if(s==='talk')say('我在这里陪你。先完成一件小事吧。');else setState(s,s==='idle'?0:2800);closeMenus();});
async function persist(next){try{await api.saveTasks(next);tasks=next;renderTasks();$('error').textContent='';return true;}catch(e){$('error').textContent='保存失败，请重试：'+e.message;return false;}}
function renderTasks(){$('tasks').replaceChildren();if(!tasks.length){const li=document.createElement('li');li.textContent='还没有待办，慢慢来。';$('tasks').append(li);}for(const t of tasks){const li=document.createElement('li'),check=document.createElement('input'),label=document.createElement('span'),del=document.createElement('button');li.classList.toggle('done',t.done);check.type='checkbox';check.checked=t.done;check.setAttribute('aria-label','完成：'+t.text);check.onchange=()=>persist(tasks.map(x=>x.id===t.id?{...x,done:check.checked}:x));label.textContent=t.text;del.textContent='删除';del.onclick=()=>persist(tasks.filter(x=>x.id!==t.id));li.append(check,label,del);$('tasks').append(li);}}
$('form').onsubmit=async e=>{e.preventDefault();const text=$('task').value.trim();if(text&&await persist([...tasks,{id:crypto.randomUUID(),text,done:false}]))$('task').value='';};api.readTasks().then(items=>{tasks=items;renderTasks();}).catch(e=>{$('error').textContent='无法读取待办：'+e.message;});
setInterval(()=>{if(!$('reminders').checked||mode!=='idle'||menuOpen)return;const pending=tasks.filter(x=>!x.done);if(pending.length)say('还有 '+pending.length+' 件事没完成：'+pending.slice(0,2).map(x=>x.text).join('；'),8500);},15*60*1000);

window.petQA={
 openMenu,closeMenus,hitTest,
 tailSourceFidelity:async()=>{const source=cleanArt(await loadImage('assets/fox.png')),src=source.getContext('2d').getImageData(0,0,source.width,source.height).data;let checked=0,mismatches=0;for(let i=0;i<9;i++){const c=tailLayers[i],p=c.getContext('2d').getImageData(0,0,c.width,c.height).data,[ox,oy]=tailLayout[i].offset;for(let y=0;y<c.height;y+=7)for(let x=0;x<c.width;x+=7){const a=(y*c.width+x)*4,b=((y+oy)*source.width+x+ox)*4;if(p[a+3]<245)continue;checked++;if(Math.max(Math.abs(p[a]-src[b]),Math.abs(p[a+1]-src[b+1]),Math.abs(p[a+2]-src[b+2]))>1)mismatches++;}}return {checked,mismatches};},
 exportClosedFace:()=>closedFace.toDataURL('image/png').split(',')[1],
 exportTailLayout:()=>tailLayout,
 exportTailLayers:()=>tailLayers.map(c=>c.toDataURL('image/png').split(',')[1]),
 setState:s=>{frozenPose=null;if(s==='talk')say('今天也陪你一起完成待办。',20000);else{$('bubble').hidden=true;setState(s);}},
 freeze:p=>{frozenPose=p;},
 snapshot:()=>({mode,ready,errors,engine:'body-and-nine-independent-tail-meshes',tailCount:rig?.tailTextures.length,vertexCount:rig?.vertexCount,textureUploads:rig?.textureUploads,pose:rig?.pose,frameCount:times.length,meanFrameMs:times.reduce((a,b)=>a+b,0)/times.length,p95FrameMs:[...times].sort((a,b)=>a-b)[Math.floor(times.length*.95)]}),
 record:()=>new Promise(resolve=>{
  const chunks=[],stream=canvas.captureStream(60),rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9'});
  rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  rec.onstop=()=>{stream.getTracks().forEach(t=>t.stop());const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}));};
  let dragDemo;rec.start();['idle','talk','pet','lift','idle'].forEach((s,i)=>setTimeout(()=>{window.petQA.setState(s);if(s==='lift'){const start=performance.now();dragDemo=setInterval(()=>velocity=Math.sin((performance.now()-start)/330)*20,16);}else{clearInterval(dragDemo);velocity=0;}},i*4000));setTimeout(()=>{clearInterval(dragDemo);rec.stop();},20000);
 })
};
