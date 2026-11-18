import { createServer } from 'node:http';
import {APP_VERSION} from './version.mjs';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, readSettings, readSummary } from './database.mjs';
import {readDevelopment,saveParticipant,deleteParticipant,saveMembers,saveJournal,deleteJournal,saveWorkspace} from './development.mjs';
import {readLibrary,getResource,saveResource,deleteResource,viewResource,setFavorite,saveTaxonomy,deleteTaxonomy,sortTaxonomy,linkProjectResources} from './library.mjs';
import {uploadAsset,serveAsset} from './assets.mjs';
import {ingestUsage,readUsage} from './usage.mjs';
import * as presets from './presets.mjs';
import {searchAll,recentActivity} from './search.mjs';
import * as reminders from './reminders.mjs';
import {windows,toastXml} from './windows-reminders.mjs';
import {withDataLock} from './data-lock.mjs';
import * as storage from './storage.mjs';
import {createBackup,inspectBackup,restoreBackup} from './backups.mjs';
import { HttpError, listProjects, getProject, createProject, updateProject, archiveProject, deleteProject, listCategories, createCategory, updateCategory, deleteCategory, reorderCategories } from './projects.mjs';

async function readBody(req, host, limit=32768) {
  if (req.headers.origin !== `http://${host}` || !req.headers['content-type']?.startsWith('application/json')) throw new HttpError(403,'请求来源不受信任。');
  const chunks=[];let length=0;
  for await (const chunk of req) { length+=chunk.length; if (length>limit) throw new HttpError(413,'请求过大。'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400,'无效的 JSON。'); }
}

export function createApp(runtime) {
  const {databasePath}=runtime;let queue=Promise.resolve();const ready=storage.initializeStorage(runtime.db,databasePath);
  const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
  return createServer(async (req, res) => {
    const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
    const host = req.headers.host;
    if (!host || !/^127\.0\.0\.1:\d+$/.test(host)) return json(403, { error: '仅允许本机访问。' });
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; media-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    let release;
    try {
      const url = new URL(req.url, `http://${host}`);
      if (url.pathname.startsWith('/api/')) {
        await ready;const previous=queue;queue=new Promise(r=>release=r);await previous;const db=runtime.db;
        if(url.pathname==='/api/usage/heartbeat'&&req.method==='POST')return json(200,ingestUsage(db,await readBody(req,host)));
        if(url.pathname==='/api/usage'&&req.method==='GET')return json(200,readUsage(db,{offset:url.searchParams.get('offset')||0}));
        const projectUsage=url.pathname.match(/^\/api\/usage\/projects\/([^/]+)$/);if(projectUsage&&req.method==='GET')return json(200,readUsage(db,{project_id:projectUsage[1],offset:url.searchParams.get('offset')||0}));
        if(url.pathname==='/api/search'&&req.method==='GET')return json(200,searchAll(db,url.searchParams.get('q')||''));
        const presetImage=url.pathname.match(/^\/api\/preset-images\/([^/]+)$/);if(presetImage&&['GET','HEAD'].includes(req.method))return await presets.servePresetImage(db,databasePath,presetImage[1],req,res);
        if(url.pathname==='/api/presets/restore'&&req.method==='POST')return json(200,presets.restorePresets(db,await readBody(req,host)));
        if(url.pathname==='/api/presets/reorder'&&req.method==='PUT')return json(200,presets.reorderPresets(db,await readBody(req,host)));
        const presetRoute=url.pathname.match(/^\/api\/presets(?:\/([^/]+))?(?:\/(image|apply))?$/);
        if(presetRoute){const [,id,action]=presetRoute;if(action==='image'&&req.method==='POST'){if(req.headers.origin!==`http://${host}`||req.headers['content-type']!=='application/octet-stream')throw new HttpError(403,'上传来源无效。');return json(200,await presets.uploadPresetImage(db,databasePath,id,req,url));}if(action==='image'&&req.method==='DELETE')return json(200,presets.clearPresetImage(db,id,await readBody(req,host)));if(action==='apply'&&req.method==='POST'){await readBody(req,host);return json(200,presets.materializePreset(db,id));}if(!action){if(req.method==='GET')return json(200,presets.readPresets(db));if(!id&&req.method==='POST'||id&&req.method==='PUT')return json(200,presets.savePreset(db,id,await readBody(req,host)));if(id&&req.method==='DELETE')return json(200,presets.deletePreset(db,id,await readBody(req,host)));}}
        if(url.pathname==='/api/shutdown'&&req.method==='POST'){const b=await readBody(req,host);if(b.confirm!=='stop-local-service'||!runtime.shutdown)throw new HttpError(400,'停止请求无效。');json(200,{stopping:true});setTimeout(runtime.shutdown,100);return;}
        if(url.pathname==='/api/reminders'&&req.method==='GET')return json(200,reminders.readReminders(db));
        if(url.pathname==='/api/reminders/settings'&&req.method==='PUT'){const b=await readBody(req,host),old=reminders.settings(db);const active=db.prepare("SELECT value FROM reminder_runtime WHERE key='desktop_enabled'").get()?.value==='1';const saved=reminders.saveSettings(db,b);try{if(active&&(!b.enabled||b.daily_time!==old.daily_time)){await windows(db,databasePath,b.enabled?'install':'uninstall',Number(host.split(':')[1]));if(!b.enabled)db.prepare("INSERT OR REPLACE INTO reminder_runtime VALUES('desktop_enabled','0')").run();}}catch(error){reminders.saveSettings(db,{...old,enabled:!!old.enabled,projects_enabled:!!old.projects_enabled,resources_enabled:!!old.resources_enabled,revision:saved.revision});throw new HttpError(409,error.message);}return json(200,saved);}
        if(url.pathname==='/api/reminders/rule'&&req.method==='PUT')return json(200,reminders.saveRule(db,await readBody(req,host)));
        if(url.pathname==='/api/reminders/action'&&req.method==='POST')return json(200,reminders.act(db,await readBody(req,host)));
        const desktop=url.pathname.match(/^\/api\/reminders\/windows\/(status|install|uninstall|test|run)$/);
        if(desktop&&req.method==='POST'){await readBody(req,host);const action=desktop[1],port=Number(host.split(':')[1]);if(action==='install'&&!reminders.settings(db).enabled)throw new HttpError(400,'请先开启全局提醒。');db.prepare("INSERT OR REPLACE INTO reminder_runtime VALUES('desktop_port',?)").run(String(port));const result=await windows(db,databasePath,action==='test'?'toast':action,port,action==='test'?toastXml(databasePath,[{title:'桌面通知测试，可打开回访中心。',route:'journal/reviews'}]):undefined).catch(error=>{throw new HttpError(409,error.message);});if(['install','uninstall'].includes(action))db.prepare("INSERT OR REPLACE INTO reminder_runtime VALUES('desktop_enabled',?)").run(action==='install'?'1':'0');return json(200,result);}
        if(url.pathname==='/api/filesystem'&&req.method==='GET')return json(200,await storage.readStorage(db,databasePath));
        if(url.pathname==='/api/trash'&&req.method==='GET')return json(200,storage.readTrash(db));
        const fsActions={'/api/filesystem/browse':storage.browse,'/api/filesystem/folder':storage.createFolder,'/api/filesystem/move':storage.moveNode,'/api/filesystem/trash':storage.trashNode,'/api/filesystem/import':storage.importPaths,'/api/filesystem/reveal':storage.reveal};
        if(req.method==='POST'&&fsActions[url.pathname])return json(200,await fsActions[url.pathname](db,databasePath,await readBody(req,host,262144)));
        if(req.method==='POST'&&url.pathname==='/api/filesystem/choose-list')return json(200,await storage.chooseList(db,databasePath,await readBody(req,host)));
        if(req.method==='POST'&&url.pathname==='/api/filesystem/upload'){
          if(req.headers.origin!==`http://${host}`||req.headers['content-type']!=='application/octet-stream')throw new HttpError(403,'上传请求来源无效。');
          return json(201,await uploadAsset(db,databasePath,null,req,url));
        }
        const rootRoute=url.pathname.match(/^\/api\/storage-roots(?:\/([^/]+))?$/);
        if(rootRoute){const id=rootRoute[1];if(req.method==='POST'&&!id||req.method==='PUT'&&id)return json(200,await storage.saveRoot(db,databasePath,id,await readBody(req,host)));if(req.method==='DELETE'&&id)return json(200,storage.removeRoot(db,id,await readBody(req,host)));}
        const locate=url.pathname.match(/^\/api\/files\/([^/]+)\/relink$/);if(locate&&req.method==='PUT')return json(200,await storage.relink(db,databasePath,locate[1],await readBody(req,host)));
        const folderRoute=url.pathname.match(/^\/api\/projects\/([^/]+)\/folder$/);if(folderRoute&&req.method==='PUT')return json(200,await storage.projectFolder(db,folderRoute[1],await readBody(req,host)));
        const trashRoute=url.pathname.match(/^\/api\/trash\/([^/]+)\/(restore|purge)$/);if(trashRoute&&req.method==='POST')return json(200,await (trashRoute[2]==='restore'?storage.restoreTrash:storage.purgeTrash)(db,databasePath,trashRoute[1],await readBody(req,host)));
        if(url.pathname==='/api/trash/empty'&&req.method==='POST'){const b=await readBody(req,host);if(b.confirm!=='永久删除')throw new HttpError(400,'请输入永久删除确认。');const list=storage.readTrash(db);for(const r of list.resources)await storage.purgeTrash(db,databasePath,r.id,{...b,type:'resource'});for(const f of list.files)await storage.purgeTrash(db,databasePath,f.id,{...b,type:'file'});return json(200,{emptied:true});}
        if(url.pathname==='/api/backups/create'&&req.method==='POST')return json(200,await withDataLock(databasePath,async()=>createBackup(db,databasePath,await readBody(req,host))));
        if(url.pathname==='/api/backups/inspect'&&req.method==='POST'){const check=await inspectBackup((await readBody(req,host)).directory);const {manifest,...result}=check;return json(200,result);}
        if(url.pathname==='/api/backups/restore'&&req.method==='POST')return json(200,await withDataLock(databasePath,async()=>{const body=await readBody(req,host);await inspectBackup(body.directory);if(body.confirm!=='恢复')throw new HttpError(400,'请输入恢复确认。');if(db.prepare("SELECT value FROM reminder_runtime WHERE key='desktop_enabled'").get()?.value==='1'){await windows(db,databasePath,'uninstall');db.prepare("INSERT OR REPLACE INTO reminder_runtime VALUES('desktop_enabled','0')").run();}return restoreBackup(runtime,body);}));

        const assetRoute=url.pathname.match(/^\/api\/assets\/([^/]+)$/);
        if(assetRoute&&['GET','HEAD'].includes(req.method))return await serveAsset(db,databasePath,assetRoute[1],req,res,url);
        const fileRoute=url.pathname.match(/^\/api\/resources\/([^/]+)\/file$/);
        if(fileRoute&&req.method==='POST'){
          if(req.headers.origin!==`http://${host}`||req.headers['content-type']!=='application/octet-stream')throw new HttpError(403,'上传请求来源无效。');
          return json(201,await uploadAsset(db,databasePath,fileRoute[1],req,url));
        }
        const resourceRoute=url.pathname.match(/^\/api\/resources(?:\/([^/]+))?(?:\/(view|favorite))?$/);
        if(resourceRoute){const [,id,action]=resourceRoute;
          if(req.method==='GET'&&!action){if(id)getResource(db,id);return json(200,id?readLibrary(db).resources.find(r=>r.id===id):readLibrary(db).resources);}
          if(action==='view'&&req.method==='POST'){await readBody(req,host);return json(200,viewResource(db,id));}
          if(action==='favorite'&&req.method==='PUT')return json(200,setFavorite(db,id,await readBody(req,host)));
          if(!action&&((!id&&req.method==='POST')||(id&&req.method==='PUT')))return json(id?200:201,saveResource(db,id,await readBody(req,host,262144)));
          if(!action&&id&&req.method==='DELETE')return json(200,deleteResource(db,id,await readBody(req,host)));
        }
        const taxRoute=url.pathname.match(/^\/api\/library\/(categories|tags|collections)(?:\/([^/]+))?$/);
        if(taxRoute){const [,type,id]=taxRoute;
          if(req.method==='GET')return json(200,readLibrary(db)[{categories:'libraryCategories',tags:'libraryTags',collections:'libraryCollections'}[type]]);
          if(id==='reorder'&&req.method==='PUT')return json(200,sortTaxonomy(db,type,await readBody(req,host)));
          if((!id&&req.method==='POST')||(id&&req.method==='PUT'))return json(id?200:201,saveTaxonomy(db,type,id,await readBody(req,host)));
          if(id&&req.method==='DELETE')return json(200,deleteTaxonomy(db,type,id,await readBody(req,host)));
        }
        if (req.method === 'GET' && url.pathname === '/api/health') return json(200, { app: 'project-desk', version:APP_VERSION, phase: 8, database: 'ready' });
        if (req.method === 'GET' && url.pathname === '/api/bootstrap') return json(200, { settings: readSettings(db), summary: readSummary(db), categories: listCategories(db), projects: listProjects(db,{archive:'all'}), ...readDevelopment(db), ...readLibrary(db),presets:presets.readPresets(db),recentActivity:recentActivity(db),reminders:reminders.readReminders(db),fileSystem:await storage.readStorage(db,databasePath), storage: { databasePath, appVersion:APP_VERSION, schemaVersion: '007', nodeVersion: process.version } });
        const dev=url.pathname.match(/^\/api\/(participants|journals)(?:\/([^/]+))?$/);
        if(dev){const [,kind,id]=dev;if(req.method==='GET'){const rows=readDevelopment(db)[kind];if(!id)return json(200,rows);const row=rows.find(r=>r.id===id);if(!row)throw new HttpError(404,'记录不存在。');return json(200,row);}
          if((!id&&req.method==='POST')||(id&&req.method==='PUT'))return json(id?200:201,(kind==='participants'?saveParticipant:saveJournal)(db,id,await readBody(req,host)));
          if(id&&req.method==='DELETE')return json(200,(kind==='participants'?deleteParticipant:deleteJournal)(db,id,await readBody(req,host)));
        }
        const resourceLinks=url.pathname.match(/^\/api\/projects\/([^/]+)\/resources$/);
        if(resourceLinks&&req.method==='PUT')return json(200,linkProjectResources(db,resourceLinks[1],await readBody(req,host)));
        const work=url.pathname.match(/^\/api\/projects\/([^/]+)\/(participants|workspace)$/);
        if(work&&req.method==='PUT')return json(200,(work[2]==='participants'?saveMembers:saveWorkspace)(db,work[1],await readBody(req,host)));
        if (url.pathname === '/api/projects') {
          if (req.method === 'GET') return json(200,listProjects(db,Object.fromEntries(url.searchParams)));
          if (req.method === 'POST') return json(201,createProject(db,await readBody(req,host)));
        }
        if (url.pathname === '/api/categories') {
          if (req.method === 'GET') return json(200,listCategories(db));
          if (req.method === 'POST') return json(201,createCategory(db,await readBody(req,host)));
        }
        if (req.method === 'PUT' && url.pathname === '/api/categories/reorder') return json(200,reorderCategories(db,await readBody(req,host)));
        const projectRoute=url.pathname.match(/^\/api\/projects\/([^/]+)(\/archive)?$/);
        if (projectRoute) {
          const [,id,archive]=projectRoute;
          if (!archive && req.method==='GET') return json(200,getProject(db,id));
          if (archive && req.method==='PUT') return json(200,archiveProject(db,id,await readBody(req,host)));
          if (!archive && req.method==='PUT') return json(200,updateProject(db,id,await readBody(req,host)));
          if (!archive && req.method==='DELETE') return json(200,deleteProject(db,id,await readBody(req,host)));
        }
        const categoryRoute=url.pathname.match(/^\/api\/categories\/([^/]+)$/);
        if (categoryRoute && req.method==='PUT') return json(200,updateCategory(db,categoryRoute[1],await readBody(req,host)));
        if (categoryRoute && req.method==='DELETE') return json(200,deleteCategory(db,categoryRoute[1],await readBody(req,host)));
        if (req.method === 'PUT' && url.pathname === '/api/settings') {
          const settings=await readBody(req,host);
          if (!settings || Array.isArray(settings) || !['light', 'dark', 'system'].includes(settings.theme) || Object.keys(settings).some(k => k !== 'theme')) return json(400, { error: '主题设置无效。' });
          db.prepare("INSERT INTO settings VALUES ('theme', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(settings.theme);
          return json(200, readSettings(db));
        }
        return json(404, { error: '该接口尚未开放。' });
      }
      if (!['GET', 'HEAD'].includes(req.method)) return json(405, { error: '不支持此方法。' });
      const pathname = decodeURIComponent(url.pathname);
      const file = resolve(publicRoot, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(publicRoot.endsWith(sep) ? publicRoot : publicRoot + sep)) return json(403, { error: '不可访问此路径。' });
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
      const content = await readFile(file);
      res.writeHead(200, { 'Content-Type': `${types[extname(file)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if(res.headersSent){res.destroy();return;}
      if (error instanceof HttpError) return json(error.status,{error:error.message});
      if (['ENOENT','ENOTDIR','EISDIR'].includes(error.code)) return json(404, { error: '文件不存在。' });
      if (error instanceof URIError) return json(400, { error: '路径无效。' });
      if(['EACCES','EPERM','EBUSY'].includes(error.code))return json(409,{error:'文件正在使用或没有访问权限，请关闭占用程序后重试。'});
      if(error.code==='EEXIST')return json(409,{error:'目标名称已存在，未覆盖任何文件。'});
      console.error(error);
      json(500, { error: '本地服务发生错误，请查看运行日志。' });
    } finally {release?.();}
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { db, path } = openDatabase();
  const port = Number(process.env.PROJECT_DESK_PORT || 4317);
  const runtime={db,databasePath:path};const server = createApp(runtime);
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已被占用，请使用启动文件检查已有服务或设置 PROJECT_DESK_PORT。` : error); runtime.db.close(); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`PROJECT DESK: http://127.0.0.1:${server.address().port}\nSQLite: ${path}\n按 Ctrl+C 停止。`));
  const shutdown = () => server.close(() => { runtime.db.close(); process.exit(0); });
  runtime.shutdown=shutdown;
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
}
