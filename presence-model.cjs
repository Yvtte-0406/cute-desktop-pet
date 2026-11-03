'use strict';
class PresenceModel{
 constructor(now=Date.now){this.now=now;this.locked=null;this.suspended=false;this.display='unknown';this.idleSeconds=null;this.returnedAt=0;this.settleUntil=0;this.awaySeen=false;this.waitingInput=false;this.lastIdle=null;}
 event(name,value){const now=this.now();if(name==='lock')this.locked=true;if(name==='unlock'){this.locked=false;this.waitingInput=true;}if(name==='suspend')this.suspended=true;if(name==='resume'){this.suspended=false;this.waitingInput=true;}if(name==='display'){this.display=value;if(value==='off')this.awaySeen=true;}if(this.locked||this.suspended)this.awaySeen=true;this.settleUntil=Math.max(this.settleUntil,now);}
 sample(idleSeconds,locked){const now=this.now();if(typeof locked==='boolean')this.locked=locked;this.idleSeconds=Number.isFinite(idleSeconds)?idleSeconds:null;
  if(this.idleSeconds!==null&&this.idleSeconds>=180)this.awaySeen=true;
  const input=this.idleSeconds!==null&&(this.idleSeconds<10||(this.lastIdle!==null&&this.idleSeconds+2<this.lastIdle));
  if(input&&!this.locked&&!this.suspended&&this.display!=='off'&&(this.awaySeen||this.waitingInput)){this.returnedAt=now;this.settleUntil=now+15000;this.awaySeen=false;this.waitingInput=false;}
  this.lastIdle=this.idleSeconds;return this.snapshot();
 }
 snapshot(){return {canDisplay:this.locked===false&&!this.suspended&&this.display!=='off'&&!this.waitingInput&&this.now()>=this.settleUntil,possiblyAway:this.idleSeconds===null||this.idleSeconds>=180,returnedAt:this.returnedAt,locked:this.locked,suspended:this.suspended,display:this.display,idleSeconds:this.idleSeconds};}
}
module.exports={PresenceModel};
