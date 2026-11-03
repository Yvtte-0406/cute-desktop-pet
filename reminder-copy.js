(function(root){
 function hash(value){let n=0;for(const c of value)n=(n*31+c.charCodeAt(0))>>>0;return n;}
 function line(task,now=Date.now()){
  const name=(task.text.length>36?task.text.slice(0,35)+'…':task.text),left=task.deadline?Date.parse(task.deadline)-now:Infinity,index=hash(task.id+':'+(task.key||''));
  let choices;
  if(left<=0)choices=['喂喂，'+name+'的截止时间已经过啦，可别把它落下！','爪爪轻敲！'+name+'已经到时间了，这件要记牢哦。'];
  else if(left<=3600000)choices=['喂喂，'+name+'快到时间啦！这件可不能忘。','爪爪敲敲～'+name+'快截止了，才不是我爱操心呢！'];
  else choices=['哼，'+name+'还等着你呢，可别忘啦～','爪爪轻敲～记得'+name+'哦，才不是我一直惦记着呢！','偷偷探头：'+name+'也要记着哦～'];
  return choices[index%choices.length];
 }
 function feedback(action){return {working:'好嘛，那我乖乖陪着，先不催你啦～',snooze:'哼，记住啦！到时候爪爪再来敲敲～',complete:'拿下啦！哼哼，我就知道你可以～',undo:'好嘛，把它放回来啦，我替你记着～'}[action]||'';}
 const copy={line,feedback};if(typeof module!=='undefined')module.exports=copy;else root.foxReminderCopy=copy;
})(typeof window!=='undefined'?window:globalThis);
