// Nine rigid tails share one fan-opening rhythm; no per-vertex distortion.
(function(root){
 const PERIOD=8.4/1.2;
 const profiles=Object.freeze([.072,.061,.046,.042,.034,.038,.045,.059,.077].map((amplitude,i)=>Object.freeze({amplitude,period:PERIOD,phase:0,direction:i<5?1:-1})));
 function angle(index,pose){
  const p=profiles[index];if(!p)throw Error('缺少尾巴运动参数');
  const wave=pose.time*2*Math.PI/PERIOD;
  const swing=.84*Math.sin(wave)+.16*Math.sin(wave*.53);
  const lift=Math.max(0,Math.min(1,pose.lift||0)),pet=Math.max(0,Math.min(1,pose.pet||0));
  return p.direction*swing*p.amplitude*(1+lift*.18+pet*.08)-(pose.sway||0)*(.15+index*.01);
 }
 const motion={profiles,angle};if(typeof module!=='undefined')module.exports=motion;else root.foxTailMotion=motion;
})(typeof window!=='undefined'?window:globalThis);
