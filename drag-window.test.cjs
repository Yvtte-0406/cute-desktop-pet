const {test}=require('node:test'),assert=require('node:assert/strict');
const {dragPlacement}=require('./drag-window.cjs');
test('stationary held cursor does not repeatedly apply native window geometry',()=>{
 const update=dragPlacement({x:100,y:200},{x:30,y:40,width:382,height:606});
 for(let i=0;i<1000;i++)assert.equal(update({x:100,y:200}),null);
 assert.deepEqual(update({x:120,y:210}),{x:50,y:50,width:382,height:606});
 for(let i=0;i<1000;i++)assert.equal(update({x:120,y:210}),null);
});
test('drag uses absolute cursor displacement and captured size across moves and monitors',()=>{
 const cursor={x:100,y:200},bounds={x:30,y:40,width:382,height:606},update=dragPlacement(cursor,bounds);
 cursor.x=999;bounds.height=999;
 assert.deepEqual(update({x:140,y:190}),{x:70,y:30,width:382,height:606});
 assert.deepEqual(update({x:-140,y:-210}),{x:-210,y:-370,width:382,height:606});
 assert.deepEqual(update({x:100,y:200}),{x:30,y:40,width:382,height:606});
 const next=dragPlacement({x:20,y:30},{x:50,y:60,width:400,height:700});
 assert.deepEqual(next({x:21,y:32}),{x:51,y:62,width:400,height:700});
});
