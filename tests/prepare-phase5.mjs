import {openDatabase} from '../server/database.mjs';
import {createProject} from '../server/projects.mjs';
import {saveResource,saveTaxonomy} from '../server/library.mjs';
import {resolve} from 'node:path';
const {db,path}=openDatabase(resolve('PROJECT DESK/output/phase5-test-data'));if(db.prepare('SELECT COUNT(*) n FROM projects').get().n)throw Error('Use empty isolated database');
const past=new Date(Date.now()-100*86400000).toISOString();
const p=createProject(db,{name:'阶段5闲置项目',status:'in_progress',progress:37}),q=createProject(db,{name:'阶段5暂停项目',status:'paused',progress:70});db.prepare('UPDATE projects SET created_at=?,updated_at=?').run(past,past);
const c=saveTaxonomy(db,'categories',null,{name:'回访验收分类',icon:'book'});
for(const [kind,title,status] of [['text','阶段5待学笔记','unsorted'],['video_link','阶段5视频收藏','to_view'],['text','阶段5已学资料','learned']]){const r=saveResource(db,null,{title,kind,content:'验收笔记',source_url:kind==='video_link'?'http://127.0.0.1:4318/api/health':'',favorite:false,status,project_ids:[p.id],category_id:c.id});db.prepare('UPDATE resources SET created_at=?,updated_at=? WHERE id=?').run(past,past,r.id);}
db.prepare("INSERT OR REPLACE INTO reminder_runtime VALUES('desktop_port','4318')").run();console.log(path);db.close();
