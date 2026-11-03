'use strict';
const fs=require('node:fs'),path=require('node:path');
function readJSON(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
function writeJSON(file,value){
 fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.'+process.pid+'.tmp',data=JSON.stringify(value,null,2);let fd;
 try{fd=fs.openSync(temp,'w');fs.writeFileSync(fd,data,'utf8');fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;let last;for(let i=0;i<3;i++){try{fs.renameSync(temp,file);return;}catch(e){last=e;if(!['EPERM','EACCES','EBUSY'].includes(e.code))throw e;}}throw last;}
 finally{if(fd!==undefined)fs.closeSync(fd);try{fs.unlinkSync(temp);}catch(e){if(e.code!=='ENOENT')throw e;}}
}
module.exports={readJSON,writeJSON};
