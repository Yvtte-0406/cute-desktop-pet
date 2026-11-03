'use strict';
const keyOf=item=>item.id+':'+(item.occurrenceDate?item.occurrenceDate+':':'')+item.key;
class ReadingSession{
 constructor({load=()=>null,save=()=>{}}={}){this.save=save;const value=load();this.state=value?.version===1?value:{version:1,active:null,parked:null,pausedKeys:[]};}
 commit(fn){const next=structuredClone(this.state),result=fn(next);this.save(next);this.state=next;return result;}
 get active(){return this.state.active;}
 valid(view,tasks){return Boolean(view&&tasks.some(t=>t.id===view.items[0]?.id&&!t.done&&t.revision===view.items[0].revision));}
 reconcile(tasks){if((this.state.active&&!this.valid(this.state.active,tasks))||(this.state.parked&&!this.valid(this.state.parked,tasks)))this.commit(s=>{if(!this.valid(s.active,tasks))s.active=null;if(!this.valid(s.parked,tasks))s.parked=null;});}
 present(ticket,text,source){this.commit(s=>{s.hudCollapsed=false;s.active={...ticket,text,source,ui:{kind:'reading'},suspended:false};if(s.parked?.items[0]?.id===ticket.items[0].id)s.parked=null;});return this.active;}
 draft(token,input){if(!this.active||token!==this.active.token)return false;
  const ui={kind:input.kind==='choosing'?'choosing':'reading',scroll:Math.max(0,Math.min(100000,Number(input.scroll)||0))};
  if(ui.kind==='choosing'){if(!['working','snooze'].includes(input.action))throw Error('提醒操作不正确');ui.action=input.action;ui.duration=['10','30','45','60','custom'].includes(input.duration)?input.duration:'10';ui.custom=String(input.custom||'').slice(0,32);ui.preserve=input.preserve===true;}
  if(JSON.stringify(this.active.ui)===JSON.stringify(ui))return true;this.commit(s=>{s.active.ui=ui;});return true;
 }
 suspend(){if(this.active&&!this.active.suspended)this.commit(s=>{s.active.suspended=true;});}
 resume(){if(this.active?.suspended)this.commit(s=>{s.active.suspended=false;});return this.active;}
 dismiss(pending,{collapseHud=false}={}){this.commit(s=>{s.hudCollapsed=collapseHud===true;if(s.active)s.parked=s.active;s.active=null;s.pausedKeys=[...new Set(pending.map(keyOf))];});}
 openParked(tasks){this.reconcile(tasks);if(this.active)return this.active;if(this.state.parked)this.commit(s=>{s.hudCollapsed=false;s.active=s.parked;s.active.suspended=false;s.parked=null;s.pausedKeys=[];});else if(this.state.pausedKeys.length||this.state.hudCollapsed)this.commit(s=>{s.hudCollapsed=false;s.pausedKeys=[];});return this.active;}
 clearTask(id){if(this.active?.items[0]?.id===id||this.state.parked?.items[0]?.id===id)this.commit(s=>{if(s.active?.items[0]?.id===id)s.active=null;if(s.parked?.items[0]?.id===id)s.parked=null;});}
 allowed(items){const paused=new Set(this.state.pausedKeys);return items.filter(item=>!paused.has(keyOf(item)));}
}
module.exports={ReadingSession,keyOf};
