import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rename,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {openDatabase} from '../server/database.mjs';
import * as S from '../server/storage.mjs';
import {objectPath,getFile,exists} from '../server/file-paths.mjs';
import {createProject,getProject} from '../server/projects.mjs';
import {readLibrary,deleteResource} from '../server/library.mjs';
import {createBackup,inspectBackup,restoreBackup} from '../server/backups.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
async function fixture(){const dir=await mkdtemp(join(tmpdir(),'project-desk-files-'));const data=join(dir,'data'),src=join(dir,'source'),dest=join(dir,'destination');await mkdir(src);await mkdir(dest);await writeFile(join(src,'image.png'),png);await writeFile(join(src,'doc.txt'),'document');const {db,path}=openDatabase(data);await S.initializeStorage(db,path);return {dir,src,dest,db,path};}

test('storage roots, copy/reference batch, dedup, directory moves, invalid paths, recycle and permanent separation',async()=>{
 const f=await fixture(),{db,path,src}=f;
 try{let root=await S.saveRoot(db,path,null,{name:'自定义资料',role:'other',path:f.dest});const p=createProject(db,{name:'甲'}),q=createProject(db,{name:'乙'});
  let results=(await S.importPaths(db,path,{paths:[join(src,'image.png'),join(src,'doc.txt'),join(src,'missing')],mode:'managed',root_id:root.id,project_ids:[p.id,q.id]})).results;assert.deepEqual(results.map(r=>r.ok),[true,true,false]);assert.equal(readLibrary(db).resources.length,2);assert.equal(readLibrary(db).resources[0].project_ids.length,2);
  const duplicate=(await S.importPaths(db,path,{paths:[join(src,'image.png')],mode:'managed',root_id:root.id})).results[0];assert.equal(duplicate.duplicate,true);assert.equal(readLibrary(db).resources.length,2);
  const ref=(await S.importPaths(db,path,{paths:[join(src,'doc.txt')],mode:'reference'})).results[0];assert.equal(getFile(db,ref.file_id).path,join(src,'doc.txt'));assert.equal((await S.readStorage(db,path)).files.length,3);
  await S.createFolder(db,path,{root_id:root.id,name:'子目录'});await S.moveNode(db,path,{root_id:root.id,path:'image.png',target_folder:'子目录',name:'改名.png'});const image=getFile(db,results[0].file_id);assert.equal(image.name,'改名.png');assert.equal(image.path,'子目录/改名.png');assert.deepEqual(await readFile(await objectPath(db,path,image)),png);
  await S.moveNode(db,path,{root_id:root.id,path:'子目录',name:'重命名目录'});assert.equal(getFile(db,image.id).path,'重命名目录/改名.png');await assert.rejects(S.moveNode(db,path,{root_id:root.id,path:'../source'}));
  const movedRoot=join(f.dir,'moved-root');await mkdir(movedRoot);await S.saveRoot(db,path,root.id,{name:root.name,role:root.role,path:movedRoot,revision:root.revision,move_existing:true});assert.ok(await exists(join(movedRoot,'重命名目录','改名.png')));
  const info=await S.readStorage(db,path);assert.ok(info.files.find(o=>o.id===image.id).available);
  const missingOld=await objectPath(db,path,getFile(db,image.id)),newLocation=join(src,'found.png');await rename(missingOld,newLocation);assert.equal((await S.readStorage(db,path)).files.find(o=>o.id===image.id).available,false);await S.relink(db,path,image.id,{path:newLocation,revision:getFile(db,image.id).revision});assert.equal(getFile(db,image.id).storage_mode,'reference');
  const referenceTrash=await S.trashNode(db,path,{file_id:ref.file_id,acknowledge_usage:true});assert.ok(await exists(join(src,'doc.txt')));await S.restoreTrash(db,path,referenceTrash.id,{type:'file'});assert.ok(!getFile(db,ref.file_id).deleted_at);
  const r=readLibrary(db).resources.find(r=>r.id===results[1].id);deleteResource(db,r.id,{revision:r.revision});await S.restoreTrash(db,path,r.id,{type:'resource',revision:db.prepare('SELECT revision FROM resources WHERE id=?').get(r.id).revision});assert.ok(readLibrary(db).resources.find(x=>x.id===r.id));
  await assert.rejects(S.trashNode(db,path,{root_id:root.id,path:'doc.txt'}),e=>e.status===409);const trash=await S.trashNode(db,path,{root_id:root.id,path:'doc.txt',acknowledge_usage:true});assert.ok(getFile(db,results[1].file_id).deleted_at);await S.restoreTrash(db,path,trash.id,{type:'file'});assert.ok(await exists(await objectPath(db,path,getFile(db,results[1].file_id))));
  const folderTrash=await S.trashNode(db,path,{root_id:root.id,path:'重命名目录',acknowledge_usage:true});await S.restoreTrash(db,path,folderTrash.id,{type:'file'});assert.ok(await exists(join(movedRoot,'重命名目录')));
  const refTrash=await S.trashNode(db,path,{file_id:ref.file_id,acknowledge_usage:true});await S.purgeTrash(db,path,refTrash.id,{type:'file',confirm:'永久删除'});assert.equal(await readFile(join(src,'doc.txt'),'utf8'),'document');
  const again=readLibrary(db).resources.find(x=>x.id===r.id);deleteResource(db,r.id,{revision:again.revision});await S.purgeTrash(db,path,r.id,{type:'resource',confirm:'永久删除'});assert.ok(await exists(join(movedRoot,'doc.txt')),'record purge keeps bytes');
  const fileTrash=await S.trashNode(db,path,{root_id:root.id,path:'doc.txt'});await S.purgeTrash(db,path,fileTrash.id,{type:'file',confirm:'永久删除'});assert.ok(!await exists(join(movedRoot,'doc.txt')));
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{db.close();await rm(f.dir,{recursive:true,force:true});}
});

test('backup validates all bytes and SQLite, restores managed files without overwriting source roots, keeps references and pre-restore safety',async()=>{
 const f=await fixture();const runtime={db:f.db,databasePath:f.path};let db=runtime.db;
 try{const p=createProject(db,{name:'需恢复的项目'});await S.importPaths(db,f.path,{paths:[join(f.src,'image.png')],mode:'managed',project_ids:[p.id]});await S.importPaths(db,f.path,{paths:[join(f.src,'doc.txt')],mode:'reference'});await S.createFolder(db,f.path,{root_id:'images',name:'空文件夹'});
  const saved=readLibrary(db),parent=join(f.dir,'backups');await mkdir(parent);const result=await createBackup(db,f.path,{directory:parent});assert.equal(result.files,1);let inspected=await inspectBackup(result.path);assert.equal(inspected.resources,2);assert.equal(inspected.references.length,1);
  const manifest=JSON.parse(await readFile(join(result.path,'manifest.json'),'utf8')),blob=join(result.path,manifest.files[0].file),bytes=await readFile(blob);await writeFile(blob,'corrupt');await assert.rejects(inspectBackup(result.path));await writeFile(blob,bytes);
  createProject(db,{name:'恢复后应不存在'});const restored=await restoreBackup(runtime,{directory:result.path,confirm:'恢复'});db=runtime.db;assert.ok(await exists(join(restored.safety_backup,'manifest.json')));assert.equal(db.prepare('SELECT COUNT(*) n FROM projects').get().n,1);assert.equal(readLibrary(db).resources.length,saved.resources.length);
  const object=db.prepare("SELECT * FROM file_objects WHERE storage_mode='managed'").get();const restoredFile=await objectPath(db,f.path,object);assert.ok(restoredFile.startsWith(restored.file_root));assert.deepEqual(await readFile(restoredFile),png);assert.ok(await exists(join(f.src,'doc.txt')));
  assert.ok((await S.readStorage(db,f.path)).files.every(o=>o.available));assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');db.close();runtime.db=openDatabase(join(f.dir,'data')).db;assert.equal(readLibrary(runtime.db).resources.length,2);assert.deepEqual(runtime.db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{runtime.db.close();await rm(f.dir,{recursive:true,force:true});}
});

test('shared physical paths, crash recovery and offline roots preserve ownership and history',async()=>{
 const f=await fixture(),{db,path}=f;
 try{
  const root=await S.saveRoot(db,path,null,{name:'可移动目录',role:'other',path:f.dest});
  const copy=(await S.importPaths(db,path,{paths:[join(f.src,'doc.txt')],mode:'managed',root_id:root.id})).results[0];
  const reference=(await S.importPaths(db,path,{paths:[join(f.dest,'doc.txt')],mode:'reference'})).results[0];
  await S.moveNode(db,path,{root_id:root.id,path:'doc.txt',name:'renamed.txt'});assert.equal(getFile(db,reference.file_id).path,join(f.dest,'renamed.txt'));
  const recycle=await S.trashNode(db,path,{file_id:copy.file_id,acknowledge_usage:true});assert.ok(getFile(db,reference.file_id).deleted_at);await S.restoreTrash(db,path,recycle.id,{type:'file'});assert.ok(await exists(await objectPath(db,path,getFile(db,reference.file_id))));
  const o=getFile(db,copy.file_id),from=await objectPath(db,path,o),to=join(f.dest,'after-crash.txt'),plan={from,to,objects:[{...o,path:'after-crash.txt',name:'after-crash.txt'}]};
  db.prepare('INSERT INTO disk_jobs VALUES(?,?,?,?,NULL)').run('simulated-crash',JSON.stringify(plan),'planned',new Date().toISOString());await rename(from,to);await S.recoverJobs(db);assert.equal(getFile(db,o.id).path,'after-crash.txt');assert.equal(db.prepare('SELECT status FROM disk_jobs WHERE id=?').get('simulated-crash').status,'done');
  const offline=join(f.dir,'reconnected');await rename(f.dest,offline);assert.equal((await S.readStorage(db,path)).roots.find(r=>r.id===root.id).available,false);
  await S.saveRoot(db,path,root.id,{...root,path:offline,relocate_existing:true});assert.ok((await S.readStorage(db,path)).files.find(r=>r.id===o.id).available);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{db.close();await rm(f.dir,{recursive:true,force:true});}
});
