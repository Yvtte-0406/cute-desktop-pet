// Continuous pose controls. No animation frame images or sprite changes.
(function(root){
 const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
 class FoxMotion {
  constructor(){this.time=0;this.pet=0;this.lift=0;this.talk=0;this.sway=0;this.roll=0;this.rollVelocity=0;this.blinkStart=2.1;this.nextBlink=2.1;this.blinks=0;}
  step(dt,mode,drag=0){
   dt=Math.max(0,Math.min(dt,.05));this.time+=dt;const t=this.time;
   for(const [key,target,speed] of [['pet',mode==='pet'?1:0,5],['lift',mode==='lift'?1:0,5],['talk',mode==='talk'?1:0,9],['sway',Math.max(-1,Math.min(1,drag/20)),7]])this[key]+=(target-this[key])*(1-Math.exp(-speed*dt));
   if(t>=this.nextBlink){this.blinkStart=t;this.blinks++;this.nextBlink=t+3.8+Math.sin(this.blinks*2.4)*.9;}
   const b=t-this.blinkStart;let blink=b<0?0:b<.13?smooth(b/.13):b<.18?1:b<.39?1-smooth((b-.18)/.21):0;
   const pleased=this.pet*(.97+.02*Math.sin(t*2.6));blink=1-(1-blink)*(1-pleased);
   const targetRoll=-this.sway*this.lift*.21;
   const steps=Math.max(1,Math.ceil(dt/.008));for(let i=0;i<steps;i++){const h=dt/steps;this.rollVelocity+=((targetRoll-this.roll)*38-this.rollVelocity*8)*h;this.roll+=this.rollVelocity*h;}
   const breath=Math.sin(t*1.8),flickTime=t%8.7;
   const flick=flickTime>5&&flickTime<5.8?Math.sin((flickTime-5)/.8*Math.PI)*.1:0;
   const flutter=Math.sin(t*.73)*.026+flick;
   return {time:t,blink,pet:this.pet,lift:this.lift,talk:this.talk,
    mouth:this.talk*(.18+.82*Math.pow(.5+.5*Math.sin(t*10.5+Math.sin(t*2)),1.4)),
    head:Math.sin(t*.9)*.009+this.pet*.035*Math.sin(t*2.4)-this.roll*.45+this.lift*Math.sin(t*2.3-.4)*.025,
    earLeft:flutter-this.pet*.065+this.lift*.12+this.roll*.25,
    earRight:Math.sin(t*.83+.9)*.036-flick*.6+this.pet*.05-this.lift*.10-this.roll*.2,
    bodyY:breath*1.8-this.lift*32+this.lift*Math.sin(t*2.3)*5,breath:breath*.0035,
    sway:this.roll+this.lift*Math.sin(t*2.3)*.045};
  }
 }
 const exported={FoxMotion,smooth};if(typeof module!=='undefined')module.exports=exported;else root.foxMotion=exported;
})(typeof window!=='undefined'?window:globalThis);
