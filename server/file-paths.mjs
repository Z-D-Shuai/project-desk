import {resolve,dirname,relative,sep,isAbsolute,basename,parse} from 'node:path';
import {lstat,realpath,mkdir,stat,open,readdir} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {HttpError} from './projects.mjs';
import {root as appRoot} from './database.mjs';

export const fail=(message,status=400)=>{throw new HttpError(status,message);};
export const time=()=>new Date().toISOString();
export const inside=(parent,child)=>{const p=relative(resolve(parent),resolve(child));return p===''||(!p.startsWith('..'+sep)&&p!=='..'&&!isAbsolute(p));};
export async function exists(path){try{await stat(path);return true;}catch(e){if(['ENOENT','ENOTDIR','ENODEV'].includes(e.code))return false;throw e;}}
export function name(value){if(typeof value!=='string'||!value.trim()||value.length>180||/[<>:"/\\|?*\x00-\x1f]/.test(value)||/[. ]$/.test(value)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)||['.','..'].includes(value))fail('名称无效，请使用普通文件名（不含路径或 Windows 保留名称）。');return value;}
export function rel(value='',allowTrash=false){if(typeof value!=='string'||isAbsolute(value)||value.includes('\\')||value.includes('\0'))fail('相对路径无效。');const parts=value.split('/').filter(Boolean);parts.forEach(p=>name(p));if(!allowTrash&&parts.some(p=>p.startsWith('.project-desk-')))fail('此目录由回收站管理。');return parts.join('/');}
export function rootPath(row,databasePath){return row.path.startsWith('@data/')?resolve(dirname(databasePath),row.path.slice(6)):resolve(row.path);}
export function getRoot(db,id){const r=db.prepare('SELECT * FROM storage_roots WHERE id=?').get(id);if(!r)fail('存储目录不存在。',404);return r;}
export async function safePath(root,path='',allowTrash=false){path=rel(path,allowTrash);const absolute=resolve(root,path);if(!inside(root,absolute))fail('路径超出存储目录。',403);let current=resolve(root);for(const part of ['',...path.split('/').filter(Boolean)]){if(part)current=resolve(current,part);try{if((await lstat(current)).isSymbolicLink())fail('不操作符号链接或目录联接，请选择实际目录。',403);}catch(e){if(e.code!=='ENOENT')throw e;}}return absolute;}
export async function validateRoot(path,databasePath){
 if(typeof path!=='string'||!isAbsolute(path)||path.includes('\0'))fail('请选择完整的本地目录路径。');
 path=resolve(path);if(path===parse(path).root)fail('不能将整个磁盘作为存储目录。');
 const protectedPaths=[appRoot,dirname(databasePath),process.env.WINDIR,process.env.ProgramFiles,process.env['ProgramFiles(x86)']].filter(Boolean);
 for(const p of protectedPaths){if(inside(path,p)||inside(p,path)&&!inside(resolve(dirname(databasePath)),path))fail('请选择独立的资料目录，不要选择程序源码、数据库目录或系统目录。');}
 if(path===resolve(dirname(databasePath)))fail('不能直接使用数据库目录。');
 const info=await lstat(path).catch(e=>{if(e.code==='ENOENT')fail('目录不存在，请先创建或选择已有目录。');throw e;});if(!info.isDirectory()||info.isSymbolicLink())fail('请选择实际文件夹。');
 const canonical=await realpath(path);if(resolve(canonical).toLowerCase()!==path.toLowerCase())return validateRoot(canonical,databasePath);
 return path;
}
export async function digest(path){const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');}
export async function describe(path){const info=await stat(path);if(!info.isFile())fail('请选择普通文件。');const h=await open(path,'r');const head=Buffer.alloc(64);let bytesRead;try{({bytesRead}=await h.read(head,0,64,0));}finally{await h.close();}return {size:info.size,sha256:await digest(path),mime:mediaType(head.subarray(0,bytesRead))};}
export function mediaType(h){if(h.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';if(h[0]===255&&h[1]===216&&h[2]===255)return 'image/jpeg';if(['GIF87a','GIF89a'].includes(h.subarray(0,6).toString()))return 'image/gif';if(h.subarray(0,4).toString()==='RIFF'&&h.subarray(8,12).toString()==='WEBP')return 'image/webp';if(h.subarray(4,8).toString()==='ftyp')return 'video/mp4';if(h.subarray(0,4).equals(Buffer.from([26,69,223,163])))return 'video/webm';if(h.subarray(0,4).toString()==='OggS')return 'video/ogg';return 'application/octet-stream';}
export async function objectPath(db,databasePath,o,{trash=false}={}){if(o.storage_mode==='reference'){if(!isAbsolute(o.path))fail('引用路径无效。');return trash&&o.trash_path?o.trash_path:o.path;}const root=rootPath(getRoot(db,o.root_id),databasePath);return safePath(root,trash&&o.trash_path?o.trash_path:o.path,true);}
export function getFile(db,id){const o=db.prepare('SELECT * FROM file_objects WHERE id=?').get(id);if(!o)fail('文件登记不存在。',404);return o;}
export function usage(db,ids){if(!ids.length)return [];const marks=ids.map(()=>'?').join(',');const rows=db.prepare(`SELECT DISTINCT r.id,r.title,r.deleted_at,p.id AS project_id,p.name AS project_name FROM resources r JOIN file_assets f ON f.id=r.asset_id LEFT JOIN project_resources pr ON pr.resource_id=r.id LEFT JOIN projects p ON p.id=pr.project_id AND p.deleted_at IS NULL WHERE f.file_id IN(${marks})`).all(...ids);
 for(const [table,column,title,route] of [['presets','image_file_id','name','settings/presets'],['project_categories','icon_file_id','name','projects/categories'],['participants','icon_file_id','name','journal/participants'],['resources','platform_image_id','title','library']]){for(const r of db.prepare(`SELECT id,${title} title FROM ${table} WHERE ${column} IN(${marks})`).all(...ids))rows.push({...r,id:table+':'+r.id,deleted_at:null,route:route==='library'?'library/'+r.id:route});}return rows;}

export async function tree(path){const files=[],dirs=[''];async function walk(dir,prefix){for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.isSymbolicLink())fail('文件夹包含符号链接，未执行操作。');const r=prefix?prefix+'/'+entry.name:entry.name;name(entry.name);if(entry.isDirectory()){dirs.push(r);await walk(resolve(dir,entry.name),r);}else if(entry.isFile())files.push(r);else fail('目录中包含不支持的文件。');}}const info=await lstat(path);if(info.isSymbolicLink())fail('不能操作符号链接。');if(info.isDirectory())await walk(path,'');else if(info.isFile())files.push('');else fail('不是普通文件或文件夹。');return {files,dirs:info.isDirectory()?dirs:[]};}
