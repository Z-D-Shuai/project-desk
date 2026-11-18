async (page) => {
  if(!page.url().startsWith('http://127.0.0.1:4318/'))throw new Error('仅可在独立验收服务运行');
  const bootstrap=await (await page.request.get('http://127.0.0.1:4318/api/bootstrap')).json();
  if(!bootstrap.storage.databasePath.includes('phase1-test-data'))throw new Error('拒绝操作正式数据库');
  for(const name of ['总览','项目档案','跟进中心','资料库','设置']){
    await page.getByRole('link',{name,exact:true}).click();
    await page.getByRole('heading',{name,exact:true,level:1}).waitFor();
  }
  for(const mode of ['light','dark','system']){
    await page.getByRole('combobox',{name:'主题模式',exact:true}).selectOption(mode);
    await page.getByRole('button',{name:'保存主题',exact:true}).click();
    await page.getByText('主题已保存。',{exact:true}).waitFor();
    await page.reload();
    await page.getByRole('heading',{name:'设置',exact:true,level:1}).waitFor();
    if(await page.getByRole('combobox',{name:'主题模式',exact:true}).inputValue()!==mode)throw new Error('主题未持久化');
    if(mode!=='system' && await page.locator('html').getAttribute('data-theme')!==mode)throw new Error('主题外观未更新');
  }
  await page.getByRole('button',{name:'查看存储说明',exact:true}).click();
  await page.getByRole('dialog',{name:'存储说明'}).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({state:'detached'});
  await page.getByRole('link',{name:'总览',exact:true}).click();
  await page.getByRole('heading',{name:'总览',level:1,exact:true}).waitFor();
  const state=await (await page.request.get('http://127.0.0.1:4318/api/bootstrap')).json();
  if(state.summary.projects.total!==5)throw new Error('总览总数不正确');
  for(const status of ['not_started','in_progress','paused','completed','abandoned'])if(state.summary.projects[status]!==1)throw new Error('总览状态数量不正确');
  if(await page.locator('.recent-row').count()!==5)throw new Error('最近项目未联动');
  console.log('PASS: all routes, light/dark/system persistence, drawer, dashboard total/status/recent');
}
