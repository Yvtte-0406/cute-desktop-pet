(function(root){
 const REMINDER_MS=30*60*1000;
 function normalizeTasks(items){
  if(!Array.isArray(items)||items.length>500)throw Error('最多可保存500条待办');
  return items.map(t=>{
   if(!t||typeof t.id!=='string'||typeof t.text!=='string'||!t.text.trim()||t.text.length>500)throw Error('待办内容不正确');
   const deadline=t.deadline||null;
   if(deadline!==null&&(typeof deadline!=='string'||!Number.isFinite(Date.parse(deadline))))throw Error('截止时间不正确');
   return {id:t.id,text:t.text.trim(),deadline,done:t.done===true};
  });
 }
 function reminderText(tasks,now=Date.now()){
  const pending=tasks.filter(t=>!t.done).slice().sort((a,b)=>(a.deadline?Date.parse(a.deadline):Infinity)-(b.deadline?Date.parse(b.deadline):Infinity));
  if(!pending.length)return '';
  const text=pending.slice(0,2).map(t=>t.text+(t.deadline?(Date.parse(t.deadline)<now?'（已到截止时间）':'（截止 '+new Date(t.deadline).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})+'）'):''));
  return '还有 '+pending.length+' 件待办：'+text.join('；');
 }
 class ReminderClock{
  constructor(now=Date.now()){this.next=now+REMINDER_MS;}
  reset(now=Date.now()){this.next=now+REMINDER_MS;}
  poll(now,{enabled,idle,tasks}){if(!enabled){this.reset(now);return '';}if(!idle||now<this.next)return '';this.reset(now);return reminderText(tasks,now);}
 }
 const model={normalizeTasks,reminderText,ReminderClock,REMINDER_MS};
 if(typeof module!=='undefined')module.exports=model;else root.foxTodos=model;
})(typeof window!=='undefined'?window:globalThis);
