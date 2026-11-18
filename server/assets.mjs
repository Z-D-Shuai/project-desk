import {randomUUID,createHash} from 'node:crypto';
import {mkdir,open,unlink,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {getResource} from './library.mjs';
import {attachFile} from './storage.mjs';
import {fail,mediaType,objectPath,getFile} from './file-paths.mjs';
export const MAX_UPLOAD=512*1024*1024;
export async function uploadAsset(db,databasePath,id,req,url){
 const resource=id?getResource(db,id):null,revision=Number(url.searchParams.get('revision'));
 if(resource&&resource.revision!==revision)fail('资料已更新，请刷新后上传。',409);
 if(resource&&!['image','video','file'].includes(resource.kind))fail('此资料类型不支持文件上传。');
 let filename;try{filename=decodeURIComponent(req.headers['x-file-name']||'attachment');}catch{fail('文件名无效。');}filename=filename.split(/[\\/]/).at(-1).replace(/[\x00-\x1f]/g,'');
 const staging=resolve(dirname(databasePath),'.uploads');await mkdir(staging,{recursive:true});const temporary=resolve(staging,randomUUID());let h,size=0,head=Buffer.alloc(0);const hash=createHash('sha256');
 try{if(Number(req.headers['content-length'])>MAX_UPLOAD)fail('浏览器单文件上传最多 512 MiB，可使用本地路径复制或引用大文件。',413);h=await open(temporary,'wx');
  for await(const chunk of req){size+=chunk.length;if(size>MAX_UPLOAD)fail('浏览器单文件上传最多 512 MiB。',413);hash.update(chunk);if(head.length<64)head=Buffer.concat([head,chunk.subarray(0,64-head.length)]);await h.writeFile(chunk);}await h.sync();await h.close();h=null;if(!size)fail('不能上传空文件。');
  const mime=mediaType(head);const result=await attachFile(db,databasePath,{source:temporary,filename,mode:'managed',root_id:url.searchParams.get('root_id')||undefined,folder:url.searchParams.get('folder')||'',project_ids:JSON.parse(url.searchParams.get('project_ids')||'[]'),resource,metadata:{mime,size,sha256:hash.digest('hex')}});
  return {...result,original_name:filename,mime,size};
 }finally{await h?.close();await unlink(temporary).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
export async function serveAsset(db,databasePath,id,req,res,url){
 const asset=db.prepare('SELECT f.*,r.kind FROM file_assets f JOIN resources r ON r.asset_id=f.id WHERE f.id=? AND r.deleted_at IS NULL').get(id);if(!asset)fail('文件不存在或资料已删除。',404);
 const o=getFile(db,asset.file_id);if(o.deleted_at||o.purged_at)fail('文件已移入回收站或永久删除。',404);const path=await objectPath(db,databasePath,o);let info;try{info=await stat(path);}catch{fail('本地文件不可用，请检查硬盘或重新定位。',404);}
 const download=url.searchParams.has('download')||!['image','video'].includes(asset.kind),headers={'Content-Type':asset.kind==='file'?'application/octet-stream':o.mime,'Content-Disposition':`${download?'attachment':'inline'}; filename="download"; filename*=UTF-8''${encodeURIComponent(o.name)}`,'Accept-Ranges':'bytes','Cache-Control':'no-store'};let start=0,end=info.size-1,status=200;
 if(req.headers.range){const m=req.headers.range.match(/^bytes=(\d*)-(\d*)$/);if(!m||(!m[1]&&!m[2])){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});return res.end();}if(!m[1])start=Math.max(0,info.size-Number(m[2]));else{start=Number(m[1]);if(m[2])end=Math.min(end,Number(m[2]));}if(start>end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});return res.end();}status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;}
 headers['Content-Length']=end-start+1;res.writeHead(status,headers);if(req.method==='HEAD'||info.size===0)return res.end();const stream=createReadStream(path,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
}
