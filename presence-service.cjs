'use strict';
const {spawn,execFile}=require('node:child_process'),path=require('node:path');
const {PresenceModel}=require('./presence-model.cjs');
function readPowerSettings(){return new Promise(resolve=>execFile('powercfg.exe',['/qh','SCHEME_CURRENT'],{windowsHide:true,timeout:10000,maxBuffer:2*1024*1024},(error,stdout)=>{
 if(error)return resolve({available:false,error:'无法读取电源设置'});
 const values={};for(const [name,guid] of Object.entries({display:'3c0bc021-c8a8-4e07-a973-6b14cbcb2b7e',sleep:'29f6c1db-86da-48c5-9fdb-f2b67b1f44da',wakePassword:'0e796bdb-100d-47d6-a2d5-f7d2daa51f51'})){
  const index=stdout.toLowerCase().indexOf(guid),section=index<0?'':stdout.slice(index).split(/\r?\n[^\r\n]*GUID:\s*[0-9a-f]{8}-/i)[0],hex=[...section.matchAll(/0x([0-9a-f]+)/gi)].map(m=>parseInt(m[1],16));if(hex.length>=2)values[name]={ac:hex[hex.length-2],battery:hex[hex.length-1]};
 }resolve({available:Object.keys(values).length>0,values,readAt:Date.now(),autoLockSeconds:null});
}));}
function createPresence({app,powerMonitor,onChange=()=>{},onOutsideClick=()=>{},isolated=false}){
 const model=new PresenceModel(),listeners=[];let helper,timer,refresh,buffer='',disposed=false,helperStatus='starting',settings={available:false},battery=false,observing=false,clickObserverActive=false;
 function command(){if(helper?.stdin?.writable&&!helper.stdin.destroyed)helper.stdin.write(observing?'observe:1\n':'observe:0\n');}
 function listen(event,fn){powerMonitor.on(event,fn);listeners.push([event,fn]);}
 function sample(){try{const state=powerMonitor.getSystemIdleState(180);model.sample(powerMonitor.getSystemIdleTime(),state==='locked'?true:state==='active'||state==='idle'?false:undefined);}catch{}onChange();}
 async function read(){settings=await readPowerSettings();try{battery=powerMonitor.isOnBatteryPower();}catch{}onChange();}
 if(isolated){model.sample(0,false);model.event('display','on');helperStatus='isolated';}
 else{
  listen('lock-screen',()=>{model.event('lock');onChange();});listen('unlock-screen',()=>{model.event('unlock');sample();});listen('suspend',()=>{model.event('suspend');onChange();});listen('resume',()=>{model.event('resume');sample();void read();});
  for(const event of ['on-ac','on-battery'])listen(event,()=>void read());
  sample();void read();timer=setInterval(sample,10000);refresh=setInterval(()=>void read(),300000);
  const executable=app.isPackaged?path.join(process.resourcesPath,'presence-helper.exe'):path.join(__dirname,'native','presence-helper.exe');
  function start(){if(disposed)return;helper=spawn(executable,[String(process.pid)],{windowsHide:true,stdio:['pipe','pipe','pipe']});helper.stdin.on('error',()=>{clickObserverActive=false;});helper.stdout.setEncoding('utf8');helper.stdout.on('data',chunk=>{buffer+=chunk;if(buffer.length>65536)buffer='';let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);try{const event=JSON.parse(line);if(event.type==='lock')model.event(event.value?'lock':'unlock');if(event.type==='display')model.event('display',event.value);if(event.type==='ready'){helperStatus=event.value.display&&event.value.session?'ready':'partial';command();}if(event.type==='click-observer')clickObserverActive=event.value===true;if(event.type==='outside-click'){if(observing&&event.value===true)onOutsideClick();continue;}onChange();}catch{}}});helper.on('error',()=>{helperStatus='unavailable';clickObserverActive=false;model.event('display','unknown');});helper.on('exit',()=>{helperStatus='unavailable';model.event('display','unknown');if(!disposed)setTimeout(start,30000).unref();});helper.stderr.resume();}
  start();
 }
 return {observeClicks(enabled){if(observing===(enabled===true))return;observing=enabled===true;if(isolated)clickObserverActive=observing;else command();},snapshot:()=>model.snapshot(),status:()=>({...model.snapshot(),helperStatus,powerSettings:settings,onBattery:battery,clickObserverActive}),dispose(){disposed=true;observing=false;command();clearInterval(timer);clearInterval(refresh);for(const [e,fn]of listeners)powerMonitor.removeListener(e,fn);helper?.kill();},testEvent:(name,value)=>{if(isolated){if(name==='outside-click'){if(observing)onOutsideClick();return;}if(name==='test-active'){model.locked=false;model.suspended=false;model.waitingInput=false;model.awaySeen=false;model.settleUntil=0;model.display='on';model.sample(0,false);}else model.event(name,value);onChange();}}};
}
module.exports={createPresence,readPowerSettings};
