const {test}=require('node:test'),assert=require('node:assert/strict');
const {profiles,angle}=require('./tail-motion.js'),layout=require('./assets/tails-overlap-v2/layout.json');
test('nine complete tails have visible coordinated movement at 70 percent size',()=>{
 assert.equal(profiles.length,9);assert.equal(new Set(profiles.map(p=>p.period)).size,1);
 const lengthScale=650/1374*210/720;
 for(let i=0;i<9;i++){
  const samples=Array.from({length:1201},(_,t)=>angle(i,{time:t/30}));
  const b=layout[i],length=Math.max(...[0,1].flatMap(x=>[0,1].map(y=>Math.hypot(b.offset[0]+b.size[0]*x-b.root[0],b.offset[1]+b.size[1]*y-b.root[1]))));
  const peak=Math.max(...samples.map(Math.abs))*length*lengthScale;
  assert(peak>1.5,'尾巴'+i+'摆幅仍不可见');assert(peak<12,'尾巴'+i+'摆幅过大');
 }
 assert.notDeepEqual(profiles.map((_,i)=>angle(i,{time:0})),profiles.map((_,i)=>angle(i,{time:2})));
});
test('tail angles are continuous across seconds and interaction transitions',()=>{
 for(let i=0;i<9;i++)for(let t=0;t<20;t+=.1){
  const a=angle(i,{time:t}),b=angle(i,{time:t+1/120});assert(Math.abs(a-b)<.002);
  const c=angle(i,{time:t,lift:.51,pet:.1,sway:.02}),d=angle(i,{time:t,lift:.5,pet:.1,sway:.02});assert(Math.abs(c-d)<.001);
 }
});

test('all nine tails share inward and outward phases with mirrored directions',()=>{
 for(let t=0;t<30;t+=.05){const normalized=profiles.map((p,i)=>angle(i,{time:t})/p.amplitude/p.direction);assert(normalized.every(x=>Math.abs(x-normalized[0])<1e-12));}
 assert(profiles.slice(0,5).every(p=>p.direction===1));assert(profiles.slice(5).every(p=>p.direction===-1));
});
