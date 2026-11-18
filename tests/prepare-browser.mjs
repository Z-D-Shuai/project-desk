// Only used for visual QA. Refuse to seed a production database.
const origin='http://127.0.0.1:4318';
const bootstrap=await (await fetch(origin+'/api/bootstrap')).json();
if(!bootstrap.storage.databasePath.includes('phase1-test-data'))throw new Error('Not an isolated QA database');
const existing=new Set(bootstrap.projects.map(p=>p.name));
for(const p of [
 {name:'验收 · 新建计划',status:'not_started',progress:0},
 {name:'验收 · 进行中的网页',status:'in_progress',progress:42},
 {name:'验收 · 已完成工具',status:'completed',progress:100},
 {name:'验收 · 暂停的创作',status:'paused',progress:68},
 {name:'验收 · 已放弃的尝试',status:'abandoned',progress:25},
]){
 if(existing.has(p.name))continue;
 const response=await fetch(origin+'/api/projects',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({...p,description:'仅用于独立数据库的布局与状态验收。',category_id:bootstrap.categories[0]?.id||null})});
 if(!response.ok)throw new Error(await response.text());
}
console.log('Visual QA fixture ready in isolated database');
