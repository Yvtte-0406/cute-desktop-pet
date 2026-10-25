// Layered body and nine independently deformable tail meshes.
(function(){
 const vertex=`
 precision highp float;
 attribute vec2 aUV; varying vec2 vUV,vTailPoint;
 uniform vec2 uSize,uTailRoot,uTailTip,uTailOffset,uTailSize; uniform float uTime,uBlink,uPet,uLift,uHead,uEarL,uEarR,uBreath,uBodyY,uSway,uLayer,uTailAngle;
 mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c);}
 float oval(vec2 p,vec2 c,vec2 r){return 1.0-smoothstep(.45,1.0,length((p-c)/r));}
 vec2 blinkEye(vec2 p,vec2 c,float a){
  vec2 q=rot(-a)*(p-c);
  float wx=1.0-smoothstep(35.0,62.0,abs(q.x));
  float wy=1.0-smoothstep(29.0,57.0,abs(q.y));
  float arc=-17.0*(1.0-pow(clamp(q.x/49.0,-1.0,1.0),2.0));
  q.y+=(-q.y*.975+arc)*uBlink*wx*wy;
  return c+rot(a)*q;
 }
 void main(){
  vUV=aUV;vTailPoint=vec2(0.);
  if(uLayer>.5){
   vec2 original=uTailOffset+aUV*uTailSize;
   // Complete painted sprites rotate without squeezing the fluffy silhouette.
   vec2 point=uTailRoot+rot(uTailAngle)*(original-uTailRoot);
   point.y+=uLift*(uTailRoot.y-550.)*.028+uBodyY;
   vTailPoint=point;
   point=vec2(880.,410.)+rot(uSway)*(point-vec2(880.,410.));
   vec2 screen=vec2(35.,32.)+point/uSize*vec2(650.,548.);
   gl_Position=vec4(screen.x/720.*2.-1.,1.-screen.y/620.*2.,0.,1.);return;
  }
  vec2 original=aUV*uSize,p=original;
  // Tails have their own complete textures and independently anchored meshes.
  // Blinking deforms the existing eyelids/iris, progressively and reversibly.
  // Eyelids are animated in face space below; lashes retain visible thickness.
  // Ear pivots use overlapping weights, not cut-out rectangles.
  vec2 anchorL=vec2(662.,349.),anchorR=vec2(931.,270.);
  // Fade to zero at each ear base, before reaching the forehead or cheeks.
  float wl=oval(original,vec2(610.,280.),vec2(180.,180.))*smoothstep(0.,60.,1040.-original.x-original.y);
  float wr=oval(original,vec2(959.,150.),vec2(160.,260.))*smoothstep(0.,65.,original.x*.2+100.-original.y);
  p+=(rot(uEarL-uBlink*.28)*(p-anchorL)-(p-anchorL))*wl;
  p+=(rot(uEarR+uBlink*.55)*(p-anchorR)-(p-anchorR))*wr;
  vec2 neck=vec2(862.,565.);
  float headWeight=1.0-smoothstep(440.,655.,original.y);
  headWeight*=smoothstep(470.,650.,original.x);
  p+=(rot(uHead)*(p-neck)-(p-neck))*headWeight;
  // Keep connected legs and paws intact; suspend the torso rather than pinch legs.
  float lowerBody=smoothstep(460.,850.,original.y);
  p.y+=(original.y-550.)*uLift*.028*lowerBody;
  // The silver bell follows the chest with a smaller delayed pendulum swing.
  vec2 bellPivot=vec2(964.,637.);
  float bellWeight=oval(original,vec2(979.,675.),vec2(63.,88.));
  p+=(rot(-uSway*.7+sin(uTime*3.2)*uLift*.035)*(p-bellPivot)-(p-bellPivot))*bellWeight;
  float chest=oval(original,vec2(888.,725.),vec2(210.,300.));
  p.x+=(p.x-880.)*uBreath*chest;p.y+=(p.y-1080.)*uBreath;
  p.y+=uBodyY;
  p=vec2(880.,410.)+rot(uSway)*(p-vec2(880.,410.));
  // Fixed padded viewport leaves room for tips and lifting motion.
  vec2 screen=vec2(35.,32.)+p/uSize*vec2(650.,548.);
  gl_Position=vec4(screen.x/720.*2.-1.,1.-screen.y/620.*2.,0.,1.);
 }`;
 const fragment=`
 precision highp float;varying vec2 vUV,vTailPoint;uniform sampler2D uTexture,uClosedTexture;uniform vec2 uSize;uniform float uMouth,uLayer,uBlink;
 uniform sampler2D uShadowTexture1,uShadowTexture2;
 uniform vec2 uShadowRoot1,uShadowOffset1,uShadowSize1,uShadowShift1;
 uniform vec2 uShadowRoot2,uShadowOffset2,uShadowSize2,uShadowShift2;
 uniform float uShadowAngle1,uShadowBlur1,uShadowOpacity1,uShadowAngle2,uShadowBlur2,uShadowOpacity2,uShadowCount,uLift,uBodyY;
 mat2 turn(float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c);}
 // Inverse-project the moving receiver into each moving caster's texture.
 // All shadow textures are existing tail textures; no per-frame image upload.
 float castShadow(sampler2D tex,vec2 root,vec2 offset,vec2 size,vec2 shift,float angle,float blur){
  vec2 point=vTailPoint-shift-vec2(0.,uBodyY+uLift*(root.y-550.)*.028);
  vec2 uv=(root+turn(-angle)*(point-root)-offset)/size;
  vec2 du=turn(-angle)*vec2(blur*.65,0.)/size,dv=turn(-angle)*vec2(0.,blur*.65)/size;
  float sum=0.;
  for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){
   float wx=x==0?6.:(abs(float(x))<1.5?4.:1.);
   float wy=y==0?6.:(abs(float(y))<1.5?4.:1.);
   vec2 q=uv+float(x)*du+float(y)*dv;
   float bounds=step(0.,q.x)*step(q.x,1.)*step(0.,q.y)*step(q.y,1.);
   sum+=texture2D(tex,q).a*wx*wy*bounds;
  }
  return sum/256.;
 }
 vec4 closingEye(vec4 color,vec2 p,vec2 center,float angle){
  vec2 q=turn(-angle)*(p-center);float mask=1.-smoothstep(.8,1.,length(q/vec2(65.,45.)));
  float height=max(.025,1.-uBlink*.97);vec2 source=vec2(q.x,q.y/height);
  vec4 iris=texture2D(uTexture,(center+turn(angle)*vec2(source.x,clamp(source.y,-36.,36.)))/uSize);
  vec4 fur=texture2D(uTexture,(center+turn(angle)*vec2(q.x*.2,-68.+q.y*.18))/uSize);
  vec4 narrowed=mix(fur,iris,1.-smoothstep(29.,36.,abs(source.y)));
  // Register only the reference eyelid to the existing eye. Never replace the face.
  vec2 referenceCenter=center.x<850.?vec2(770.,465.):vec2(967.,397.);
  vec4 closed=texture2D(uClosedTexture,(referenceCenter+turn(angle)*q)/uSize);
  narrowed=mix(narrowed,closed,smoothstep(.15,.95,uBlink));
  vec4 result=mix(color,narrowed,mask*smoothstep(0.,.12,uBlink));
  return vec4(result.rgb,color.a);
 }
 void main(){
  vec4 color=texture2D(uTexture,vUV);if(uLayer>.5){
   if(color.a>.004){
    if(uShadowCount>.5)color.rgb*=1.-uShadowOpacity1*castShadow(uShadowTexture1,uShadowRoot1,uShadowOffset1,uShadowSize1,uShadowShift1,uShadowAngle1,uShadowBlur1);
    if(uShadowCount>1.5)color.rgb*=1.-uShadowOpacity2*castShadow(uShadowTexture2,uShadowRoot2,uShadowOffset2,uShadowSize2,uShadowShift2,uShadowAngle2,uShadowBlur2);
   }
   gl_FragColor=color;return;
  }
  vec2 p=vUV*uSize;
  color=closingEye(color,p,vec2(798.,450.),-.35);
  color=closingEye(color,p,vec2(953.,397.),-.34);
  vec2 m=p-vec2(899.,476.);float height=1.+uMouth*10.;float ellipse=length(m/vec2(7.+uMouth*2.,height));
  float inside=(1.-smoothstep(.8,1.05,ellipse))*smoothstep(.05,.25,uMouth)*(1.-uBlink);
  color.rgb=mix(color.rgb,vec3(.7,.36,.46)*color.a,inside);gl_FragColor=color;
 }`;
 class FoxRig{
  constructor(canvas,image,tails,layout,closedImage){
   const gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:true});
   if(!gl)throw Error('当前设备无法启用连续动画，请更新显卡驱动后重试。');this.gl=gl;this.image=image;this.pose=null;
   const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
   const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);this.program=program;
   const cols=200,rows=170,uv=[],indices=[];
   for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++)uv.push(x/cols,y/rows);
   for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const a=y*(cols+1)+x,b=a+cols+1;indices.push(a,b,a+1,a+1,b,b+1);}
   gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(uv),gl.STATIC_DRAW);const attr=gl.getAttribLocation(program,'aUV');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
   gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);this.count=indices.length;
   const upload=img=>{const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);return tex;};
   this.bodyTexture=upload(image);this.tailTextures=tails.map(upload);gl.activeTexture(gl.TEXTURE1);this.closedTexture=upload(closedImage);gl.uniform1i(gl.getUniformLocation(program,'uClosedTexture'),1);gl.activeTexture(gl.TEXTURE0);
   this.tailBones=layout;this.occlusion=window.foxTailOcclusion;
   this.drawOrder=this.occlusion.order;this.shadowsEnabled=true;
   if(this.drawOrder.length!==9||new Set(this.drawOrder).size!==9||this.drawOrder.some(id=>!layout.some(b=>b.id===id)))throw Error('九条尾巴的编号或遮挡配置无效');
   this.uniforms={};for(const key of ['Size','Time','Blink','Pet','Lift','Head','EarL','EarR','Breath','BodyY','Sway','Mouth','Layer','TailRoot','TailTip','TailOffset','TailSize','TailAngle'])this.uniforms[key]=gl.getUniformLocation(program,'u'+key);
   for(const slot of [1,2]){
    gl.uniform1i(gl.getUniformLocation(program,'uShadowTexture'+slot),slot+1);gl.activeTexture(gl.TEXTURE0+slot+1);gl.bindTexture(gl.TEXTURE_2D,this.bodyTexture);
    for(const key of ['Root','Offset','Size','Shift','Angle','Blur','Opacity'])this.uniforms['Shadow'+key+slot]=gl.getUniformLocation(program,'uShadow'+key+slot);
   }gl.activeTexture(gl.TEXTURE0);this.uniforms.ShadowCount=gl.getUniformLocation(program,'uShadowCount');
   gl.uniform2f(this.uniforms.Size,image.width,image.height);gl.clearColor(0,0,0,0);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);this.vertexCount=uv.length/2;this.textureUploads=11;
   canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;});
  }
  render(pose,onlyTail){if(this.lost)throw Error('动画绘图连接已中断，请重新打开桌宠。');this.pose=pose;const gl=this.gl;gl.viewport(0,0,gl.canvas.width,gl.canvas.height);gl.clear(gl.COLOR_BUFFER_BIT);for(const [key,value] of Object.entries({Time:pose.time,Blink:pose.blink,Pet:pose.pet,Lift:pose.lift,Head:pose.head,EarL:pose.earLeft,EarR:pose.earRight,Breath:pose.breath,BodyY:pose.bodyY,Sway:pose.sway,Mouth:pose.mouth}))gl.uniform1f(this.uniforms[key],value);
   gl.uniform1f(this.uniforms.Layer,1);
   const angle=i=>pose.tailAngles?.[i]??window.foxTailMotion.angle(i,pose);
   for(const id of this.drawOrder){const i=this.tailBones.findIndex(b=>b.id===id);if(onlyTail!==undefined&&i!==onlyTail)continue;const bone=this.tailBones[i];
    const shadows=this.shadowsEnabled?this.occlusion.shadows.filter(s=>s.receiver===id):[];
    if(shadows.length>2)throw Error('单条尾巴的阴影来源超过两个');
    gl.uniform1f(this.uniforms.ShadowCount,shadows.length);
    shadows.forEach((shadow,n)=>{const slot=n+1,index=this.tailBones.findIndex(b=>b.id===shadow.caster),caster=this.tailBones[index];
     gl.activeTexture(gl.TEXTURE0+slot+1);gl.bindTexture(gl.TEXTURE_2D,this.tailTextures[index]);
     for(const [key,value] of Object.entries({Root:caster.root,Offset:caster.offset,Size:caster.size,Shift:shadow.offset}))gl.uniform2f(this.uniforms['Shadow'+key+slot],...value);
     gl.uniform1f(this.uniforms['ShadowAngle'+slot],angle(index));gl.uniform1f(this.uniforms['ShadowBlur'+slot],shadow.blur);gl.uniform1f(this.uniforms['ShadowOpacity'+slot],shadow.opacity);
    });
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.tailTextures[i]);
    gl.uniform2f(this.uniforms.TailRoot,...bone.root);gl.uniform2f(this.uniforms.TailTip,...bone.tip);gl.uniform2f(this.uniforms.TailOffset,...bone.offset);gl.uniform2f(this.uniforms.TailSize,...bone.size);gl.uniform1f(this.uniforms.TailAngle,angle(i));gl.drawElements(gl.TRIANGLES,this.count,gl.UNSIGNED_SHORT,0);
   }
   if(onlyTail!==undefined)return;
   gl.uniform1f(this.uniforms.Layer,0);gl.bindTexture(gl.TEXTURE_2D,this.bodyTexture);gl.drawElements(gl.TRIANGLES,this.count,gl.UNSIGNED_SHORT,0);
  }
 }
 window.foxRig={FoxRig};
})();
