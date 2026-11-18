import { randomUUID } from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (message, status = 400) => { throw new HttpError(status, message); };
export const statuses = ['not_started','in_progress','paused','completed','abandoned'];
function object(body, keys) {
  if (!body || Array.isArray(body) || typeof body !== 'object') fail('请求内容必须为对象。');
  if (Object.keys(body).some(key => !keys.includes(key))) fail('包含不支持的字段。');
}
function text(value, label, max, required = true) {
  if (typeof value !== 'string') fail(`${label}格式无效。`);
  const result = value.trim();
  if ((required && !result) || result.length > max || result.includes('\0')) fail(`${label}${required ? '不能为空，且' : ''}不能超过 ${max} 个字符。`);
  return result;
}
function revision(value) { if (!Number.isInteger(value) || value < 1) fail('缺少有效的数据版本，请刷新后重试。'); }
export function transaction(db, action) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = action(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
export function listCategories(db) {
  return db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM projects p WHERE p.category_id=c.id AND p.deleted_at IS NULL) AS project_count
    FROM project_categories c ORDER BY c.sort_order, c.id`).all();
}
export function getCategory(db, id) {
  const category = db.prepare('SELECT * FROM project_categories WHERE id=?').get(id);
  if (!category) fail('分类不存在，可能已被删除。',404);
  return category;
}
const projectSelect = `SELECT p.*, c.name AS category_name, c.icon AS category_icon,c.icon_file_id AS category_icon_file_id FROM projects p LEFT JOIN project_categories c ON c.id=p.category_id`;
export function getProject(db, id) {
  const project = db.prepare(`${projectSelect} WHERE p.id=? AND p.deleted_at IS NULL`).get(id);
  if (!project) fail('项目不存在或已删除。',404);
  return project;
}
export function listProjects(db, query = {}) {
  const { q = '', category = '', status = '', archive = 'active', sort = 'updated_at', order = 'desc' } = query;
  if (!['active','archived','all'].includes(archive) || !['updated_at','created_at'].includes(sort) || !['asc','desc'].includes(order)) fail('筛选或排序参数无效。');
  if (status && !statuses.includes(status)) fail('项目状态无效。');
  if (typeof q !== 'string' || q.length > 120) fail('搜索内容过长。');
  const where = ['p.deleted_at IS NULL']; const values = [];
  if (archive !== 'all') where.push(`p.archived_at IS ${archive === 'active' ? '' : 'NOT '}NULL`);
  if (status) { where.push('p.status=?'); values.push(status); }
  if (category === 'uncategorized') where.push('p.category_id IS NULL');
  else if (category) { where.push('p.category_id=?'); values.push(category); }
  if (q.trim()) { where.push("p.name LIKE ? ESCAPE '\\'"); values.push('%' + q.trim().replace(/[\\%_]/g, '\\$&') + '%'); }
  return db.prepare(`${projectSelect} WHERE ${where.join(' AND ')} ORDER BY p.${sort} ${order.toUpperCase()}, p.id`).all(...values);
}
function projectFields(db, body, updating) {
  object(body, ['name','description','status','progress','category_id', ...(updating ? ['revision'] : [])]);
  if (updating) revision(body.revision);
  const name = text(body.name,'项目名称',120);
  const description = text(body.description ?? '', '项目简介',5000,false);
  const status = body.status ?? 'not_started';
  const progress = body.progress ?? 0;
  const category_id = body.category_id ?? null;
  if (!statuses.includes(status)) fail('项目状态无效。');
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) fail('完成度必须是 0–100 的整数。');
  if (category_id !== null) { if (typeof category_id !== 'string') fail('分类无效。'); getCategory(db, category_id); }
  return {name, description, status, progress, category_id};
}
export function createProject(db, body) {
  const p = projectFields(db, body, false); const id = randomUUID(); const now = new Date().toISOString();
  db.prepare(`INSERT INTO projects(id,name,description,status,progress,category_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`).run(id,p.name,p.description,p.status,p.progress,p.category_id,now,now);
  return getProject(db,id);
}
function checkRevision(current, expected) {
  revision(expected);
  if (current.revision !== expected) fail('内容已在其他窗口更新，请关闭编辑框并刷新后重试。',409);
}
function checkChanged(result) {
  if (result.changes!==1) fail('内容已被其他窗口修改，请刷新后重试。',409);
}
export function updateProject(db,id,body) {
  const p = projectFields(db,body,true);
  const current = getProject(db,id); checkRevision(current,body.revision);
  checkChanged(db.prepare(`UPDATE projects SET name=?,description=?,status=?,progress=?,category_id=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=? AND deleted_at IS NULL`).run(p.name,p.description,p.status,p.progress,p.category_id,new Date().toISOString(),id,body.revision));
  return getProject(db,id);
}
export function archiveProject(db,id,body) {
  object(body,['archived','revision']);
  if (typeof body.archived !== 'boolean') fail('归档状态无效。');
  const p = getProject(db,id); checkRevision(p,body.revision);
  if (Boolean(p.archived_at) === body.archived) return p;
  const now = new Date().toISOString();
  checkChanged(db.prepare('UPDATE projects SET archived_at=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=? AND deleted_at IS NULL').run(body.archived ? now : null,now,id,body.revision));
  return getProject(db,id);
}
export function deleteProject(db,id,body) {
  object(body,['revision']); const p = getProject(db,id); checkRevision(p,body.revision);
  const now = new Date().toISOString();
  // Retain the row and all existing associations. Never delete real files.
  checkChanged(db.prepare('UPDATE projects SET deleted_at=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=? AND deleted_at IS NULL').run(now,now,id,body.revision));
  return {deleted:true};
}
function categoryFields(body, updating) {
  object(body,['name','icon','favorite',...(updating ? ['revision'] : [])]);
  if (updating) revision(body.revision);
  const name = text(body.name,'分类名称',40);
  const icon = text(body.icon ?? 'folder','分类图标',24);
  if (body.favorite !== undefined && typeof body.favorite !== 'boolean') fail('收藏状态无效。');
  return {name,icon,favorite:body.favorite ? 1 : 0};
}
function uniqueCategory(action) {
  try { return action(); } catch(error) {
    if (error.message.includes('UNIQUE constraint failed: project_categories.name')) fail('已存在同名分类。',409);
    throw error;
  }
}
export function createCategory(db,body) {
  const c = categoryFields(body,false); const id = randomUUID(); const now = new Date().toISOString();
  const order = db.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM project_categories').get().n;
  uniqueCategory(()=>db.prepare('INSERT INTO project_categories(id,name,icon,favorite,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(id,c.name,c.icon,c.favorite,order,now,now));
  return getCategory(db,id);
}
export function updateCategory(db,id,body) {
  const c = categoryFields(body,true); checkRevision(getCategory(db,id),body.revision);
  uniqueCategory(()=>checkChanged(db.prepare('UPDATE project_categories SET name=?,icon=?,favorite=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?').run(c.name,c.icon,c.favorite,new Date().toISOString(),id,body.revision)));
  return getCategory(db,id);
}
export function reorderCategories(db,body) {
  object(body,['ids']);
  if (!Array.isArray(body.ids) || body.ids.some(id=>typeof id!=='string') || new Set(body.ids).size!==body.ids.length) fail('分类排序格式无效。');
  return transaction(db,()=>{
    const existing=listCategories(db).map(c=>c.id);
    if (body.ids.length!==existing.length || body.ids.some(id=>!existing.includes(id))) fail('分类已发生变化，请刷新后重新排序。',409);
    const update=db.prepare('UPDATE project_categories SET sort_order=? WHERE id=?');
    body.ids.forEach((id,index)=>update.run(index,id));
    return listCategories(db);
  });
}
export function deleteCategory(db,id,body) {
  object(body,['replacement_id','revision']);
  if (!Object.hasOwn(body,'replacement_id')) fail('请选择项目转移到其他分类或未分类。');
  return transaction(db,()=>{
    checkRevision(getCategory(db,id),body.revision);
    const target=body.replacement_id;
    if (target!==null) { if (typeof target!=='string' || target===id) fail('转移目标无效。'); getCategory(db,target); }
    const now=new Date().toISOString();
    const result=db.prepare('UPDATE projects SET category_id=?,updated_at=?,revision=revision+1 WHERE category_id=?').run(target,now,id);
    db.prepare('DELETE FROM project_categories WHERE id=?').run(id);
    return {deleted:true,transferred:result.changes};
  });
}
