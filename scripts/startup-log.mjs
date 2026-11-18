import {mkdirSync,openSync,writeSync,closeSync} from 'node:fs';
import {dirname} from 'node:path';

// File logging is optional. A denied/open/full/busy log must not prevent startup
// or turn a healthy server's stdout/stderr into an unhandled exception.
export function createStartupLog(path,{mkdir=mkdirSync,open=openSync,write=writeSync,close=closeSync,warn=console.error}={}){
 let fd=null,disabled=false;
 function disable(error){
  if(fd!==null){try{close(fd);}catch{}fd=null;}
  if(disabled)return;disabled=true;
  warn(`文件日志不可用（${error.code||error.message}）：${path}\n服务仍可运行，日志将继续显示在当前启动窗口；未修改权限或旧日志。`);
 }
 try{mkdir(dirname(path),{recursive:true});fd=open(path,'a');}catch(error){disable(error);}
 return {
  get path(){return fd===null?null:path;},
  write(chunk){
   if(fd===null)return;
   try{const buffer=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);let offset=0;
    while(offset<buffer.length){const count=write(fd,buffer,offset,buffer.length-offset);if(!count)throw Object.assign(Error('Log write made no progress'),{code:'EIO'});offset+=count;}
   }catch(error){disable(error);}
  },
  close(){if(fd===null)return;try{close(fd);fd=null;}catch(error){disable(error);}}
 };
}
