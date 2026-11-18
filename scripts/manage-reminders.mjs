import {resolve} from 'node:path';
import {openDatabase,dataDirectory} from '../server/database.mjs';
import {windows,toastXml} from '../server/windows-reminders.mjs';
const action=process.argv[2]||'status',index=process.argv.indexOf('--data'),directory=index>=0?resolve(process.argv[index+1]):dataDirectory;
if(!['install','status','uninstall','run','test'].includes(action))throw Error('Unsupported command');
const {db,path}=openDatabase(directory);
try{const result=await windows(db,path,action==='test'?'toast':action,undefined,action==='test'?toastXml(path,[{title:'PROJECT DESK 桌面通知测试',route:'journal/reviews'}]):undefined);if(['install','uninstall'].includes(action))db.prepare("INSERT OR REPLACE INTO reminder_runtime VALUES('desktop_enabled',?)").run(action==='install'?'1':'0');console.log(JSON.stringify(result));}finally{db.close();}
