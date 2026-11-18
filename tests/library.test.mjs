import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,existsSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {openDatabase} from '../server/database.mjs';
import {createApp} from '../server/index.mjs';
import {saveResource,deleteResource,linkProjectResources,readLibrary,viewResource,resourceStatuses} from '../server/library.mjs';
import {createProject,getProject,deleteProject} from '../server/projects.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
test('library CRUD, independent state, taxonomies and shared project associations',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'desk-library-'));let {db,path}=openDatabase(directory);const server=createApp({db,databasePath:path});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const api=async(p,method='GET',body,code=200)=>{const r=await fetch(origin+'/api/'+p,{method,headers:{Origin:origin,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const raw=await r.text();assert.ok(raw,'Empty response: '+method+' '+p);const b=JSON.parse(raw);assert.equal(r.status,code,JSON.stringify(b));return b;};
 const payload=(kind,title,extra={})=>({kind,title,source_url:'',content:'',notes:'用途',platform:'',category_id:null,status:'unsorted',favorite:false,tag_ids:[],collection_ids:[],project_ids:[],...extra});
 try{
  const p=await api('projects','POST',{name:'项目甲'},201),q=await api('projects','POST',{name:'项目乙'},201);
  let cat=await api('library/categories','POST',{name:'资料分类',icon:'book'},201),cat2=await api('library/categories','POST',{name:'其他',icon:'code'},201);
  const tag=await api('library/tags','POST',{name:'知识'},201),collection=await api('library/collections','POST',{name:'学习集'},201);
  cat=await api('library/categories/'+cat.id,'PUT',{name:'改名分类',icon:'文',revision:cat.revision});
  await api('library/categories/reorder','PUT',{ids:[cat2.id,cat.id]});assert.equal((await api('library/categories'))[0].id,cat2.id);
  const types=['video_link','web','text','image','video','file'];let textResource;
  for(const kind of types){let r=await api('resources','POST',payload(kind,kind,{source_url:['web','video_link'].includes(kind)?'https://example.com/'+kind:'',content:kind==='text'?'知'.repeat(30000):'',platform:kind==='video_link'?'任意自定义平台':'',category_id:cat.id,tag_ids:[tag.id],collection_ids:[collection.id],project_ids:[p.id,q.id]}),201);
   assert.equal((await api('resources/'+r.id)).project_ids.length,2);
   const fields=payload(kind,kind+' 已编辑',{source_url:r.source_url||'',content:r.content||'',status:'learning',favorite:true,category_id:cat.id,tag_ids:[tag.id],collection_ids:[collection.id],project_ids:[p.id,q.id],revision:r.revision});
   r=await api('resources/'+r.id,'PUT',fields);const created=r.created_at;
   await api('resources/'+r.id+'/view','POST',{});const viewed=await api('resources/'+r.id);assert.ok(viewed.last_viewed_at);assert.equal(viewed.status,'learning');assert.equal(viewed.revision,r.revision);assert.equal(viewed.created_at,created);
   r=await api('resources/'+r.id+'/favorite','PUT',{favorite:false,revision:r.revision});assert.equal(r.favorite,0);
   if(kind==='text')textResource=r;else {await api('resources/'+r.id,'DELETE',{revision:r.revision});await api('resources/'+r.id,'GET',undefined,404);}
  }
  await api('resources','POST',payload('web','无效链接',{source_url:'javascript:alert(1)'}),400);
  const web=await api('resources','POST',payload('web','链接',{source_url:'https://example.com/duplicate'}),201);await api('resources','POST',payload('web','重复',{source_url:'https://example.com/duplicate'}),409);
  await api('library/categories/'+cat.id,'DELETE',{revision:cat.revision,replacement_id:cat2.id});assert.equal((await api('resources/'+textResource.id)).category_id,cat2.id);
  await api('library/tags/'+tag.id,'DELETE',{revision:tag.revision});assert.deepEqual((await api('resources/'+textResource.id)).tag_ids,[]);
  const before=await api('projects/'+p.id);await api('projects/'+p.id+'/resources','PUT',{resource_ids:[web.id],revision:before.revision});assert.ok((await api('resources/'+web.id)).project_ids.includes(p.id));assert.deepEqual((await api('resources/'+textResource.id)).project_ids,[q.id]);
  await api('library/collections/'+collection.id,'DELETE',{revision:collection.revision});assert.equal((await api('bootstrap')).resources.length,2);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{await new Promise(r=>server.close(r));db.close();rmSync(directory,{recursive:true,force:true});}
});
test('uploads stay on disk, validate type, deduplicate bytes, stream ranges and preserve files on record deletion',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'desk-assets-'));const {db,path}=openDatabase(directory);const server=createApp({db,databasePath:path});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const api=async(p,method,body)=>{const r=await fetch(origin+'/api/'+p,{method,headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.ok(r.ok,await r.clone().text());return r.json();};
 const upload=(r,bytes,name='image.png')=>fetch(`${origin}/api/resources/${r.id}/file?revision=${r.revision}`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(name)},body:bytes});
 try{
  const a=await api('resources','POST',{kind:'image',title:'图片',favorite:false}),b=await api('resources','POST',{kind:'image',title:'第二张图片',favorite:false});
  assert.equal((await upload(a,Buffer.from('<svg/>'),'image.png')).status,400);assert.equal((await upload(a,Buffer.alloc(0))).status,400);
  const asset=await(await upload(a,png,'../原图.png')).json();assert.ok(asset.asset_id);const second=await(await upload(b,png)).json();
  const rows=db.prepare('SELECT * FROM file_assets').all();assert.equal(rows[0].path,rows[1].path);assert.ok(existsSync(resolve(directory,rows[0].path)));assert.deepEqual(readFileSync(resolve(directory,rows[0].path)),png);
  const full=await fetch(origin+'/api/assets/'+asset.asset_id);assert.equal(full.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await full.arrayBuffer()),png);
  const range=await fetch(origin+'/api/assets/'+asset.asset_id,{headers:{Range:'bytes=0-9'}});assert.equal(range.status,206);assert.deepEqual(Buffer.from(await range.arrayBuffer()),png.subarray(0,10));assert.equal((await fetch(origin+'/api/assets/'+asset.asset_id,{headers:{Range:'bytes=99999-'}})).status,416);
  const download=await fetch(origin+'/api/assets/'+asset.asset_id+'?download');assert.match(download.headers.get('content-disposition'),/^attachment/);
  await api('resources/'+a.id,'DELETE',{revision:asset.revision});assert.equal((await fetch(origin+'/api/assets/'+asset.asset_id)).status,404);assert.equal((await fetch(origin+'/api/assets/'+second.asset_id)).status,200);assert.ok(existsSync(resolve(directory,rows[0].path)));
  const file=await api('resources','POST',{kind:'file',title:'代码附件',favorite:false});const f=await(await upload(file,Buffer.from('<script>alert(1)</script>'),'test.html')).json();const response=await fetch(origin+'/api/assets/'+f.asset_id);assert.match(response.headers.get('content-disposition'),/^attachment/);assert.equal(response.headers.get('content-type'),'application/octet-stream');
  assert.equal((await fetch(origin+'/api/resources/'+b.id+'/file?revision=1',{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/octet-stream'},body:png})).status,403);
 }finally{await new Promise(r=>server.close(r));db.close();rmSync(directory,{recursive:true,force:true});}
});



test('resource relation conflicts, hidden history, manual states and reopen persistence',()=>{
 const directory=mkdtempSync(join(tmpdir(),'desk-library-history-'));let {db}=openDatabase(directory);
 try{
  const p=createProject(db,{name:'保留历史'}),q=createProject(db,{name:'另一个项目'});
  const base={title:'记录',kind:'text',content:'内容',favorite:false,project_ids:[p.id,q.id]};let r=saveResource(db,null,base);
  assert.throws(()=>linkProjectResources(db,p.id,{resource_ids:[],revision:p.revision}),err=>err.status===409);
  deleteProject(db,q.id,{revision:getProject(db,q.id).revision});
  for(const status of resourceStatuses){r=saveResource(db,r.id,{...base,project_ids:[p.id],status,revision:r.revision});viewResource(db,r.id);assert.equal(readLibrary(db).resources[0].status,status);}
  assert.ok(db.prepare('SELECT 1 FROM project_resources WHERE project_id=? AND resource_id=?').get(q.id,r.id),'editing visible links preserves deleted project history');
  deleteResource(db,r.id,{revision:r.revision});linkProjectResources(db,p.id,{resource_ids:[],revision:getProject(db,p.id).revision});
  assert.ok(db.prepare('SELECT 1 FROM project_resources WHERE project_id=? AND resource_id=?').get(p.id,r.id),'editing project links preserves deleted resource history');
  const kept=saveResource(db,null,{...base,title:'持久资料',project_ids:[p.id],status:'used'});const before=readLibrary(db);
  db.close();db=openDatabase(directory).db;assert.deepEqual(readLibrary(db),before);assert.equal(readLibrary(db).resources[0].id,kept.id);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{db.close();rmSync(directory,{recursive:true,force:true});}
});
