import {randomUUID,createHash} from 'node:crypto';
import {HttpError,transaction,getProject} from './projects.mjs';
const DAY=86400000;
const fail=(message,status=400)=>{throw new HttpError(status,message);};
const iso=t=>new Date(t).toISOString();
const days=(v,nullable=false)=>{if(nullable&&v===null)return null;if(!Number.isInteger(v)||v<1||v>3650)fail('周期须为 1–3650 天的整数。');return v;};
export function settings(db){return db.prepare('SELECT * FROM reminder_settings WHERE id=1').get();}
export function saveSettings(db,b){const old=settings(db);if(b.revision!==old.revision)fail('提醒设置已更新，请刷新。',409);for(const k of ['enabled','projects_enabled','resources_enabled'])if(typeof b[k]!=='boolean')fail('开关格式无效。');for(const k of ['project_days','resource_days','repeat_days','snooze_days'])days(b[k]);if(typeof b.daily_time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.daily_time))fail('请选择有效的每日时间。');db.prepare('UPDATE reminder_settings SET enabled=?,projects_enabled=?,resources_enabled=?,project_days=?,resource_days=?,repeat_days=?,snooze_days=?,daily_time=?,revision=revision+1 WHERE id=1').run(Number(b.enabled),Number(b.projects_enabled),Number(b.resources_enabled),b.project_days,b.resource_days,b.repeat_days,b.snooze_days,b.daily_time);return settings(db);}
function entity(db,kind,id){const table={project:'projects',resource:'resources',category:'resource_categories'}[kind];if(!table)fail('提醒对象类型无效。');const row=db.prepare(`SELECT * FROM ${table} WHERE id=?${kind==='category'?'':' AND deleted_at IS NULL'}`).get(id);if(!row)fail('提醒对象不存在。',404);return row;}
export function saveRule(db,b){const {kind,entity_id:id}=b;entity(db,kind,id);const old=db.prepare('SELECT * FROM reminder_rules WHERE kind=? AND entity_id=?').get(kind,id);if((old?.revision||0)!==b.revision)fail('此条提醒规则已更新，请刷新。',409);days(b.days,true);days(b.repeat_days,true);if(typeof b.paused!=='boolean')fail('暂停标记无效。');db.prepare('INSERT INTO reminder_rules(kind,entity_id,days,repeat_days,paused) VALUES(?,?,?,?,?) ON CONFLICT(kind,entity_id) DO UPDATE SET days=excluded.days,repeat_days=excluded.repeat_days,paused=excluded.paused,revision=reminder_rules.revision+1').run(kind,id,b.days,b.repeat_days,Number(b.paused));return {saved:true};}
function latest(...values){return Math.max(...values.filter(Boolean).map(v=>Date.parse(v)).filter(Number.isFinite));}
export function readReminders(db,at=Date.now()){
 const config=settings(db),rules=db.prepare('SELECT * FROM reminder_rules').all();const rule=(k,id)=>rules.find(r=>r.kind===k&&r.entity_id===id);
 const projectLinks=db.prepare('SELECT pr.* FROM project_resources pr JOIN projects p ON p.id=pr.project_id WHERE p.deleted_at IS NULL').all();
 const projects=db.prepare(`SELECT p.*,(SELECT MAX(j.occurred_at) FROM journal_entries j WHERE j.project_id=p.id AND j.deleted_at IS NULL AND j.occurred_at<=?) AS journal_at,(SELECT MAX(j.updated_at) FROM journal_entries j WHERE j.project_id=p.id AND j.deleted_at IS NULL) AS journal_changed,(SELECT w.updated_at FROM project_workspaces w WHERE w.project_id=p.id AND (w.current_work<>'' OR w.problems<>'' OR w.ideas<>'' OR w.next_step<>'')) AS workspace_at FROM projects p WHERE p.deleted_at IS NULL`).all(iso(at));
 const resources=db.prepare('SELECT * FROM resources WHERE deleted_at IS NULL').all(),items=[];
 for(const [kind,rows] of [['project',projects],['resource',resources]])for(const r of rows){
  const own=rule(kind,r.id),category=kind==='resource'?rule('category',r.category_id):null;
  const period=own?.days??category?.days??config[kind==='project'?'project_days':'resource_days'];const repeat=own?.repeat_days??category?.repeat_days??config.repeat_days;
  const anchor=Math.min(at,kind==='project'?latest(r.created_at,r.last_followed_at,r.journal_at,r.journal_changed,r.workspace_at):latest(r.created_at,r.last_viewed_at));
  const base=anchor+period*DAY,handled=own?.handled_at?Date.parse(own.handled_at)+repeat*DAY:0,snooze=own?.snoozed_until?Date.parse(own.snoozed_until):0,due=Math.max(base,handled,snooze);
  const eligible=kind==='project'?!r.archived_at&&r.status==='in_progress':!['learned','used','archived'].includes(r.status);
  const paused=!!own?.paused||(!own&&!!category?.paused)||(!own?.days&&!!category?.paused&&!own?.paused);
  const enabled=!!config.enabled&&!!config[kind==='project'?'projects_enabled':'resources_enabled'];
  const phase=!eligible?'excluded':paused?'paused':!enabled?'disabled':snooze>at?'snoozed':due<=at?'due':'scheduled';
  const cycle=createHash('sha256').update(`${kind}:${r.id}:${iso(anchor)}:${iso(due)}`).digest('hex');
  items.push({kind,id:r.id,title:r.name||r.title,type:r.kind||'project',status:r.status,project_ids:kind==='project'?[r.id]:projectLinks.filter(p=>p.resource_id===r.id).map(p=>p.project_id),category_id:r.category_id,anchor:iso(anchor),idle_days:Math.max(0,Math.floor((at-anchor)/DAY)),period,repeat,base_due_at:iso(base),due_at:iso(due),phase,cycle,data_revision:r.revision,rule_revision:own?.revision||0,route:`${kind==='project'?'projects':'library'}/${r.id}`});
 }
 items.sort((a,b)=>a.due_at.localeCompare(b.due_at)||a.title.localeCompare(b.title));
 return {settings:config,rules,items,due:items.filter(r=>r.phase==='due'),history:db.prepare('SELECT * FROM reminder_history ORDER BY occurred_at DESC,id DESC LIMIT 300').all(),deliveries:db.prepare('SELECT * FROM reminder_deliveries ORDER BY created_at DESC LIMIT 30').all(),runtime:Object.fromEntries(db.prepare('SELECT * FROM reminder_runtime').all().map(r=>[r.key,r.value]))};
}
export function act(db,b,at=Date.now()){return transaction(db,()=>{
 const {kind,id,action}=b;if(!['project','resource'].includes(kind))fail('对象类型无效。');const r=entity(db,kind,id);const old=db.prepare('SELECT * FROM reminder_rules WHERE kind=? AND entity_id=?').get(kind,id);
 if(r.revision!==b.data_revision||(old?.revision||0)!==b.rule_revision)fail('内容已更新，请刷新后处理。',409);
 const allowed=kind==='project'?['continue','snooze','pause','resume','archive','done']:['view','learned','used','snooze','pause','resume','archive','delete','done'];if(!allowed.includes(action))fail('提醒操作无效。');
 const t=iso(at);db.prepare('INSERT OR IGNORE INTO reminder_rules(kind,entity_id) VALUES(?,?)').run(kind,id);
 if(action==='snooze'){const n=days(b.days??settings(db).snooze_days);db.prepare('UPDATE reminder_rules SET snoozed_until=?,revision=revision+1 WHERE kind=? AND entity_id=?').run(iso(at+n*DAY),kind,id);}
 else if(['pause','resume'].includes(action))db.prepare('UPDATE reminder_rules SET paused=?,revision=revision+1 WHERE kind=? AND entity_id=?').run(Number(action==='pause'),kind,id);
 else{db.prepare('UPDATE reminder_rules SET handled_at=?,snoozed_until=NULL,revision=revision+1 WHERE kind=? AND entity_id=?').run(t,kind,id);
  if(kind==='project'&&action==='continue')db.prepare('UPDATE projects SET last_followed_at=?,revision=revision+1 WHERE id=?').run(t,id);
  if(kind==='project'&&action==='archive')db.prepare('UPDATE projects SET archived_at=?,updated_at=?,revision=revision+1 WHERE id=?').run(t,t,id);
  if(kind==='resource'&&['learned','used','archive'].includes(action))db.prepare('UPDATE resources SET status=?,updated_at=?,revision=revision+1 WHERE id=?').run(action==='archive'?'archived':action,t,id);
  if(kind==='resource'&&action==='view')db.prepare('UPDATE resources SET last_viewed_at=? WHERE id=?').run(t,id);
  if(kind==='resource'&&action==='delete')db.prepare('UPDATE resources SET deleted_at=?,updated_at=?,revision=revision+1 WHERE id=?').run(t,t,id);
 }
 db.prepare('INSERT INTO reminder_history VALUES(?,?,?,?,?,?,?)').run(randomUUID(),kind,id,r.name||r.title,action,t,action==='snooze'?String(b.days??settings(db).snooze_days):'');return {saved:true,route:`${kind==='project'?'projects':'library'}/${id}`};
 });}
export async function deliver(db,send,at=Date.now()){
 const reservation=transaction(db,()=>{const all=readReminders(db,at);db.prepare('INSERT INTO reminder_runtime VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('last_check_at',iso(at));const items=all.due.filter(i=>{const old=db.prepare('SELECT * FROM reminder_notified WHERE kind=? AND entity_id=?').get(i.kind,i.id);return !old||old.cycle!==i.cycle||at-Date.parse(old.delivered_at)>=i.repeat*DAY;});if(!items.length)return null;const id=randomUUID();db.prepare('INSERT INTO reminder_deliveries(id,created_at,status,items) VALUES(?,?,?,?)').run(id,iso(at),'pending',JSON.stringify(items.map(i=>({kind:i.kind,id:i.id,title:i.title,route:i.route}))));for(const i of items)db.prepare('INSERT INTO reminder_notified VALUES(?,?,?,?,?) ON CONFLICT(kind,entity_id) DO UPDATE SET cycle=excluded.cycle,delivered_at=excluded.delivered_at,delivery_id=excluded.delivery_id').run(i.kind,i.id,i.cycle,iso(at),id);return {id,items};});
 if(!reservation)return {count:0};try{await send(reservation.items);db.prepare('UPDATE reminder_deliveries SET status=?,completed_at=? WHERE id=?').run('sent',iso(at),reservation.id);return {count:reservation.items.length,id:reservation.id};}catch(e){transaction(db,()=>{db.prepare('UPDATE reminder_deliveries SET status=?,error=?,completed_at=? WHERE id=?').run('failed',String(e.message).slice(0,1000),iso(at),reservation.id);db.prepare('DELETE FROM reminder_notified WHERE delivery_id=?').run(reservation.id);});throw e;}
}
