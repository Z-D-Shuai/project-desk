import {randomUUID} from 'node:crypto';
import {HttpError,getProject,transaction} from './projects.mjs';
const fail=(message,status=400)=>{throw new HttpError(status,message);};
const now=()=>new Date().toISOString();
function obj(b,keys){if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!keys.includes(k)))fail('请求字段无效。');}
function str(v='',max=5000){if(typeof v!=='string'||v.length>max||v.includes('\0'))fail(`文本格式无效或超过 ${max} 字符。`);return v.trim();}
function version(row,b){if(!Number.isInteger(b.revision)||b.revision!==(row?.revision||0))fail('数据已更新，请关闭表单并刷新后重试。',409);}
function participant(db,id,allowDeleted=false){const p=db.prepare('SELECT * FROM participants WHERE id=?').get(id);if(!p||(!allowDeleted&&p.deleted_at))fail('参与者不存在或已删除。',404);return p;}
function ids(db,value=[]){if(!Array.isArray(value)||value.length>100||value.some(v=>typeof v!=='string')||new Set(value).size!==value.length)fail('参与者选择无效。');return value;}
function touch(db,id){db.prepare('UPDATE projects SET updated_at=?,revision=revision+1 WHERE id=?').run(now(),id);}
export function readDevelopment(db){
 const participants=db.prepare('SELECT * FROM participants ORDER BY created_at,id').all();
 const memberships=db.prepare('SELECT pp.* FROM project_participants pp JOIN projects p ON p.id=pp.project_id WHERE p.deleted_at IS NULL').all();
 const links=db.prepare('SELECT * FROM journal_participants').all();
 const journals=db.prepare('SELECT j.* FROM journal_entries j JOIN projects p ON p.id=j.project_id WHERE j.deleted_at IS NULL AND p.deleted_at IS NULL ORDER BY j.occurred_at DESC,j.id').all().map(j=>({...j,participant_ids:links.filter(l=>l.journal_id===j.id).map(l=>l.participant_id)}));
 const workspaces=db.prepare('SELECT w.* FROM project_workspaces w JOIN projects p ON p.id=w.project_id WHERE p.deleted_at IS NULL').all();
 return {participants,memberships,journals,workspaces};
}
export function saveParticipant(db,id,b){
 obj(b,['name','type','role','icon','icon_file_id','revision']);const name=str(b.name,80),type=str(b.type,40),role=str(b.role);
 if(!name||!type)fail('名称和类型不能为空。');
 return transaction(db,()=>{const old=id?participant(db,id):null,icon=str(b.icon??old?.icon??'idea',24),image=b.icon_file_id===undefined?(old?.icon_file_id??null):b.icon_file_id;if(!icon)fail('图标不能为空。');if(image&&!db.prepare("SELECT 1 FROM file_objects WHERE id=? AND mime LIKE 'image/%' AND deleted_at IS NULL AND purged_at IS NULL").get(image))fail('图片不可用。');const time=now();if(id){version(old,b);db.prepare('UPDATE participants SET name=?,type=?,role=?,updated_at=?,revision=revision+1 WHERE id=?').run(name,type,role,time,id);}else{id=randomUUID();db.prepare('INSERT INTO participants(id,name,type,role,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(id,name,type,role,time,time);}db.prepare('UPDATE participants SET icon=?,icon_file_id=? WHERE id=?').run(icon,image,id);return participant(db,id);});
}
export function deleteParticipant(db,id,b){obj(b,['revision']);return transaction(db,()=>{version(participant(db,id),b);db.prepare('UPDATE participants SET deleted_at=?,updated_at=?,revision=revision+1 WHERE id=?').run(now(),now(),id);return {deleted:true};});}
export function saveMembers(db,projectId,b){
 obj(b,['participant_ids','revision']);return transaction(db,()=>{
  const project=getProject(db,projectId);version(project,b);const selected=ids(db,b.participant_ids);
  const old=db.prepare('SELECT participant_id FROM project_participants WHERE project_id=?').all().map(r=>r.participant_id);
  selected.forEach(id=>participant(db,id,old.includes(id)));
  const used=db.prepare('SELECT DISTINCT jp.participant_id FROM journal_participants jp JOIN journal_entries j ON j.id=jp.journal_id WHERE j.project_id=? AND j.deleted_at IS NULL').all(projectId).map(r=>r.participant_id);
  if(used.some(id=>!selected.includes(id)))fail('参与者仍出现在该项目的日志中，不能移除；请先编辑相关日志。',409);
  db.prepare('DELETE FROM project_participants WHERE project_id=?').run(projectId);
  for(const id of selected)db.prepare('INSERT INTO project_participants VALUES(?,?)').run(projectId,id);
  touch(db,projectId);return {saved:true};
 });
}
export function saveJournal(db,id,b){
 obj(b,['project_id','title','content','occurred_at','files','result','problems','next_step','notes','important','participant_ids','revision']);
 return transaction(db,()=>{
  let old;if(id){old=db.prepare('SELECT * FROM journal_entries WHERE id=? AND deleted_at IS NULL').get(id);if(!old)fail('日志不存在。',404);version(old,b);if(b.project_id!==old.project_id)fail('不能更改日志所属项目。');}
  getProject(db,b.project_id);const fields=Object.fromEntries(['title','content','files','result','problems','next_step','notes'].map(k=>[k,str(b[k],k==='title'?200:5000)]));
  if(!fields.content&&!fields.title)fail('至少填写一句修改内容或标题。');fields.content ||= fields.title;
  const date=new Date(b.occurred_at);if(typeof b.occurred_at!=='string'||!Number.isFinite(date.getTime()))fail('日期和时间无效。');
  if(typeof b.important!=='boolean')fail('重要节点标记无效。');
  const selected=ids(db,b.participant_ids);const oldIds=id?db.prepare('SELECT participant_id FROM journal_participants WHERE journal_id=?').all(id).map(r=>r.participant_id):[];
  selected.forEach(id=>participant(db,id,oldIds.includes(id)));
  const time=now();
  if(id)db.prepare('UPDATE journal_entries SET title=?,content=?,files=?,result=?,problems=?,next_step=?,notes=?,occurred_at=?,important=?,updated_at=?,revision=revision+1 WHERE id=?').run(fields.title,fields.content,fields.files,fields.result,fields.problems,fields.next_step,fields.notes,date.toISOString(),Number(b.important),time,id);
  else{id=randomUUID();db.prepare('INSERT INTO journal_entries(id,project_id,title,content,files,result,problems,next_step,notes,occurred_at,important,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,b.project_id,fields.title,fields.content,fields.files,fields.result,fields.problems,fields.next_step,fields.notes,date.toISOString(),Number(b.important),time,time);}
  db.prepare('DELETE FROM journal_participants WHERE journal_id=?').run(id);
  for(const who of selected){db.prepare('INSERT INTO journal_participants VALUES(?,?)').run(id,who);db.prepare('INSERT OR IGNORE INTO project_participants VALUES(?,?)').run(b.project_id,who);}
  touch(db,b.project_id);return {id};
 });
}
export function deleteJournal(db,id,b){obj(b,['revision']);return transaction(db,()=>{const old=db.prepare('SELECT * FROM journal_entries WHERE id=? AND deleted_at IS NULL').get(id);if(!old)fail('日志不存在。',404);getProject(db,old.project_id);version(old,b);db.prepare('UPDATE journal_entries SET deleted_at=?,updated_at=?,revision=revision+1 WHERE id=?').run(now(),now(),id);touch(db,old.project_id);return {deleted:true};});}
export function saveWorkspace(db,projectId,b){
 obj(b,['current_work','problems','ideas','next_step','revision']);return transaction(db,()=>{
  getProject(db,projectId);const old=db.prepare('SELECT * FROM project_workspaces WHERE project_id=?').get(projectId);version(old,b);
  const values=['current_work','problems','ideas','next_step'].map(k=>str(b[k]));
  db.prepare('INSERT INTO project_workspaces(project_id,current_work,problems,ideas,next_step,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(project_id) DO UPDATE SET current_work=excluded.current_work,problems=excluded.problems,ideas=excluded.ideas,next_step=excluded.next_step,updated_at=excluded.updated_at,revision=project_workspaces.revision+1').run(projectId,...values,now());
  touch(db,projectId);return {saved:true};
 });
}
