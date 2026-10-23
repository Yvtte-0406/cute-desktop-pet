const {app,nativeImage}=require('electron');const fs=require('node:fs'),path=require('node:path');
app.whenReady().then(()=>{
 const png=nativeImage.createFromPath(path.join(__dirname,'assets','fox.png')).crop({x:520,y:0,width:620,height:620}).resize({width:256,height:256}).toPNG();
 const ico=Buffer.alloc(22);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(png.length,14);ico.writeUInt32LE(22,18);
 fs.writeFileSync(path.join(__dirname,'assets','app.ico'),Buffer.concat([ico,png]));app.quit();
}).catch(e=>{console.error(e);app.exit(1);});
