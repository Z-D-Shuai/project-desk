import {escapeHtml as e,overlay,savedFeedback} from '../ui/components.js';
import {request} from '../services/api.js';
import {ring,statusOptions,categoryOptions,categoryIcon,iconNames} from '../ui/project-components.js';

function bindSubmission(dialog,submit){
 const form=dialog.querySelector('form'),error=dialog.querySelector('[role="alert"]');let pending=false;
 dialog.addEventListener('cancel',event=>{if(pending)event.preventDefault();});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(pending)return;pending=true;error.textContent='';
  const buttons=[...dialog.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
  try{await submit(new FormData(form));savedFeedback();}catch(err){error.textContent=err.message;error.focus();}finally{pending=false;buttons.forEach(b=>b.disabled=false);}
 });
 dialog.querySelector('[name="name"]')?.focus();
}
const errorBox='<p role="alert" tabindex="-1"></p>';
const submitButton=label=>`<div class="form-footer"><button class="button primary" type="submit">${label}</button></div>`;

export function projectEditor(state,refresh,project=null){
 const dialog=overlay(project?'编辑项目':'新建项目',`<form id="project-editor"><label>项目名称 <span class="muted">必填</span><input class="input" name="name" required maxlength="120" value="${e(project?.name||'')}"></label><label>简介<textarea class="input" name="description" rows="3" maxlength="5000">${e(project?.description||'')}</textarea></label><div class="form-grid"><label>分类<select class="input" name="category_id">${categoryOptions(state.categories,project?.category_id)}<optgroup label="从预设创建分类">${state.presets.filter(p=>p.kind==='category').map(p=>`<option value="preset:${p.id}">${e(p.name)}</option>`).join('')}</optgroup></select></label><label>项目状态<select class="input" name="status">${statusOptions(project?.status||'not_started')}</select></label></div><label>完成度（0–100）<div class="progress-editor"><input class="input" type="number" name="progress" min="0" max="100" step="1" required value="${project?.progress??0}"><input type="range" aria-label="拖动调整完成度" min="0" max="100" step="1" value="${project?.progress??0}"><span id="progress-preview">${ring(project?.progress??0)}</span></div></label><p class="muted">状态、完成度与归档分别保存；完成度不会自动改变状态。</p>${errorBox}${submitButton('保存项目')}</form>`);
 dialog.classList.add('editor-dialog');
 const number=dialog.querySelector('[name="progress"]'),range=dialog.querySelector('[type="range"]');
 const preview=()=>{dialog.querySelector('#progress-preview').innerHTML=ring(Number(number.value));};
 range.oninput=()=>{number.value=range.value;preview();};number.oninput=()=>{range.value=number.value;preview();};
 bindSubmission(dialog,async data=>{
  const payload={name:data.get('name'),description:data.get('description'),status:data.get('status'),category_id:data.get('category_id')||null,progress:Number(data.get('progress'))};if(project)payload.revision=project.revision;
  if(payload.category_id?.startsWith('preset:'))payload.category_id=(await request('presets/'+payload.category_id.slice(7)+'/apply',{method:'POST',body:'{}'})).id;
  const result=await request(project?`projects/${project.id}`:'projects',{method:project?'PUT':'POST',body:JSON.stringify(payload)});
  dialog.close();await refresh();if(!project)location.hash=`projects/${result.id}`;
 });
}
export function categoryEditor(state,refresh,category=null){
 const builtin=Object.hasOwn(iconNames,category?.icon||'folder');
 const dialog=overlay(category?'编辑分类':'新增分类',`<form><label>分类名称 <span class="muted">必填</span><input class="input" name="name" required maxlength="40" value="${e(category?.name||'')}"></label><label>图标<select class="input" name="preset">${Object.entries(iconNames).map(([key,name])=>`<option value="${key}" ${(category?.icon||'folder')===key?'selected':''}>${name}</option>`).join('')}<option value="custom" ${!builtin?'selected':''}>自定义符号</option></select></label><label id="custom-icon-field" ${builtin?'hidden':''}>自定义符号（最多 4 个字符）<input class="input" name="custom_icon" maxlength="4" value="${!builtin?e(category.icon):''}"></label><div id="category-icon-preview" class="icon-preview">${categoryIcon(category?.icon||'folder')}</div><label class="checkbox-label"><input type="checkbox" name="favorite" ${category?.favorite?'checked':''}>收藏此分类</label>${errorBox}${submitButton('保存分类')}</form>`);
 const select=dialog.querySelector('[name="preset"]'),custom=dialog.querySelector('[name="custom_icon"]');
 const update=()=>{const isCustom=select.value==='custom';dialog.querySelector('#custom-icon-field').hidden=!isCustom;custom.required=isCustom;dialog.querySelector('#category-icon-preview').innerHTML=categoryIcon(isCustom?custom.value:select.value);};
 select.onchange=update;custom.oninput=update;update();
 bindSubmission(dialog,async data=>{
  const payload={name:data.get('name'),icon:data.get('preset')==='custom'?data.get('custom_icon'):data.get('preset'),favorite:data.has('favorite')};if(category)payload.revision=category.revision;
  await request(category?`categories/${category.id}`:'categories',{method:category?'PUT':'POST',body:JSON.stringify(payload)});dialog.close();await refresh();
 });
}
export function confirmProject(refresh,p,deleting=false){
 const action=deleting?'删除项目':p.archived_at?'恢复项目':'归档项目';
 const dialog=overlay(action,`<form><p>确认${action.slice(0,2)}“${e(p.name)}”？</p><p class="muted">${deleting?'删除后将从列表和统计中移除。不会删除本地文件；当前界面暂不提供删除恢复，请谨慎确认。':'项目状态、分类和完成度保持不变。'}</p>${errorBox}${submitButton('确认'+action.slice(0,2))}</form>`);
 bindSubmission(dialog,async()=>{
  await request(`projects/${p.id}${deleting?'':'/archive'}`,{method:deleting?'DELETE':'PUT',body:JSON.stringify({revision:p.revision,...(deleting?{}:{archived:!p.archived_at})})});
  dialog.close();if(deleting)location.hash='projects';await refresh();
 });
}
export function removeCategory(state,refresh,c){
 const dialog=overlay('删除分类',`<form><p>删除“${e(c.name)}”并转移其项目。</p><p class="muted">当前关联 ${c.project_count} 个项目（含归档）。项目不会被删除。</p><label>项目转移到<select class="input" name="replacement_id">${categoryOptions(state.categories,null,c.id)}</select></label>${errorBox}${submitButton('确认转移并删除分类')}</form>`);
 bindSubmission(dialog,async data=>{await request(`categories/${c.id}`,{method:'DELETE',body:JSON.stringify({replacement_id:data.get('replacement_id')||null,revision:c.revision})});dialog.close();await refresh();});
}
