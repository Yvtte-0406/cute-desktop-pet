const {test}=require('node:test');const assert=require('node:assert/strict');
const {normalizeTasks,ReminderClock,REMINDER_MS,reminderText,deadlineHint}=require('./todo-model.cjs');
const task={id:'1',text:'提交报告',deadline:null,done:false};
test('legacy tasks and optional deadlines survive normalization',()=>{
 assert.deepEqual(normalizeTasks([{id:'1',text:'提交报告',done:false}]),[task]);
 const deadline='2026-10-24T10:00:00.000Z';assert.equal(normalizeTasks([{...task,deadline}])[0].deadline,deadline);
 assert.throws(()=>normalizeTasks([{...task,deadline:'bad-date'}]));
});
test('reminders wait 30 minutes, defer while interacting, and do not burst after sleep',()=>{
 const c=new ReminderClock(0),options={enabled:true,idle:true,tasks:[task]};
 assert.equal(c.poll(REMINDER_MS-1,options),'');assert.equal(c.poll(REMINDER_MS,{...options,idle:false}),'');
 assert.match(c.poll(REMINDER_MS+1000,options),/提交报告/);assert.equal(c.poll(REMINDER_MS+2000,options),'');
 assert.match(c.poll(REMINDER_MS*5,options),/提交报告/);assert.equal(c.poll(REMINDER_MS*5+1,options),'');
});
test('disabled reminders stay silent and deadlines take priority',()=>{
 const c=new ReminderClock(0),options={enabled:false,idle:true,tasks:[task]};assert.equal(c.poll(REMINDER_MS*2,options),'');
 assert.equal(c.poll(REMINDER_MS*2+1,{...options,enabled:true}),'');
 assert.equal(reminderText([{...task,done:true}]),'');
 assert.match(reminderText([{...task,text:'普通待办'},{...task,id:'2',text:'紧急事项',deadline:'2026-01-01T00:00:00Z'}],Date.now()),/紧急事项」.*已经到截止时间/);
});
test('deadline labels distinguish today, tomorrow and year boundaries',()=>{
 const now=new Date(2026,11,31,23,30).getTime();
 assert.match(deadlineHint(new Date(2026,11,31,23,59).toISOString(),now),/^今天 23:59/);
 assert.match(deadlineHint(new Date(2027,0,1,9,0).toISOString(),now),/^明天 09:00/);
 assert.match(deadlineHint(new Date(2027,0,2,9,0).toISOString(),now),/^后天 09:00/);
 assert.match(deadlineHint(new Date(2026,11,31,23,0).toISOString(),now),/已经到截止时间/);
});
test('lively reminders vary without inventing tasks or exceeding bubble length',()=>{
 const tasks=[{...task,text:'写'.repeat(500)}];const first=reminderText(tasks,0),second=reminderText(tasks,REMINDER_MS);
 assert.notEqual(first,second);assert(first.length<110);assert(first.includes('写'));assert.equal(reminderText([],0),'');
});
