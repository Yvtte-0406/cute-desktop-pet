const {app,BrowserWindow,ipcMain,screen,Tray,Menu,nativeImage,safeStorage,powerMonitor}=require('electron');
const fs=require('node:fs');const path=require('node:path');
app.setName('阿泠');
const {sizedBounds,MIN_SCALE}=require('./sizing.cjs');
const {normalizeTasks}=require('./todo-model.cjs');
const {dragPlacement}=require('./drag-window.cjs');
const {createAISettings}=require('./ai-settings.cjs');
const {AIReminders}=require('./ai-reminders.cjs');
const {reminderText}=require('./todo-model.cjs');
const {createReminderRuntime}=require('./reminder-runtime.cjs');
const {writeJSON}=require('./state-store.cjs');
let reminderRuntime,watchingOutside=false,bubbleWatchWanted=false;
function syncOutsideObserver(){watchingOutside=Boolean(bubbleWatchWanted&&win&&!win.isDestroyed()&&win.isVisible()&&!win.isMinimized());reminderRuntime?.observeClicks(watchingOutside);}
function watchOutside(enabled){bubbleWatchWanted=enabled===true;syncOutsideObserver();}
function outsideClick(){if(!watchingOutside||!win||win.isDestroyed()||!win.isVisible()||dragTimer)return;reminderRuntime.dismiss({collapseHud:true});watchOutside(false);win.webContents.send('reminders:outside-dismiss');}


// Preserve the development profile when launched as the packaged application.
app.setPath('userData',path.join(app.getPath('appData'),'white-fox-desktop-pet'));
// Keep Chromium's GPU compositor enabled for smooth animation.
if(process.argv.includes('--qa')){const qaProfile=path.join(__dirname,'qa',process.argv.includes('--plans')?'plans-profile-'+process.pid:process.argv.includes('--outside-click')?'outside-profile-'+process.pid:'profile');fs.mkdirSync(qaProfile,{recursive:true});app.setPath('userData',qaProfile);}
const smoke=process.argv.includes('--smoke-test');if(smoke)app.setPath('userData',path.join(app.getPath('temp'),'white-fox-smoke-profile'));
const aiSettings=createAISettings(app.getPath('userData'),safeStorage);
const aiStateFile=path.join(app.getPath('userData'),'ai-reminder-state.json');
const aiReminders=new AIReminders({readSettings:aiSettings.status,readKey:aiSettings.key,reminderText,
 loadState:()=>{try{return JSON.parse(fs.readFileSync(aiStateFile,'utf8'));}catch(e){if(e.code==='ENOENT')return {};throw e;}},
 saveState:state=>{fs.mkdirSync(path.dirname(aiStateFile),{recursive:true});writeJSON(aiStateFile,state);}});
function startupStatus(){if(!app.isPackaged)return {supported:false,enabled:false};const s=app.getLoginItemSettings({path:process.execPath,args:[]});const own=s.launchItems?.find(item=>item.name==='阿泠'&&item.scope==='user');return {supported:true,enabled:Boolean(own)||s.openAtLogin,willLaunch:own?own.enabled:s.executableWillLaunchAtLogin===true};}
function setStartup(enabled){if(!app.isPackaged||typeof enabled!=='boolean')throw Error('仅打包后的阿泠支持设置开机自启');app.setLoginItemSettings({openAtLogin:enabled,path:process.execPath,args:[],name:'阿泠'});const s=startupStatus();fs.writeFileSync(path.join(app.getPath('userData'),'startup-status.json'),JSON.stringify(s));return s;}
ipcMain.handle('startup:read',()=>startupStatus());ipcMain.handle('startup:save',(_,enabled)=>setStartup(enabled));
ipcMain.handle('ai:settings',()=>({...aiSettings.status(),usage:aiReminders.summary()}));
ipcMain.handle('ai:save',(_,input)=>{const result=aiSettings.save(input);aiReminders.reset();reminderRuntime?.changedSettings();return {...result,usage:aiReminders.summary()};});
ipcMain.handle('ai:poll',()=>aiReminders.poll(readTasks(),{enabled:readPreferences().reminders}));
ipcMain.handle('ai:preview',()=>aiReminders.poll(readTasks(),{preview:true}));
let win,tray,dragTimer; const preview=process.argv.includes('--preview'),qa=process.argv.includes('--qa');
const instanceAllowed=qa||smoke||app.requestSingleInstanceLock();app.on('second-instance',(_,args)=>{if(win&&!win.isDestroyed()){win.show();win.moveTop();if(args.includes('--enable-autostart'))setStartup(true);if(args.includes('--show-bubble-sample'))void showReminderPreview(true);if(args.includes('--show-reminder-preview'))void showReminderPreview();}});
let menuState={open:false,details:false},hitTimer,hitId=0,ignoreState=false,shapeEnabled=false;
function applyWindowScale(scale){
 const old=win.getBounds(),area=screen.getDisplayMatching(old).workArea,result=sizedBounds(scale,area,old);
 if(!preview)win.setBounds(result.bounds);
 return result;
}
async function showReminderPreview(sample=false){for(let i=0;i<100;i++){if(await win.webContents.executeJavaScript('Boolean(window.petQA?.snapshot().ready)'))break;await new Promise(r=>setTimeout(r,100));}const result=await win.webContents.executeJavaScript(sample?"petQA.showBubbleSample();({source:'sample'})":'petQA.previewReminder()');await new Promise(r=>setTimeout(r,500));const out=path.join(app.getPath('userData'),sample?'bubble-a2-status.json':'preview-result.json');fs.writeFileSync(out,JSON.stringify({source:result?.source,reason:result?.reason,automaticEnabled:aiSettings.status().enabled,usage:aiReminders.summary()},null,2));const rect=await win.webContents.executeJavaScript(`(()=>{const a=document.getElementById('bubble').getBoundingClientRect(),b=document.getElementById('pet').getBoundingClientRect(),x=Math.max(0,Math.floor(Math.min(a.x,b.x)-8)),y=Math.max(0,Math.floor(Math.min(a.y,b.y)-8));return {x,y,width:Math.min(innerWidth-x,Math.ceil(Math.max(a.right,b.right)-x+8)),height:Math.min(innerHeight-y,Math.ceil(Math.max(a.bottom,b.bottom)-y+8))};})()`);fs.writeFileSync(path.join(app.getPath('userData'),sample?'bubble-a2-live.png':'reminder-preview.png'),(await win.webContents.capturePage(rect)).toPNG());}
function ignoreMouse(ignore){if(preview||!win||win.isDestroyed()||ignore===ignoreState)return;ignoreState=ignore;win.setIgnoreMouseEvents(ignore,{forward:true});}
function startHitTesting(){if(preview)return;hitTimer=setInterval(()=>{if(!win||win.isDestroyed()||!win.isVisible())return;if(dragTimer){ignoreMouse(false);return;}const p=screen.getCursorScreenPoint(),b=win.getContentBounds();if(p.x<b.x||p.x>=b.x+b.width||p.y<b.y||p.y>=b.y+b.height){ignoreMouse(true);return;}win.webContents.send('hit:probe',{id:++hitId,x:p.x-b.x,y:p.y-b.y});},16);}
ipcMain.on('hit:result',(e,result)=>{if(shapeEnabled||e.sender!==win?.webContents||!result||result.id<hitId-3||dragTimer)return;ignoreMouse(!result.interactive);});
ipcMain.on('window:shape',(e,rects)=>{if(preview||e.sender!==win?.webContents||!Array.isArray(rects)||rects.length>15000)return;const valid=rects.filter(r=>[r.x,r.y,r.width,r.height].every(Number.isInteger)&&r.width>0&&r.height>0);if(valid.length){shapeEnabled=true;clearInterval(hitTimer);ignoreMouse(false);win.setShape(valid);}});
// Menus use space reserved at launch. Never resize or move the fox on right-click.
ipcMain.on('menu:state',(e,state)=>{if(e.sender!==win?.webContents||!state)return;menuState={open:Boolean(state.open),details:Boolean(state.details)};reminderRuntime?.menu(menuState.open);});
const dataFile=()=>path.join(app.getPath('userData'),'todos.json');
const preferencesFile=()=>path.join(app.getPath('userData'),'preferences.json');
function readPreferences(){try{const value=JSON.parse(fs.readFileSync(preferencesFile(),'utf8'));return {scale:Number.isFinite(value.scale)?Math.max(MIN_SCALE,Math.min(1.5,value.scale)):1,reminders:value.reminders!==false};}catch(e){if(e.code==='ENOENT')return {scale:1,reminders:true};throw e;}}
function savePreferences(value){fs.mkdirSync(path.dirname(preferencesFile()),{recursive:true});fs.writeFileSync(preferencesFile()+'.tmp',JSON.stringify(value));fs.renameSync(preferencesFile()+'.tmp',preferencesFile());return value;}
ipcMain.handle('preferences:read',()=>readPreferences());
ipcMain.handle('preferences:reminders',(_,enabled)=>{if(typeof enabled!=='boolean')throw Error('提醒设置不正确');aiReminders.nextDue=Date.now()+30*60000;aiReminders.lastScheduled='';const result=savePreferences({...readPreferences(),reminders:enabled});reminderRuntime?.changedSettings({remindersChanged:true});return result;});
ipcMain.handle('preferences:scale',(_,scale)=>{
 if(!Number.isFinite(scale))throw Error('大小必须为有效数值');
 stopDrag();const result=applyWindowScale(scale);
 savePreferences({...readPreferences(),scale:result.scale});
 return {scale:result.scale,maxScale:result.maxScale};
});
function startDrag(readCursor=()=>screen.getCursorScreenPoint()){stopDrag();const placement=dragPlacement(readCursor(),win.getBounds());dragTimer=setInterval(()=>{if(win.isDestroyed())return stopDrag();const bounds=placement(readCursor());if(bounds)win.setBounds(bounds);},16);}
function stopDrag(){clearInterval(dragTimer);dragTimer=null;}
function readTasks(){try{return normalizeTasks(JSON.parse(fs.readFileSync(dataFile(),'utf8')));}catch(e){if(e.code==='ENOENT')return [];throw e;}}
ipcMain.handle('tasks:read',()=>reminderRuntime?reminderRuntime.engine.list():readTasks());
ipcMain.handle('reminders:state',()=>reminderRuntime?.state());
ipcMain.handle('reminders:review',(_,id)=>reminderRuntime.review(id));
ipcMain.handle('reminders:ready',()=>{reminderRuntime?.ready();return reminderRuntime?.state();});
ipcMain.handle('tasks:upsert',(_,input)=>reminderRuntime.upsert(input));
ipcMain.handle('tasks:remove',(_,id)=>reminderRuntime.remove(id));
ipcMain.handle('tasks:action',(_,id,action,options)=>reminderRuntime.action(id,action,options));
ipcMain.handle('reminders:quiet',(_,until)=>reminderRuntime.quiet(until));
ipcMain.handle('reminders:shown',(_,token)=>reminderRuntime.shown(token));
ipcMain.handle('reminders:rewritten',(_,token)=>reminderRuntime.rewritten(token));
ipcMain.handle('reminders:dismiss',(_,options)=>reminderRuntime.dismiss(options));
ipcMain.handle('reminders:draft',(_,token,ui)=>reminderRuntime.draft(token,ui));
ipcMain.on('reminders:resume',()=>reminderRuntime?.resume());
ipcMain.on('reminders:pause',()=>reminderRuntime?.menu(true));
ipcMain.on('reminders:feedback-ended',()=>reminderRuntime?.releaseFeedback());
ipcMain.on('reminders:busy',(_,value)=>reminderRuntime?.busy(value));
ipcMain.on('reminders:watch-outside',(e,value)=>{if(e.sender===win?.webContents)watchOutside(value);});
ipcMain.on('drag:start',()=>{if(preview||qa)return;startDrag();});
ipcMain.on('drag:stop',stopDrag);ipcMain.on('app:quit',()=>app.quit());
app.whenReady().then(async()=>{if(!instanceAllowed){app.quit();return;}const area=screen.getPrimaryDisplay().workArea;win=new BrowserWindow({width:preview?860:440,height:preview?820:580,x:area.x+area.width-460,y:area.y+area.height-600,transparent:!preview,frame:preview,resizable:preview,alwaysOnTop:!preview,skipTaskbar:!preview,backgroundColor:preview?'#eae5df':'#00000000',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());win.on('blur',()=>{stopDrag();win.webContents.send('drag:cancel');});win.on('closed',stopDrag);if(!preview){const configured=sizedBounds(readPreferences().scale,area,win.getBounds());win.setBounds(configured.bounds);}for(const event of ['hide','show','minimize','restore'])win.on(event,syncOutsideObserver);reminderRuntime=createReminderRuntime({app,powerMonitor,win,readPreferences,legacy:readTasks(),aiReminders,aiSettings,onOutsideClick:outsideClick,isolated:qa||preview||smoke,isBusy:()=>menuState.open||Boolean(dragTimer)});await win.loadFile('index.html',{query:{preview:String(preview),qa:String(qa)}});startHitTesting();if(process.argv.includes('--enable-autostart'))setStartup(true);if(process.argv.includes('--show-bubble-sample'))void showReminderPreview(true);if(process.argv.includes('--show-reminder-preview'))void showReminderPreview();tray=new Tray(nativeImage.createFromPath(path.join(__dirname,'assets','fox.png')).resize({width:32,height:32}));tray.setToolTip('阿泠陪你工作');tray.setContextMenu(Menu.buildFromTemplate([{label:'显示桌宠',click:()=>win.show()},{label:'退出',click:()=>app.quit()}]));if(smoke){for(let i=0;i<200;i++){if(await win.webContents.executeJavaScript('Boolean(window.petQA?.snapshot().ready)'))break;await new Promise(r=>setTimeout(r,100));}const state=await win.webContents.executeJavaScript('petQA.snapshot()');const output=path.join(app.getPath('temp'),'white-fox-smoke.json');fs.writeFileSync(output,JSON.stringify({packaged:app.isPackaged,exe:process.execPath,ready:state.ready,errors:state.errors,tailCount:state.tailCount,bounds:win.getBounds()},null,2));app.exit(state.ready&&!state.errors.length?0:1);return;}if(qa){for(let i=0;i<200;i++){if(await win.webContents.executeJavaScript('Boolean(window.petQA?.snapshot().ready)'))break;await new Promise(r=>setTimeout(r,100));}if(process.argv.includes('--plans')){await require('./verify-simple.cjs')(win,reminderRuntime);app.quit();return;}if(process.argv.includes('--outside-click')){await require('./verify-outside.cjs')(win,reminderRuntime);app.quit();return;}if(process.argv.includes('--reminders')){await require('./verify-reading.cjs')(win,reminderRuntime);app.quit();return;}if(process.argv.includes('--window-drag')){await require('./verify-window-drag.cjs')(win,{start:startDrag,stop:stopDrag});app.quit();return;}if(process.argv.includes('--native-hit')){await require('./verify-native.cjs')(win,()=>({ignoreState,hitId,preview,bounds:win.getContentBounds()}));app.quit();return;}const out=path.join(__dirname,'qa');fs.mkdirSync(out,{recursive:true});const results=[];for(const state of ['idle','talk','pet','lift']){await win.webContents.executeJavaScript(`window.petQA.setState('${state}')`);await new Promise(r=>setTimeout(r,700));fs.writeFileSync(path.join(out,state+'.png'),(await win.webContents.capturePage()).toPNG());results.push(await win.webContents.executeJavaScript('window.petQA.snapshot()'));}await win.webContents.executeJavaScript("window.petQA.setState('idle')");await new Promise(r=>setTimeout(r,3500));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({states:results,performance:await win.webContents.executeJavaScript('window.petQA.snapshot()')},null,2));await require('./verify.cjs')(win);app.quit();}}).catch(error=>{if(qa){fs.mkdirSync(path.join(__dirname,'qa'),{recursive:true});fs.writeFileSync(path.join(__dirname,'qa','last-error.txt'),error.stack||String(error));}app.exit(1);});
app.on('window-all-closed',()=>app.quit());app.on('before-quit',()=>{reminderRuntime?.dispose();stopDrag();clearInterval(hitTimer);});
