import {randomUUID} from 'node:crypto';
import {HttpError,getProject,transaction} from './projects.mjs';
const fail=(message,status=400)=>{throw new HttpError(status,message);};
const now=()=>new Date().toISOString();
export const kinds=['video_link','image','web','text','file','video'];
export const resourceStatuses=['unsorted','to_view','learning','learned','used','archived'];
const tables={categories:'resource_categories',tags:'resource_tags',collections:'resource_collections'};
function object(b,keys){if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!keys.includes(k)))fail('请求字段无效。');}
function text(v='',max=5000){if(typeof v!=='string'||v.length>max||v.includes('\0'))fail(`文本格式无效或超过 ${max} 字符。`);return v.trim();}
function version(row,expected){if(!Number.isInteger(expected)||row.revision!==expected)fail('资料已更新，请关闭表单并刷新后重试。',409);}
function tableFor(type){if(!Object.hasOwn(tables,type))fail('整理类型无效。');return tables[type];}
export function taxonomy(db,type,id){const table=tableFor(type);const row=db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);if(!row)fail('分类、标签或收藏夹已不存在。',404);return row;}
export function getResource(db,id){const row=db.prepare('SELECT * FROM resources WHERE id=? AND deleted_at IS NULL').get(id);if(!row)fail('资料不存在或已删除。',404);return row;}
export function readLibrary(db){
 const tagLinks=db.prepare('SELECT * FROM resource_tag_links').all(),collectionLinks=db.prepare('SELECT * FROM resource_collection_links').all();
 const projectLinks=db.prepare('SELECT pr.* FROM project_resources pr JOIN projects p ON p.id=pr.project_id WHERE p.deleted_at IS NULL').all();
 const rows=db.prepare(`SELECT r.*,COALESCE(o.name,f.original_name) AS original_name,COALESCE(o.mime,f.mime) AS mime,COALESCE(o.size,f.size) AS size,f.file_id,o.storage_mode,o.deleted_at AS file_deleted_at,o.purged_at AS file_purged_at FROM resources r LEFT JOIN file_assets f ON f.id=r.asset_id LEFT JOIN file_objects o ON o.id=f.file_id WHERE r.deleted_at IS NULL ORDER BY r.created_at DESC,r.id`).all();
 return {resources:rows.map(r=>({...r,tag_ids:tagLinks.filter(l=>l.resource_id===r.id).map(l=>l.tag_id),collection_ids:collectionLinks.filter(l=>l.resource_id===r.id).map(l=>l.collection_id),project_ids:projectLinks.filter(l=>l.resource_id===r.id).map(l=>l.project_id)})),libraryCategories:db.prepare('SELECT * FROM resource_categories ORDER BY sort_order,id').all(),libraryTags:db.prepare('SELECT * FROM resource_tags ORDER BY sort_order,id').all(),libraryCollections:db.prepare('SELECT * FROM resource_collections ORDER BY sort_order,id').all()};
}
export function saveTaxonomy(db,type,id,b){
 const table=tableFor(type);object(b,['name','icon','revision']);const name=text(b.name,40),icon=text(b.icon??'folder',24);if(!name||!icon)fail('名称和图标不能为空。');
 return transaction(db,()=>{const time=now();try{if(id){version(taxonomy(db,type,id),b.revision);db.prepare(`UPDATE ${table} SET name=?,icon=?,revision=revision+1,updated_at=? WHERE id=?`).run(name,icon,time,id);}else{id=randomUUID();const order=db.prepare(`SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM ${table}`).get().n;db.prepare(`INSERT INTO ${table}(id,name,icon,sort_order,created_at,updated_at) VALUES(?,?,?,?,?,?)`).run(id,name,icon,order,time,time);}}catch(err){if(err.message.includes('UNIQUE constraint'))fail('已存在同名内容。',409);throw err;}return taxonomy(db,type,id);});
}
export function sortTaxonomy(db,type,b){const table=tableFor(type);object(b,['ids']);return transaction(db,()=>{const old=db.prepare(`SELECT id FROM ${table}`).all().map(r=>r.id);if(!Array.isArray(b.ids)||new Set(b.ids).size!==old.length||b.ids.length!==old.length||b.ids.some(id=>!old.includes(id)))fail('列表已变化，请刷新后重新排序。',409);b.ids.forEach((id,i)=>db.prepare(`UPDATE ${table} SET sort_order=? WHERE id=?`).run(i,id));return {saved:true};});}
export function deleteTaxonomy(db,type,id,b){const table=tableFor(type);object(b,['revision','replacement_id']);return transaction(db,()=>{
 version(taxonomy(db,type,id),b.revision);
 if(type==='categories'){if(!Object.hasOwn(b,'replacement_id'))fail('请选择转移到其他分类或未分类。');if(b.replacement_id!==null){if(b.replacement_id===id)fail('不能转移到自身。');taxonomy(db,type,b.replacement_id);}db.prepare('UPDATE resources SET category_id=?,updated_at=?,revision=revision+1 WHERE category_id=?').run(b.replacement_id,now(),id);}
 else {const link=type==='tags'?'resource_tag_links':'resource_collection_links',column=type==='tags'?'tag_id':'collection_id';db.prepare(`UPDATE resources SET updated_at=?,revision=revision+1 WHERE id IN(SELECT resource_id FROM ${link} WHERE ${column}=?)`).run(now(),id);db.prepare(`DELETE FROM ${link} WHERE ${column}=?`).run(id);}
 db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);return {deleted:true};
 });}
function ids(value=[]){if(!Array.isArray(value)||value.length>200||new Set(value).size!==value.length||value.some(id=>typeof id!=='string'))fail('关联选择无效。');return value;}
export function saveResource(db,id,b){
 object(b,['title','kind','source_url','content','notes','platform','platform_icon','platform_image_id','category_id','status','favorite','tag_ids','collection_ids','project_ids','revision']);
 return transaction(db,()=>{
  const old=id?getResource(db,id):null;if(old)version(old,b.revision);
  const title=text(b.title,160),kind=b.kind,status=b.status??'unsorted';if(!title)fail('资料标题不能为空。');if(!kinds.includes(kind)||!resourceStatuses.includes(status))fail('资料类型或状态无效。');
  if(old&&old.kind!==kind)fail('已有资料不能改变类型，请新建其他类型资料。');
  let url=text(b.source_url??'',4000);if(['web','video_link'].includes(kind)){let u;try{u=new URL(url);}catch{fail('请填写完整的网址。');}if(!['http:','https:'].includes(u.protocol))fail('仅支持 http / https 网址。');url=u.href;}
  else url='';
  // An exact existing URL is reused by linking that resource to more projects, rather than silently duplicating it.
  if(url){const duplicate=db.prepare('SELECT id FROM resources WHERE source_url=? AND deleted_at IS NULL AND id<>?').get(url,id||'');if(duplicate)fail('此网址已收藏，请搜索已有资料并编辑其项目关联。',409);}
  const content=text(b.content??'',30000),notes=text(b.notes),platform=text(b.platform??'',100),category=b.category_id??null;
  if(kind==='text'&&!content)fail('请填写文字内容。');if(category!==null)taxonomy(db,'categories',category);
  if(typeof b.favorite!=='boolean')fail('收藏标记无效。');
  const tags=ids(b.tag_ids),collections=ids(b.collection_ids),projects=ids(b.project_ids);
  tags.forEach(t=>taxonomy(db,'tags',t));collections.forEach(c=>taxonomy(db,'collections',c));
  const oldProjects=old?db.prepare('SELECT project_id FROM project_resources WHERE resource_id=?').all(id).map(p=>p.project_id):[];
  projects.forEach(p=>{try{getProject(db,p);}catch(err){if(!oldProjects.includes(p))throw err;}});
  for(const oldId of oldProjects)if(!projects.includes(oldId)&&db.prepare('SELECT 1 FROM projects WHERE id=? AND deleted_at IS NOT NULL').get(oldId))projects.push(oldId);
  const time=now();if(id)db.prepare('UPDATE resources SET title=?,source_url=?,content=?,notes=?,platform=?,category_id=?,status=?,favorite=?,updated_at=?,revision=revision+1 WHERE id=?').run(title,url||null,content,notes,platform,category,status,Number(b.favorite),time,id);
  else{id=randomUUID();db.prepare('INSERT INTO resources(id,title,kind,source_url,content,notes,platform,category_id,status,favorite,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,title,kind,url||null,content,notes,platform,category,status,Number(b.favorite),time,time);}
  const platformIcon=text(b.platform_icon??(old?.platform===platform?old.platform_icon:'')??'',24),platformImage=b.platform_image_id===undefined?(old?.platform===platform?old.platform_image_id:null):b.platform_image_id;if(platformImage&&!db.prepare("SELECT 1 FROM file_objects WHERE id=? AND mime LIKE 'image/%' AND deleted_at IS NULL AND purged_at IS NULL").get(platformImage))fail('平台图片不可用。');db.prepare('UPDATE resources SET platform_icon=?,platform_image_id=? WHERE id=?').run(platformIcon,platformImage,id);
  db.prepare('DELETE FROM resource_tag_links WHERE resource_id=?').run(id);for(const tag of tags)db.prepare('INSERT INTO resource_tag_links VALUES(?,?)').run(id,tag);
  db.prepare('DELETE FROM resource_collection_links WHERE resource_id=?').run(id);for(const c of collections)db.prepare('INSERT INTO resource_collection_links VALUES(?,?)').run(id,c);
  db.prepare('DELETE FROM project_resources WHERE resource_id=?').run(id);for(const p of projects)db.prepare('INSERT INTO project_resources VALUES(?,?)').run(p,id);
  for(const p of new Set([...oldProjects,...projects]))if(oldProjects.includes(p)!==projects.includes(p))db.prepare('UPDATE projects SET revision=revision+1,updated_at=? WHERE id=?').run(time,p);
  return getResource(db,id);
 });
}
export function deleteResource(db,id,b){object(b,['revision']);return transaction(db,()=>{version(getResource(db,id),b.revision);db.prepare('UPDATE resources SET deleted_at=?,updated_at=?,revision=revision+1 WHERE id=?').run(now(),now(),id);return {deleted:true};});}
export function viewResource(db,id){getResource(db,id);const time=now();db.prepare('UPDATE resources SET last_viewed_at=? WHERE id=?').run(time,id);return {last_viewed_at:time};}
export function setFavorite(db,id,b){object(b,['revision','favorite']);if(typeof b.favorite!=='boolean')fail('收藏标记无效。');return transaction(db,()=>{version(getResource(db,id),b.revision);db.prepare('UPDATE resources SET favorite=?,updated_at=?,revision=revision+1 WHERE id=?').run(Number(b.favorite),now(),id);return getResource(db,id);});}
export function linkProjectResources(db,id,b){object(b,['resource_ids','revision']);return transaction(db,()=>{
 const project=getProject(db,id);version(project,b.revision);const selected=ids(b.resource_ids);selected.forEach(r=>getResource(db,r));
 const old=db.prepare('SELECT pr.resource_id FROM project_resources pr JOIN resources r ON r.id=pr.resource_id WHERE pr.project_id=? AND r.deleted_at IS NULL').all(id).map(r=>r.resource_id);
 db.prepare('DELETE FROM project_resources WHERE project_id=? AND resource_id IN(SELECT id FROM resources WHERE deleted_at IS NULL)').run(id);for(const r of selected)db.prepare('INSERT INTO project_resources VALUES(?,?)').run(id,r);
 for(const r of new Set([...old,...selected]))if(old.includes(r)!==selected.includes(r))db.prepare('UPDATE resources SET revision=revision+1,updated_at=? WHERE id=?').run(now(),r);
 db.prepare('UPDATE projects SET revision=revision+1,updated_at=? WHERE id=?').run(now(),id);return {saved:true};
 });}
