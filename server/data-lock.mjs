import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {open,unlink,mkdir,readFile,stat,rename} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';

const wait=()=>new Promise(r=>setTimeout(r,100));
function busy(error){return [5,6].includes(error.errcode)||/database (?:table )?is locked/.test(error.message);}
async function legacyAvailable(path){
 let text,info;
 try{text=await readFile(path,'utf8');info=await stat(path);}catch(error){if(error.code==='ENOENT')return true;throw error;}
 let owner;try{owner=JSON.parse(text);}catch{}
 if(Number.isInteger(owner?.pid)&&owner.pid>0){
  try{process.kill(owner.pid,0);return false;}catch(error){if(error.code!=='ESRCH')return false;}
 }else if(Date.now()-info.mtimeMs<2000)return false;
 // Keep abandoned metadata for diagnosis. The exclusive mutex serializes reclaimers.
 await rename(path,path+'.abandoned-'+randomUUID());return true;
}
export async function withDataLock(databasePath,fn){
 const directory=dirname(databasePath),path=resolve(directory,'.reminder-data.lock');await mkdir(directory,{recursive:true});
 // Separate from the business DB: this OS lock survives a main-DB swap and is
 // released on process exit. No business tables or migrations change.
 const mutexPath=resolve(directory,'.reminder-data-mutex.sqlite');
 for(let attempt=0;attempt<100;attempt++){
  let mutex,held=false,handle,created=false,initialized=false;const token=randomUUID();
  try{
   mutex=new DatabaseSync(mutexPath);mutex.exec('PRAGMA busy_timeout=0;BEGIN EXCLUSIVE;');held=true;
   if(!await legacyAvailable(path))continue;
   try{handle=await open(path,'wx');created=true;}catch(error){if(error.code==='EEXIST')continue;throw error;}
   await handle.writeFile(JSON.stringify({pid:process.pid,token}));await handle.sync();initialized=true;
   return await fn();
  }catch(error){if(created||!busy(error))throw error;}
  finally{
   try{await handle?.close();if(created){let owner;try{owner=JSON.parse(await readFile(path,'utf8'));}catch{}if(!initialized||owner?.token===token)await unlink(path).catch(error=>{if(error.code!=='ENOENT')throw error;});}}
   finally{try{if(held)mutex.exec('ROLLBACK');}finally{mutex?.close();}}
   if(!created)await wait();
  }
 }
 throw Error('其他数据检查或恢复正在运行，请稍后重试。若持续出现，请检查 reminders 日志与锁持有者。');
}
