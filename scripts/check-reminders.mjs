import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {appendFile,mkdir} from 'node:fs/promises';
import {openDatabase,dataDirectory} from '../server/database.mjs';
import {deliver} from '../server/reminders.mjs';
import {windows,toastXml} from '../server/windows-reminders.mjs';
import {withDataLock} from '../server/data-lock.mjs';
const idx=process.argv.indexOf('--data'),data=idx>=0?resolve(process.argv[idx+1]):dataDirectory;
if(!existsSync(resolve(data,'project-desk.sqlite'))){console.error('提醒数据库不存在；未创建空白数据库。请从当前项目重新安装任务。');process.exit(2);}
await mkdir(resolve(data,'reminders'),{recursive:true});
try{const result=await withDataLock(resolve(data,'project-desk.sqlite'),async()=>{const {db,path}=openDatabase(data);try{const row=db.prepare("SELECT value FROM reminder_runtime WHERE key='desktop_enabled'").get();if(row?.value!=='1')return {count:0,disabled:true};return await deliver(db,items=>windows(db,path,'toast',undefined,toastXml(path,items)));}finally{db.close();}});await appendFile(resolve(data,'reminders/checker.log'),JSON.stringify({at:new Date().toISOString(),...result})+'\n');console.log(JSON.stringify(result));}catch(e){await appendFile(resolve(data,'reminders/checker.log'),JSON.stringify({at:new Date().toISOString(),error:e.message})+'\n');console.error(e.message);process.exitCode=1;}
