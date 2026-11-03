const {app}=require('electron'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
module.exports=async(win,runtime)=>{
 const evaluate=s=>win.webContents.executeJavaScript(s),sleep=ms=>new Promise(r=>setTimeout(r,ms)),checks={},out=path.join(__dirname,'qa');
 assert.equal(path.resolve(app.getPath('userData')),path.resolve(path.join(out,'plans-profile-'+process.pid)));assert.equal(runtime.engine.list().length,0);
 const wait=async(fn,label)=>{for(let i=0;i<70;i++){if(await fn()){await sleep(200);return;}await sleep(100);}throw Error(label);};
 async function capture(name){await evaluate(`petQA.openMenu('todos');document.getElementById('panel').scrollTop=0`);await sleep(350);await evaluate(`petQA.openMenu('todos')`);fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG());}
 try{
 await evaluate(`petQA.openMenu('todos')`);
 checks.defaultList=await evaluate(`!document.getElementById('todo-list-page').hidden&&document.getElementById('todo-add-page').hidden`);
 await evaluate(`document.querySelector('[data-todo-page=add]').click()`);
 checks.separateEditor=await evaluate(`document.getElementById('todo-list-page').hidden&&!document.getElementById('todo-add-page').hidden`);
 checks.threeFields=await evaluate(`Array.from(document.querySelectorAll('#form input')).filter(e=>!e.hidden).length===3&&!document.querySelector('[data-content=todos] select')&&!document.querySelector('[data-content=todos] details')`);
 await capture('simple-add');checks.addButtonFits=await evaluate(`document.getElementById('task-save').getBoundingClientRect().bottom<=document.getElementById('panel').getBoundingClientRect().bottom-8`);
 await evaluate(`document.getElementById('task').value='校园跑';document.getElementById('task-daily').click();document.getElementById('form').requestSubmit()`);
 await wait(async()=>runtime.engine.list().length===1,'create daily');const daily=runtime.engine.list()[0];checks.dailyCreated=daily.cadence==='daily'&&daily.dailyTime==='09:00';checks.savedToList=await evaluate(`!document.getElementById('todo-list-page').hidden&&document.getElementById('todo-add-page').hidden`);
 runtime.action(daily.id,'complete',{});await sleep(200);
 checks.completedInline=await evaluate(`document.getElementById('tasks').textContent.includes('今日已完成')&&!document.querySelector('[data-content=todos] summary')`);
 checks.onlyTwoActions=await evaluate(`JSON.stringify(Array.from(document.querySelectorAll('#tasks button')).map(b=>b.textContent))===JSON.stringify(['修改','删除'])`);
 await evaluate(`document.querySelector('#tasks button').click()`);checks.editValues=await evaluate(`!document.getElementById('todo-add-page').hidden&&document.getElementById('task').value==='校园跑'&&document.getElementById('task-daily').checked`);
 await evaluate(`document.getElementById('task').value='校园跑两公里';document.getElementById('form').requestSubmit()`);await wait(async()=>runtime.engine.list()[0].text==='校园跑两公里','edit daily');checks.completionPreserved=runtime.engine.list()[0].dailyCompleted;
 await evaluate(`document.querySelector('[data-todo-page=add]').click();document.getElementById('task').value='概率论作业';document.getElementById('deadline').value='2026-11-06T23:00';document.getElementById('form').requestSubmit()`);await wait(async()=>runtime.engine.list().length===2,'single');checks.singleDeadline=Boolean(runtime.engine.list()[1].deadline);
 await capture('simple-list');checks.noExtraCopy=await evaluate(`!['已结束 / 旧记录','安静30分钟','更多选项','普通提醒正常','撤销今日完成'].some(text=>document.querySelector('[data-content=todos]').textContent.includes(text))`);
 await evaluate(`Array.from(document.querySelectorAll('#tasks li')).find(e=>e.textContent.includes('概率论作业')).querySelectorAll('button')[1].click()`);await wait(async()=>runtime.engine.list().length===1,'delete single');checks.deleteWorks=true;
 const errors=await evaluate(`petQA.snapshot().errors`);checks.noRendererErrors=!errors.length;assert(Object.values(checks).every(Boolean),JSON.stringify(checks));fs.writeFileSync(path.join(out,'simple-report.json'),JSON.stringify({passed:true,checks,errors},null,2));
 }catch(error){fs.writeFileSync(path.join(out,'simple-report.json'),JSON.stringify({passed:false,checks,error:error.stack},null,2));throw error;}
};
