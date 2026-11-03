const {test}=require('node:test'),assert=require('node:assert/strict');
const {ReminderEngine,MIN}=require('./reminder-engine.cjs');
const {dayKey,atDay}=require('./recurrence.cjs');
const {ReadingSession}=require('./reading-session.cjs');
const present={canDisplay:true,possiblyAway:false,returnedAt:0};
function fixture(day='2026-10-30',time='17:00'){
 let now=Date.parse(atDay(day,time)),saved;const options={now:()=>now,save:s=>saved=structuredClone(s)};let e=new ReminderEngine(options);
 return {get e(){return e},at:(day,time)=>{now=Date.parse(atDay(day,time));},advance:m=>now+=m*MIN,restart:()=>e=new ReminderEngine({...options,load:()=>structuredClone(saved)}),task:(extra={})=>e.upsert({text:'校园跑',cadence:'daily',dailyTime:'18:00',startDate:day,...extra})};
}
test('daily completion suppresses all same-day reminders, midnight only resets, next reminder retains fixed time',()=>{
 const f=fixture(),t=f.task({dailyDeadline:'21:00',important:true});f.at('2026-10-30','18:00');const item=f.e.delivery(present)[0];assert.equal(item.occurrenceDate,'2026-10-30');f.e.action(t.id,'complete',{occurrenceDate:item.occurrenceDate});f.at('2026-10-30','23:59');assert.equal(f.e.delivery(present).length,0);f.restart();assert.equal(f.e.delivery(present).length,0);f.at('2026-10-31','00:00');assert.equal(f.e.delivery(present).length,0);assert.equal(f.e.list()[0].dailyCompleted,false);f.at('2026-10-31','18:00');assert.equal(f.e.delivery(present).length,1);
});
test('early completion is valid and undo restores only current day',()=>{
 const f=fixture(),t=f.task();f.e.action(t.id,'complete');f.at('2026-10-30','19:00');assert.equal(f.e.delivery(present).length,0);f.e.action(t.id,'undo');assert.equal(f.e.delivery(present).length,1);assert.equal(f.e.list().length,1);
});
test('missed days and away recovery produce only current occurrence',()=>{
 const f=fixture();f.task();f.at('2026-11-04','19:00');assert.equal(f.e.delivery({...present,canDisplay:false}).length,0);f.restart();const items=f.e.delivery(present);assert.equal(items.length,1);assert.equal(items[0].occurrenceDate,'2026-11-04');f.e.markShown(items);assert.equal(f.e.delivery(present).length,0);
});
test('yesterday pinned text survives midnight; completing it cannot complete or erase today',()=>{
 const f=fixture(),t=f.task();f.at('2026-10-30','18:00');const item=f.e.delivery(present)[0],reader=new ReadingSession();reader.present({token:'old',items:[item]},'昨天的校园跑','local');f.e.markShown([item]);f.at('2026-10-31','19:00');f.e.tick();reader.reconcile(f.e.list());assert.equal(reader.active.text,'昨天的校园跑');assert.equal(reader.active.items[0].occurrenceDate,'2026-10-30');f.e.action(t.id,'complete',{occurrenceDate:item.occurrenceDate,expectedRevision:item.revision});const today=f.e.delivery(present);assert.equal(today.length,1);assert.equal(today[0].occurrenceDate,'2026-10-31');assert.equal(f.e.list()[0].dailyCompleted,false);
});
test('daily snooze and working are scoped to day, cross-day requests require skip, skip never deletes plan',()=>{
 const f=fixture(),t=f.task();f.at('2026-10-30','18:00');f.e.action(t.id,'snooze',{until:atDay('2026-10-30','19:00')});f.advance(30);assert.equal(f.e.delivery(present).length,0);f.advance(30);assert.equal(f.e.delivery(present).length,1);assert.throws(()=>f.e.action(t.id,'working',{until:atDay('2026-10-31','00:10')}),/明天/);f.e.action(t.id,'skip');assert.equal(f.e.delivery(present).length,0);f.e.action(t.id,'undo');assert.equal(f.e.delivery(present).length,1);f.e.action(t.id,'skip');f.at('2026-10-31','18:00');assert.equal(f.e.delivery(present).length,1);
});
test('inclusive end date, future start and extending ended plan',()=>{
 const f=fixture(),t=f.task({startDate:'2026-11-01',endDate:'2026-11-02'});f.at('2026-10-31','19:00');assert.equal(f.e.delivery(present).length,0);f.at('2026-11-02','18:00');assert.equal(f.e.delivery(present).length,1);f.at('2026-11-03','19:00');assert.equal(f.e.delivery(present).length,0);assert(f.e.list()[0].ended);f.e.upsert({...f.e.list()[0],endDate:'2026-11-04'});assert.equal(f.e.delivery(present).length,1);
});
test('editing daily reminder time materializes new time without losing today completion',()=>{
 const f=fixture(),t=f.task();f.e.upsert({...f.e.list()[0],dailyTime:'20:00'});f.at('2026-10-30','18:30');assert.equal(f.e.delivery(present).length,0);f.at('2026-10-30','20:00');assert.equal(f.e.delivery(present).length,1);f.e.action(t.id,'complete');f.e.upsert({...f.e.list()[0],dailyTime:'21:00'});f.at('2026-10-30','21:00');assert.equal(f.e.delivery(present).length,0);
});
test('single completion removes task, restart retains 10-second undo then purges tombstone',()=>{
 const f=fixture(),t=f.e.upsert({text:'交作业',deadline:atDay('2026-10-30','18:00')});f.e.action(t.id,'complete');assert.equal(f.e.list().length,0);assert.equal(f.e.undoable().length,1);f.restart();f.e.action(t.id,'undo');assert.equal(f.e.list()[0].deadline,t.deadline);f.e.action(t.id,'complete');f.advance(1);f.e.tick();assert.equal(f.e.undoable().length,0);assert.equal(f.e.state.undoEntries.length,0);assert.throws(()=>f.e.action(t.id,'undo'),/撤销时间已过/);
});
test('invalid schedule rejected atomically; deleting repeat plan stops future reminders; legacy remains single',()=>{
 const f=fixture();assert.throws(()=>f.task({dailyTime:'25:00'}));assert.throws(()=>f.task({endDate:'2026-10-29'}));assert.throws(()=>f.task({dailyDeadline:'17:00'}));assert.throws(()=>f.task({startDate:'2026-02-30'}));assert.equal(f.e.list().length,0);const t=f.task();f.e.remove(t.id);f.at('2026-11-01','19:00');assert.equal(f.e.delivery(present).length,0);const legacy=new ReminderEngine({load:()=>({version:2,tasks:[{id:'x',text:'旧事项',done:false,revision:1,createdAt:Date.now(),record:{consumed:[],pending:null,shownAt:null}}]})});assert.notEqual(legacy.list()[0].cadence,'daily');
});
test('calendar days work across local month/year boundaries and 23/25-hour DST days',()=>{
 const old=process.env.TZ;try{process.env.TZ='America/New_York';const f=fixture('2026-10-31'),t=f.task();f.e.action(t.id,'complete');f.at('2026-11-01','18:00');assert.equal(f.e.delivery(present).length,1);assert.equal(dayKey(Date.parse(f.e.list()[0].remindAt)),'2026-11-01');}finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}
 const f=fixture('2026-12-31');f.task();f.at('2027-01-01','18:00');assert.equal(f.e.delivery(present)[0].occurrenceDate,'2027-01-01');
});
test('outside dismissal pauses only that date, never tomorrow same deadline key',()=>{
 const reader=new ReadingSession(),item={id:'daily',key:'deadline',occurrenceDate:'2026-10-30'};reader.dismiss([item],{collapseHud:true});assert.equal(reader.allowed([item]).length,0);assert.equal(reader.allowed([{...item,occurrenceDate:'2026-10-31'}]).length,1);
});
test('runtime keeps yesterday reading pinned and acknowledges the correct date without marking today done',()=>{
 const fs=require('fs'),path=require('path'),{createReminderRuntime}=require('./reminder-runtime.cjs');const folder=fs.mkdtempSync(path.join(__dirname,'qa','daily-runtime-'));let now=Date.parse(atDay('2026-10-30','18:00'));const events=[];
 const runtime=createReminderRuntime({app:{getPath:()=>folder},powerMonitor:{},win:{isDestroyed:()=>false,webContents:{send:(name,value)=>events.push({name,value})}},readPreferences:()=>({reminders:true}),legacy:[],aiReminders:{summary:()=>({}),configured:()=>false,cached:()=>null,cachedTask:()=>({message:'今天跑步别忘啦～',replies:{complete:'今天的跑步完成啦！'}})},aiSettings:{status:()=>({dynamic:false})},presenceFactory:()=>({snapshot:()=>present,status:()=>present,dispose(){}}),now:()=>now,isolated:true});
 try{const t=runtime.upsert({text:'校园跑',cadence:'daily',dailyTime:'18:00',startDate:'2026-10-30'});runtime.ready();const view=events.find(x=>x.name==='reminders:delivery').value;runtime.shown(view.token);now=Date.parse(atDay('2026-10-31','19:00'));runtime.tick();assert.equal(runtime.state().reading.id,t.id);assert.equal(events.filter(x=>x.name==='reminders:delivery').length,1);const result=runtime.action(t.id,'complete',{occurrenceDate:'2026-10-30',expectedRevision:t.revision});assert(result.reply.includes('2026-10-30'));assert.equal(runtime.engine.list()[0].dailyCompleted,false);runtime.releaseFeedback();assert.equal(events.at(-1).name,'reminders:delivery');assert.equal(events.at(-1).value.items[0].occurrenceDate,'2026-10-31');}finally{runtime.dispose();}
});
