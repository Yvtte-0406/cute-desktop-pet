// One true circular arc drives button positions, SVG paint and native clipping.
(function(root){
 const cx=139,cy=198,radius=180,width=278,height=110,angles=[-130,-103,-77,-50];
 const point=degrees=>{const a=degrees*Math.PI/180;return {x:cx+radius*Math.cos(a),y:cy+radius*Math.sin(a)};};
 const points=angles.map(point),first=points[0],last=points.at(-1);
 const arc={cx,cy,radius,width,height,points,point,start:angles[0],end:angles.at(-1),path:'M '+first.x+' '+first.y+' A '+radius+' '+radius+' 0 0 1 '+last.x+' '+last.y};
 if(typeof module!=='undefined')module.exports=arc;else{root.menuArc=arc;document.querySelector('#orbit-arc path').setAttribute('d',arc.path);document.querySelectorAll('#orbit button').forEach((button,i)=>{button.style.left=(points[i].x-22)+'px';button.style.top=(points[i].y-22)+'px';});}
})(typeof window!=='undefined'?window:globalThis);
