import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase,readSummary} from '../server/database.mjs';
import {createProject,getProject} from '../server/projects.mjs';
import {saveParticipant,deleteParticipant,saveMembers,saveJournal,deleteJournal,saveWorkspace,readDevelopment} from '../server/development.mjs';
import {createApp} from '../server/index.mjs';
test('development lifecycle, distinct memberships, historical deletion and persistence',()=>{
 const dir=mkdtempSync(join(tmpdir(),'desk-dev-'));let db;
 try{
  db=openDatabase(dir).db;let p=createProject(db,{name:'原有项目',status:'paused',progress:73});
  let a=saveParticipant(db,null,{name:'自定义模型',type:'模型',role:'设计'}),b=saveParticipant(db,null,{name:'自定义代理',type:'本地代理',role:'实现'});
  a=saveParticipant(db,a.id,{name:'修改后的名称',type:'我的类型',role:'规划',revision:a.revision});
  saveMembers(db,p.id,{participant_ids:[a.id,b.id],revision:p.revision});
  let row=saveJournal(db,null,{project_id:p.id,content:'一句话',occurred_at:'2026-11-15T08:00:00+08:00',participant_ids:[b.id],important:true});
  let state=readDevelopment(db);assert.equal(state.memberships.length,2);assert.deepEqual(state.journals[0].participant_ids,[b.id]);assert.equal(state.journals[0].important,1);
  assert.throws(()=>saveMembers(db,p.id,{participant_ids:[a.id],revision:getProject(db,p.id).revision}),/日志/);
  let j=state.journals[0];saveJournal(db,row.id,{project_id:p.id,title:'节点',content:'修改内容',files:'app.js',result:'通过',problems:'无',next_step:'验证',notes:'补充',occurred_at:'2026-11-16T08:00:00Z',important:false,participant_ids:[a.id],revision:j.revision});
  assert.throws(()=>deleteJournal(db,row.id,{revision:j.revision}),/更新/);
  saveWorkspace(db,p.id,{current_work:'当前工作',problems:'问题',ideas:'想法',next_step:'下一步',revision:0});
  assert.throws(()=>saveWorkspace(db,p.id,{current_work:'旧窗口',revision:0}),/更新/);
  deleteParticipant(db,a.id,{revision:a.revision});state=readDevelopment(db);assert.ok(state.participants.find(v=>v.id===a.id).deleted_at);assert.equal(state.journals[0].participant_ids[0],a.id);
  assert.throws(()=>saveJournal(db,null,{project_id:p.id,content:'新增',occurred_at:new Date().toISOString(),important:false,participant_ids:[a.id]}),/删除/);
  assert.throws(()=>saveJournal(db,null,{project_id:p.id,content:'',occurred_at:'invalid',important:false}),/至少/);
  p=getProject(db,p.id);assert.equal(p.progress,73);assert.equal(p.status,'paused');
  db.close();db=openDatabase(dir).db;state=readDevelopment(db);assert.equal(state.workspaces[0].ideas,'想法');assert.equal(state.journals[0].files,'app.js');
  deleteJournal(db,row.id,{revision:state.journals[0].revision});assert.equal(readSummary(db).journals,0);assert.equal(readDevelopment(db).memberships.length,2);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{db?.close();rmSync(dir,{recursive:true,force:true});}
});
test('development API validates origin and shares the bootstrap data',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'desk-dev-http-'));const {db,path}=openDatabase(dir);const server=createApp({db,databasePath:path});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 async function api(path,method='GET',body){const r=await fetch(origin+'/api/'+path,{method,headers:{Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert.ok(r.ok,await r.clone().text());return r.json();}
 try{const p=await api('projects','POST',{name:'API 项目'});const a=await api('participants','POST',{name:'参与者',type:'自定义'});await api('journals','POST',{project_id:p.id,content:'完成测试',occurred_at:new Date().toISOString(),important:true,participant_ids:[a.id]});let s=await api('bootstrap');assert.equal(s.journals.length,1);assert.equal(s.memberships.length,1);await api('projects/'+p.id+'/workspace','PUT',{current_work:'工作',revision:0});s=await api('bootstrap');assert.equal(s.workspaces[0].current_work,'工作');assert.equal(s.summary.journals,1);
 assert.equal((await fetch(origin+'/api/participants',{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json'},body:'{}'})).status,403);
 }finally{await new Promise(r=>server.close(r));db.close();rmSync(dir,{recursive:true,force:true});}
});
