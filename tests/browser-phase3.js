async(page)=>{
 const origin='http://127.0.0.1:4318';const state=async()=>(await page.request.get(origin+'/api/bootstrap')).json();
 if(!(await state()).storage.databasePath.includes('phase3-test-data'))throw Error('仅允许隔离验收库');
 const save=async()=>{const d=page.getByRole('dialog');await d.getByRole('button',{name:'保存',exact:true}).click();await d.waitFor({state:'detached'});};
 const post=async(path,data)=>{const r=await page.request.post(origin+'/api/'+path,{headers:{Origin:origin},data});if(!r.ok())throw Error(await r.text());return r.json();};
 const initial=await state();if(initial.resources.length)throw Error('请使用空白的隔离验收资料库');const p=initial.projects.find(p=>p.name==='资料验收项目甲')||await post('projects',{name:'资料验收项目甲'}),q=initial.projects.find(p=>p.name==='资料验收项目乙')||await post('projects',{name:'资料验收项目乙'});
 await page.goto(origin+'/#library');await page.reload();await page.getByRole('link',{name:'管理分类与收藏夹',exact:true}).click();
 for(const [type,names] of [['categories',['资料分类甲','资料分类乙']],['tags',['标签甲']],['collections',['资料夹甲']]]){
  await page.getByRole('combobox',{name:'管理内容',exact:true}).selectOption(type);
  for(const name of names){const key={categories:'libraryCategories',tags:'libraryTags',collections:'libraryCollections'}[type];if((await state())[key].some(r=>r.name===name))continue;await page.getByRole('button',{name:/^新增/}).click();await page.getByRole('textbox',{name:'名称',exact:true}).fill(name);await save();}
 }
 await page.getByRole('combobox',{name:'管理内容',exact:true}).selectOption('categories');
 const first=()=>page.locator('.category-row').filter({hasText:'资料分类甲'});
 await first().getByRole('button',{name:'编辑',exact:true}).click();await page.getByRole('textbox',{name:'名称',exact:true}).fill('资料分类甲已编辑');await page.getByRole('combobox',{name:/^图标/}).fill('文');await save();
 await first().getByRole('button',{name:'下移',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.category-row')[1]?.textContent.includes('资料分类甲已编辑'));
 const imageBytes=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=240;c.height=140;const x=c.getContext('2d');x.fillStyle='#dadada';x.fillRect(0,0,240,140);x.fillStyle='#222';x.font='20px sans-serif';x.fillText('Library preview',36,76);return c.toDataURL('image/png').split(',')[1];});
 const rows=[['video_link','视频收藏验收'],['web','网页收藏验收'],['text','文字资料验收'],['image','图片预览验收'],['video','本地视频验收'],['file','附件下载验收']];
 for(const [kind,title] of rows){
  await page.getByRole('link',{name:'资料库',exact:true}).click();await page.getByRole('button',{name:'新增资料',exact:true}).click();
  const d=page.getByRole('dialog');await d.getByRole('combobox',{name:'资料类型',exact:true}).selectOption(kind);await d.getByRole('textbox',{name:'标题',exact:true}).fill(title);
  if(['web','video_link'].includes(kind))await d.getByRole('textbox',{name:'网址',exact:true}).fill(origin+'/api/health?kind='+kind);
  if(kind==='video_link')await d.getByRole('textbox',{name:'来源平台',exact:true}).fill('我的自定义视频平台');
  if(kind==='text')await d.getByRole('textbox',{name:'文字内容',exact:true}).fill('知识笔记\n提示词与开发方案');
  if(kind==='video')await d.locator('input[type=file]').setInputFiles('D:/桌面文件/集合/PROJECT DESK/output/playwright/phase3-preview.webm');else if(['image','file'].includes(kind))await d.locator('input[type=file]').setInputFiles({name:kind==='image'?'preview.png':'reference.txt',mimeType:kind==='image'?'image/png':'text/plain',buffer:kind==='image'?Buffer.from(imageBytes,'base64'):Buffer.from('attachment reference')});
  await d.getByRole('textbox',{name:'备注 / 用途说明',exact:true}).fill('阶段三独立验收资料');await d.getByRole('combobox',{name:'资料分类',exact:true}).selectOption({label:'资料分类甲已编辑'});await d.getByRole('combobox',{name:'资料状态',exact:true}).selectOption('learning');await d.getByRole('checkbox',{name:'收藏这份资料',exact:true}).check();
  await d.getByText('标签、收藏夹与项目关联',{exact:true}).click();for(const name of ['标签甲','资料夹甲','资料验收项目甲','资料验收项目乙'])await d.getByRole('checkbox',{name,exact:true}).check();
  await save();await page.getByRole('heading',{name:title,exact:true}).waitFor();
  if(kind==='image')await page.locator('.resource-image').evaluate(img=>img.decode());
  if(kind==='video'){await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&(v.readyState>=2||v.error);});await page.locator('video').evaluate(async v=>{if(v.error)throw Error(v.error.message);v.muted=true;await v.play();});await page.waitForFunction(()=>document.querySelector('video').currentTime>0.1);await page.locator('video').evaluate(v=>v.pause());}
  if(kind==='web'){const popupPromise=page.waitForEvent('popup');await page.getByRole('link',{name:'打开收藏网址',exact:true}).click();const popup=await popupPromise;await popup.waitForLoadState();if(!popup.url().includes('/api/health?kind=web'))throw Error('打开网址不正确');await popup.close();}
  if(kind==='file'){const downloaded=page.waitForEvent('download');await page.getByRole('link',{name:'下载原文件',exact:true}).click();const download=await downloaded;if(download.suggestedFilename()!=='reference.txt')throw Error('附件名丢失');}
  await page.getByRole('button',{name:'编辑资料',exact:true}).click();await page.getByRole('dialog').getByRole('textbox',{name:'备注 / 用途说明',exact:true}).fill('编辑已验证');await page.getByRole('dialog').getByRole('combobox',{name:'资料状态',exact:true}).selectOption('learned');await save();
  if(!(await state()).resources.find(r=>r.title===title).last_viewed_at)throw Error('查看时间未记录');
  await page.getByRole('button',{name:'取消收藏',exact:true}).click();await page.getByRole('button',{name:'收藏',exact:true}).waitFor();
 }
 await page.getByRole('link',{name:'资料库',exact:true}).click();await page.getByRole('searchbox',{name:'名称',exact:true}).fill('图片预览验收');await page.getByText('1 份资料',{exact:true}).waitFor();await page.getByRole('button',{name:'重置',exact:true}).click();
 await page.getByRole('combobox',{name:'类型',exact:true}).selectOption('text');await page.getByText('1 份资料',{exact:true}).waitFor();await page.getByRole('button',{name:'重置',exact:true}).click();
 await page.goto(origin+'/#projects/'+p.id);await page.getByRole('button',{name:'关联已有资料',exact:true}).click();const dlg=page.getByRole('dialog');await dlg.getByRole('checkbox',{name:'附件下载验收',exact:true}).uncheck();await save();
 const s=await state();if(s.resources.length!==6||s.resources.find(r=>r.kind==='image').project_ids.length!==2||s.resources.find(r=>r.kind==='file').project_ids.length!==1)throw Error('项目关联异常或产生了副本');
 await page.getByRole('link',{name:'资料库',exact:true}).click();return {sixEditors:true,imageDecode:true,videoPlayback:true,download:true,openURL:true,state:true,favorite:true,search:true,sharedProjectReferences:true};
}
