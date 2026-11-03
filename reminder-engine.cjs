'use strict';
const {normalizeTasks,deadlineHint}=require('./todo-model.cjs');
const {dayKey,validDay,recurrenceFields,syncDay,activeDay,nextReminder}=require('./recurrence.cjs');
const MIN=60000,HOUR=60*MIN,DAY=24*HOUR;
const dateValue=v=>v==null||v===''?null:(Number.isFinite(Date.parse(v))?new Date(v).toISOString():(()=>{throw Error('时间格式不正确');})());
function fields(input,now=Date.now()){
 const text=String(input.text||'').trim();if(!text||text.length>500)throw Error('事项需为1–500字');
 const remainingMinutes=input.remainingMinutes==null||input.remainingMinutes===''?null:Number(input.remainingMinutes);
 const bufferMinutes=input.bufferMinutes==null||input.bufferMinutes===''?30:Number(input.bufferMinutes);
 if(remainingMinutes!==null&&(!Number.isFinite(remainingMinutes)||remainingMinutes<1||remainingMinutes>525600))throw Error('剩余工作时间不正确');
 if(!Number.isFinite(bufferMinutes)||bufferMinutes<0||bufferMinutes>10080)throw Error('预留时间不正确');
 return {...recurrenceFields(input,now),text,deadline:dateValue(input.deadline),remindAt:dateValue(input.remindAt),kind:input.kind==='appointment'?'appointment':'task',remainingMinutes,bufferMinutes,important:input.important===true};
}
function taskFrom(input,now){return {...fields(input,now),id:input.id||require('crypto').randomUUID(),done:input.done===true,status:input.done?'done':'pending',createdAt:now,revision:1,snoozeUntil:null,workingUntil:null,preserveDeadline:true,completedAt:input.done?now:null,record:{consumed:[],pending:null,shownAt:null}};}
function schedule(t){
 if(t.done||!activeDay(t))return [];
 if(t.cadence==='daily'){const nodes=[{key:'daily:'+t.occurrenceDate,at:Date.parse(t.remindAt)}];if(t.deadline){if(t.important)nodes.push({key:'final',at:Math.max(Date.parse(t.remindAt),Date.parse(t.deadline)-10*MIN)});nodes.push({key:'deadline',at:Date.parse(t.deadline)});}return nodes.sort((a,b)=>a.at-b.at);}
 const d=t.deadline?Date.parse(t.deadline):null,r=t.remindAt?Date.parse(t.remindAt):null,nodes=[];
 if(r!==null)nodes.push({key:'explicit',at:r});
 else if(d!==null){
  if(t.kind==='task'&&t.remainingMinutes!==null)nodes.push({key:'start',at:d-(t.remainingMinutes+t.bufferMinutes)*MIN});
  else if(t.kind==='appointment')nodes.push({key:'appointment',at:d-10*MIN});
  else nodes.push({key:'day',at:d-DAY},{key:'hour',at:d-HOUR});
  if(d-t.createdAt<=HOUR)nodes.push({key:'initial',at:t.createdAt});
 }
 if(d!==null){if(t.important)nodes.push({key:'final',at:d-10*MIN});nodes.push({key:'deadline',at:d});}
 if(r===null&&d===null){const day=new Date(t.createdAt);day.setHours(9,0,0,0);const first=Math.max(+day,t.createdAt+30*MIN);nodes.push({key:'summary',at:first});}
 const sorted=nodes.sort((a,b)=>a.at-b.at),merged=[];
 for(const n of sorted){const prior=merged[merged.length-1];if(prior&&n.at>=t.createdAt&&prior.at>=t.createdAt&&n.at-prior.at<5*MIN&&!['explicit','deadline'].includes(n.key)&&!['explicit','deadline'].includes(prior.key)){if(n.key==='final')prior.key='final';}else merged.push({...n});}
 return merged;
}
class ReminderEngine{
 constructor({load=()=>null,save=()=>{},legacy=[],now=Date.now}={}){this.now=now;this.save=save;const state=load();this.state=state||{version:2,tasks:normalizeTasks(legacy).map(t=>taskFrom(t,now())),quietUntil:null,lastAutoAt:0};if(this.state.version!==2||!Array.isArray(this.state.tasks))throw Error('提醒数据版本或格式不正确');if(!state)this.commit(this.state);}
 commit(next){this.save(next);this.state=next;}
 change(fn){const next=structuredClone(this.state),result=fn(next);this.commit(next);return result;}
 list(){return structuredClone(this.state.tasks).map(t=>({...t,nextReminder:nextReminder(t,this.now())}));}
 undoable(){return (this.state.undoEntries||[]).filter(x=>x.expiresAt>this.now()).map(x=>({id:x.task.id,text:x.task.text,expiresAt:x.expiresAt}));}
 upsert(input){return this.change(s=>{let t=s.tasks.find(t=>t.id===input.id);if(t){Object.assign(t,fields(input,this.now()),{revision:t.revision+1,createdAt:this.now(),record:{consumed:[],pending:null,shownAt:null}});}else{if(s.tasks.length>=500)throw Error('最多保存500件事项');t=taskFrom(input,this.now());s.tasks.push(t);}syncDay(t,this.now());return structuredClone(t);});}
 remove(id){this.change(s=>{s.tasks=s.tasks.filter(t=>t.id!==id);});}
 action(id,action,{until,preserveDeadline=true,expectedRevision,occurrenceDate}={}){
  const now=this.now();return this.change(s=>{let t=s.tasks.find(t=>t.id===id);if(!t&&action==='undo'){const entry=(s.undoEntries||[]).find(x=>x.task.id===id&&x.expiresAt>now);if(!entry)throw Error('撤销时间已过');t=entry.task;s.tasks.push(t);s.undoEntries=s.undoEntries.filter(x=>x!==entry);}if(!t)throw Error('事项已不存在');syncDay(t,now);if(expectedRevision!==undefined&&t.revision!==expectedRevision)throw Error('事项已更新，请重新查看');
   if(t.cadence==='daily'){
    const date=occurrenceDate||t.occurrenceDate;if(!validDay(date)||date>dayKey(now)||date<t.startDate||t.endDate&&date>t.endDate)throw Error('这天不在计划范围内');
    if(!['complete','undo','skip'].includes(action)&&date!==t.occurrenceDate)throw Error('这是昨天的提醒啦，请处理今天的计划');
    if(action==='complete'||action==='skip'||action==='undo'){
     const field=action==='skip'?'skippedDates':'completedDates';t[field]=(t[field]||[]).filter(x=>x!==date);if(action!=='undo')t[field].push(date);
     if(action==='complete'||action==='undo')t.skippedDates=(t.skippedDates||[]).filter(x=>x!==date);
     if(date===t.occurrenceDate){t.snoozeUntil=null;t.workingUntil=null;t.status='pending';t.record={consumed:[],pending:null,shownAt:null};syncDay(t,now);}
     t.revision++;return {...structuredClone(t),actedDate:date};
    }
    const target=until?Date.parse(until):now+(action==='working'?45:10)*MIN;if(dayKey(target)!==t.occurrenceDate)throw Error('这个时间已经到明天啦，请换个今天的时间，或选择今天先跳过');
   }
   if(action==='complete'){s.undoEntries=(s.undoEntries||[]).filter(x=>x.expiresAt>now&&x.task.id!==id);s.undoEntries.push({task:structuredClone(t),expiresAt:now+10000});s.tasks=s.tasks.filter(x=>x.id!==id);t.done=true;t.status='done';t.completedAt=now;t.snoozeUntil=null;t.workingUntil=null;t.record.pending=null;}
   else if(action==='undo'){t.done=false;t.status='pending';t.completedAt=null;t.record={consumed:[],pending:null,shownAt:null};}
   else if(action==='working'||action==='snooze'){
    const at=until?Date.parse(until):now+(action==='working'?45:10)*MIN;if(!Number.isFinite(at)||at<=now)throw Error('请选择未来的提醒时间');
    t.status=action==='working'?'working':'pending';t.workingUntil=action==='working'?at:null;t.snoozeUntil=action==='snooze'?at:null;t.preserveDeadline=preserveDeadline!==false;t.record.pending=null;
   }else throw Error('不支持的操作');
   t.revision++;t.record.shownAt=null;return structuredClone(t);
  });
 }
 quiet(until){this.change(s=>{s.quietUntil=until?dateValue(until):null;});}
 tick(now=this.now()){
  const next=structuredClone(this.state);let changed=false;const kept=(next.undoEntries||[]).filter(x=>x.expiresAt>now);if(kept.length!==(next.undoEntries||[]).length){next.undoEntries=kept;changed=true;}
  for(const t of next.tasks){if(syncDay(t,now))changed=true;if(t.done||!activeDay(t))continue;const rec=t.record,snooze=t.snoozeUntil||null,working=t.workingUntil||null,hold=snooze||working;
   if(hold&&now>=hold){t.snoozeUntil=null;t.workingUntil=null;if(t.status==='working')t.status='pending';rec.pending={key:'followup:'+hold,at:hold};rec.shownAt=null;changed=true;}
   let due=schedule(t).filter(n=>n.at<=now&&!rec.consumed.includes(n.key));
   if(hold&&now<hold){due=due.filter(n=>t.preserveDeadline&&(n.key==='final'||n.key==='deadline'));}
   // A user acknowledgement covers all older ordinary milestones, even after hold ends.
   if(hold){const skipped=schedule(t).filter(n=>n.at<=Math.min(now,hold)&&!['final','deadline'].includes(n.key)&&!rec.consumed.includes(n.key));for(const n of skipped){rec.consumed.push(n.key);changed=true;}}
   if(due.length){for(const n of due)rec.consumed.push(n.key);rec.pending=due[due.length-1];rec.shownAt=null;changed=true;}
   if(!t.deadline&&!t.remindAt&&rec.consumed.includes('summary')){const key='daily:'+new Date(now).toLocaleDateString('en-CA'),today=new Date(now);today.setHours(9,0,0,0);if(+today>t.createdAt&&now>=+today&&!rec.consumed.includes(key)){rec.consumed.push(key);rec.pending={key,at:+today};rec.shownAt=null;changed=true;}}
  }
  if(changed)this.commit(next);
 }
 delivery(presence,{enabled=true,busy=false}={}){
  this.tick();const now=this.now();if(!enabled||busy||!presence.canDisplay)return [];
  const quiet=this.state.quietUntil&&Date.parse(this.state.quietUntil)>now;
  return this.state.tasks.filter(t=>!t.done&&activeDay(t)&&t.record.pending&&(!t.record.shownAt||presence.returnedAt>t.record.shownAt)&&(!quiet||t.important)&&(!presence.possiblyAway||t.important)).sort((a,b)=>Number(b.important)-Number(a.important)||(Date.parse(a.deadline)||Infinity)-(Date.parse(b.deadline)||Infinity)).map(t=>({id:t.id,revision:t.revision,key:t.record.pending.key,cadence:t.cadence,occurrenceDate:t.occurrenceDate,text:t.text,deadline:t.deadline,important:t.important,status:t.status}));
 }
 markShown(items){this.change(s=>{for(const item of items){const t=s.tasks.find(t=>t.id===item.id);if(t&&!t.done&&t.revision===item.revision&&(t.cadence!=='daily'||t.occurrenceDate===item.occurrenceDate)&&t.record.pending?.key===item.key)t.record.shownAt=this.now();}});}
 message(items){const now=this.now();return items.slice(0,2).map(t=>'「'+(t.text.length>36?t.text.slice(0,35)+'…':t.text)+'」'+(t.deadline?'，'+deadlineHint(t.deadline,now):'')).join('；')+(items.length>2?'。还有'+(items.length-2)+'件待回应':'')+'。爪爪提醒，记牢啦！';}
}
module.exports={ReminderEngine,schedule,fields,MIN,HOUR,DAY};
