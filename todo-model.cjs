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
 function deadlineHint(deadline,now){
  if(!deadline)return '';
  const date=new Date(deadline),current=new Date(now),time=date.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
  if(date.getTime()<=now)return '已经到截止时间啦，记得看看进度';
  const days=Math.round((Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())-Date.UTC(current.getFullYear(),current.getMonth(),current.getDate()))/86400000);
  const day=days===0?'今天':days===1?'明天':days===2?'后天':date.toLocaleDateString('zh-CN',{month:'numeric',day:'numeric',...(date.getFullYear()!==current.getFullYear()?{year:'numeric'}:{})});
  return day+' '+time+' 截止';
 }
 function reminderText(tasks,now=Date.now()){
  const pending=tasks.filter(t=>!t.done).slice().sort((a,b)=>(a.deadline?Date.parse(a.deadline):Infinity)-(b.deadline?Date.parse(b.deadline):Infinity));
  if(!pending.length)return '';
  const first=pending[0],name='「'+(first.text.length>42?first.text.slice(0,41)+'…':first.text)+'」';
  const left=first.deadline?Date.parse(first.deadline)-now:Infinity;
  if(left<=0)return '爪爪提醒！'+name+'已经到截止时间啦，可别漏掉了！';
  if(left<=3600000)return '喂喂！'+name+'快截止啦，这件最着急！';
  if(left<=86400000)return '哼，'+name+deadlineHint(first.deadline,now)+'，记牢啦！';
  const text=pending.slice(0,2).map(t=>'「'+(t.text.length>42?t.text.slice(0,41)+'…':t.text)+'」').join('、');
  return ['哼，'+text+'还在待办里，可别忘了！','爪爪提醒～'+text+'也要记着哦！','喂喂，'+text+'还等着你呢！'][Math.floor(now/REMINDER_MS)%3];
 }
 class ReminderClock{
  constructor(now=Date.now()){this.next=now+REMINDER_MS;}
  reset(now=Date.now()){this.next=now+REMINDER_MS;}
  poll(now,{enabled,idle,tasks}){if(!enabled){this.reset(now);return '';}if(!idle||now<this.next)return '';this.reset(now);return reminderText(tasks,now);}
 }
 const model={normalizeTasks,reminderText,deadlineHint,ReminderClock,REMINDER_MS};
 if(typeof module!=='undefined')module.exports=model;else root.foxTodos=model;
})(typeof window!=='undefined'?window:globalThis);
