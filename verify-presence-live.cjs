const {app,powerMonitor}=require('electron'),fs=require('node:fs'),path=require('node:path');
app.setPath('userData',path.join(__dirname,'qa','presence-profile'));
app.whenReady().then(()=>{const service=require('./presence-service.cjs').createPresence({app,powerMonitor});setTimeout(()=>{const status=service.status();fs.writeFileSync(path.join(__dirname,'qa','presence-live.json'),JSON.stringify(status,null,2));service.dispose();app.exit(status.helperStatus==='ready'&&status.powerSettings.available?0:1);},8000);});
