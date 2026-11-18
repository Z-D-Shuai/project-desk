import {randomUUID} from 'node:crypto';
import {mkdir,readdir,stat,lstat,rename,copyFile,rm,rmdir,unlink} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,dirname,basename,extname,relative} from 'node:path';
import {spawn} from 'node:child_process';
import {transaction,getProject} from './projects.mjs';
import {saveResource} from './library.mjs';
import {fail,time,inside,exists,name,rel,rootPath,getRoot,safePath,validateRoot,digest,describe,objectPath,getFile,usage,tree} from './file-paths.mjs';

export async function initializeStorage(db,databasePath){for(const r of db.prepare('SELECT * FROM storage_roots').all())if(r.path.startsWith('@data/')&&!db.prepare('SELECT 1 FROM file_objects WHERE root_id=? AND purged_at IS NULL').get(r.id)&&!db.prepare('SELECT 1 FROM storage_folders WHERE root_id=?').get(r.id))await mkdir(rootPath(r,databasePath),{recursive:true});await recoverJobs(db);}
export async function readStorage(db,databasePath){
 const roots=await Promise.all(db.prepare('SELECT * FROM storage_roots ORDER BY created_at,id').all().map(async r=>({...r,path:rootPath(r,databasePath),available:await exists(rootPath(r,databasePath))})));
 const files=await Promise.all(db.prepare('SELECT * FROM file_objects WHERE purged_at IS NULL ORDER BY created_at DESC').all().map(async o=>{let present=false,path='',error='';try{path=await objectPath(db,databasePath,o,{trash:true});present=await exists(path);}catch(e){error=e.message;}return {...o,absolute_path:path,available:present,error,usage:usage(db,[o.id])};}));
 const projectFolders=await Promise.all(db.prepare('SELECT id,folder_path FROM projects WHERE folder_path IS NOT NULL AND deleted_at IS NULL').all().map(async p=>({...p,available:await exists(p.folder_path)})));
 return {roots,files,projectFolders,jobs:db.prepare("SELECT id,status,error FROM disk_jobs WHERE status NOT IN('done','cancelled')").all()};
}
export async function saveRoot(db,databasePath,id,b){
 if(typeof b.name!=='string'||!b.name.trim()||b.name.length>80||!['image','video','file','project','other'].includes(b.role))fail('目录名称或用途无效。');
 const path=await validateRoot(b.path,databasePath);
 for(const r of db.prepare('SELECT * FROM storage_roots').all())if(r.id!==id&&(inside(rootPath(r,databasePath),path)||inside(path,rootPath(r,databasePath))))fail('存储目录不能相互嵌套或重叠。');
 if(id){const old=getRoot(db,id);if(old.revision!==b.revision)fail('目录设置已更新，请刷新。',409);
  if(rootPath(old,databasePath).toLowerCase()!==path.toLowerCase()&&!await exists(rootPath(old,databasePath))){
   if(!b.relocate_existing)fail('原位置不可用，请确认重新定位到内容一致的目录。',409);
   for(const o of db.prepare('SELECT * FROM file_objects WHERE root_id=? AND purged_at IS NULL').all(id)){const candidate=await safePath(path,o.trash_path||o.path,true);if(!await exists(candidate)||o.sha256&&await digest(candidate)!==o.sha256)fail('新目录缺少相同内容的文件，未更改原设置。',409);}
  }
  if(rootPath(old,databasePath).toLowerCase()!==path.toLowerCase()&&await exists(rootPath(old,databasePath))&&(await readdir(rootPath(old,databasePath))).length){
   if(!b.move_existing)fail('原目录含内容，请确认将内容整体迁移到新的空目录。',409);
   if((await readdir(path)).length)fail('迁移目标必须为空文件夹，未覆盖任何内容。',409);
   const from=rootPath(old,databasePath);await tree(from);await rmdir(path);
   try{return await relocate(db,{from,to:path,rootUpdate:{id,path,name:b.name.trim(),role:b.role}});}catch(e){if(!await exists(path))await mkdir(path).catch(()=>{});throw e;}
  }
  db.prepare('UPDATE storage_roots SET name=?,role=?,path=?,revision=revision+1 WHERE id=?').run(b.name.trim(),b.role,path,id);
 }else{id=randomUUID();db.prepare('INSERT INTO storage_roots(id,name,role,path,created_at) VALUES(?,?,?,?,?)').run(id,b.name.trim(),b.role,path,time());}
 return getRoot(db,id);
}
export function removeRoot(db,id,b){if(id==='preset-images')fail('预设图片目录可修改位置，但不能移除。');const r=getRoot(db,id);if(r.revision!==b.revision)fail('目录已更新。',409);if(db.prepare('SELECT 1 FROM file_objects WHERE root_id=?').get(id)||db.prepare('SELECT 1 FROM file_trash WHERE root_id=?').get(id)||db.prepare('SELECT 1 FROM storage_folders WHERE root_id=?').get(id))fail('仍有登记内容或历史记录，不能移除目录。');db.prepare('DELETE FROM storage_roots WHERE id=?').run(id);return {removed:true};}
export async function browse(db,databasePath,b){const r=getRoot(db,b.root_id),folder=rel(b.path||''),base=rootPath(r,databasePath),path=await safePath(base,folder);if(!await exists(path))fail('目录不可用，可能磁盘未连接。',404);
 const entries=[];for(const d of await readdir(path,{withFileTypes:true})){if(d.name.startsWith('.project-desk-')||d.isSymbolicLink())continue;const item=folder?folder+'/'+d.name:d.name;const info=await stat(resolve(path,d.name));entries.push({name:d.name,path:item,directory:d.isDirectory(),size:info.size,modified:info.mtime.toISOString(),file_id:db.prepare('SELECT id FROM file_objects WHERE root_id=? AND path=? COLLATE NOCASE AND deleted_at IS NULL AND purged_at IS NULL').get(r.id,item)?.id||null});}
 return {root:r.id,path:folder,absolute_path:path,entries:entries.sort((a,b)=>Number(b.directory)-Number(a.directory)||a.name.localeCompare(b.name))};
}
export async function createFolder(db,databasePath,b){const root=getRoot(db,b.root_id),parent=rel(b.parent||''),path=parent?parent+'/'+name(b.name):name(b.name),absolute=await safePath(rootPath(root,databasePath),path);await mkdir(absolute);db.prepare('INSERT OR IGNORE INTO storage_folders VALUES(?,?)').run(root.id,path);return {path};}

async function uniqueDestination(base,folder,filename){filename=name(filename);const ext=extname(filename),stem=basename(filename,ext);for(let n=0;n<10000;n++){const candidate=(folder?folder+'/':'')+(n?`${stem} (${n+1})${ext}`:filename);if(!await exists(await safePath(base,candidate)))return candidate;}fail('同名文件过多，请换个文件名。');}
async function matchesCurrentFile(db,databasePath,o,expected){
 let current;
 try{current=await describe(await objectPath(db,databasePath,o));}catch(error){if(['ENOENT','ENOTDIR','ENODEV'].includes(error.code))return false;throw error;}
 if(o.sha256!==current.sha256||o.size!==current.size||o.mime!==current.mime){db.prepare('UPDATE file_objects SET sha256=?,size=?,mime=?,revision=revision+1 WHERE id=?').run(current.sha256,current.size,current.mime,o.id);Object.assign(o,current);}
 return current.sha256===expected.sha256&&current.size===expected.size;
}
export async function attachFile(db,databasePath,{source,filename,mode='managed',root_id,folder='',project_ids=[],resource=null,metadata=null}){
 if(!['managed','reference'].includes(mode))fail('导入方式无效。');filename=name(filename||basename(source));const info=metadata||await describe(source);if(!info.size)fail('不能导入空文件。');
 const kind=info.mime.startsWith('image/')?'image':info.mime.startsWith('video/')?'video':'file';
 if(resource&&resource.kind!=='file'&&resource.kind!==kind)fail('文件内容与资料类型不符。');
 const duplicates= !resource?db.prepare(`SELECT r.id,r.title,o.id AS file_id FROM resources r JOIN file_assets a ON a.id=r.asset_id JOIN file_objects o ON o.id=a.file_id WHERE r.deleted_at IS NULL AND o.deleted_at IS NULL AND o.purged_at IS NULL AND o.storage_mode=? AND ${mode==='reference'?'o.path=? COLLATE NOCASE':'o.sha256=?'}`).all(mode,mode==='reference'?source:info.sha256):[];
 for(const duplicate of duplicates){const o=getFile(db,duplicate.file_id);if(await matchesCurrentFile(db,databasePath,o,info)){mergeProjects(db,duplicate.id,project_ids);return {id:duplicate.id,title:duplicate.title,duplicate:true,file_id:o.id};}}
 let o,createdPath=null;
 if(mode==='reference'){
  o=db.prepare("SELECT * FROM file_objects WHERE storage_mode='reference' AND path=? COLLATE NOCASE AND deleted_at IS NULL AND purged_at IS NULL").get(source);
  if(o&&!await matchesCurrentFile(db,databasePath,o,info))fail('导入期间源文件内容发生变化，请重试。',409);
 }else{
  const defaultId=db.prepare('SELECT id FROM storage_roots WHERE role=? ORDER BY CASE WHEN id=? THEN 0 ELSE 1 END,created_at LIMIT 1').get(kind,{image:'images',video:'videos',file:'attachments'}[kind])?.id;if(!root_id&&!defaultId)fail('请先在设置中添加对应资料类型的存储目录。');const root=getRoot(db,root_id||defaultId);folder=rel(folder);const base=rootPath(root,databasePath);await safePath(base,folder);if(!await exists(resolve(base,folder)))fail('目标文件夹不存在或磁盘不可用。');
  const candidates=db.prepare("SELECT * FROM file_objects WHERE storage_mode='managed' AND root_id=? AND sha256=? AND deleted_at IS NULL AND purged_at IS NULL").all(root.id,info.sha256);
  for(const c of candidates)if(await matchesCurrentFile(db,databasePath,c,info)){o=c;break;}
  if(!o){const path=await uniqueDestination(base,folder,filename),absolute=await safePath(base,path);await copyFile(source,absolute,constants.COPYFILE_EXCL);createdPath=absolute;o={id:randomUUID(),root_id:root.id,path,storage_mode:mode,name:filename,...info};}
 }
 if(!o)o={id:randomUUID(),root_id:null,path:source,storage_mode:mode,name:filename,...info};
 let r=resource;
 // Files are copied before the short transaction. A failed commit only removes our new copy.
 try{
  if(!r)r=saveResource(db,null,{title:filename.slice(0,160),kind,favorite:false,project_ids});
  return transaction(db,()=>{if(resource){const fresh=db.prepare('SELECT * FROM resources WHERE id=? AND deleted_at IS NULL').get(resource.id);if(!fresh||fresh.revision!==resource.revision)fail('上传期间资料已修改，请刷新重试。',409);}
   if(!db.prepare('SELECT 1 FROM file_objects WHERE id=?').get(o.id))db.prepare('INSERT INTO file_objects(id,root_id,path,storage_mode,name,mime,size,sha256,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(o.id,o.root_id,o.path,o.storage_mode,o.name,o.mime,o.size,o.sha256,time());
   const asset=randomUUID(),legacy=mode==='managed'?relative(dirname(databasePath),createdPath||resolve(rootPath(getRoot(db,o.root_id),databasePath),o.path)).replaceAll('\\','/'):source;
   db.prepare('INSERT INTO file_assets(id,resource_id,storage_mode,path,created_at,original_name,mime,size,sha256,file_id) VALUES(?,?,?,?,?,?,?,?,?,?)').run(asset,r.id,mode,legacy,time(),filename,info.mime,info.size,info.sha256,o.id);
   db.prepare('UPDATE resources SET asset_id=?,revision=revision+1,updated_at=? WHERE id=?').run(asset,time(),r.id);
   return {...db.prepare('SELECT * FROM resources WHERE id=?').get(r.id),file_id:o.id,duplicate:false};});
 }catch(e){if(createdPath)await unlink(createdPath).catch(()=>{});throw e;}
}
function mergeProjects(db,id,ids){transaction(db,()=>{for(const p of ids){getProject(db,p);const changed=db.prepare('INSERT OR IGNORE INTO project_resources VALUES(?,?)').run(p,id).changes;if(changed){db.prepare('UPDATE projects SET revision=revision+1,updated_at=? WHERE id=?').run(time(),p);db.prepare('UPDATE resources SET revision=revision+1,updated_at=? WHERE id=?').run(time(),id);}}});}
export async function importPaths(db,databasePath,b){if(!Array.isArray(b.paths)||!b.paths.length||b.paths.length>200)fail('每批请选择 1–200 个文件。');if(!['managed','reference'].includes(b.mode))fail('导入方式无效。');const results=[];for(const path of b.paths){try{if(typeof path!=='string'||!resolve(path)||!path.match(/^(?:[A-Za-z]:[\\/]|\/|\\\\)/))fail('请使用完整的本地文件路径。');const info=await lstat(path);if(!info.isFile()||info.isSymbolicLink())fail('请选择普通文件，不能直接导入文件夹或链接。');results.push({path,ok:true,...await attachFile(db,databasePath,{source:resolve(path),mode:b.mode,root_id:b.root_id,folder:b.folder,project_ids:b.project_ids||[]})});}catch(e){results.push({path,ok:false,error:e.message});}}return {results};}

function applyPlan(db,p){if(!p.trash&&!p.removeTrash&&!p.rootUpdate){for(const project of db.prepare('SELECT id,folder_path FROM projects WHERE folder_path IS NOT NULL').all())if(inside(p.from,project.folder_path))db.prepare('UPDATE projects SET folder_path=?,revision=revision+1,updated_at=? WHERE id=?').run(resolve(p.to,relative(p.from,project.folder_path)),time(),project.id);for(const ref of db.prepare("SELECT * FROM file_objects WHERE storage_mode='reference' AND deleted_at IS NULL AND purged_at IS NULL").all())if(inside(p.from,ref.path))db.prepare('UPDATE file_objects SET path=?,name=?,revision=revision+1 WHERE id=?').run(resolve(p.to,relative(p.from,ref.path)),basename(resolve(p.to,relative(p.from,ref.path))),ref.id);}
 if(p.projectRestore){for(const id of p.projectRestore.ids){const project=db.prepare('SELECT folder_path FROM projects WHERE id=?').get(id);if(project?.folder_path&&inside(p.projectRestore.from,project.folder_path))db.prepare('UPDATE projects SET folder_path=?,revision=revision+1,updated_at=? WHERE id=?').run(resolve(p.to,relative(p.projectRestore.from,project.folder_path)),time(),id);}}
 if(p.rootUpdate){const r=p.rootUpdate;db.prepare('UPDATE storage_roots SET path=?,name=?,role=?,revision=revision+1 WHERE id=?').run(r.path,r.name,r.role,r.id);for(const project of db.prepare('SELECT id,folder_path FROM projects WHERE folder_path IS NOT NULL').all())if(inside(p.from,project.folder_path))db.prepare('UPDATE projects SET folder_path=?,revision=revision+1,updated_at=? WHERE id=?').run(resolve(p.to,relative(p.from,project.folder_path)),time(),project.id);for(const ref of db.prepare("SELECT * FROM file_objects WHERE storage_mode='reference' AND purged_at IS NULL").all())if(inside(p.from,ref.path))db.prepare('UPDATE file_objects SET path=?,trash_path=?,revision=revision+1 WHERE id=?').run(resolve(p.to,relative(p.from,ref.path)),ref.trash_path&&inside(p.from,ref.trash_path)?resolve(p.to,relative(p.from,ref.trash_path)):ref.trash_path,ref.id);for(const t of db.prepare('SELECT * FROM file_trash WHERE root_id=?').all(r.id)){const v=JSON.parse(t.payload);if(v.source_abs&&inside(p.from,v.source_abs)){v.source_abs=resolve(p.to,relative(p.from,v.source_abs));db.prepare('UPDATE file_trash SET payload=? WHERE id=?').run(JSON.stringify(v),t.id);}}}
 for(const u of p.objects||[])db.prepare('UPDATE file_objects SET root_id=?,path=?,name=?,deleted_at=?,trash_path=?,revision=revision+1 WHERE id=?').run(u.root_id,u.path,u.name||basename(u.path),u.deleted_at??null,u.trash_path??null,u.id);
 if(p.removeFolders)for(const f of p.removeFolders)db.prepare('DELETE FROM storage_folders WHERE root_id=? AND path=?').run(f.root_id,f.path);
 for(const f of p.addFolders||[])db.prepare('INSERT OR IGNORE INTO storage_folders VALUES(?,?)').run(f.root_id,f.path);
 if(p.trash)db.prepare('INSERT INTO file_trash VALUES(?,?,?,?,?,?)').run(p.trash.id,p.trash.root_id,p.trash.original_path,p.trash.stored_path,JSON.stringify(p.trash.payload),p.trash.deleted_at);
 if(p.removeTrash)db.prepare('DELETE FROM file_trash WHERE id=?').run(p.removeTrash);
}
async function relocate(db,p){const id=randomUUID();if(await exists(p.to))fail('目标已存在，请更换名称或文件夹。',409);await mkdir(dirname(p.to),{recursive:true});db.prepare('INSERT INTO disk_jobs VALUES(?,?,?, ?,NULL)').run(id,JSON.stringify(p),'planned',time());
 try{await rename(p.from,p.to);}catch(e){if(e.code!=='EXDEV'){db.prepare("UPDATE disk_jobs SET status='cancelled',error=? WHERE id=?").run(e.message,id);throw e;}
  const listing=await tree(p.from);if(listing.dirs.length){await mkdir(p.to);for(const dir of listing.dirs.filter(Boolean))await mkdir(resolve(p.to,dir),{recursive:true});}
  for(const f of listing.files){const src=f?resolve(p.from,f):p.from,dst=f?resolve(p.to,f):p.to;await copyFile(src,dst,constants.COPYFILE_EXCL);if(await digest(src)!==await digest(dst))fail('移动校验失败，原文件保留。');}
  db.prepare("UPDATE disk_jobs SET status='copied' WHERE id=?").run(id);
 }
 transaction(db,()=>{applyPlan(db,p);db.prepare("UPDATE disk_jobs SET status='committed' WHERE id=?").run(id);});
 if(await exists(p.from)){// Only the checked source of this explicit move is removed after a verified copy.
  await rm(p.from,{recursive:true,force:false});
 }
 db.prepare("UPDATE disk_jobs SET status='done' WHERE id=?").run(id);return {saved:true};
}
export async function recoverJobs(db){for(const j of db.prepare("SELECT * FROM disk_jobs WHERE status IN('planned','copied','committed')").all()){const p=JSON.parse(j.payload),source=await exists(p.from),target=await exists(p.to);if(target&&(!source||j.status==='copied'||j.status==='committed')){transaction(db,()=>{if(j.status!=='committed')applyPlan(db,p);db.prepare("UPDATE disk_jobs SET status=?,error=? WHERE id=?").run(source?'source_retained':'done',source?'移动已恢复；原位置仍保留副本，请检查后自行处理。':null,j.id);});}else db.prepare('UPDATE disk_jobs SET status=?,error=? WHERE id=?').run(source&&!target?'cancelled':'needs_review','操作中断，现有文件未自动删除，请检查原位置及目标位置。',j.id);}}
export async function moveNode(db,databasePath,b){const fromRoot=getRoot(db,b.root_id),toRoot=getRoot(db,b.target_root_id||b.root_id),old=rel(b.path),folder=rel(b.target_folder||'');if(!old)fail('不能移动存储根目录。');const path=(folder?folder+'/':'')+name(b.name||basename(old));const from=await safePath(rootPath(fromRoot,databasePath),old),to=await safePath(rootPath(toRoot,databasePath),path);if(inside(from,to))fail('不能移入自身或子目录。');await tree(from);
 const objects=db.prepare('SELECT * FROM file_objects WHERE root_id=? AND deleted_at IS NULL AND purged_at IS NULL').all(fromRoot.id).filter(o=>o.path===old||o.path.startsWith(old+'/')).map(o=>({...o,root_id:toRoot.id,path:path+o.path.slice(old.length),name:basename(path+o.path.slice(old.length))}));
 const folders=db.prepare('SELECT * FROM storage_folders WHERE root_id=?').all(fromRoot.id).filter(f=>f.path===old||f.path.startsWith(old+'/'));
 return relocate(db,{from,to,objects,removeFolders:folders,addFolders:folders.map(f=>({root_id:toRoot.id,path:path+f.path.slice(old.length)}))});
}
export async function trashNode(db,databasePath,b){
 if(b.file_id){const o=getFile(db,b.file_id);if(o.deleted_at||o.purged_at)fail('文件已移入回收站。',409);if(o.storage_mode==='reference'){if(usage(db,[o.id]).some(u=>!u.deleted_at)&&!b.acknowledge_usage)fail('文件仍有关联资料，请确认影响范围。',409);const id=randomUUID();return transaction(db,()=>{db.prepare('UPDATE file_objects SET deleted_at=?,revision=revision+1 WHERE id=?').run(time(),o.id);db.prepare('INSERT INTO file_trash VALUES(?,NULL,?,NULL,?,?)').run(id,o.path,JSON.stringify({reference:true,objects:[o.id],dirs:[]}),time());return {id};});}b={...b,root_id:o.root_id,path:o.path};}
 const root=getRoot(db,b.root_id),path=rel(b.path);if(!path)fail('不能删除存储根目录。');const base=rootPath(root,databasePath),from=await safePath(base,path),listing=await tree(from);
 let objects=db.prepare('SELECT * FROM file_objects WHERE root_id=? AND deleted_at IS NULL AND purged_at IS NULL').all(root.id).filter(o=>o.path===path||o.path.startsWith(path+'/'));
 objects.push(...db.prepare("SELECT * FROM file_objects WHERE storage_mode='reference' AND deleted_at IS NULL AND purged_at IS NULL").all().filter(o=>inside(from,o.path)));
 if(usage(db,objects.map(o=>o.id)).some(u=>!u.deleted_at)&&!b.acknowledge_usage)fail('仍有资料或项目使用其中的文件，请确认影响范围。',409);
 // Register otherwise untracked files before recycling so a full backup includes them.
 for(const f of listing.files){const p=f?path+'/'+f:path;if(!objects.some(o=>o.storage_mode==='managed'&&o.path===p)){const info=await describe(f?resolve(from,f):from),o={id:randomUUID(),root_id:root.id,path:p,storage_mode:'managed',name:basename(p),...info};db.prepare('INSERT INTO file_objects(id,root_id,path,storage_mode,name,mime,size,sha256,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(o.id,o.root_id,o.path,o.storage_mode,o.name,o.mime,o.size,o.sha256,time());objects.push(o);}}
 const id=randomUUID(),stored='.project-desk-trash/'+id+'/'+basename(path),to=await safePath(base,stored,true),deleted_at=time();const folders=db.prepare('SELECT * FROM storage_folders WHERE root_id=?').all(root.id).filter(f=>f.path===path||f.path.startsWith(path+'/'));
 const project_ids=db.prepare('SELECT id,folder_path FROM projects WHERE folder_path IS NOT NULL').all().filter(p=>inside(from,p.folder_path)).map(p=>p.id);
 await relocate(db,{from,to,objects:objects.map(o=>({...o,deleted_at,trash_path:o.storage_mode==='reference'?resolve(to,relative(from,o.path)):stored+o.path.slice(path.length)})),removeFolders:folders,trash:{id,root_id:root.id,original_path:path,stored_path:stored,deleted_at,payload:{source_abs:from,objects:objects.map(o=>o.id),dirs:listing.dirs,folders,project_ids}}});return {id};
}
export function readTrash(db){return {resources:db.prepare('SELECT id,title,kind,deleted_at,revision FROM resources WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC').all(),files:db.prepare('SELECT * FROM file_trash ORDER BY deleted_at DESC').all().map(t=>({...t,payload:JSON.parse(t.payload),usage:usage(db,JSON.parse(t.payload).objects)}))};}
export async function restoreTrash(db,databasePath,id,b){if(b.type==='resource'){return transaction(db,()=>{const r=db.prepare('SELECT * FROM resources WHERE id=? AND deleted_at IS NOT NULL').get(id);if(!r)fail('回收记录不存在。',404);if(r.revision!==b.revision)fail('记录已变化，请刷新。',409);if(r.source_url&&db.prepare('SELECT 1 FROM resources WHERE source_url=? AND deleted_at IS NULL').get(r.source_url))fail('资料库已有相同网址，请先处理重复记录。',409);db.prepare('UPDATE resources SET deleted_at=NULL,revision=revision+1,updated_at=? WHERE id=?').run(time(),id);return {restored:true};});}
 const t=db.prepare('SELECT * FROM file_trash WHERE id=?').get(id);if(!t)fail('回收内容不存在。',404);const p=JSON.parse(t.payload);if(p.reference)return transaction(db,()=>{for(const oid of p.objects)db.prepare('UPDATE file_objects SET deleted_at=NULL,revision=revision+1 WHERE id=?').run(oid);db.prepare('DELETE FROM file_trash WHERE id=?').run(id);return {restored:true};});
 const root=rootPath(getRoot(db,t.root_id),databasePath),original=rel(b.path||t.original_path),objects=p.objects.map(oid=>getFile(db,oid)).map(o=>({...o,path:o.storage_mode==='reference'?resolve(root,original,relative(p.source_abs,o.path)):original+o.path.slice(t.original_path.length),deleted_at:null,trash_path:null}));
 const project_ids=p.project_ids??db.prepare('SELECT id,folder_path FROM projects WHERE folder_path IS NOT NULL').all().filter(project=>inside(p.source_abs,project.folder_path)).map(project=>project.id);
 return relocate(db,{from:await safePath(root,t.stored_path,true),to:await safePath(root,original),objects,addFolders:(p.folders||[]).map(f=>({...f,path:original+f.path.slice(t.original_path.length)})),projectRestore:{from:p.source_abs,ids:project_ids},removeTrash:id});
}
export async function purgeTrash(db,databasePath,id,b){if(b.confirm!=='永久删除')fail('请输入“永久删除”以确认。');if(b.type==='resource'){return transaction(db,()=>{const r=db.prepare('SELECT * FROM resources WHERE id=? AND deleted_at IS NOT NULL').get(id);if(!r)fail('只能永久删除回收站中的记录。');db.prepare('DELETE FROM project_resources WHERE resource_id=?').run(id);db.prepare('DELETE FROM resource_tag_links WHERE resource_id=?').run(id);db.prepare('DELETE FROM resource_collection_links WHERE resource_id=?').run(id);db.prepare('UPDATE resources SET asset_id=NULL WHERE id=?').run(id);db.prepare('DELETE FROM file_assets WHERE resource_id=?').run(id);db.prepare('DELETE FROM resources WHERE id=?').run(id);return {purged:true,files_retained:true};});}
 const t=db.prepare('SELECT * FROM file_trash WHERE id=?').get(id);if(!t)fail('回收内容不存在。',404);const p=JSON.parse(t.payload);if(!p.reference){const root=rootPath(getRoot(db,t.root_id),databasePath),target=await safePath(root,t.stored_path,true);if(!t.stored_path.startsWith('.project-desk-trash/'+id+'/'))fail('回收站路径无效。',403);await rm(target,{recursive:true,force:true});}
 transaction(db,()=>{for(const oid of p.objects)db.prepare('UPDATE file_objects SET purged_at=?,revision=revision+1 WHERE id=?').run(time(),oid);db.prepare('DELETE FROM file_trash WHERE id=?').run(id);});return {purged:true,external_files_untouched:!!p.reference};
}
export async function relink(db,databasePath,id,b){const o=getFile(db,id);if(o.revision!==b.revision)fail('文件信息已更新。',409);if(o.deleted_at||o.purged_at)fail('请先恢复回收站中的文件引用。');const path=resolve(b.path||'');if(!b.path||!await exists(path)||(await lstat(path)).isSymbolicLink())fail('请选择存在的普通文件。');const info=await describe(path);if(o.sha256&&o.sha256!==info.sha256&&!b.allow_changed)fail('新文件内容不同。如确实需要替换，请明确勾选允许更换内容。',409);
 let root_id=null,target=path,mode='reference';for(const r of db.prepare('SELECT * FROM storage_roots').all())if(inside(rootPath(r,databasePath),path)){root_id=r.id;target=relative(rootPath(r,databasePath),path).replaceAll('\\','/');await safePath(rootPath(r,databasePath),target);mode='managed';break;}
 db.prepare('UPDATE file_objects SET root_id=?,path=?,storage_mode=?,name=?,size=?,mime=?,sha256=?,revision=revision+1 WHERE id=?').run(root_id,target,mode,basename(path),info.size,info.mime,info.sha256,id);return {saved:true};
}
export async function projectFolder(db,id,b){const p=getProject(db,id);if(p.revision!==b.revision)fail('项目已更新，请刷新。',409);const path=b.path?resolve(b.path):null;if(path&&!(await stat(path)).isDirectory())fail('请选择存在的文件夹。');db.prepare('UPDATE projects SET folder_path=?,revision=revision+1,updated_at=? WHERE id=?').run(path,time(),id);return {saved:true};}

export async function chooseList(db,databasePath,b){
 const drives=[];if(process.platform==='win32'){for(const letter of 'CDEFGHIJKLMNOPQRSTUVWXYZ')if(await exists(letter+':/'))drives.push(letter+':/');}else drives.push('/');
 const path=b.path?resolve(b.path):drives.find(p=>inside(p,databasePath))||drives[0];if(typeof b.path==='string'&&b.path.includes('\0')||!path||!drives.some(d=>inside(d,path)))fail('请选择可用的本地磁盘路径。');
 const info=await lstat(path);if(!info.isDirectory()||info.isSymbolicLink())fail('请选择实际文件夹。');
 const entries=[];for(const d of await readdir(path,{withFileTypes:true})){if(d.isSymbolicLink()||d.name.startsWith('.')||d.name==='$RECYCLE.BIN'||d.name==='System Volume Information')continue;if(d.isDirectory())entries.push({name:d.name,path:resolve(path,d.name),directory:true});else if(d.isFile()&&b.kind==='files')entries.push({name:d.name,path:resolve(path,d.name),directory:false});}
 return {path,drives,parent:dirname(path),entries:entries.sort((a,b)=>Number(b.directory)-Number(a.directory)||a.name.localeCompare(b.name))};
}
export async function reveal(db,databasePath,b){let path;if(b.file_id)path=await objectPath(db,databasePath,getFile(db,b.file_id),{trash:true});else if(b.project_id)path=getProject(db,b.project_id).folder_path;else path=await safePath(rootPath(getRoot(db,b.root_id),databasePath),b.path||'');if(!path||!await exists(path))fail('位置不可用，请检查磁盘或重新定位。',404);if(process.platform!=='win32')fail('资源管理器仅支持 Windows。');const directory=(await stat(path)).isDirectory();await new Promise((resolve,reject)=>{const child=spawn('explorer.exe',directory?[path]:['/select,',path],{windowsHide:false,stdio:'ignore'});child.once('spawn',()=>{child.unref();resolve();});child.once('error',reject);});return {opened:true};}
