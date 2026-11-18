async (page)=>{
 const origin='http://127.0.0.1:4318';const s=await(await page.request.get(origin+'/api/bootstrap')).json();if(!s.storage.databasePath.includes('phase2-test-data'))throw Error('仅用于验收');
 const id=s.projects[0].id;
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:900});await page.goto(origin+'/#projects/'+id);await page.reload();await page.getByRole('button',{name:'关联参与者'}).waitFor();
  await page.getByRole('button',{name:'关联参与者'}).scrollIntoViewIfNeeded();await page.screenshot({path:`PROJECT DESK/output/playwright/phase2-project-${width}.png`});
  await page.locator('.journal-entry').scrollIntoViewIfNeeded();await page.screenshot({path:`PROJECT DESK/output/playwright/phase2-timeline-${width}.png`});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('布局横向溢出');
 }
 await page.getByRole('button',{name:'记录开发日志',exact:true}).click();await page.getByRole('dialog').getByText('详细编辑',{exact:true}).click();await page.screenshot({path:'PROJECT DESK/output/playwright/phase2-editor-mobile.png'});await page.keyboard.press('Escape');
 await page.getByRole('link',{name:'跟进中心',exact:true}).click();await page.getByRole('checkbox',{name:'仅重要节点',exact:true}).check();await page.getByText('0 条开发记录',{exact:true}).waitFor();await page.getByRole('button',{name:'重置',exact:true}).click();await page.getByText('1 条开发记录',{exact:true}).waitFor();
}
