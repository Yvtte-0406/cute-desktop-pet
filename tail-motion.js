// Each complete painted tail has its own small pendulum motion, in radians/seconds.
(function(root){
 // IDs follow the user's numbering, starting with the low left tail.
 const profiles=Object.freeze([
  {amplitude:.072,period:7.8,phase:.2},
  {amplitude:.061,period:8.8,phase:.65},
  {amplitude:.046,period:9.7,phase:1.1},
  {amplitude:.042,period:10.6,phase:1.75},
  {amplitude:.034,period:11.4,phase:2.3},
  {amplitude:.038,period:12.3,phase:2.8},
  {amplitude:.045,period:9.2,phase:3.65},
  {amplitude:.059,period:8.3,phase:4.3},
  {amplitude:.077,period:7.2,phase:4.9}
 ].map(Object.freeze));
 function angle(index,pose){
  const p=profiles[index];if(!p)throw Error('缺少尾巴运动参数');
  const wave=pose.time*2*Math.PI/p.period;
  const swing=.84*Math.sin(wave+p.phase)+.16*Math.sin(wave*.53+p.phase*1.3);
  const lift=Math.max(0,Math.min(1,pose.lift||0)),pet=Math.max(0,Math.min(1,pose.pet||0));
  return swing*p.amplitude*(1+lift*.18+pet*.08)-(pose.sway||0)*(.15+index*.01);
 }
 const motion={profiles,angle};if(typeof module!=='undefined')module.exports=motion;else root.foxTailMotion=motion;
})(typeof window!=='undefined'?window:globalThis);
