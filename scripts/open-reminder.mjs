import {resolve} from 'node:path';
import {mkdir,appendFile} from 'node:fs/promises';
import {spawn,execFile} from 'node:child_process';
import {root,dataDirectory} from '../server/database.mjs';
const arg=k=>{const i=process.argv.indexOf(k);return i>=0?process.argv[i+1]:undefined;};
const data=resolve(arg('--data')||dataDirectory),port=Number(arg('--port')||4317);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid port');
let route='journal/reviews';try{const u=new URL(arg('--uri'));const r=u.searchParams.get('route');if(r==='journal/reviews'||/^(projects|library)\/[a-zA-Z0-9-]+$/.test(r))route=r;}catch{}
const base=`http://127.0.0.1:${port}`;const ready=async()=>{try{const r=await fetch(base+'/api/bootstrap',{signal:AbortSignal.timeout(800)});return r.ok&&(await r.json()).storage.databasePath.toLowerCase()===resolve(data,'project-desk.sqlite').toLowerCase();}catch{return false;}};
if(!await ready()){const server=spawn(process.execPath,[resolve(root,'server/index.mjs')],{cwd:root,env:{...process.env,PROJECT_DESK_DATA_DIR:data,PROJECT_DESK_PORT:String(port)},detached:true,windowsHide:true,stdio:'ignore'});server.unref();for(let n=0;n<50&&!await ready();n++)await new Promise(r=>setTimeout(r,200));}
if(!await ready())throw Error('PROJECT DESK could not start. Port may be occupied.');await mkdir(resolve(data,'reminders'),{recursive:true});await appendFile(resolve(data,'reminders/activation.log'),JSON.stringify({at:new Date().toISOString(),route,port})+'\n');execFile('rundll32.exe',['url.dll,FileProtocolHandler',base+'/#'+route]);
