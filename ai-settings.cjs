const fs=require('node:fs'),path=require('node:path');
const {MODEL}=require('./ai-reminders.cjs');
const {writeJSON}=require('./state-store.cjs');
function createAISettings(folder,safeStorage){
 const file=path.join(folder,'ai-settings.json');
 function read(){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code==='ENOENT')return {enabled:false,dynamic:true};throw e;}}
 function status(){const s=read();return {enabled:s.enabled===true,hasKey:Boolean(s.key),dynamic:s.dynamic!==false,dailyLimit:s.dailyLimit||60,monthBudgetRMB:s.monthBudgetRMB??null,inputRMB:s.inputRMB??null,outputRMB:s.outputRMB??null,provider:'DeepSeek',model:MODEL,encryptionAvailable:safeStorage.isEncryptionAvailable()};}
 function save(input){
  const old=read(),next={...old};if(typeof input.enabled!=='boolean'||typeof input.dynamic!=='boolean')throw Error('设置内容不正确');
  if(input.removeKey){delete next.key;next.enabled=false;}else{
   if(typeof input.apiKey!=='string'||input.apiKey.length>512||/[\r\n]/.test(input.apiKey))throw Error('API Key格式不正确');
   const key=input.apiKey.trim();if(key){if(!safeStorage.isEncryptionAvailable())throw Error('系统加密暂不可用，未保存Key');next.key=safeStorage.encryptString(key).toString('base64');}
   next.enabled=input.enabled;next.dynamic=input.dynamic;
   if(next.enabled&&!next.key)throw Error('请先填写API Key');
  }
  for(const field of ['dailyLimit','monthBudgetRMB','inputRMB','outputRMB'])if(Object.hasOwn(input,field)){const value=input[field]===''||input[field]===null?null:Number(input[field]);if(value!==null&&(!Number.isFinite(value)||value<0))throw Error('额度或价格不正确');next[field]=value;}
  if(next.dailyLimit!=null&&(!Number.isInteger(next.dailyLimit)||next.dailyLimit<1||next.dailyLimit>1000))throw Error('每日上限应为1–1000次');
  if(next.monthBudgetRMB!=null&&(next.inputRMB==null||next.outputRMB==null))throw Error('设置月预算时请填写供应商输入和输出价格');
  writeJSON(file,next);return status();
 }
 function key(){const s=read();return s.key?safeStorage.decryptString(Buffer.from(s.key,'base64')):'';}
 return {status,save,key};
}
module.exports={createAISettings};
