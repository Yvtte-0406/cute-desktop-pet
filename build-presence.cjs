const {execFileSync}=require('node:child_process'),path=require('node:path'),fs=require('node:fs');
const compiler=path.join(process.env.WINDIR||'C:/Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe');
if(process.platform!=='win32'||!fs.existsSync(compiler))throw Error('构建Windows状态助手需要.NET Framework C#编译器');
execFileSync(compiler,['/nologo','/target:exe','/reference:System.Windows.Forms.dll','/out:'+path.join(__dirname,'native','presence-helper.exe'),path.join(__dirname,'native','PresenceHelper.cs')],{windowsHide:true,stdio:'inherit'});
