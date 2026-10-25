const {app,BrowserWindow,ipcMain,screen,Tray,Menu,nativeImage}=require('electron');
const fs=require('node:fs');const path=require('node:path');
const {sizedBounds,MIN_SCALE}=require('./sizing.cjs');
const {normalizeTasks}=require('./todo-model.cjs');

// Preserve the development profile when launched as the packaged application.
app.setPath('userData',path.join(app.getPath('appData'),'white-fox-desktop-pet'));
// Keep Chromium's GPU compositor enabled for smooth animation.
if(process.argv.includes('--qa')){const qaProfile=path.join(__dirname,'qa','profile');fs.mkdirSync(qaProfile,{recursive:true});app.setPath('userData',qaProfile);}
const smoke=process.argv.includes('--smoke-test');if(smoke)app.setPath('userData',path.join(app.getPath('temp'),'white-fox-smoke-profile'));
let win,tray,dragTimer,dragOrigin; const preview=process.argv.includes('--preview'),qa=process.argv.includes('--qa');
const instanceAllowed=qa||smoke||app.requestSingleInstanceLock();app.on('second-instance',()=>{if(win&&!win.isDestroyed()){win.show();win.moveTop();}});
let menuState={open:false,details:false},hitTimer,hitId=0,ignoreState=false,shapeEnabled=false;
function applyWindowScale(scale){
 const old=win.getBounds(),area=screen.getDisplayMatching(old).workArea,result=sizedBounds(scale,area,old);
 if(!preview)win.setBounds(result.bounds);
 return result;
}
function ignoreMouse(ignore){if(preview||!win||win.isDestroyed()||ignore===ignoreState)return;ignoreState=ignore;win.setIgnoreMouseEvents(ignore,{forward:true});}
function startHitTesting(){if(preview)return;hitTimer=setInterval(()=>{if(!win||win.isDestroyed()||!win.isVisible())return;if(dragTimer){ignoreMouse(false);return;}const p=screen.getCursorScreenPoint(),b=win.getContentBounds();if(p.x<b.x||p.x>=b.x+b.width||p.y<b.y||p.y>=b.y+b.height){ignoreMouse(true);return;}win.webContents.send('hit:probe',{id:++hitId,x:p.x-b.x,y:p.y-b.y});},16);}
ipcMain.on('hit:result',(e,result)=>{if(shapeEnabled||e.sender!==win?.webContents||!result||result.id<hitId-3||dragTimer)return;ignoreMouse(!result.interactive);});
ipcMain.on('window:shape',(e,rects)=>{if(preview||e.sender!==win?.webContents||!Array.isArray(rects)||rects.length>15000)return;const valid=rects.filter(r=>[r.x,r.y,r.width,r.height].every(Number.isInteger)&&r.width>0&&r.height>0);if(valid.length){shapeEnabled=true;clearInterval(hitTimer);ignoreMouse(false);win.setShape(valid);}});
// Menus use space reserved at launch. Never resize or move the fox on right-click.
ipcMain.on('menu:state',(e,state)=>{if(e.sender!==win?.webContents||!state)return;menuState={open:Boolean(state.open),details:Boolean(state.details)};});
const dataFile=()=>path.join(app.getPath('userData'),'todos.json');
const preferencesFile=()=>path.join(app.getPath('userData'),'preferences.json');
function readPreferences(){try{const value=JSON.parse(fs.readFileSync(preferencesFile(),'utf8'));return {scale:Number.isFinite(value.scale)?Math.max(MIN_SCALE,Math.min(1.5,value.scale)):1,reminders:value.reminders!==false};}catch(e){if(e.code==='ENOENT')return {scale:1,reminders:true};throw e;}}
function savePreferences(value){fs.mkdirSync(path.dirname(preferencesFile()),{recursive:true});fs.writeFileSync(preferencesFile()+'.tmp',JSON.stringify(value));fs.renameSync(preferencesFile()+'.tmp',preferencesFile());return value;}
ipcMain.handle('preferences:read',()=>readPreferences());
ipcMain.handle('preferences:reminders',(_,enabled)=>{if(typeof enabled!=='boolean')throw Error('提醒设置不正确');return savePreferences({...readPreferences(),reminders:enabled});});
ipcMain.handle('preferences:scale',(_,scale)=>{
 if(!Number.isFinite(scale))throw Error('大小必须为有效数值');
 stopDrag();const result=applyWindowScale(scale);
 savePreferences({...readPreferences(),scale:result.scale});
 return {scale:result.scale,maxScale:result.maxScale};
});
function stopDrag(){clearInterval(dragTimer);dragTimer=null;}
function readTasks(){try{return normalizeTasks(JSON.parse(fs.readFileSync(dataFile(),'utf8')));}catch(e){if(e.code==='ENOENT')return [];throw e;}}
ipcMain.handle('tasks:read',()=>readTasks());
ipcMain.handle('tasks:save',(_,items)=>{const normalized=normalizeTasks(items);fs.mkdirSync(path.dirname(dataFile()),{recursive:true});fs.writeFileSync(dataFile()+'.tmp',JSON.stringify(normalized,null,2),'utf8');fs.renameSync(dataFile()+'.tmp',dataFile());});
ipcMain.on('drag:start',()=>{if(preview||qa)return;stopDrag();const p=screen.getCursorScreenPoint(),b=win.getBounds();dragOrigin={x:p.x,y:p.y,wx:b.x,wy:b.y};dragTimer=setInterval(()=>{if(win.isDestroyed())return stopDrag();const q=screen.getCursorScreenPoint();win.setPosition(dragOrigin.wx+q.x-dragOrigin.x,dragOrigin.wy+q.y-dragOrigin.y);},16);});
ipcMain.on('drag:stop',stopDrag);ipcMain.on('app:quit',()=>app.quit());
app.whenReady().then(async()=>{if(!instanceAllowed){app.quit();return;}const area=screen.getPrimaryDisplay().workArea;win=new BrowserWindow({width:preview?860:440,height:preview?820:580,x:area.x+area.width-460,y:area.y+area.height-600,transparent:!preview,frame:preview,resizable:preview,alwaysOnTop:!preview,skipTaskbar:!preview,backgroundColor:preview?'#eae5df':'#00000000',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());win.on('blur',()=>{stopDrag();win.webContents.send('drag:cancel');});win.on('closed',stopDrag);if(!preview){const configured=sizedBounds(readPreferences().scale,area,win.getBounds());win.setBounds(configured.bounds);}await win.loadFile('index.html',{query:{preview:String(preview),qa:String(qa)}});startHitTesting();tray=new Tray(nativeImage.createFromPath(path.join(__dirname,'assets','fox.png')).resize({width:32,height:32}));tray.setToolTip('阿泠陪你工作');tray.setContextMenu(Menu.buildFromTemplate([{label:'显示桌宠',click:()=>win.show()},{label:'退出',click:()=>app.quit()}]));if(smoke){for(let i=0;i<200;i++){if(await win.webContents.executeJavaScript('Boolean(window.petQA?.snapshot().ready)'))break;await new Promise(r=>setTimeout(r,100));}const state=await win.webContents.executeJavaScript('petQA.snapshot()');const output=path.join(app.getPath('temp'),'white-fox-smoke.json');fs.writeFileSync(output,JSON.stringify({packaged:app.isPackaged,exe:process.execPath,ready:state.ready,errors:state.errors,tailCount:state.tailCount,bounds:win.getBounds()},null,2));app.exit(state.ready&&!state.errors.length?0:1);return;}if(qa){for(let i=0;i<200;i++){if(await win.webContents.executeJavaScript('Boolean(window.petQA?.snapshot().ready)'))break;await new Promise(r=>setTimeout(r,100));}if(process.argv.includes('--native-hit')){await require('./verify-native.cjs')(win,()=>({ignoreState,hitId,preview,bounds:win.getContentBounds()}));app.quit();return;}const out=path.join(__dirname,'qa');fs.mkdirSync(out,{recursive:true});const results=[];for(const state of ['idle','talk','pet','lift']){await win.webContents.executeJavaScript(`window.petQA.setState('${state}')`);await new Promise(r=>setTimeout(r,700));fs.writeFileSync(path.join(out,state+'.png'),(await win.webContents.capturePage()).toPNG());results.push(await win.webContents.executeJavaScript('window.petQA.snapshot()'));}await win.webContents.executeJavaScript("window.petQA.setState('idle')");await new Promise(r=>setTimeout(r,3500));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({states:results,performance:await win.webContents.executeJavaScript('window.petQA.snapshot()')},null,2));await require('./verify.cjs')(win);app.quit();}}).catch(error=>{if(qa){fs.mkdirSync(path.join(__dirname,'qa'),{recursive:true});fs.writeFileSync(path.join(__dirname,'qa','last-error.txt'),error.stack||String(error));}app.exit(1);});
app.on('window-all-closed',()=>app.quit());app.on('before-quit',()=>{stopDrag();clearInterval(hitTimer);});
