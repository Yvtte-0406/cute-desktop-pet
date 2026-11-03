(function(){
 let cadence='once',lastUndo=null,undoTimer,editing=null,current=[],response=null,latest=null,refreshing=false,activeToken=null,reviewEpoch=0,reviewBusy=false,suspended=false,draftTimer,actionPending=false,hudCollapsed=false;
 const localInput=value=>{if(!value)return '';const d=new Date(value);return new Date(+d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
 const inputDate=id=>$(id).value?new Date($(id).value).toISOString():null;
 function beforeSay(){reviewEpoch++;activeToken=null;clearTimeout(draftTimer);current=[];suspended=false;$('bubble-deadline').hidden=true;$('response-main').hidden=false;$('reminder-actions').hidden=true;$('response-options').hidden=true;$('response-error').textContent='';$('completion-undo').hidden=true;}
 function hide(){beforeSay();$('bubble').hidden=true;bubbleUntil=0;if(mode==='talk')setState('idle');syncOutsideWatch();}
 function syncOutsideWatch(){api.watchOutsideClicks(!$('bubble').hidden);}
 function afterSay(){hudCollapsed=false;syncOutsideWatch();}
 function outsideDismiss(){hudCollapsed=true;hide();closeMenus();$('pending-reminders').hidden=true;syncOutsideWatch();}
 async function collapseOutside(){saveDraft();try{await api.dismissReminder({collapseHud:true});outsideDismiss();}catch(e){$('response-error').textContent=e.message;}}
 function foxClick(){if(hudCollapsed&&(latest?.hasParkedReminder||tasks.some(t=>!t.done&&t.record.pending)))void reviewItem();}
 function snapshot(s){if(!s)return;const undo=s.undoable?.at(-1);if(undo)lastUndo=undo;else if(lastUndo?.expiresAt<=Date.now())lastUndo=null;latest=s;tasks=s.tasks;render();const count=tasks.filter(t=>!t.done&&t.record.pending).length;hudCollapsed=s.hudCollapsed===true;$('pending-reminders').hidden=hudCollapsed||!count;$('pending-reminders').textContent=s.urgentCount?'有'+s.urgentCount+'件紧急事项':count+'件小事';$('pending-reminders').dataset.urgent=String(Boolean(s.urgentCount));

  const p=s.presence;if(p){const state=p.suspended?'睡眠中':p.locked?'已锁屏':p.display==='off'?'屏幕关闭':p.possiblyAway?'可能离开':'有操作';const v=p.powerSettings?.values;const seconds=x=>x===0?'不自动':Math.round(x/60)+'分钟';$('presence-status').textContent='本机检测：'+state+'；显示监听：'+({ready:'正常',partial:'部分可用',unavailable:'不可用',starting:'启动中',isolated:'独立验证'}[p.helperStatus]||'未知')+(v?'；'+(p.onBattery?'电池':'接电')+'息屏'+seconds(v.display?.[p.onBattery?'battery':'ac']??0)+'、睡眠'+seconds(v.sleep?.[p.onBattery?'battery':'ac']??0):'；电源设置未读出')+'。只读取输入空闲秒数。';}
  if(s.error)$('error').textContent=s.error;
  if(current.some(item=>!tasks.some(t=>t.id===item.id&&!t.done&&t.revision===item.revision)))hide();
 }
 async function refresh(){if(refreshing)return;refreshing=true;try{snapshot(await api.readReminderState());}catch(e){$('error').textContent=e.message;}finally{refreshing=false;}}
 function selected(){return current[0];}
 function saveDraft(){clearTimeout(draftTimer);if(!current.length||!activeToken)return;const token=activeToken,ui={kind:$('response-options').hidden?'reading':'choosing',action:response,duration:$('response-duration').value,custom:$('response-custom').value,preserve:$('preserve-deadline').checked,scroll:$('reminder-actions').scrollTop};api.saveReadingDraft(token,ui).catch(e=>{if(activeToken===token)$('response-error').textContent='这次没存好：'+e.message;});}
 function suspendLocal(reason,notify=true){saveDraft();suspended=true;$('bubble').hidden=true;bubbleUntil=0;if(mode==='talk')setState('idle');api.reminderBusy(false);syncOutsideWatch();if(notify)api.pauseReminder();}
 function menuClosed(){if(suspended){api.reminderBusy(false);api.resumeReminder();}}
 function paintChoice(action,ui={}){
  response=action;$('bubble-text').textContent=action==='working'?'交给你啦，要我安静多久？':'好嘛，多久后再来敲敲？';$('bubble-deadline').hidden=true;$('response-main').hidden=true;$('response-options').hidden=false;$('response-duration').value=ui.duration||(action==='working'?'45':'10');$('response-custom').value=ui.custom||'';$('response-custom').hidden=$('response-duration').value!=='custom';$('preserve-deadline').checked=ui.preserve??(action==='working');
  document.querySelector('[data-duration="10"]').hidden=action==='working';document.querySelector('[data-duration="30"]').hidden=action==='working';document.querySelector('[data-duration="45"]').hidden=action!=='working';updateWarning();bubbleUntil=0;window.bubbleFrame.update();$('reminder-actions').scrollTop=ui.scroll||0;
 }
 function showDelivery(delivery,ack=true){
  if(menuOpen||press){api.pauseReminder();return;}
  const item=delivery.items[0];if(!item)return;api.reminderBusy(true);
  say(delivery.text||window.foxReminderCopy.line(item),0);current=[{...item,spoken:delivery.text}];activeToken=delivery.token||null;suspended=false;$('reminder-actions').hidden=false;$('response-main').hidden=false;
  document.querySelector('[data-response=complete]').textContent=item.cadence==='daily'?'今日完成':'已完成';if(item.cadence==='daily'){$('bubble-deadline').textContent=item.occurrenceDate+' · 每日计划';$('bubble-deadline').hidden=false;}
  if(item.deadline){$('bubble-deadline').textContent=(item.cadence==='daily'?item.occurrenceDate+' · ':'')+window.foxTodos.deadlineHint(item.deadline,Date.now());$('bubble-deadline').hidden=false;}
  if(delivery.ui?.kind==='choosing')paintChoice(delivery.ui.action,delivery.ui);else $('reminder-actions').scrollTop=delivery.ui?.scroll||0;
  window.bubbleFrame.update();
  if(ack)api.reminderShown(delivery.token).catch(e=>{$('response-error').textContent='刚刚没记住，再试一下好不好？ '+e.message;});
 }
 async function reviewItem(t){if(reviewBusy)return;reviewBusy=true;say('让我想想这件事，马上回来～',0);api.reminderBusy(true);const epoch=reviewEpoch;try{const result=await api.reviewReminder(t?.id);if(epoch===reviewEpoch&&!$('bubble').hidden)showDelivery(result,false);}catch(e){if(epoch===reviewEpoch){hide();$('error').textContent=e.message;}}finally{reviewBusy=false;}}
 function expired(){syncOutsideWatch();if(!current.length){api.reminderBusy(false);api.feedbackEnded();}}
 async function dismiss(){reviewEpoch++;try{await api.dismissReminder();hide();}catch(e){$('response-error').textContent=e.message;}}
 document.addEventListener('pointerdown',e=>{if($('bubble').hidden||e.button!==0||dragging||e.target.closest('#bubble,#panel,#orbit,#pending-reminders'))return;if(ready&&rig&&window.petShape.shape(canvas,rig.gl).some(r=>e.clientX>=r.x&&e.clientX<r.x+r.width&&e.clientY>=r.y&&e.clientY<r.y+r.height))return;void collapseOutside();},true);
 $('bubble').addEventListener('contextmenu',e=>{if(e.target.closest('input,select,textarea'))return;e.preventDefault();void dismiss();});
 function render(){
  $('tasks').replaceChildren();
  if(!tasks.length){const empty=document.createElement('li');empty.className='empty-tasks';empty.textContent='暂无事项';$('tasks').append(empty);}
  for(const t of tasks){const li=document.createElement('li'),copy=document.createElement('div'),title=document.createElement('span'),status=document.createElement('small');copy.className='task-copy';title.className='task-title';title.textContent=t.text;copy.append(title);
   let label=t.done?'已完成':t.cadence==='daily'?(t.ended?'已结束':t.notStarted?'未开始':t.dailyCompleted?'今日已完成':t.dailySkipped?'今日已跳过':t.status==='working'?'正在做':t.snoozeUntil?'稍后提醒':'今日待完成'):t.status==='working'?'正在做':t.snoozeUntil?'稍后提醒':t.deadline&&Date.parse(t.deadline)<Date.now()?'已逾期':'待完成';
   status.textContent=(t.cadence==='daily'?'每日 · ':'单次 · ')+label;status.className=t.done||t.dailyCompleted?'task-status is-complete':'task-status';copy.append(status);
   if(t.cadence==='daily'&&t.dailyDeadline||t.cadence!=='daily'&&t.deadline){const time=document.createElement('small');time.textContent=t.cadence==='daily'?'每天 '+t.dailyDeadline+' 前':'截止 '+new Date(t.deadline).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});copy.append(time);}
   if(t.snoozeUntil||t.workingUntil){const next=document.createElement('small');next.textContent='下次提醒 '+new Date(t.snoozeUntil||t.workingUntil).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});copy.append(next);}
   const actions=document.createElement('div');actions.className='task-row-actions';const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;actions.append(b);};
   button('修改',()=>edit(t));button('删除',async()=>{try{await api.removeTask(t.id);await refresh();}catch(e){$('error').textContent=e.message;}});li.append(copy,actions);$('tasks').append(li);
  }
 }
 async function act(t,action,options={}){if(actionPending)return;actionPending=true;try{const result=await api.taskAction(t.id,action,{occurrenceDate:t.occurrenceDate,...options,expectedRevision:t.revision});await refresh();closeMenus();if(result.affectsCurrent||!latest?.reading){hide();say(result.reply||window.foxReminderCopy.feedback(action),3200);api.reminderBusy(true);if(action==='complete'&&t.cadence!=='daily'&&lastUndo){$('completion-undo').hidden=false;clearTimeout(undoTimer);undoTimer=setTimeout(()=>{$('completion-undo').hidden=true;window.bubbleFrame.update();},Math.max(0,lastUndo.expiresAt-Date.now()));window.bubbleFrame.update();}}else api.resumeReminder();}catch(e){$('response-error').textContent=e.message;$('error').textContent=e.message;await refresh();}finally{actionPending=false;}}
 async function choose(t,action,adjust=false){
  const until=Date.now()+45*60000;if(t.cadence==='daily'&&dayKey(until)!==t.occurrenceDate)adjust=true;if(action==='working'&&!adjust&&(!t.deadline||until<Date.parse(t.deadline))){void act(t,'working',{until:new Date(until).toISOString(),preserveDeadline:true});return;}
  try{if(!activeToken||selected()?.id!==t.id){const view=await api.reviewReminder(t.id);closeMenus();showDelivery(view,false);}else closeMenus();
   if(selected()?.id!==t.id)return;paintChoice(action);saveDraft();
  }catch(e){$('error').textContent=e.message;}
 }
 function chosenUntil(){return $('response-duration').value==='custom'?inputDate('response-custom'):new Date(Date.now()+Number($('response-duration').value)*60000).toISOString();}
 function updateWarning(){const t=selected();let at;try{at=chosenUntil();}catch{}const crossDay=Boolean(t?.cadence==='daily'&&at&&dayKey(Date.parse(at))!==t.occurrenceDate),crosses=Boolean(t?.deadline&&at&&Date.parse(at)>=Date.parse(t.deadline));$('response-warning').hidden=!crosses&&!crossDay;$('response-warning').textContent=crossDay?'这个时间已经到明天啦，换个今天的时间，还是今天先跳过？':crosses?'咦，这会跨过截止时间哦，要我到时候也叫你一声吗？':'';$('skip-today').hidden=!crossDay;$('preserve-row').hidden=!crosses||crossDay;$('response-confirm').hidden=crossDay||(!crosses&&$('response-duration').value!=='custom');for(const b of document.querySelectorAll('[data-duration]'))b.setAttribute('aria-pressed',String(b.dataset.duration===$('response-duration').value));}
 $('skip-today').onclick=()=>{const t=selected();if(t)void act(t,'skip');};
 $('undo-last').onclick=()=>{if(lastUndo)void act({id:lastUndo.id},'undo');};

 document.querySelectorAll('[data-response]').forEach(b=>b.onclick=()=>{const t=selected();if(!t)return;if(b.dataset.response==='complete')void act(t,'complete');else choose(t,b.dataset.response);});
 $('response-duration').onchange=()=>{$('response-custom').hidden=$('response-duration').value!=='custom';updateWarning();window.bubbleFrame.update();saveDraft();};for(const b of document.querySelectorAll('[data-duration]'))b.onclick=()=>{$('response-duration').value=b.dataset.duration;$('response-duration').dispatchEvent(new Event('change'));if(b.dataset.duration!=='custom'&&$('response-warning').hidden)$('response-confirm').click();};$('response-custom').oninput=()=>{updateWarning();saveDraft();};$('preserve-deadline').onchange=saveDraft;$('reminder-actions').onscroll=()=>{clearTimeout(draftTimer);draftTimer=setTimeout(saveDraft,150);};
 $('response-confirm').onclick=()=>{try{const t=selected(),until=chosenUntil();if(!until||Date.parse(until)<=Date.now())throw Error('请选择未来时间');void act(t,response,{until,preserveDeadline:$('preserve-deadline').checked});}catch(e){$('response-error').textContent=e.message;}};
 $('response-back').onclick=()=>{const t=selected();if(!t)return;showDelivery({token:activeToken,items:[t],text:t.spoken},false);saveDraft();};
 $('pending-reminders').onclick=()=>{closeMenus();void reviewItem();};
 function dayKey(value=Date.now()){const d=new Date(value);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
 function syncForm(){cadence=$('task-daily').checked?'daily':'once';const daily=cadence==='daily';$('deadline').hidden=daily;$('deadline-label').hidden=daily;$('daily-deadline').hidden=!daily;$('daily-deadline-label').hidden=!daily;}
 function showPage(page){$('todo-list-page').hidden=page!=='list';$('todo-add-page').hidden=page!=='add';for(const b of document.querySelectorAll('[data-todo-page]'))b.setAttribute('aria-pressed',String(b.dataset.todoPage===page));$('error').textContent='';}
 function resetForm(){editing=null;$('form').reset();syncForm();$('task-save').textContent='添加';$('task-cancel').hidden=true;}
 function edit(t){resetForm();editing=t.id;$('task').value=t.text;$('task-daily').checked=t.cadence==='daily';$('deadline').value=localInput(t.cadence==='daily'?null:t.deadline);$('daily-deadline').value=t.dailyDeadline||'';syncForm();$('task-save').textContent='保存';$('task-cancel').hidden=false;showPage('add');}
 for(const b of document.querySelectorAll('[data-todo-page]'))b.onclick=()=>{if(b.dataset.todoPage==='add'&&editing)resetForm();showPage(b.dataset.todoPage);};
 $('task-daily').onchange=syncForm;$('task-cancel').onclick=()=>{resetForm();showPage('list');};
 $('form').onsubmit=async e=>{e.preventDefault();const save=$('task-save');if(save.disabled)return;save.disabled=true;try{
  const previous=editing?tasks.find(t=>t.id===editing):null;if(editing&&!previous)throw Error('这件事项已删除');const daily=$('task-daily').checked,dailyDeadline=$('daily-deadline').value||null;
  // Keep existing scheduling choices while simplifying the editor. New daily plans start today at 09:00.
  const dailyTime=previous?.cadence==='daily'?previous.dailyTime:'09:00';
  await api.upsertTask({...previous,id:editing||undefined,text:$('task').value,cadence:daily?'daily':'once',deadline:daily?null:inputDate('deadline'),remindAt:previous&&(daily?previous.cadence==='daily':previous.cadence!=='daily')?previous.remindAt:null,dailyTime:dailyDeadline&&dailyDeadline<dailyTime?dailyDeadline:dailyTime,dailyDeadline,startDate:previous?.cadence==='daily'?previous.startDate:dayKey(),endDate:previous?.cadence==='daily'?previous.endDate:null});
  resetForm();await refresh();showPage('list');
 }catch(e){$('error').textContent='保存失败：'+e.message;}finally{save.disabled=false;}};
 api.onReminderRewrite(()=>{}); // Do not rewrite a message that may already be halfway read.
 api.onOutsideDismiss(outsideDismiss);api.onReminder(showDelivery);api.onReminderRestore(r=>{if(activeToken===r.token&&selected()?.id===r.items[0].id&&selected()?.revision===r.items[0].revision){suspended=false;$('bubble').hidden=false;bubbleUntil=0;api.reminderBusy(true);window.bubbleFrame.update();syncOutsideWatch();}else showDelivery(r,false);});api.onReminderSuspend(r=>suspendLocal(r.reason,false));api.onReminderState(snapshot);api.onReminderHide(hide);
 setInterval(()=>api.reminderBusy((current.length>0&&!suspended)||!$('bubble').hidden||menuOpen||Boolean(press)||reviewBusy),1000);
 window.reminderUI={afterSay,syncOutsideWatch,foxClick,beforeSay,refresh,snapshot,showDelivery,expired,holdsReading:()=>current.length>0,suspendLocal,menuOpened:()=>suspendLocal('menu'),menuClosed,saveDraft};
 api.remindersReady().then(snapshot).catch(e=>{$('error').textContent='提醒初始化失败：'+e.message;});
})();
