import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openDatabase,readSummary,readSettings} from '../server/database.mjs';
import {createApp} from '../server/index.mjs';
import {createProject,createCategory,updateProject,archiveProject,deleteProject,getProject,listProjects,listCategories,updateCategory,deleteCategory,reorderCategories} from '../server/projects.mjs';

test('migration preserves phase 0 records and theme without reseeding',()=>{
 const directory=mkdtempSync(join(tmpdir(),'desk-migrate-'));let db;
 try{
  db=new DatabaseSync(join(directory,'project-desk.sqlite'));
  db.exec('CREATE TABLE schema_migrations(version TEXT PRIMARY KEY,applied_at TEXT NOT NULL) STRICT;');
  db.exec(readFileSync(new URL('../server/migrations/001-foundation.sql',import.meta.url),'utf8'));
  db.prepare('INSERT INTO schema_migrations VALUES (?,?)').run('001-foundation.sql','2026-01-01T00:00:00Z');
  db.prepare("INSERT INTO settings VALUES ('theme','dark')").run();
  db.prepare('INSERT INTO projects(id,name,status,progress,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('legacy','旧项目','paused',73,'2026-01-01T00:00:00Z','2026-01-02T00:00:00Z');
  db.close();db=openDatabase(directory).db;
  const p=getProject(db,'legacy');assert.equal(p.progress,73);assert.equal(p.status,'paused');assert.equal(p.category_id,null);assert.equal(p.archived_at,null);assert.equal(p.revision,1);
  assert.equal(readSettings(db).theme,'dark');assert.equal(listCategories(db).length,0);db.close();
  db=openDatabase(directory).db;assert.equal(listProjects(db).length,1);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n,7);
 }finally{db?.close();rmSync(directory,{recursive:true,force:true});}
});

test('project lifecycle, independent values, category transfers, ordering and disk persistence',()=>{
 const directory=mkdtempSync(join(tmpdir(),'desk-projects-'));let db;
 try{
  db=openDatabase(directory).db;
  const a=createCategory(db,{name:'研发',icon:'code',favorite:true});
  let b=createCategory(db,{name:'创作',icon:'design'});
  b=updateCategory(db,b.id,{name:'作品',icon:'文',favorite:true,revision:b.revision});
  assert.throws(()=>createCategory(db,{name:'作品'}),/同名/);
  reorderCategories(db,{ids:[b.id,a.id]});assert.deepEqual(listCategories(db).map(c=>c.id),[b.id,a.id]);
  assert.throws(()=>reorderCategories(db,{ids:[a.id]}),/变化/);
  let p=createProject(db,{name:'桌面工具 100%_A',description:'第一行\n第二行',category_id:a.id,status:'in_progress',progress:35});
  const originalCreated=p.created_at;
  p=updateProject(db,p.id,{name:p.name,description:p.description,status:'paused',progress:70,category_id:a.id,revision:p.revision});
  assert.equal(p.created_at,originalCreated);assert.equal(p.progress,70);
  p=archiveProject(db,p.id,{archived:true,revision:p.revision});
  assert.equal(p.status,'paused');assert.equal(p.progress,70);assert.equal(p.category_id,a.id);
  assert.equal(listProjects(db).length,0);assert.equal(listProjects(db,{archive:'archived'}).length,1);
  assert.equal(readSummary(db).projects.paused,1);assert.equal(readSummary(db).archived,1);
  assert.throws(()=>deleteCategory(db,a.id,{replacement_id:a.id,revision:a.revision}),/无效/);
  assert.equal(getProject(db,p.id).category_id,a.id);
  deleteCategory(db,a.id,{replacement_id:b.id,revision:a.revision});
  p=getProject(db,p.id);assert.equal(p.category_id,b.id);assert.equal(p.progress,70);assert.ok(p.archived_at);
  assert.equal(listProjects(db,{archive:'all',q:'100%_'}).length,1);
  assert.equal(listProjects(db,{archive:'all',q:'100x'}).length,0);
  p=archiveProject(db,p.id,{archived:false,revision:p.revision});
  assert.equal(p.status,'paused');assert.equal(p.progress,70);assert.equal(listProjects(db,{category:b.id,status:'paused'}).length,1);
  const stale=p;
  p=updateProject(db,p.id,{name:p.name,status:'completed',progress:0,category_id:b.id,revision:p.revision});assert.equal(p.progress,0);
  assert.throws(()=>updateProject(db,p.id,{name:'旧窗口',revision:stale.revision}),/其他窗口/);
  assert.throws(()=>createProject(db,{name:'x',progress:101}),/0–100/);
  assert.throws(()=>createProject(db,{name:'  '}),/不能为空/);
  assert.throws(()=>createProject(db,{name:'x',progress:0.5}),/整数/);
  deleteCategory(db,b.id,{replacement_id:null,revision:b.revision});p=getProject(db,p.id);assert.equal(p.category_id,null);
  const other=createProject(db,{name:'另一个项目',status:'abandoned',progress:100});
  db.prepare('UPDATE projects SET created_at=?,updated_at=? WHERE id=?').run('2025-01-01','2027-01-01',p.id);
  assert.equal(listProjects(db,{sort:'created_at',order:'asc'})[0].id,p.id);
  assert.equal(listProjects(db,{sort:'updated_at',order:'desc'})[0].id,p.id);
  const file=join(directory,'external.txt');writeFileSync(file,'original');
  db.prepare('UPDATE projects SET folder_path=? WHERE id=?').run(file,p.id);
  deleteProject(db,p.id,{revision:p.revision});assert.ok(existsSync(file));assert.equal(readSummary(db).projects.total,1);assert.throws(()=>getProject(db,p.id),/不存在/);
  assert.ok(db.prepare('SELECT deleted_at FROM projects WHERE id=?').get(p.id).deleted_at);
  db.close();db=openDatabase(directory).db;assert.equal(getProject(db,other.id).progress,100);assert.equal(readSummary(db).projects.abandoned,1);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{db?.close();rmSync(directory,{recursive:true,force:true});}
});

test('HTTP CRUD, all statuses, input checks and dashboard stay consistent',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'desk-api-'));const {db,path}=openDatabase(directory);const server=createApp({db,databasePath:path});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
 const api=async(path,method='GET',body,expected=200)=>{const response=await fetch(origin+'/api/'+path,{method,headers:{Origin:origin,'Content-Type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{})});const data=await response.json();assert.equal(response.status,expected,JSON.stringify(data));return data;};
 try{
  const c=await api('categories','POST',{name:'接口分类',icon:'book'},201);
  const names=['not_started','in_progress','paused','completed','abandoned'];
  for(const [index,status] of names.entries())await api('projects','POST',{name:'项目 '+index,status,progress:index*25,category_id:c.id},201);
  const bootstrap=await api('bootstrap');assert.equal(bootstrap.summary.projects.total,5);for(const status of names)assert.equal(bootstrap.summary.projects[status],1);
  let p=(await api('projects?status=paused'))[0];p=await api('projects/'+p.id,'PUT',{name:'改名项目',status:'paused',progress:99,category_id:c.id,revision:p.revision});
  p=await api('projects/'+p.id+'/archive','PUT',{archived:true,revision:p.revision});assert.equal((await api('projects?archive=archived')).length,1);
  p=await api('projects/'+p.id+'/archive','PUT',{archived:false,revision:p.revision});assert.equal(p.progress,99);
  await api('projects','POST',{name:'无效',progress:'50'},400);await api('projects','POST',{name:'无效',archived_at:'x'},400);await api('projects','POST',null,400);
  await api('projects?sort=name','GET',undefined,400);await api('projects','POST',{name:'无效',status:'custom'},400);
  await api('categories/'+c.id,'DELETE',{revision:c.revision},400);
  await api('categories/'+c.id,'DELETE',{revision:c.revision,replacement_id:'missing'},404);assert.equal((await api('categories')).length,1);
  await api('categories/'+c.id,'DELETE',{revision:c.revision,replacement_id:null});assert.equal((await api('projects?category=uncategorized')).length,5);
  p=await api('projects/'+p.id);await api('projects/'+p.id,'DELETE',{revision:p.revision});await api('projects/'+p.id,'GET',undefined,404);
  assert.equal((await api('bootstrap')).summary.projects.total,4);
  assert.equal((await fetch(origin+'/api/projects',{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json'},body:JSON.stringify({name:'forbidden'})})).status,403);
 }finally{await new Promise(resolve=>server.close(resolve));db.close();rmSync(directory,{recursive:true,force:true});}
});
