export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {overview:'<path d="m3 10 9-8 9 8v11h-6v-8H9v8H3V10Z"/>', projects:'<path d="M3 7V4h6l3 3h9v13H3V7Zm0 3h18"/>',journal:'<path d="M7 3h13v18H7zM3 7h8M3 12h8M3 17h8M13 8h4M13 13h4"/>',reviews:'<path d="M3 11a9 9 0 1 1 2.4 7.1M3 6v5h5M12 6v6l4 2"/>',library:'<path d="m3 7 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 17l9 5 9-5"/>'};
export const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${paths[name] || ''}</svg>`;
export const header = (title, text) => `<div class="page-header"><h1>${title}</h1><p>${text}</p></div>`;
export const panel = (title, body, action = '') => `<section class="panel"><div class="panel-header"><h2>${title}</h2>${action}</div>${body}</section>`;
export const empty = (title, text) => `<div class="empty"><strong>${title}</strong><p>${text}</p></div>`;
export const link = (route, label) => `<a class="text-link" href="#${route}">${label} →</a>`;
export const notice = text => `<p class="notice">${text}</p>`;
export function overlay(title, content, drawer = false) {
  const previous = document.activeElement;
  const root = document.querySelector('#overlay-root');
  root.innerHTML = `<dialog class="${drawer ? 'drawer' : ''}" aria-labelledby="dialog-title"><div class="panel-header"><h2 id="dialog-title">${title}</h2><button class="button" autofocus>关闭</button></div><div class="dialog-content">${content}</div></dialog>`;
  const dialog = root.querySelector('dialog');
  root.querySelector('button').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { root.replaceChildren(); previous?.focus(); }, {once:true});
  dialog.showModal();
  return dialog;
}

let savedTimer;
export function savedFeedback(){document.querySelector('.saved-feedback')?.remove();clearTimeout(savedTimer);const box=document.createElement('div');box.className='saved-feedback';box.setAttribute('role','status');box.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 12 4 4 10-10"/></svg><span>操作已完成</span>';document.body.append(box);if(!matchMedia('(prefers-reduced-motion: reduce)').matches)box.animate([{opacity:0,transform:'translate(-50%, 6px)'},{opacity:1,transform:'translate(-50%, 0)'}],{duration:180,easing:'cubic-bezier(.23,1,.32,1)'});savedTimer=setTimeout(()=>box.remove(),2200);}
