'use strict';
const crypto=require('node:crypto');
const MODEL='deepseek-flash',ENDPOINT='https://api.deepseek.com/chat/completions',DAY_LIMIT=60;
const SYSTEM_PROMPT=require('./ai-prompt.cjs');
const {taskData,taskSignature,parseReminders}=require('./semantic-context.cjs');
function shortlist(tasks){return tasks.filter(t=>!t.done).slice().sort((a,b)=>Number(b.important)-Number(a.important)||(Date.parse(a.deadline)||Infinity)-(Date.parse(b.deadline)||Infinity)).slice(0,30).map(t=>({id:t.id,text:t.text.slice(0,500),deadline:t.deadline||null,remainingMinutes:t.remainingMinutes??null,important:t.important===true}));}
function phase(t,now){const left=t.deadline?Date.parse(t.deadline)-now:Infinity;return left<=0?'overdue':left<=3600000?'hour':left<=86400000?'day':'later';}
function signature(tasks,now){return crypto.createHash('sha256').update(JSON.stringify({version:5,tasks:shortlist(tasks).map(t=>({...t,phase:phase(t,now)}))})).digest('hex');}
function validatePlan(value,tasks,now){if(!value||!tasks.some(t=>t.id===value.taskId)||!['high','medium','low'].includes(value.urgency)||!Number.isFinite(value.nextMinutes))throw Error('invalid-plan');const reminders=parseReminders(value,tasks),chosen=reminders.find(r=>r.taskId===value.taskId);if(!chosen)throw Error('invalid-plan');return {taskId:value.taskId,urgency:value.urgency,nextMinutes:Math.max(10,Math.min(120,Math.round(value.nextMinutes))),message:chosen.message,reminders,source:'ai'};}
class AIReminders{
 constructor({readSettings,readKey,loadState=()=>({}),saveState=()=>{},reminderText,fetchImpl=fetch,now=Date.now}){Object.assign(this,{readSettings,readKey,saveState,reminderText,fetchImpl,now});this.state=loadState()||{};this.inFlight=null;this.generation=0;this.status='local';this.nextDue=now()+1800000;}
 budget(now){const d=new Date(now),day=[d.getFullYear(),d.getMonth()+1,d.getDate()].join('-'),month=[d.getFullYear(),d.getMonth()+1].join('-');if(this.state.day!==day){this.state.day=day;this.state.calls=0;this.state.inputTokens=0;this.state.outputTokens=0;this.state.tokens=0;}if(this.state.month!==month){this.state.month=month;this.state.costRMB=0;}return this.state;}
 configured(manual=false){const s=this.readSettings();return s.hasKey&&(s.enabled||manual);}
 reset(){this.generation++;this.state.caches={};this.state.taskCaches={};this.status='local';this.saveState(this.state);}
 summary(){const s=this.budget(this.now()),settings=this.readSettings();return {calls:s.calls||0,limit:settings.dailyLimit||DAY_LIMIT,softLimit:20,tokens:s.tokens||0,inputTokens:s.inputTokens||0,outputTokens:s.outputTokens||0,costRMB:s.costRMB||0,priceConfigured:settings.inputRMB!=null&&settings.outputRMB!=null,monthBudgetRMB:settings.monthBudgetRMB??null,status:this.status};}
 cached(tasks){const now=this.now(),cache=this.state.caches?.[signature(tasks,now)];if(!cache||now-cache.at>24*3600000||now<cache.at)return null;try{return {...validatePlan(cache.plan,tasks,now),source:'ai-cache'};}catch{return null;}}
 cachedTask(task){if(!task||task.done)return null;const now=this.now(),cache=this.state.taskCaches?.[taskSignature(task,now)];if(!cache||now<cache.at||now-cache.at>12*3600000)return null;return {...cache.reminder,source:'ai-cache'};}
 recordTurn(turn){const now=this.now();this.state.conversation=(this.state.conversation||[]).filter(t=>now-t.at<86400000).slice(-11);const last=this.state.conversation.at(-1);if(turn.role==='fox'&&last?.role==='fox'&&last.taskId===turn.taskId&&now-last.at<30000)this.state.conversation.pop();this.state.conversation.push({...turn,at:now});this.saveState(this.state);}
 history(tasks){const ids=new Set(tasks.map(t=>t.id)),now=this.now();return (this.state.conversation||[]).filter(t=>now-t.at<86400000&&ids.has(t.taskId)).slice(-6);}
 async plan(tasks,{manual=false,context=[]}={}){
  tasks=shortlist(tasks).slice(0,8).map(t=>({...tasks.find(original=>original.id===t.id)}));
  const now=this.now(),fallback={taskId:shortlist(tasks)[0]?.id||null,message:this.reminderText(tasks,now),source:'local',nextMinutes:30,urgency:'low'};
  if(!tasks.some(t=>!t.done)||!this.configured(manual))return fallback;
  const messages=tasks.map(t=>this.cachedTask(t));if(messages.every(Boolean)){const selected=tasks[0].id;return {taskId:selected,message:messages[0].message,reminders:messages,nextMinutes:30,urgency:phase(tasks[0],now)==='overdue'?'high':'low',source:'ai-cache'};}
  if(this.inFlight)return fallback;
  const state=this.budget(now),settings=this.readSettings(),limit=settings.dailyLimit||DAY_LIMIT;
  if((state.calls||0)>=limit){this.status='daily-limit';return fallback;}
  if(state.lastAttempt&&now-state.lastAttempt<60000&&(state.lastFailed||state.lastSignature===signature(tasks,now))){this.status='cooldown';return fallback;}
  const maxTokens=Math.min(2800,200+tasks.length*300),payload={now:new Date(now).toISOString(),localTime:new Date(now).toString(),tasks:tasks.map(t=>taskData(t,now)),context:shortlist(context).filter(t=>!tasks.some(x=>x.id===t.id)).slice(0,8),history:this.history(tasks)},body=JSON.stringify({model:MODEL,messages:[{role:'system',content:SYSTEM_PROMPT},{role:'user',content:JSON.stringify(payload)}],thinking:{type:'disabled'},max_tokens:maxTokens,response_format:{type:'json_object'},stream:false});
  const priced=settings.inputRMB!=null&&settings.outputRMB!=null,reserve=priced?((Buffer.byteLength(body)+256)*settings.inputRMB+maxTokens*settings.outputRMB)/1e6:0;
  if(settings.monthBudgetRMB!=null&&(!priced||(state.costRMB||0)+reserve>settings.monthBudgetRMB)){this.status='monthly-limit';return fallback;}
  const generation=this.generation,run=async()=>{
   try{
    const key=this.readKey();if(!key)return fallback;
    state.calls=(state.calls||0)+1;state.lastAttempt=now;state.lastSignature=signature(tasks,now);if(priced)state.costRMB=(state.costRMB||0)+reserve;this.saveState(state);
    const response=await this.fetchImpl(ENDPOINT,{method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body});
    if(!response.ok)throw Error(response.status===401?'key-rejected':response.status===429?'rate-limited':'http-'+response.status);
    const raw=await response.text();if(raw.length>64000)throw Error('invalid-response');const result=JSON.parse(raw),input=Number(result.usage?.prompt_tokens),output=Number(result.usage?.completion_tokens),total=Number(result.usage?.total_tokens)||0;
    if(Number.isFinite(input)&&Number.isFinite(output)&&input>=0&&output>=0){state.inputTokens=(state.inputTokens||0)+input;state.outputTokens=(state.outputTokens||0)+output;if(priced)state.costRMB=Math.max(0,(state.costRMB||0)-reserve+(input*settings.inputRMB+output*settings.outputRMB)/1e6);}
    state.tokens=(state.tokens||0)+Math.max(0,total);this.saveState(state);
    const plan=validatePlan(JSON.parse(result.choices?.[0]?.message?.content),tasks,now);state.lastFailed=false;
    if(generation!==this.generation||!this.configured(manual))return fallback;
    state.taskCaches=state.taskCaches||{};for(const reminder of plan.reminders){const t=tasks.find(t=>t.id===reminder.taskId);state.taskCaches[taskSignature(t,now)]={at:now,reminder};}const taskKeys=Object.keys(state.taskCaches).sort((a,b)=>state.taskCaches[a].at-state.taskCaches[b].at);for(const key of taskKeys.slice(0,Math.max(0,taskKeys.length-100)))delete state.taskCaches[key];state.caches=state.caches||{};state.caches[signature(tasks,now)]={at:now,plan};const keys=Object.keys(state.caches).sort((a,b)=>state.caches[a].at-state.caches[b].at);for(const key of keys.slice(0,Math.max(0,keys.length-24)))delete state.caches[key];this.status='ready';this.saveState(state);return plan;
   }catch(e){state.lastFailed=true;try{this.saveState(state);}catch{}this.status=['key-rejected','rate-limited'].includes(e.message)||/^http-\d+$/.test(e.message)?e.message:'fallback';return fallback;}
  };
  this.inFlight=run();try{return await this.inFlight;}finally{this.inFlight=null;}
 }
 async poll(tasks,{preview=false}={}){if(!preview)return {handled:false};const result=await this.plan(tasks,{manual:true});return {handled:this.configured(true),...result,reason:this.status,automaticEnabled:this.readSettings().enabled};}
}
module.exports={AIReminders,validatePlan,shortlist,MODEL,ENDPOINT,SYSTEM_PROMPT,DAY_LIMIT,signature};
