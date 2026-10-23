const {test}=require('node:test');const assert=require('node:assert/strict');
const {FoxMotion}=require('./motion.js');
test('blink contains intermediate eyelid positions instead of binary switching',()=>{
 const m=new FoxMotion();const values=[];
 for(let i=0;i<300;i++){const p=m.step(1/120,'idle');if(m.time>2.08&&m.time<2.55)values.push(p.blink);}
 assert(values.some(x=>x>.15&&x<.35));assert(values.some(x=>x>.65&&x<.85));assert(Math.max(...values)>.99);
 for(let i=1;i<values.length;i++)assert(Math.abs(values[i]-values[i-1])<.11);
});
test('pet, lift and release stay continuous across state boundaries',()=>{
 const m=new FoxMotion();let prev=m.step(1/120,'idle');
 for(const mode of ['pet','lift','idle','talk','idle'])for(let i=0;i<240;i++){
  const p=m.step(1/120,mode,10);
  for(const key of ['pet','lift','talk','head','earLeft','earRight','bodyY'])assert(Math.abs(p[key]-prev[key])<(key==='bodyY'?2:.1),key);
  prev=p;
 }
 assert(prev.lift<.001);assert(prev.talk<.001);
});
test('motion duration does not depend on screen refresh rate',()=>{
 function simulate(fps){const m=new FoxMotion();let p;for(let i=0;i<fps;i++)p=m.step(1/fps,'lift');return p;}
 const a=simulate(60),b=simulate(144);assert(Math.abs(a.lift-b.lift)<1e-6);assert(Math.abs(a.earLeft-b.earLeft)<1e-6);
});
test('drag drives body and head inertia and settles after release',()=>{const m=new FoxMotion();let p;for(let i=0;i<120;i++)p=m.step(1/120,'lift',20);assert(Math.abs(p.sway)>.1);assert(Math.abs(p.head)>.035);assert(Math.abs(p.earLeft)>.05);for(let i=0;i<600;i++)p=m.step(1/120,'idle',0);assert(Math.abs(p.sway)<.001);assert(p.lift<.001);});
