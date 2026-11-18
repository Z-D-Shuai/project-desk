async (page) => {
  if(!page.url().startsWith('http://127.0.0.1:4318/'))throw new Error('仅可在独立验收服务运行');
  const bootstrap=await (await page.request.get('http://127.0.0.1:4318/api/bootstrap')).json();
  if(!bootstrap.storage.databasePath.includes('phase1-test-data'))throw new Error('拒绝操作正式数据库');
  await page.getByRole('link',{name:'阶段一验收项目已编辑',exact:true}).click();
  await page.getByRole('img',{name:'完成度 70%',exact:true}).waitFor();
  await page.getByRole('button',{name:'删除项目',exact:true}).click();
  await page.getByRole('dialog',{name:'删除项目'}).getByRole('button',{name:'关闭',exact:true}).click();
  if(!await page.getByRole('heading',{name:'阶段一验收项目已编辑',exact:true}).isVisible())throw new Error('取消删除后项目丢失');
  await page.getByRole('button',{name:'删除项目',exact:true}).click();
  await page.getByRole('button',{name:'确认删除',exact:true}).click();
  await page.waitForURL('**/#projects');
  await page.getByText('还没有项目',{exact:true}).waitFor();
  console.log('PASS: cancel delete, confirm delete, remove from list');
}
