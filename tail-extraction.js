// Runtime source-preserving layer extraction. Never reshapes the approved tips.
(function(){
const bones=[
 {root:[620,700],tip:[550,70],phase:.1,radius:150},
 {root:[570,700],tip:[220,200],phase:.8,radius:180},
 {root:[560,790],tip:[60,420],phase:1.5,radius:210},
 {root:[560,850],tip:[120,760],phase:2.2,radius:210},
 {root:[650,1000],tip:[480,1025],phase:2.9,radius:170},
 {root:[1060,780],tip:[1245,260],phase:3.5,radius:180},
 {root:[1080,830],tip:[1300,610],phase:4.2,radius:170},
 {root:[1080,940],tip:[1200,910],phase:4.9,radius:170},
 {root:[1000,1000],tip:[1080,1040],phase:5.6,radius:120}
];
function extract(master,body){
 const w=master.width,h=master.height,source=document.createElement('canvas');source.width=w;source.height=h;const g=source.getContext('2d',{willReadFrequently:true});g.drawImage(master,0,0);
 // Remove the body, including its antialiased fringe, before assigning tails.
 g.globalCompositeOperation='destination-out';
 for(let dy=-3;dy<=3;dy+=3)for(let dx=-3;dx<=3;dx+=3)g.drawImage(body,dx,dy,w,h);
 const p=g.getImageData(0,0,w,h),parts=bones.map(()=>new Uint8ClampedArray(w*h*4)),bounds=bones.map(()=>({x:w,y:h,r:0,b:0,count:0}));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const k=(y*w+x)*4;if(p.data[k+3]<2)continue;
  let nearest=Infinity;const distances=[];
  for(const bone of bones){const ax=bone.tip[0]-bone.root[0],ay=bone.tip[1]-bone.root[1],t=Math.max(0,Math.min(1,((x-bone.root[0])*ax+(y-bone.root[1])*ay)/(ax*ax+ay*ay)));const d=Math.hypot(x-bone.root[0]-ax*t,y-bone.root[1]-ay*t);distances.push(d);nearest=Math.min(nearest,d);}
  // Overlap preserves fur along internal boundaries when neighboring tails move.
  for(let i=0;i<9;i++){const delta=distances[i]-nearest;if(delta>24)continue;const opacity=delta<=12?1:(24-delta)/12;parts[i].set(p.data.subarray(k,k+4),k);parts[i][k+3]=Math.round(p.data[k+3]*opacity);const b=bounds[i];b.x=Math.min(b.x,x);b.y=Math.min(b.y,y);b.r=Math.max(b.r,x);b.b=Math.max(b.b,y);b.count++;}
 }
 return parts.map((pixels,i)=>{const b=bounds[i];if(b.count<50)throw Error('原图尾巴区域不足：'+(i+1));const full=document.createElement('canvas');full.width=w;full.height=h;full.getContext('2d').putImageData(new ImageData(pixels,w,h),0,0);const c=document.createElement('canvas');c.width=b.r-b.x+1;c.height=b.b-b.y+1;c.getContext('2d').drawImage(full,b.x,b.y,c.width,c.height,0,0,c.width,c.height);return {image:c,layout:{root:bones[i].root,tip:bones[i].tip,phase:bones[i].phase,offset:[b.x,b.y],size:[c.width,c.height]}};});
}
window.tailExtraction={extract};
})();
