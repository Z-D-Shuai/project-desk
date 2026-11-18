import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,copyFile,rename,rm,utimes,readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,basename,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {openDatabase,readSettings} from '../server/database.mjs';
import {prepareRestore} from '../server/restore-state.mjs';
import {createProject,getProject} from '../server/projects.mjs';
import {readLibrary,saveResource} from '../server/library.mjs';
import * as S from '../server/storage.mjs';
import {createApp} from '../server/index.mjs';
import {getFile,objectPath} from '../server/file-paths.mjs';
import {withDataLock} from '../server/data-lock.mjs';
import {execFile,spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';

async function fixture(){const dir=await mkdtemp(resolve(tmpdir(),'desk-release-')),data=resolve(dir,'data');const f={dir,data,...openDatabase(data)};await S.initializeStorage(f.db,f.path);return f;}
async function dispose(f){f.db?.close();assert.ok(f.dir.startsWith(resolve(tmpdir())+sep)&&basename(f.dir).startsWith('desk-release-'));await rm(f.dir,{recursive:true,force:true});}

test('R01: zero-byte reference GET/HEAD/Range leave the service and records usable',async()=>{
 const f=await fixture();let server;
 try{const p=createProject(f.db,{name:'Preserved',progress:37}),source=resolve(f.dir,'reference.txt');await writeFile(source,'before');const item=(await S.importPaths(f.db,f.path,{paths:[source],mode:'reference',project_ids:[p.id]})).results[0];assert.equal(item.ok,true);const resource=readLibrary(f.db).resources.find(r=>r.id===item.id);await writeFile(source,'');server=createApp({db:f.db,databasePath:f.path});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const get=await fetch(base+'/api/assets/'+resource.asset_id);assert.equal(get.status,200);assert.equal(get.headers.get('content-length'),'0');assert.equal(await get.text(),'');
  const head=await fetch(base+'/api/assets/'+resource.asset_id,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),'0');assert.equal(await head.text(),'');
  const range=await fetch(base+'/api/assets/'+resource.asset_id,{headers:{Range:'bytes=0-'}});assert.equal(range.status,416);assert.equal(range.headers.get('content-range'),'bytes */0');assert.equal((await fetch(base+'/api/health')).status,200);assert.equal(getProject(f.db,p.id).progress,37);
 }finally{if(server)await new Promise(r=>server.close(r));await dispose(f);}
});

test('R02: durable restore states recover a verified workspace; legacy gaps never seed a blank DB',async t=>{
 for(const stage of ['prepared','previous-moved','candidate-installed','staged-only','legacy-gap'])await t.test(stage,async()=>{
  const f=await fixture();try{createProject(f.db,{name:'Original'});f.db.prepare("INSERT INTO settings VALUES('theme','dark')").run();const candidate=openDatabase(resolve(f.dir,'candidate'));createProject(candidate.db,{name:'Restored'});candidate.db.close();const id=randomUUID(),old=resolve(f.data,'before-restore-'+id+'.sqlite'),staged=resolve(f.data,'restore-'+id+'.sqlite');await copyFile(candidate.path,staged);f.db.exec('PRAGMA wal_checkpoint(TRUNCATE);PRAGMA journal_mode=DELETE;');f.db.close();f.db=null;
   if(stage!=='legacy-gap')prepareRestore(f.path,old,staged);
   if(stage!=='prepared')await rename(f.path,old);
   if(stage==='candidate-installed')await rename(staged,f.path);
   if(stage==='staged-only')await rm(old);
   if(stage==='legacy-gap'){const original=await readFile(old);assert.throws(()=>openDatabase(f.data),/未创建空数据库/);assert.equal(existsSync(f.path),false);assert.deepEqual(await readFile(old),original);return;}
   f.db=openDatabase(f.data).db;const names=f.db.prepare('SELECT name FROM projects').all().map(p=>p.name);assert.deepEqual(names,[['candidate-installed','staged-only'].includes(stage)?'Restored':'Original']);if(!['candidate-installed','staged-only'].includes(stage))assert.equal(readSettings(f.db).theme,'dark');assert.equal(f.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(existsSync(resolve(f.data,'.restore-state.json')),false);assert.ok(existsSync(staged)||['candidate-installed','staged-only'].includes(stage));
  }finally{await dispose(f);}
 });
});


test('R03: alternate recycle restore updates shared/nested project paths and keeps newer associations',async()=>{
 const f=await fixture();try{const original=resolve(f.data,'projects/work'),nested=resolve(original,'nested');await mkdir(nested,{recursive:true});await writeFile(resolve(nested,'work.txt'),'PROJECT-WORK');
  const p=createProject(f.db,{name:'Owner'}),q=createProject(f.db,{name:'Nested owner'});await S.projectFolder(f.db,p.id,{path:original,revision:p.revision});await S.projectFolder(f.db,q.id,{path:nested,revision:q.revision});
  const recycled=await S.trashNode(f.db,f.path,{root_id:'projects',path:'work',acknowledge_usage:true});await mkdir(original);await writeFile(resolve(original,'unrelated.txt'),'UNRELATED');const newer=createProject(f.db,{name:'New owner'});await S.projectFolder(f.db,newer.id,{path:original,revision:newer.revision});
  await S.restoreTrash(f.db,f.path,recycled.id,{type:'file',path:'restored'});assert.equal(getProject(f.db,p.id).folder_path,resolve(f.data,'projects/restored'));assert.equal(getProject(f.db,q.id).folder_path,resolve(f.data,'projects/restored/nested'));assert.equal(getProject(f.db,newer.id).folder_path,original);assert.equal(await readFile(resolve(original,'unrelated.txt'),'utf8'),'UNRELATED');assert.equal(await readFile(resolve(f.data,'projects/restored/nested/work.txt'),'utf8'),'PROJECT-WORK');assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{await dispose(f);}
});

test('R04: dedup verifies current bytes for resource reuse and explicit asset replacement',async()=>{
 const f=await fixture();try{const source=resolve(f.dir,'original.txt');await writeFile(source,'CONTENT-A');const first=(await S.importPaths(f.db,f.path,{paths:[source],mode:'managed'})).results[0];assert.equal(first.ok,true);const oldPath=await objectPath(f.db,f.path,getFile(f.db,first.file_id));await writeFile(oldPath,'CONTENT-B');
  const second=(await S.importPaths(f.db,f.path,{paths:[source],mode:'managed'})).results[0];assert.equal(second.ok,true);assert.equal(second.duplicate,false);assert.notEqual(second.file_id,first.file_id);assert.equal(await readFile(await objectPath(f.db,f.path,getFile(f.db,second.file_id)),'utf8'),'CONTENT-A');assert.equal(await readFile(oldPath,'utf8'),'CONTENT-B');assert.equal((await S.importPaths(f.db,f.path,{paths:[source],mode:'managed'})).results[0].duplicate,true);
  await writeFile(source,'CONTENT-C');const r=saveResource(f.db,null,{title:'Explicit file',kind:'file',favorite:false}),a=await S.attachFile(f.db,f.path,{source,filename:'explicit.txt',resource:r});const changed=await objectPath(f.db,f.path,getFile(f.db,a.file_id));await writeFile(changed,'CONTENT-D');const next=saveResource(f.db,null,{title:'Next file',kind:'file',favorite:false}),b=await S.attachFile(f.db,f.path,{source,filename:'next.txt',resource:next});assert.notEqual(a.file_id,b.file_id);assert.equal(await readFile(await objectPath(f.db,f.path,getFile(f.db,b.file_id)),'utf8'),'CONTENT-C');assert.equal(await readFile(changed,'utf8'),'CONTENT-D');
 }finally{await dispose(f);}
});

test('R05: launch reuses only the expected workspace and leaves another workspace running',async()=>{
 const f=await fixture();let server;try{server=createApp({db:f.db,databasePath:f.path});await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=String(server.address().port),launch=fileURLToPath(new URL('../scripts/launch.mjs',import.meta.url)),exec=promisify(execFile),env={...process.env,PROJECT_DESK_PORT:port,PROJECT_DESK_DATA_DIR:f.data,PROJECT_DESK_NO_BROWSER:'1'};
  const same=await exec(process.execPath,[launch],{env,windowsHide:true,timeout:10000});assert.match(same.stdout,/已有 PROJECT DESK 服务/);const other=resolve(f.dir,'other-workspace');await assert.rejects(exec(process.execPath,[launch],{env:{...env,PROJECT_DESK_DATA_DIR:other},windowsHide:true,timeout:10000}),error=>error.code===1&&error.stderr.includes('其他 PROJECT DESK 工作区'));
  assert.equal(existsSync(resolve(other,'project-desk.sqlite')),false);assert.equal((await fetch('http://127.0.0.1:'+port+'/api/health')).status,200);
 }finally{if(server)await new Promise(r=>server.close(r));await dispose(f);}
});

test('R06: empty locks recover, live legacy owners are respected, and competing work stays exclusive',async()=>{
 const f=await fixture();try{const lock=resolve(f.data,'.reminder-data.lock');await writeFile(lock,'');await utimes(lock,new Date(0),new Date(0));assert.equal(await withDataLock(f.path,async()=>42),42);assert.ok((await readdir(f.data)).some(n=>n.startsWith('.reminder-data.lock.abandoned-')));
  await writeFile(lock,'');assert.equal(await withDataLock(f.path,async()=>43),43);
  await writeFile(lock,JSON.stringify({pid:process.pid}));let entered=false;const pending=withDataLock(f.path,async()=>{entered=true;});await new Promise(r=>setTimeout(r,160));assert.equal(entered,false);assert.equal(existsSync(lock),true);await rm(lock);await pending;
  const order=[];let release;const gate=new Promise(r=>release=r);const a=withDataLock(f.path,async()=>{order.push('A-start');await gate;order.push('A-end');});while(!order.length)await new Promise(r=>setTimeout(r,5));const b=withDataLock(f.path,async()=>order.push('B'));await new Promise(r=>setTimeout(r,120));assert.deepEqual(order,['A-start']);release();await Promise.all([a,b]);assert.deepEqual(order,['A-start','A-end','B']);
  let calls=0;await assert.rejects(withDataLock(f.path,async()=>{calls++;throw Object.assign(Error('database is locked'),{errcode:5});}));assert.equal(calls,1);assert.equal(await withDataLock(f.path,async()=>true),true);
 }finally{await dispose(f);}
});


test('R05: an older running service requires restart rather than mixing old backend and new UI',async()=>{
 const server=createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({app:'project-desk',version:'0.7.2'}));});await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const exec=promisify(execFile);await assert.rejects(exec(process.execPath,[fileURLToPath(new URL('../scripts/launch.mjs',import.meta.url))],{env:{...process.env,PROJECT_DESK_PORT:String(server.address().port),PROJECT_DESK_NO_BROWSER:'1'},windowsHide:true,timeout:10000}),error=>error.code===1&&error.stderr.includes('停止旧版服务'));}finally{await new Promise(r=>server.close(r));}
});

test('R06: separate processes serialize normally and release the mutex on normal shutdown',async()=>{
 const f=await fixture();let child;
 try{const code="import {withDataLock} from "+JSON.stringify(new URL('../server/data-lock.mjs',import.meta.url).href)+";await withDataLock(process.argv[1],async()=>{console.log('LOCKED');await new Promise(r=>process.stdin.once('data',r));});";
  child=spawn(process.execPath,['--input-type=module','-e',code,f.path],{windowsHide:true,stdio:['pipe','pipe','pipe']});const exited=new Promise(r=>child.once('exit',r));
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('lock holder startup timeout')),5000);child.stdout.once('data',()=>{clearTimeout(timeout);resolve();});child.once('error',e=>{clearTimeout(timeout);reject(e);});});
  let entered=false;const next=withDataLock(f.path,async()=>{entered=true;});await new Promise(r=>setTimeout(r,160));assert.equal(entered,false);child.stdin.end('release');await exited;await next;assert.equal(entered,true);
 }finally{if(child&&child.exitCode===null){child.stdin.end('release');await new Promise(r=>child.once('exit',r));}await dispose(f);}
});


test('R07: saved theme synchronizes the settings control; system changes preserve unsaved draft selection',async()=>{
 const originalDocument=globalThis.document,originalMedia=globalThis.matchMedia;const select={value:'light'},label={textContent:''},choices=['light','dark','system'].map(mode=>({dataset:{themeChoice:mode},attributes:{},setAttribute(k,v){this.attributes[k]=v;}}));let systemDark=false;
 globalThis.document={documentElement:{dataset:{}},querySelector(selector){return selector==='#theme-mode-label'?label:selector==='#theme-form [name=theme]'?select:null;},querySelectorAll(){return choices;}};globalThis.matchMedia=()=>({matches:systemDark});
 try{const {syncStudioTheme}=await import('../public/ui/studio.js');for(const mode of ['light','dark','system']){syncStudioTheme(mode,{syncForm:true});assert.equal(select.value,mode);assert.equal(choices.find(c=>c.dataset.themeChoice===mode).attributes['aria-pressed'],'true');assert.equal(document.documentElement.dataset.theme,mode==='dark'?'dark':'light');}
  systemDark=true;syncStudioTheme('system');assert.equal(select.value,'system');assert.equal(document.documentElement.dataset.theme,'dark');select.value='light';syncStudioTheme('system');assert.equal(select.value,'light','passive OS change preserves explicit unsaved draft');syncStudioTheme('dark',{syncForm:true});assert.equal(select.value,'dark');assert.equal(label.textContent,'深色模式');syncStudioTheme('light',{syncForm:true});assert.equal(select.value,'light');assert.equal(label.textContent,'浅色模式');
 }finally{if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;if(originalMedia===undefined)delete globalThis.matchMedia;else globalThis.matchMedia=originalMedia;}
});

test('release settings page renders the runtime version and all saved theme choices',async()=>{
 const {render}=await import('../public/pages/settings.js');
 for(const theme of ['light','dark','system']){
  const html=render({settings:{theme},storage:{appVersion:'1.0.0',databasePath:'test.sqlite',schemaVersion:'007',nodeVersion:'v24'}});
  assert.ok(html.includes('v1.0.0'));assert.ok(!html.includes('${'));
  assert.ok(html.includes(`value="${theme}" selected`));
  assert.ok(html.includes('settings/backup')&&html.includes('settings/reminders')&&html.includes('settings/usage'));
 }
});
