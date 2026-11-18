import {backup,DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdir,copyFile,readFile,writeFile,rename,unlink,stat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,dirname,isAbsolute,relative,basename} from 'node:path';
import {openDatabase,migrateDatabase} from './database.mjs';
import {prepareRestore} from './restore-state.mjs';
import {fail,time,inside,exists,rootPath,objectPath,digest,rel,safePath,tree,describe} from './file-paths.mjs';

export async function createBackup(db,databasePath,b){
 if(typeof b.directory!=='string'||!isAbsolute(b.directory))fail('请选择备份目录。');
 const parent=resolve(b.directory);if(!(await stat(parent)).isDirectory())fail('备份目标不是文件夹。');
 for(const r of db.prepare('SELECT * FROM storage_roots').all())if(inside(rootPath(r,databasePath),parent))fail('备份目录不能放在托管文件目录中，请另选位置。');
 const destination=resolve(parent,'PROJECT-DESK-'+time().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8));await mkdir(destination);await mkdir(resolve(destination,'blobs'));
 // The marker remains if an interrupted/incomplete backup needs inspection. Only manifest.json marks success.
 await writeFile(resolve(destination,'INCOMPLETE.txt'),'备份尚未完成，请勿用于恢复。','utf8');
 // A project folder inside a managed root belongs to the backup, including files added outside this UI.
 const roots=db.prepare('SELECT * FROM storage_roots').all().map(r=>({...r,path:rootPath(r,databasePath)}));
 for(const p of db.prepare('SELECT folder_path FROM projects WHERE folder_path IS NOT NULL').all()){const r=roots.find(r=>inside(r.path,p.folder_path));if(!r||!await exists(p.folder_path))continue;const listing=await tree(p.folder_path);for(const d of listing.dirs)db.prepare('INSERT OR IGNORE INTO storage_folders VALUES(?,?)').run(r.id,relative(r.path,resolve(p.folder_path,d)).replaceAll('\\','/'));for(const f of listing.files){const absolute=resolve(p.folder_path,f),path=relative(r.path,absolute).replaceAll('\\','/');if(!db.prepare('SELECT 1 FROM file_objects WHERE root_id=? AND path=? COLLATE NOCASE AND deleted_at IS NULL AND purged_at IS NULL').get(r.id,path)){const info=await describe(absolute);db.prepare("INSERT INTO file_objects(id,root_id,path,storage_mode,name,mime,size,sha256,created_at) VALUES(?,?,?,'managed',?,?,?,?,?)").run(randomUUID(),r.id,path,basename(path),info.mime,info.size,info.sha256,time());}}}
 const snapshotPath=resolve(destination,'project-desk.sqlite');await backup(db,snapshotPath);
 const files=[],missing=[],references=[];
 const objects=db.prepare('SELECT * FROM file_objects WHERE purged_at IS NULL ORDER BY id').all();
 const snapshot=new DatabaseSync(snapshotPath);
 try{
  snapshot.exec('PRAGMA journal_mode=DELETE;');
  for(const o of objects){const path=await objectPath(db,databasePath,o,{trash:true});if(o.storage_mode==='reference'){references.push({id:o.id,path:o.path,available:await exists(path)});continue;}
   if(!await exists(path)){missing.push({id:o.id,path});continue;}
   const sha256=await digest(path),file='blobs/'+sha256,target=resolve(destination,file);
   if(!await exists(target))await copyFile(path,target,constants.COPYFILE_EXCL);
   if(await digest(target)!==sha256)fail('文件在备份期间发生变化，请暂停外部编辑后重试。',409);
   const size=(await stat(target)).size;files.push({id:o.id,file,sha256,size});snapshot.prepare('UPDATE file_objects SET sha256=?,size=? WHERE id=?').run(sha256,size,o.id);
  }
  if(missing.length&&!b.allow_missing)fail(`有 ${missing.length} 个托管文件不可用，未生成完整备份。请重新定位文件，或明确允许仅备份现有内容。`,409);
  if(snapshot.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||snapshot.prepare('PRAGMA foreign_key_check').all().length)fail('数据库完整性检查未通过。');
 }finally{snapshot.close();}
 const manifest={format:'project-desk-backup',version:1,schema:db.prepare('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1').get().version.slice(0,3),created_at:time(),roots,database:{file:'project-desk.sqlite',sha256:await digest(snapshotPath),size:(await stat(snapshotPath)).size},files,missing,references};
 await writeFile(resolve(destination,'manifest.json'),JSON.stringify(manifest,null,2),'utf8');await unlink(resolve(destination,'INCOMPLETE.txt'));
 return {path:destination,files:files.length,missing,references,complete:missing.length===0};
}
export async function inspectBackup(directory){
 if(typeof directory!=='string'||!isAbsolute(directory))fail('请选择备份包文件夹。');directory=resolve(directory);
 let m;try{const data=await readFile(resolve(directory,'manifest.json'),'utf8');if(data.length>16*1024*1024)fail('备份清单过大。');m=JSON.parse(data);}catch(e){fail('不是完整的 PROJECT DESK 备份目录：'+e.message);}
 if(m.format!=='project-desk-backup'||m.version!==1||!['005','006','007'].includes(m.schema)||m.database?.file!=='project-desk.sqlite'||!Array.isArray(m.files)||!Array.isArray(m.missing))fail('备份格式或数据版本不受支持。');
 const dbPath=await safePath(directory,m.database.file);if(await digest(dbPath)!==m.database.sha256||(await stat(dbPath)).size!==m.database.size)fail('数据库校验和不匹配，未执行恢复。');
 let check;try{check=new DatabaseSync(dbPath,{readOnly:true});if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||check.prepare('PRAGMA foreign_key_check').all().length)fail('备份数据库损坏或关联不完整。');
  const migrations=check.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(r=>r.version);if(migrations.join('|')!==('001-foundation.sql|002-project-archive.sql|003-development.sql|004-library.sql|005-files.sql'+(m.schema>='006'?'|006-reminders.sql':'')+(m.schema>='007'?'|007-experience.sql':'')))fail('备份迁移版本不匹配。');
  const objects=check.prepare("SELECT * FROM file_objects WHERE storage_mode='managed' AND purged_at IS NULL").all(),ids=new Set();
  for(const f of m.files){if(typeof f.file!=='string'||!/^blobs\/[a-f0-9]{64}$/.test(f.file)||f.file!=='blobs/'+f.sha256||ids.has(f.id)||!objects.some(o=>o.id===f.id))fail('备份文件清单无效。');ids.add(f.id);const path=await safePath(directory,f.file);if(!await exists(path)||await digest(path)!==f.sha256||(await stat(path)).size!==f.size)fail('备份文件缺失或内容校验失败：'+f.id);}
  for(const o of objects){rel(o.trash_path||o.path,true);if(!ids.has(o.id)&&!m.missing.some(x=>x.id===o.id))fail('备份遗漏托管文件。');}
  const references=await Promise.all(check.prepare("SELECT * FROM file_objects WHERE storage_mode='reference' AND purged_at IS NULL").all().map(async o=>({id:o.id,path:o.path,available:await exists(o.path)})));
  return {directory,manifest:m,projects:check.prepare('SELECT COUNT(*) n FROM projects').get().n,resources:check.prepare('SELECT COUNT(*) n FROM resources').get().n,references,missing:m.missing,files:m.files.length};
 }finally{check?.close();}
}
export async function restoreBackup(runtime,b){
 if(b.confirm!=='恢复')fail('请输入“恢复”以确认覆盖当前工作台数据。');const checked=await inspectBackup(b.directory),{manifest:m}=checked;
 if(m.missing.length&&!b.allow_missing)fail('这是含缺失文件的备份，需要明确同意恢复现有内容。');
 const data=dirname(runtime.databasePath),id=randomUUID(),fileRoot=resolve(data,'restored-'+id),staged=resolve(data,'restore-'+id+'.sqlite');await mkdir(fileRoot);await copyFile(resolve(checked.directory,m.database.file),staged,constants.COPYFILE_EXCL);
 let candidate=new DatabaseSync(staged);
 try{
  migrateDatabase(candidate);
  candidate.prepare("INSERT OR REPLACE INTO reminder_runtime VALUES('desktop_enabled','0')").run();
  candidate.exec("PRAGMA journal_mode=DELETE;UPDATE disk_jobs SET status='needs_review',error='备份中未完成的操作仅保留待检查记录，不自动操作原目录。' WHERE status IN('planned','copied','committed');");const roots=candidate.prepare('SELECT * FROM storage_roots ORDER BY id').all();let i=0;
  for(const r of roots){const path=resolve(fileRoot,'directory-'+(++i));await mkdir(path);candidate.prepare('UPDATE storage_roots SET path=?,revision=revision+1 WHERE id=?').run(path,r.id);
   const old=m.roots?.find(x=>x.id===r.id)?.path;
   if(old){for(const p of candidate.prepare('SELECT id,folder_path FROM projects WHERE folder_path IS NOT NULL').all())if(inside(old,p.folder_path))candidate.prepare('UPDATE projects SET folder_path=? WHERE id=?').run(resolve(path,relative(old,p.folder_path)),p.id);
    for(const o of candidate.prepare("SELECT * FROM file_objects WHERE storage_mode='reference' AND purged_at IS NULL").all())if(inside(old,o.path)){const suffix=relative(old,o.path).replaceAll('\\','/'),owned=candidate.prepare("SELECT 1 FROM file_objects WHERE root_id=? AND path=? COLLATE NOCASE AND storage_mode='managed' AND purged_at IS NULL").get(r.id,suffix);if(owned)candidate.prepare('UPDATE file_objects SET path=?,trash_path=? WHERE id=?').run(resolve(path,suffix),o.trash_path&&inside(old,o.trash_path)?resolve(path,relative(old,o.trash_path)):o.trash_path,o.id);}
    for(const t of candidate.prepare('SELECT * FROM file_trash WHERE root_id=?').all(r.id)){const payload=JSON.parse(t.payload);if(payload.source_abs&&inside(old,payload.source_abs)){payload.source_abs=resolve(path,relative(old,payload.source_abs));candidate.prepare('UPDATE file_trash SET payload=? WHERE id=?').run(JSON.stringify(payload),t.id);}}
   }
  }
  for(const f of candidate.prepare('SELECT * FROM storage_folders').all()){const r=candidate.prepare('SELECT * FROM storage_roots WHERE id=?').get(f.root_id);await mkdir(await safePath(r.path,f.path),{recursive:true});}
  for(const t of candidate.prepare('SELECT * FROM file_trash WHERE stored_path IS NOT NULL').all()){const r=candidate.prepare('SELECT * FROM storage_roots WHERE id=?').get(t.root_id),p=JSON.parse(t.payload);if(p.dirs?.length)for(const d of p.dirs)await mkdir(await safePath(r.path,t.stored_path+(d?'/'+d:''),true),{recursive:true});}
  for(const f of m.files){const o=candidate.prepare('SELECT * FROM file_objects WHERE id=?').get(f.id),target=await objectPath(candidate,runtime.databasePath,o,{trash:true});if(!inside(fileRoot,target))fail('恢复路径超出目标目录。',403);await mkdir(dirname(target),{recursive:true});await copyFile(resolve(checked.directory,f.file),target,constants.COPYFILE_EXCL);if(await digest(target)!==f.sha256)fail('恢复文件校验失败。');}
  if(candidate.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||candidate.prepare('PRAGMA foreign_key_check').all().length)fail('恢复数据校验未通过。');
 }finally{candidate.close();}
 // Never overwrite existing managed directories. Keep a complete pre-restore safety snapshot.
 const safetyParent=resolve(data,'recovery');await mkdir(safetyParent,{recursive:true});const safety=await createBackup(runtime.db,runtime.databasePath,{directory:safetyParent,allow_missing:true});
 const old=resolve(data,'before-restore-'+id+'.sqlite');runtime.db.exec('PRAGMA wal_checkpoint(TRUNCATE);PRAGMA journal_mode=DELETE;');runtime.db.close();
 let previousMoved=false,candidateMoved=false;
 try{prepareRestore(runtime.databasePath,old,staged);await rename(runtime.databasePath,old);previousMoved=true;await rename(staged,runtime.databasePath);candidateMoved=true;runtime.db=openDatabase(data).db;}
 catch(e){if(candidateMoved&&await exists(runtime.databasePath))await rename(runtime.databasePath,resolve(data,'failed-restore-'+id+'.sqlite'));if(previousMoved&&await exists(old))await rename(old,runtime.databasePath);runtime.db=openDatabase(data).db;throw e;}
 return {restored:true,files:m.files.length,file_root:fileRoot,safety_backup:safety.path,missing:m.missing,references:checked.references};
}
