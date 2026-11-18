import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID as uuid} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {openDatabase} from '../server/database.mjs';
import {createProject,getProject} from '../server/projects.mjs';
import {saveParticipant,saveJournal} from '../server/development.mjs';
import {saveResource,saveTaxonomy} from '../server/library.mjs';
import {readReminders} from '../server/reminders.mjs';
import {ingestUsage,readUsage} from '../server/usage.mjs';
import * as P from '../server/presets.mjs';
import {searchAll,recentActivity} from '../server/search.mjs';
import {ActivityClock} from '../public/services/usage.js';
import {createApp} from '../server/index.mjs';
import {createBackup,restoreBackup} from '../server/backups.mjs';
import {usage as fileUsage} from '../server/file-paths.mjs';
const at=Date.parse('2027-01-01T16:00:10Z');
async function fixture(){const dir=await mkdtemp(join(tmpdir(),'desk-experience-'));return {dir,...openDatabase(join(dir,'data'))};}
test('foreground clock pauses on hidden, idle and long suspension, resumes without crediting gaps',()=>{
 const c=new ActivityClock(0);let total=0;for(let i=1;i<=41;i++)total+=c.advance(i*15000);assert.equal(total,600000);assert.equal(c.advance(630000),0);assert.equal(c.activity(650000),0);assert.equal(c.advance(660000),10000);
 assert.equal(c.setActive(665000,false),5000);assert.equal(c.advance(700000),0);assert.equal(c.setActive(710000,true),0);assert.equal(c.advance(725000),15000);assert.equal(c.advance(825000),30000);assert.equal(c.advance(840000),15000);
 const hidden=new ActivityClock(0,{active:false});hidden.activity(20000);assert.equal(hidden.advance(25000),0);
});
test('usage is idempotent, merges multiwindow intervals, respects local days, and never touches development or reminders',async()=>{const f=await fixture();let {db}=f;try{
 const p=createProject(db,{name:'独立统计',status:'in_progress',progress:37});db.prepare('UPDATE projects SET created_at=?,updated_at=? WHERE id=?').run('2026-01-01T00:00:00Z','2026-01-01T00:00:00Z',p.id);const before=getProject(db,p.id),due=readReminders(db,at),recent=recentActivity(db),session=uuid(),visit=uuid(),sample=uuid();const heartbeat={session_id:session,visits:[{id:visit,project_id:p.id}],samples:[{id:sample,visit_id:visit,start_ms:at-20000,end_ms:at}]};
 assert.equal(ingestUsage(db,heartbeat,at).accepted,1);assert.equal(ingestUsage(db,heartbeat,at).accepted,0);ingestUsage(db,{session_id:uuid(),visits:[],samples:[{id:uuid(),start_ms:at-10000,end_ms:at+10000}]},at+10000);
 const stats=readUsage(db,{offset:-480,now:at+10000});assert.equal(stats.total_ms,30000);assert.equal(stats.today_ms,20000);assert.equal(stats.count,2);assert.equal(stats.average_ms,15000);assert.equal(stats.daily.reduce((n,r)=>n+r.milliseconds,0),30000);
 assert.equal(readUsage(db,{project_id:p.id,now:at}).total_ms,20000);assert.equal(readUsage(db,{project_id:p.id}).count,1);assert.deepEqual(getProject(db,p.id),before);assert.deepEqual(readReminders(db,at),due);assert.deepEqual(recentActivity(db),recent);
 const last=readUsage(db).recent_at;ingestUsage(db,{session_id:session,visits:[],samples:[]},at+60000);assert.equal(readUsage(db).recent_at,last);
 assert.throws(()=>ingestUsage(db,{session_id:session,visits:[],samples:[{id:uuid(),start_ms:0,end_ms:600000}]},at));assert.throws(()=>readUsage(db,{offset:9999}));
 db.close();db=openDatabase(join(f.dir,'data')).db;assert.equal(readUsage(db).total_ms,30000);assert.equal(readUsage(db,{project_id:p.id}).count,1);
 }finally{db.close();await rm(f.dir,{recursive:true,force:true});}});
test('preset CRUD, order, restored defaults and business snapshots remain independent',async()=>{const {dir,db}=await fixture();try{
 assert.equal(P.readPresets(db).length,17);assert.equal(db.prepare('SELECT COUNT(*) n FROM participants').get().n,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM project_categories').get().n,0);
 let preset=P.savePreset(db,null,{kind:'category',name:'自定义分类',icon:'★'});const category=P.materializePreset(db,preset.id),project=createProject(db,{name:'历史项目',category_id:category.id});preset=P.savePreset(db,preset.id,{...preset,name:'预设改名',icon:'book'});P.deletePreset(db,preset.id,{revision:preset.revision});assert.equal(getProject(db,project.id).category_name,'自定义分类');assert.equal(getProject(db,project.id).category_icon,'★');
 const ai=P.readPresets(db).find(p=>p.name==='Codex');const person=P.materializePreset(db,ai.id);saveJournal(db,null,{project_id:project.id,content:'参与记录',occurred_at:new Date().toISOString(),important:false,participant_ids:[person.id]});P.deletePreset(db,ai.id,{revision:ai.revision});assert.equal(db.prepare('SELECT name FROM participants WHERE id=?').get(person.id).name,'Codex');assert.equal(db.prepare('SELECT COUNT(*) n FROM journal_participants').get().n,1);
 const edited=P.readPresets(db).find(p=>p.name==='YouTube');P.savePreset(db,edited.id,{...edited,icon:'★'});let list=P.readPresets(db).filter(p=>p.kind==='platform');P.reorderPresets(db,{kind:'platform',ids:list.map(p=>p.id).reverse()});assert.equal(P.readPresets(db).filter(p=>p.kind==='platform')[0].id,list.at(-1).id);assert.throws(()=>P.reorderPresets(db,{kind:'platform',ids:[]}));
 assert.equal(P.restorePresets(db,{}).added,1);assert.equal(P.restorePresets(db,{}).added,0);assert.equal(P.getPreset(db,edited.id).icon,'★');assert.throws(()=>P.savePreset(db,null,{kind:'category',name:'过'.repeat(41),icon:'folder'}));assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{db.close();await rm(dir,{recursive:true,force:true});}});
test('global search covers all local groups, treats wildcards literally and excludes deleted rows',async()=>{const {dir,db}=await fixture();try{
 const category=P.materializePreset(db,P.savePreset(db,null,{kind:'category',name:'查找 分类',icon:'folder'}).id),p=createProject(db,{name:'名称',description:'查找 简介',category_id:category.id}),person=saveParticipant(db,null,{name:'查找 Agent',type:'测试',role:'用途'});const log=saveJournal(db,null,{project_id:p.id,content:'查找 内容',title:'记录',files:'lib.js',occurred_at:new Date().toISOString(),important:false,participant_ids:[person.id]});
 const tag=saveTaxonomy(db,'tags',null,{name:'查找 标签'}),rc=saveTaxonomy(db,'categories',null,{name:'查找 分类'});const r=saveResource(db,null,{title:'资料',kind:'text',content:'查找 100%_!',favorite:false,tag_ids:[tag.id],category_id:rc.id});saveResource(db,null,{title:'链接',kind:'web',source_url:'https://example.com/findword',notes:'用途',favorite:false});
 const result=searchAll(db,'查找');assert.equal(result.groups.filter(g=>g.items.length).length,7);assert.ok(result.groups.find(g=>g.type==='开发日志').items[0].route.endsWith('?log='+log.id));assert.ok(result.groups.find(g=>g.type==='AI / Agent').items[0].route.includes('person-'));
 assert.equal(searchAll(db,'100%_!').groups.find(g=>g.type==='资料').items[0].id,r.id);assert.equal(searchAll(db,'findword').groups.find(g=>g.type==='资料').items.length,1);assert.equal(searchAll(db,'lib.js').groups.find(g=>g.type==='开发日志').items.length,1);assert.equal(searchAll(db,'   ').groups.length,0);assert.equal(searchAll(db,"' OR 1=1 --").groups.flatMap(g=>g.items).length,0);
 db.prepare('UPDATE resources SET deleted_at=? WHERE id=?').run(new Date().toISOString(),r.id);assert.equal(searchAll(db,'100%_!').groups.find(g=>g.type==='资料').items.length,0);assert.throws(()=>searchAll(db,'x'.repeat(161)));
 }finally{db.close();await rm(dir,{recursive:true,force:true});}});
test('preset image API, historical references, backup and restored usage/presets persist',async()=>{const f=await fixture(),runtime={db:f.db,databasePath:f.path};const server=createApp(runtime);await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
 const call=async(path,body,method='POST')=>{const r=await fetch(origin+'/api/'+path,{method,headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200,await r.clone().text());return r.json();};try{
 let preset=await call('presets',{kind:'category',name:'带图标',icon:'folder'});let response=await fetch(`${origin}/api/presets/${preset.id}/image?revision=${preset.revision}`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/octet-stream'},body:png});assert.equal(response.status,200);preset=await response.json();const category=await call('presets/'+preset.id+'/apply',{});const project=createProject(runtime.db,{name:'图片历史',category_id:category.id});await call('presets/'+preset.id,{revision:preset.revision},'DELETE');assert.equal((await fetch(origin+'/api/preset-images/'+preset.image_file_id)).status,200);assert.ok(fileUsage(runtime.db,[preset.image_file_id]).some(r=>r.route==='projects/categories'));
 const person=saveParticipant(runtime.db,null,{name:'图片参与者',type:'AI',icon:'idea',icon_file_id:preset.image_file_id});assert.equal(person.icon_file_id,preset.image_file_id);const platform=saveResource(runtime.db,null,{title:'视频',kind:'video_link',source_url:'https://example.com/video',platform:'自由平台',platform_icon:'camera',platform_image_id:preset.image_file_id,favorite:false});assert.equal(platform.platform_image_id,preset.image_file_id);
 const sid=uuid();ingestUsage(runtime.db,{session_id:sid,visits:[{id:uuid(),project_id:project.id}],samples:[{id:uuid(),start_ms:Date.now()-1000,end_ms:Date.now()}]});const stats=readUsage(runtime.db);await mkdir(join(f.dir,'backups'));const saved=await createBackup(runtime.db,runtime.databasePath,{directory:join(f.dir,'backups')});await restoreBackup(runtime,{directory:saved.path,confirm:'恢复'});assert.equal(readUsage(runtime.db).count,stats.count);assert.equal(readUsage(runtime.db).total_ms,stats.total_ms);assert.equal(P.readPresets(runtime.db).length,17);assert.equal(getProject(runtime.db,project.id).category_icon_file_id,preset.image_file_id);assert.equal((await fetch(origin+'/api/preset-images/'+preset.image_file_id)).status,200);assert.deepEqual(runtime.db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{await new Promise(r=>server.close(r));runtime.db.close();await rm(f.dir,{recursive:true,force:true});}});
test('phase 4 and phase 5 backups migrate to 007 without losing historical business rows',async()=>{
 for(const version of [5,6]){const f=await fixture(),runtime={db:f.db,databasePath:f.path},legacyPath=join(f.dir,'legacy.sqlite'),legacy=new DatabaseSync(legacyPath);try{
  legacy.exec('PRAGMA foreign_keys=ON;CREATE TABLE schema_migrations(version TEXT PRIMARY KEY,applied_at TEXT NOT NULL) STRICT;');const files=['001-foundation.sql','002-project-archive.sql','003-development.sql','004-library.sql','005-files.sql','006-reminders.sql'];for(const file of files.slice(0,version)){legacy.exec(await readFile(new URL('../server/migrations/'+file,import.meta.url),'utf8'));legacy.prepare('INSERT INTO schema_migrations VALUES(?,?)').run(file,new Date().toISOString());}
  legacy.prepare('INSERT INTO projects(id,name,status,progress,created_at,updated_at) VALUES(?,?,?,?,?,?)').run('legacy-project','旧版项目','paused',73,'2026-01-01T00:00:00Z','2026-02-01T00:00:00Z');await mkdir(join(f.dir,'old-backups'));const saved=await createBackup(legacy,legacyPath,{directory:join(f.dir,'old-backups')});await restoreBackup(runtime,{directory:saved.path,confirm:'恢复'});const row=getProject(runtime.db,'legacy-project');assert.equal(row.name,'旧版项目');assert.equal(row.status,'paused');assert.equal(row.progress,73);assert.equal(row.updated_at,'2026-02-01T00:00:00Z');assert.equal(P.readPresets(runtime.db).length,17);assert.equal(readUsage(runtime.db).count,0);assert.equal(runtime.db.prepare('SELECT COUNT(*) n FROM schema_migrations').get().n,7);
 }finally{legacy.close();runtime.db.close();await rm(f.dir,{recursive:true,force:true});}}
});
