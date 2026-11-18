import { spawn, execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { root,dataDirectory } from '../server/database.mjs';
import {APP_VERSION} from '../server/version.mjs';
import {createStartupLog} from './startup-log.mjs';

const port=Number(process.env.PROJECT_DESK_PORT || 4317);
if(!Number.isInteger(port)||port<1024||port>65535) throw new Error('PROJECT_DESK_PORT must be 1024–65535');
const url=`http://127.0.0.1:${port}`;
const expectedDatabase=resolve(dataDirectory,'project-desk.sqlite');
const normalize=path=>process.platform==='win32'?resolve(path).toLowerCase():resolve(path);
const probe=async()=>{try{
 const response=await fetch(`${url}/api/health`,{signal:AbortSignal.timeout(800)});if(!response.ok)return false;const health=await response.json();if(health.app!=='project-desk')return false;
 if(health.version!==APP_VERSION)throw Object.assign(Error('已有 PROJECT DESK 服务版本与当前程序不同。请先用该实例的 stop.bat 停止旧版服务，再启动当前版本；未打开或停止其他实例。'),{code:'WORKSPACE_MISMATCH'});
 const stateResponse=await fetch(`${url}/api/bootstrap`,{signal:AbortSignal.timeout(3000)});if(!stateResponse.ok)throw Object.assign(Error('已有服务无法确认工作区，请检查端口。'),{code:'WORKSPACE_MISMATCH'});const state=await stateResponse.json();
 if(typeof state.storage?.databasePath!=='string'||normalize(state.storage.databasePath)!==normalize(expectedDatabase))throw Object.assign(Error('端口已由其他 PROJECT DESK 工作区使用；未打开或停止该工作区。请使用不同端口，或先停止正确的实例。'),{code:'WORKSPACE_MISMATCH'});
 return true;
}catch(error){if(error.code==='WORKSPACE_MISMATCH')throw error;return false;}};
function openBrowser(){if(process.env.PROJECT_DESK_NO_BROWSER==='1')return;if(process.platform==='win32')execFile('rundll32.exe',['url.dll,FileProtocolHandler',url],error=>{if(error)console.log(`请手动打开 ${url}`);});}
if(await probe()){console.log(`已有 PROJECT DESK 服务：${url}`);openBrowser();}
else{
  const log=createStartupLog(resolve(root,'logs','server.log'));
  const child=spawn(process.execPath,[resolve(root,'server/index.mjs')],{cwd:root,windowsHide:true,stdio:['inherit','pipe','pipe']});
  for(const [stream,destination] of [[child.stdout,process.stdout],[child.stderr,process.stderr]])stream.on('data',chunk=>{destination.write(chunk);log.write(chunk);});
  child.on('error',error=>console.error(error));
  child.on('close',code=>{log.close();process.exitCode=code ?? 1;});
  let ready=false;
  try{for(let attempt=0;attempt<40;attempt++){if(child.exitCode!==null)break;if(await probe()){ready=true;break;}await new Promise(r=>setTimeout(r,150));}}
  catch(error){console.error(error.message);child.kill();process.exitCode=1;}
  if(ready){console.log(`运行日志：${log.path||'当前启动窗口（文件日志不可用）'}\n关闭此窗口或按 Ctrl+C 停止服务。`);openBrowser();}
  else{console.error(`启动失败，请查看当前窗口${log.path?'或 '+log.path:''}。端口可能被其他程序占用。`);child.kill();process.exitCode=1;}
  process.on('SIGINT',()=>child.kill('SIGINT'));
  process.on('SIGTERM',()=>child.kill('SIGTERM'));
}
