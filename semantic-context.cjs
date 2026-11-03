'use strict';
const crypto=require('node:crypto');
function phase(t,now){const left=t.deadline?Date.parse(t.deadline)-now:Infinity;return left<=0?'overdue':left<=3600000?'hour':left<=86400000?'day':'later';}
function taskData(t,now){return {id:t.id,text:t.text.slice(0,500),deadline:t.deadline||null,kind:t.kind||'task',cadence:t.cadence||'once',occurrenceDate:t.occurrenceDate||null,dailyTime:t.dailyTime||null,dailyDeadline:t.dailyDeadline||null,startDate:t.startDate||null,endDate:t.endDate||null,remindAt:t.remindAt||null,remainingMinutes:t.remainingMinutes??null,important:t.important===true,revision:t.revision||0,phase:phase(t,now)};}
function taskSignature(t,now){return crypto.createHash('sha256').update(JSON.stringify({version:6,task:taskData(t,now)})).digest('hex');}
function validMessage(value){return typeof value==='string'&&value.trim().length>0&&value.length<=120;}
function parseReminders(value,tasks){
 const raw=value.reminders||[{taskId:value.taskId,message:value.message,meaning:''}],ids=new Set(tasks.map(t=>t.id)),seen=new Set();
 if(!Array.isArray(raw)||!raw.length||raw.length>tasks.length)throw Error('invalid-plan');
 const reminders=raw.map(r=>{if(!r||!ids.has(r.taskId)||seen.has(r.taskId)||!validMessage(r.message)||(r.meaning!==undefined&&(typeof r.meaning!=='string'||r.meaning.length>100)))throw Error('invalid-plan');seen.add(r.taskId);const replies={};for(const action of ['working','snooze','complete'])if(r.replies?.[action]!==undefined){if(typeof r.replies[action]!=='string'||!r.replies[action].trim()||r.replies[action].length>80)throw Error('invalid-plan');replies[action]=r.replies[action].trim();}return {taskId:r.taskId,meaning:r.meaning||'',message:r.message.replace(/[\u0000-\u001f]/g,' ').trim(),replies};});
 // Partial batches would force unseen items back to templates, so do not cache them as complete.
 if(seen.size!==tasks.length)throw Error('incomplete-plan');
 return reminders;
}
module.exports={phase,taskData,taskSignature,parseReminders};
