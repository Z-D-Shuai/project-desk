import {initializeStudio,syncStudioTheme,commandPalette,enhancePage} from './ui/studio.js';
import {configureProjectCards} from './ui/project-card.js';
import {configurePreferences} from './ui/preferences.js';
import {request} from './services/api.js';
import {icon,escapeHtml,overlay} from './ui/components.js';
import * as overview from './pages/overview.js';
import * as projects from './pages/projects.js';
import * as journal from './pages/journal.js';
import * as library from './pages/library.js';
import * as settings from './pages/settings.js';
import * as files from './pages/files.js';
import * as reminders from './pages/reminders.js';
import * as usage from './pages/usage.js';
import * as presets from './pages/presets.js';
import * as search from './pages/search.js';
import {usageTracker} from './services/usage.js';
import {quickMenu} from './pages/quick-actions.js';
const routes={overview:['总览',overview],projects:['项目档案',projects],journal:['跟进中心',journal],library:['资料库',library],settings:['设置',settings],search:['全局搜索',search]};
let state,requestVersion=0;
const main=document.querySelector('main');
const system=matchMedia('(prefers-color-scheme: dark)');
const navItems=[['overview','首页','Overview','overview'],['projects','项目档案','Projects','projects'],['reviews','回访中心','Reviews','journal/reviews'],['library','数字资料','Resources','library']];
document.querySelector('#navigation').innerHTML=navItems.map(([key,label,en,path])=>`<a class="nav-link" aria-label="${label}" data-route="${key}" href="#${path}">${icon(key)}<span class="nav-copy">${label}<small aria-hidden="true">${en}</small></span></a>`).join('');
document.querySelector('#navigation').insertAdjacentHTML('afterend',`<a class="followup-navigation" data-route="journal" href="#journal">开发跟进 <span>↗</span></a>`);
function theme(){syncStudioTheme(state.settings.theme);}
system.addEventListener('change',()=>{if(state)theme();});
function render(){
  if(!state)return;
  const path=(location.hash.slice(1)||'overview').split('?')[0];
  const [key,id]=path.split('/');
  if(!Object.hasOwn(routes,key)){location.replace('#overview');return;}
  const [routeName,defaultPage]=routes[key];const page=key==='settings'&&id==='usage'?usage:key==='settings'&&id==='presets'?presets:key==='search'||key==='journal'&&id?.startsWith('person-')?search:(key==='library'&&['files','trash'].includes(id)||key==='settings'&&['storage','backup'].includes(id))?files:(key==='journal'&&id==='reviews'||key==='settings'&&id==='reminders')?reminders:defaultPage;
  const fileTitles={files:'文件管理',trash:'回收站',storage:'存储目录',backup:'备份与恢复'};
  const name=page===usage?'使用统计':page===presets?'常用预设库':page===search?(key==='journal'?'参与者详情':'全局搜索'):page===reminders?(id==='reviews'?'回访中心':'提醒设置'):page===files?fileTitles[id]:key==='projects'&&id ? (id==='categories'?'项目分类':state.projects.find(p=>p.id===id)?.name || '项目详情') : (key==='journal'&&id==='participants'?'参与者管理':key==='library'&&id?(id==='manage'?'整理资料':state.resources.find(r=>r.id===id)?.title||'资料详情'):routeName);
  document.title=`${name} · PROJECT DESK`;document.querySelector('#current-page').textContent=name;
  document.querySelectorAll('[data-route]').forEach(el=>{if(el.dataset.route===(key==='journal'&&id==='reviews'?'reviews':key))el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  usageTracker.route(key==='projects'&&state.projects.some(p=>p.id===id)?id:null);
  configureProjectCards(state);document.querySelector('#due-dot').hidden=!state.reminders.due.length;main.onclick=null;main.innerHTML=page.render(state,{id});main.setAttribute('aria-busy','false');main.scrollTop=0;
  page.bind?.(state,{refresh:()=>load(true),notify},{id});
  enhancePage(state,{key,id});
  document.querySelector('#theme-form')?.addEventListener('submit',async event=>{
    event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;
    const feedback=document.querySelector('#save-feedback');
    try{state.settings=await request('settings',{method:'PUT',body:JSON.stringify({theme:new FormData(event.target).get('theme')})});theme();feedback.textContent='主题已保存。';}
    catch(error){feedback.textContent=error.message;}finally{button.disabled=false;}
  });
  document.querySelector('#storage-info')?.addEventListener('click',()=>overlay('存储说明','<p>结构化数据保存在 SQLite 中，不依赖浏览器临时存储。</p><p>默认数据库位于项目 data 目录，文件独立保存在各自存储目录。删除资料或解除关联不会删除磁盘文件。可以在存储目录设置选择位置，并使用复制入库或引用模式。</p><p>设置中的“备份与恢复”可以创建经过校验的数据库和托管文件备份。外部引用只记录原路径。</p>',true));
  document.querySelector('#phase-info')?.addEventListener('click',()=>overlay('v1.0.0 当前范围','<p>已建立项目 CRUD、分类、筛选、独立状态与进度、详情、归档恢复和总览联动。</p><p>AI / Agent、开发日志、时间线与当前工作已开放。数字资料库、基本上传预览和项目关联已开放；本地目录、复制与引用、文件回收站、备份与恢复已开放。提醒与回访、独立的 Windows 定时检查已开放。</p><p>独立使用统计、常用预设库、全局搜索和快速操作已开放。Cream Studio 设计系统与全套界面重构已完成。Phase 8.2 已处理确认的读取、恢复、路径、去重、启动、锁与主题同步问题；等待最终验收。</p>'));
}
function notify(message){
 const box=document.createElement('div');box.className='notice';box.setAttribute('role','alert');
 box.innerHTML=`<span>${escapeHtml(message)}</span> <button class="button">刷新数据</button>`;box.querySelector('button').onclick=()=>load(true);main.prepend(box);
}
async function load(preserveScroll=false){
 const version=++requestVersion,scroll=preserveScroll?main.scrollTop:0;
 main.setAttribute('aria-busy','true');
 try{const next=await request('bootstrap');if(version!==requestVersion)return;state=next;document.querySelector('#app-version').textContent='v'+(next.storage.appVersion||'1.0.0');configurePreferences(next.storage.databasePath);usageTracker.initialize();theme();render();main.scrollTop=scroll;const log=new URLSearchParams(location.hash.split('?')[1]).get('log');if(log)document.getElementById('log-'+log)?.scrollIntoView({block:'center'});document.querySelector('#connection').textContent='本地数据已连接';}
 catch(error){if(version!==requestVersion)return;main.setAttribute('aria-busy','false');if(state)notify(error.message);else{main.innerHTML=`<section class="panel"><h1>无法连接本地数据</h1><p>${escapeHtml(error.message)}</p><button class="button" id="retry">重新连接</button></section>`;document.querySelector('#retry').onclick=()=>load();}document.querySelector('#connection').textContent='本地服务连接失败';}
}
window.addEventListener('hashchange',()=>{main.onclick=null;main.innerHTML='<p role="status">正在读取本地数据…</p>';main.focus({preventScroll:true});load();});
window.addEventListener('focus',()=>{if(state&&!document.querySelector('dialog[open]')&&!document.activeElement?.closest('form'))load(true);});
document.querySelector('.skip').addEventListener('click',event=>{event.preventDefault();main.focus();});
document.querySelector('#reminders').onclick=()=>{location.hash='journal/reviews';};
document.querySelector('#global-search-form').onsubmit=ev=>{ev.preventDefault();const q=new FormData(ev.target).get('q')||'';location.hash='search?q='+encodeURIComponent(q);};
document.querySelector('#quick-action').onclick=()=>{if(!state)return;const [key,id]=location.hash.slice(1).split('?')[0].split('/');quickMenu(state,()=>load(true),key==='projects'&&state.projects.some(p=>p.id===id)?id:null);};
window.addEventListener('keydown',ev=>{if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='k'){ev.preventDefault();const field=document.querySelector('#command-input');if(field)field.focus();else if(!document.querySelector('dialog[open]'))commandPalette();}});
initializeStudio({state:()=>state,reload:()=>load(true)});
load();
