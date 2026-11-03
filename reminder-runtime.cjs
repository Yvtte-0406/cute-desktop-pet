'use strict';
const {activeDay}=require('./recurrence.cjs');const path=require('node:path');const {ReminderEngine}=require('./reminder-engine.cjs');const {readJSON,writeJSON}=require('./state-store.cjs');const {createPresence}=require('./presence-service.cjs');
function createReminderRuntime({app,powerMonitor,win,readPreferences,legacy,aiReminders,aiSettings,isolated=false,isBusy=()=>false,presenceFactory=createPresence,now=Date.now,onOutsideClick=()=>{}}){
 const file=path.join(app.getPath('userData'),'reminders-v2.json'),engine=new ReminderEngine({load:()=>readJSON(file,null),save:s=>writeJSON(file,s),legacy,now});
 let presence,ready=false,busy=false,disposed=false,lease=null,analysisTimer,analysisGeneration=0,lastAnalysisSignature='',lastTickState=engine.state,lastError='',lastOrdinaryAt=0;
 const batchIds=new Set();
 const {ReadingSession}=require('./reading-session.cjs'),viewFile=path.join(app.getPath('userData'),'reminder-view.json'),reader=new ReadingSession({load:()=>readJSON(viewFile,null),save:s=>writeJSON(viewFile,s)});reader.reconcile(engine.list());let restoreNeeded=Boolean(reader.active),blocked=false,feedbackUntil=0,reviewVersion=0;
 let activeDelivery=null;const pendingTextTimers=new Set();
 const remember=turn=>{try{aiReminders.recordTurn?.(turn);}catch{/* Conversation history must never block a saved task action. */}};
 const send=(event,value)=>{if(ready&&!win.isDestroyed())win.webContents.send(event,value);};
 function state(){const tasks=engine.list(),active=reader.active,urgentCount=tasks.filter(t=>!t.done&&t.record.pending&&(t.record.pending.key==='deadline'||t.record.pending.key==='final'||(t.deadline&&Date.parse(t.deadline)-now()<=3600000))&&(!active||active.items[0].id!==t.id||active.items[0].key!==t.record.pending.key||active.items[0].occurrenceDate!==t.occurrenceDate)).length;return {tasks,undoable:engine.undoable(),urgentCount,hudCollapsed:reader.state.hudCollapsed===true,hasParkedReminder:Boolean(reader.state.parked),reading:active?{id:active.items[0].id,kind:active.ui.kind,suspended:active.suspended}:null,quietUntil:engine.state.quietUntil,presence:presence?.status(),error:lastError,usage:aiReminders.summary()};}
 function publish(){send('reminders:state',state());}
 function eligible(){return engine.list().filter(t=>!t.done&&activeDay(t)&&!t.snoozeUntil&&!t.workingUntil);}
 function queueAnalysis(){clearTimeout(analysisTimer);if(isolated||!readPreferences().reminders||!aiReminders.configured())return;const generation=++analysisGeneration;analysisTimer=setTimeout(async()=>{
  if(disposed||generation!==analysisGeneration)return;const tasks=eligible();if(!tasks.length)return;
  const result=await aiReminders.plan(tasks,{context:tasks});if(disposed||generation!==analysisGeneration)return;
  if(aiReminders.status==='cooldown'){queueAnalysisAfterCooldown();return;}
  publish();
 },10000);}
 function queueAnalysisAfterCooldown(){clearTimeout(analysisTimer);analysisTimer=setTimeout(queueAnalysis,60000);}
 function tick(){if(disposed||!presence)return;try{
  engine.tick();if(engine.state!==lastTickState){lastTickState=engine.state;publish();}
  const previous=reader.active;reader.reconcile(engine.list());if(previous&&!reader.active){activeDelivery=null;restoreNeeded=false;send('reminders:hide');}
  if(!ready)return;
  const p=presence.snapshot(),unavailable=p.locked===true||p.suspended||p.display==='off';
  if(unavailable){if(!blocked){blocked=true;reader.suspend();restoreNeeded=Boolean(reader.active);send('reminders:suspend',{reason:'presence'});}lease=null;return;}
  if(reader.active){
   if(!isBusy()&&!busy&&p.canDisplay&&(restoreNeeded||reader.active.suspended)){blocked=false;const view=reader.resume();activeDelivery=view;restoreNeeded=false;send('reminders:restore',view);}
   return;
  }
  blocked=false;if(lease||busy||isBusy()||now()<feedbackUntil)return;
  const items=reader.allowed(engine.delivery(p,{enabled:readPreferences().reminders}));if(!items.length)return;
  // Ordinary prompts are merged across a short burst; deadline and user-selected times bypass it.
  const critical=items.some(t=>['deadline','explicit','final'].includes(t.key)||(t.deadline&&Date.parse(t.deadline)-now()<=3600000));if(!critical&&!items.some(t=>batchIds.has(t.id))&&now()-lastOrdinaryAt<5*60000&&p.returnedAt<=lastOrdinaryAt)return;
  const related=eligible(),cached=aiReminders.cached(related),selected=cached&&items.find(t=>t.id===cached.taskId);
  if(selected&&aiSettings.status().dynamic&&selected.important===items[0].important){items.splice(items.indexOf(selected),1);items.unshift(selected);}
  for(const item of items)batchIds.add(item.id);
  const item=items[0],fullTask=engine.list().find(t=>t.id===item.id),semantic=aiReminders.cachedTask?.(fullTask);
  // Prepare this batch's individual messages; never mark a task shown while the model is thinking.
  const ticket={token:require('node:crypto').randomUUID(),items:[item],at:now()};lease=ticket;
  const stillValid=()=>{const t=engine.list().find(t=>t.id===item.id);return t&&!t.done&&t.revision===item.revision&&(t.cadence!=='daily'||t.occurrenceDate===item.occurrenceDate)&&t.record.pending?.key===item.key;};
  let emitted=false;
  const emit=message=>{if(disposed||emitted||lease?.token!==ticket.token)return;if((reader.active&&reader.active.token!==ticket.token)||!stillValid()||!presence.snapshot().canDisplay||!readPreferences().reminders||isBusy()){lease=null;return;}reader.present(ticket,message.message,message.source);emitted=true;activeDelivery=reader.active;restoreNeeded=false;send('reminders:delivery',{...ticket,text:message.message,moreCount:items.length-1,source:message.source});};
  const fallback=()=>{const current=aiReminders.cachedTask?.(fullTask);emit(current||{message:require('./reminder-copy.js').line(item),source:'local'});};
  if(semantic)emit(semantic);
  else if(!isolated&&aiReminders.configured()){
   const urgent=item.deadline&&Date.parse(item.deadline)-now()<=5*60000;
   let timer;if(urgent)fallback();else{timer=setTimeout(()=>{pendingTextTimers.delete(timer);fallback();},4000);pendingTextTimers.add(timer);}
   const targets=items.slice(0,8).map(i=>engine.list().find(t=>t.id===i.id));
   void (async()=>{if(aiReminders.inFlight)await aiReminders.inFlight;return aiReminders.plan(targets,{context:related});})().then(()=>{
    const generated=aiReminders.cachedTask?.(fullTask);if(!generated||disposed||!aiReminders.configured()||!stillValid())return;
    clearTimeout(timer);pendingTextTimers.delete(timer);
    if(!emitted)emit(generated);
    // A late result is cached for a later review. Never rewrite text someone is reading.
   }).catch(()=>fallback());
  }else fallback();
  const sig=require('./ai-reminders.cjs').signature(related,now());if(sig!==lastAnalysisSignature){lastAnalysisSignature=sig;queueAnalysis();}
 }catch(e){lastError='提醒保存或读取失败：'+e.message;publish();}}
 presence=presenceFactory({app,powerMonitor,isolated,onOutsideClick,onChange:()=>{if(presence)tick();}});
 const timer=setInterval(()=>{if(lease&&now()-lease.at>30000)lease=null;tick();},1000);
 return {engine,state,observeClicks:enabled=>presence.observeClicks?.(enabled),ready(){ready=true;busy=false;restoreNeeded=Boolean(reader.active);publish();tick();},busy(value){busy=value===true;},tick,
  shown(token){if(lease?.token!==token)return;const p=presence.snapshot();if(p.canDisplay&&readPreferences().reminders){engine.markShown(lease.items);for(const item of lease.items)batchIds.delete(item.id);lastOrdinaryAt=now();remember({role:'fox',taskId:lease.items[0].id,text:activeDelivery?.text||''});}lease=null;publish();},
  rewritten(token){if(activeDelivery?.token===token)remember({role:'fox',taskId:activeDelivery.items[0].id,text:activeDelivery.text});},
  async review(id){
   const requestVersion=++reviewVersion;lease=null;reader.reconcile(engine.list());const parked=reader.state.parked;
   if(!id&&reader.active){restoreNeeded=false;return {...reader.resume(),restoring:true};}
   if(!id&&parked){const view=reader.openParked(engine.list());restoreNeeded=false;activeDelivery=view;return {...view,restoring:true};}
   const task=engine.list().find(t=>t.id===id&&!t.done)||engine.list().find(t=>!t.done&&t.record.pending);if(!task)throw Error('这件事已经更新啦');
   if(reader.active?.items[0].id===task.id){restoreNeeded=false;return {...reader.resume(),restoring:true};}
   let speech=aiReminders.cachedTask?.(task);if(!speech&&!isolated&&aiReminders.configured()){if(aiReminders.inFlight)await aiReminders.inFlight;await aiReminders.plan([task],{context:eligible()});speech=aiReminders.cachedTask?.(task);}
   if(requestVersion!==reviewVersion)throw Error('这次提醒已收起');const live=engine.list().find(t=>t.id===task.id&&!t.done&&t.revision===task.revision);if(!live)throw Error('这件事已经更新啦');
   reader.openParked(engine.list());const item={...live,key:live.record.pending?.key||'manual'},ticket={token:require('node:crypto').randomUUID(),items:[item],at:now()};reader.present(ticket,speech?.message||require('./reminder-copy.js').line(live),speech?'ai-cache':'local');activeDelivery=reader.active;restoreNeeded=false;return {...reader.active,manual:true};
  },
  draft(token,ui){return reader.draft(token,ui);},
  dismiss({collapseHud=false}={}){reviewVersion++;const pending=engine.list().filter(t=>!t.done&&t.record.pending).map(t=>({id:t.id,key:t.record.pending.key,occurrenceDate:t.occurrenceDate}));reader.dismiss(pending,{collapseHud});lease=null;activeDelivery=null;restoreNeeded=false;send('reminders:hide');publish();},
  menu(open){if(open&&reader.active){reader.suspend();restoreNeeded=true;}},
  resume(){if(reader.active){restoreNeeded=true;tick();}},
  releaseFeedback(){feedbackUntil=0;tick();},
  upsert(input){analysisGeneration++;const previous=engine.list().find(t=>t.id===input.id),result=engine.upsert(input);if(previous&&reader.active?.items[0].id===previous.id){reader.clearTask(previous.id);activeDelivery=null;lease=null;send('reminders:hide');}publish();queueAnalysis();tick();return result;},
  remove(id){analysisGeneration++;const affected=reader.active?.items[0].id===id;engine.remove(id);reader.clearTask(id);if(affected){lease=null;activeDelivery=null;restoreNeeded=false;send('reminders:hide');}publish();tick();},
  action(id,action,options){analysisGeneration++;const affected=reader.active?.items[0].id===id,before=engine.list().find(t=>t.id===id),reply=before?.cadence==='daily'&&['complete','skip','undo'].includes(action)?({complete:options?.occurrenceDate&&options.occurrenceDate!==before.occurrenceDate?options.occurrenceDate+'那份记好啦，今天的可没算进去哦～':aiReminders.cachedTask?.(before)?.replies?.complete||'今天这份拿下啦！后面的安排我还替你记着～',skip:'好嘛，今天先放过你。下次再来敲敲～',undo:'今天这项放回来啦，我继续替你记着～'}[action]):aiReminders.cachedTask?.(before)?.replies?.[action],result=engine.action(id,action,options);remember({role:'user',taskId:id,action,text:{skip:'今天先跳过',working:'正在做',snooze:'稍后提醒',complete:'已完成',undo:'撤销完成'}[action],until:options?.until||null});reader.clearTask(id);if(affected){lease=null;activeDelivery=null;restoreNeeded=false;feedbackUntil=now()+3500;send('reminders:hide');}publish();if(action==='complete'&&eligible().length>1)queueAnalysis();return {...result,reply,affectsCurrent:affected};},
  quiet(until){engine.quiet(until);publish();tick();},
  changedSettings({remindersChanged=false}={}){analysisGeneration++;if(remindersChanged&&readPreferences().reminders){reader.openParked(engine.list());restoreNeeded=Boolean(reader.active);}if(!readPreferences().reminders){reader.dismiss(engine.list().filter(t=>!t.done&&t.record.pending).map(t=>({id:t.id,key:t.record.pending.key,occurrenceDate:t.occurrenceDate})));lease=null;activeDelivery=null;restoreNeeded=false;send('reminders:hide');}publish();queueAnalysis();tick();},
  dispose(){disposed=true;clearInterval(timer);clearTimeout(analysisTimer);for(const timer of pendingTextTimers)clearTimeout(timer);presence.dispose();},
  testPresence(name,value){presence.testEvent(name,value);},
 };
}
module.exports={createReminderRuntime};
