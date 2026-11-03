'use strict';
function dayKey(value=Date.now()){const d=new Date(value);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function validDay(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;const d=new Date(value+'T12:00:00');return Number.isFinite(+d)&&dayKey(d)===value;}
const validTime=value=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value||'');
const atDay=(day,time)=>new Date(day+'T'+time+':00').toISOString();
function recurrenceFields(input,now=Date.now()){
 if(input.cadence!=='daily')return {cadence:'once'};
 const startDate=input.startDate||dayKey(now),endDate=input.endDate||null,dailyTime=input.dailyTime,dailyDeadline=input.dailyDeadline||null;
 if(!validDay(startDate)||endDate&&(!validDay(endDate)||endDate<startDate))throw Error('计划日期不正确，结束日期不能早于开始日期');
 if(!validTime(dailyTime)||dailyDeadline&&!validTime(dailyDeadline))throw Error('请选择每日提醒时间');
 if(dailyDeadline&&dailyDeadline<dailyTime)throw Error('当日最晚完成时间不能早于提醒时间');
 return {cadence:'daily',startDate,endDate,dailyTime,dailyDeadline};
}
function syncDay(t,now){
 if(t.cadence!=='daily')return false;
 const date=dayKey(now);let changed=false;
 if(t.occurrenceDate!==date){Object.assign(t,{occurrenceDate:date,status:'pending',done:false,snoozeUntil:null,workingUntil:null,record:{consumed:[],pending:null,shownAt:null},deadline:t.dailyDeadline?atDay(date,t.dailyDeadline):null,remindAt:atDay(date,t.dailyTime)});changed=true;}
 const deadline=t.dailyDeadline?atDay(date,t.dailyDeadline):null,remindAt=atDay(date,t.dailyTime);
 if(t.deadline!==deadline||t.remindAt!==remindAt){t.deadline=deadline;t.remindAt=remindAt;changed=true;}
 const completed=(t.completedDates||[]).includes(date),skipped=(t.skippedDates||[]).includes(date),ended=Boolean(t.endDate&&date>t.endDate),notStarted=date<t.startDate;
 for(const [key,value] of Object.entries({dailyCompleted:completed,dailySkipped:skipped,ended,notStarted}))if(t[key]!==value){t[key]=value;changed=true;}
 return changed;
}
function activeDay(t){return t.cadence!=='daily'||!t.dailyCompleted&&!t.dailySkipped&&!t.ended&&!t.notStarted;}
function nextReminder(t,now=Date.now()){
 if(t.cadence!=='daily'||t.ended)return null;
 let day=dayKey(now);if(day<t.startDate)day=t.startDate;
 else if(t.dailyCompleted||t.dailySkipped||Date.parse(atDay(day,t.dailyTime))<=now){const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+1);day=dayKey(d);}
 return t.endDate&&day>t.endDate?null:atDay(day,t.dailyTime);
}
module.exports={dayKey,validDay,atDay,recurrenceFields,syncDay,activeDay,nextReminder};
