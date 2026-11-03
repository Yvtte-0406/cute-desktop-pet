const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createReminderRuntime}=require('./reminder-runtime.cjs');
test('multiple ordinary reminders use separate leases and only visible item is marked shown',()=>{
 const base=path.join(__dirname,'qa');fs.mkdirSync(base,{recursive:true});const folder=fs.mkdtempSync(path.join(base,'serial-')),events=[];
 const runtime=createReminderRuntime({app:{getPath:()=>folder},powerMonitor:{},win:{isDestroyed:()=>false,webContents:{send:(name,value)=>events.push({name,value})}},readPreferences:()=>({reminders:true}),legacy:[],aiReminders:{summary:()=>({}),configured:()=>false,cached:()=>null},aiSettings:{status:()=>({dynamic:true})},isolated:true});
 try{
  for(const text of ['写报告','交作业','回邮件'])runtime.upsert({text});
  runtime.engine.change(s=>{for(const t of s.tasks)t.createdAt=Date.now()-31*60000;});runtime.ready();
  const deliveries=()=>events.filter(e=>e.name==='reminders:delivery').map(e=>e.value);
  let first=deliveries()[0];assert.equal(first.items.length,1);assert.equal(first.moreCount,2);assert(!first.text.includes('选择'));runtime.shown(first.token);
  let tasks=runtime.engine.list();assert.equal(tasks.filter(t=>t.record.shownAt!==null).length,1);
  runtime.busy(true);runtime.tick();assert.equal(deliveries().length,1);runtime.busy(false);runtime.tick();
  assert.equal(deliveries().length,1);runtime.action(first.items[0].id,'complete',{});runtime.releaseFeedback();const second=deliveries()[1];assert.equal(second.items.length,1);assert.notEqual(second.items[0].id,first.items[0].id);runtime.shown(second.token);runtime.tick();assert.equal(deliveries().length,2);runtime.action(second.items[0].id,'complete',{});runtime.releaseFeedback();
  const third=deliveries()[2];assert.equal(third.items.length,1);assert.equal(new Set([first,second,third].map(d=>d.items[0].id)).size,3);runtime.shown(third.token);runtime.tick();assert.equal(deliveries().length,3);
 }finally{runtime.dispose();fs.rmSync(folder,{recursive:true,force:true});}
});
test('playful local copy states real urgency without merging unrelated tasks',()=>{const copy=require('./reminder-copy.js');const task={id:'a',text:'报名',deadline:new Date(Date.now()-60000).toISOString()};assert.match(copy.line(task),/报名/);assert.match(copy.line(task),/已经/);assert(!copy.line(task).includes('待回应'));assert.match(copy.feedback('snooze'),/爪爪/);});
