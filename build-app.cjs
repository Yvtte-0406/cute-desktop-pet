const {spawnSync}=require('node:child_process');const path=require('node:path'),fs=require('node:fs');
function run(file,args){const result=spawnSync(file,args,{cwd:__dirname,stdio:'inherit',windowsHide:true});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);}
run(require('electron'),[path.join(__dirname,'build-icon.cjs')]);
run(process.execPath,[require.resolve('electron-builder/cli.js'),'--win','--dir']);
// This resource editor needs an ASCII filename on Windows.
const target=path.join(__dirname,'dist','win-unpacked',require('./package.json').build.productName+'.exe'),temporary=path.join(__dirname,'dist','win-unpacked','fox-icon.exe');
fs.copyFileSync(target,temporary);
run(path.join(__dirname,'node_modules','electron-winstaller','vendor','rcedit.exe'),[
 temporary,'--set-icon',path.join(__dirname,'assets','app.ico'),
 '--set-version-string','ProductName',require('./package.json').build.productName,'--set-version-string','FileDescription',require('./package.json').build.productName,
 '--set-file-version',require('./package.json').version,'--set-product-version',require('./package.json').version
]);
fs.copyFileSync(temporary,target);fs.unlinkSync(temporary);
