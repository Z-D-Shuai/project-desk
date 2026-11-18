async (page)=>{
 const origin='http://127.0.0.1:4318';const getState=async()=> (await page.request.get(origin+'/api/bootstrap')).json();
 if(!(await getState()).storage.databasePath.includes('phase2-test-data'))throw Error('拒绝操作正式库');
 const save=async()=>{const d=page.getByRole('dialog');await d.getByRole('button',{name:'保存',exact:true}).click();await d.waitFor({state:'detached'});};
 await page.goto(origin+'/#journal/participants');await page.reload();
 for(const [name,type] of [['验收模型','自定义模型'],['验收代理','自定义代理']]){
  await page.getByRole('button',{name:'新增参与者',exact:true}).click();
  await page.getByRole('textbox',{name:'名称',exact:true}).fill(name);await page.getByRole('textbox',{name:'类型',exact:true}).fill(type);await page.getByRole('textbox',{name:'用途或职责'}).fill('验证职责');await save();
 }
 await page.locator('.person-row').filter({hasText:'验收模型'}).getByRole('button',{name:'编辑',exact:true}).click();await page.getByRole('textbox',{name:'用途或职责'}).fill('编辑后的职责');await save();
 const r=await page.request.post(origin+'/api/projects',{headers:{Origin:origin},data:{name:'阶段二验收项目',status:'paused',progress:70}});if(!r.ok())throw Error(await r.text());const p=await r.json();
 await page.goto(origin+'/#projects/'+p.id);
 await page.getByRole('button',{name:'关联参与者'}).click();await page.getByRole('checkbox',{name:/验收模型/}).check();await page.getByRole('checkbox',{name:/验收代理/}).check();await save();
 await page.getByRole('button',{name:'记录开发日志',exact:true}).click();await page.getByRole('textbox',{name:'本次修改内容'}).fill('完成一句话快速记录');await page.getByRole('checkbox',{name:/验收代理/}).check();await page.getByRole('checkbox',{name:'重要开发节点',exact:true}).check();await save();
 let state=await getState();if(state.memberships.length!==2||state.journals[0].participant_ids.length!==1)throw Error('两级参与者混淆');
 await page.locator('.journal-entry').getByRole('button',{name:'编辑',exact:true}).click();
 for(const [label,value] of [['标题','第一次运行'],['涉及的功能或文件','app.js'],['修改结果','通过'],['遇到的问题','待检查'],['下一步计划','回归'],['补充说明','详细说明']])await page.getByRole('dialog').getByRole('textbox',{name:label,exact:true}).fill(value);
 await save();
 await page.getByRole('button',{name:'编辑备忘',exact:true}).click();
 for(const [label,value] of [['目前正在做什么','正在验证数据联动'],['遇到的问题','尚需检查缩放'],['临时想法','减少步骤'],['下一步计划','完成验收']])await page.getByRole('dialog').getByRole('textbox',{name:label,exact:true}).fill(value);
 await save();
 await page.getByRole('link',{name:'跟进中心',exact:true}).click();await page.getByText('正在验证数据联动',{exact:true}).waitFor();
 await page.getByRole('combobox',{name:'日志参与者',exact:true}).selectOption({label:'验收模型'});await page.getByText('0 条开发记录',{exact:true}).waitFor();
 await page.getByRole('combobox',{name:'日志参与者',exact:true}).selectOption({label:'验收代理'});await page.getByText('1 条开发记录',{exact:true}).waitFor();
 await page.getByLabel('起始日期',{exact:true}).fill('2099-01-01');await page.getByText('0 条开发记录',{exact:true}).waitFor();await page.getByRole('button',{name:'重置',exact:true}).click();await page.getByText('1 条开发记录',{exact:true}).waitFor();
 await page.getByRole('link',{name:'管理 AI / Agent',exact:true}).click();await page.locator('.person-row').filter({hasText:'验收代理'}).getByRole('button',{name:'删除',exact:true}).click();await save();
 await page.getByRole('link',{name:'跟进中心',exact:true}).click();await page.getByText('本次参与：验收代理（已删除）',{exact:true}).waitFor();
 await page.locator('.journal-entry').getByRole('button',{name:'删除',exact:true}).click();await save();await page.getByText('0 条开发记录',{exact:true}).waitFor();
 await page.getByRole('button',{name:'记录日志',exact:true}).click();await page.getByRole('textbox',{name:'本次修改内容'}).fill('最终保留的验收日志');await save();
 await page.screenshot({path:'PROJECT DESK/output/playwright/phase2-center.png'});
 console.log('PASS: participants CRUD, memberships, quick/detailed journal CRUD, filters, workspace and shared center');
}


