import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,readdirSync,openSync,readSync,writeFileSync,fsyncSync,closeSync,renameSync,unlinkSync} from 'node:fs';
import {resolve,dirname,basename} from 'node:path';

const markerFor=databasePath=>resolve(dirname(databasePath),'.restore-state.json');
function hash(path){const fd=openSync(path,'r'),value=createHash('sha256'),buffer=Buffer.allocUnsafe(1024*1024);try{let length;while((length=readSync(fd,buffer,0,buffer.length,null))>0)value.update(buffer.subarray(0,length));return value.digest('hex');}finally{closeSync(fd);}}
function checkedDatabase(path){
 let db;
 try{db=new DatabaseSync(path,{readOnly:true});
  if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||db.prepare('PRAGMA foreign_key_check').all().length)throw Error('数据库完整性或关联检查未通过。');
  db.prepare('SELECT version FROM schema_migrations').all();
 }finally{db?.close();}
}

// This marker is durable before either database is renamed. It contains no business data.
export function prepareRestore(databasePath,previous,staged){
 const marker=markerFor(databasePath),state={version:1,previous:basename(previous),staged:basename(staged),previousHash:hash(databasePath),stagedHash:hash(staged)};
 let fd;
 try{fd=openSync(marker,'wx');writeFileSync(fd,JSON.stringify(state));fsyncSync(fd);}
 catch(error){if(fd!==undefined){closeSync(fd);fd=undefined;unlinkSync(marker);}throw error;}
 finally{if(fd!==undefined)closeSync(fd);}
}

export function recoverRestore(directory){
 const databasePath=resolve(directory,'project-desk.sqlite'),marker=markerFor(databasePath);
 if(!existsSync(marker)){
  if(!existsSync(databasePath)&&readdirSync(directory).some(n=>/^(before-restore-|restore-).+\.sqlite$/.test(n)))throw Error('检测到未完成的旧版恢复；未创建空数据库。请保留旧库、暂存库和 recovery 备份，确认后恢复。');
  return;
 }
 let state;
 try{state=JSON.parse(readFileSync(marker,'utf8'));}catch{throw Error('恢复状态标记不完整；未创建或覆盖数据库，请保留现有文件检查。');}
 if(state.version!==1||!/^before-restore-[a-zA-Z0-9-]+\.sqlite$/.test(state.previous)||!/^restore-[a-zA-Z0-9-]+\.sqlite$/.test(state.staged)||![state.previousHash,state.stagedHash].every(s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s)))throw Error('恢复状态标记无效；未创建或覆盖数据库。');
 const previous=resolve(directory,state.previous),staged=resolve(directory,state.staged);
 if(!existsSync(databasePath)){
  // Prefer the pre-restore workspace; only use the prepared candidate when the old one is absent.
  const source=existsSync(previous)?previous:staged,expected=source===previous?state.previousHash:state.stagedHash;
  if(!existsSync(source)||hash(source)!==expected)throw Error('未完成恢复的数据库缺失或校验不符；未创建空数据库。');
  checkedDatabase(source);renameSync(source,databasePath);
 }
 if(![state.previousHash,state.stagedHash].includes(hash(databasePath)))throw Error('数据库与恢复标记不一致；为保护现有记录，未覆盖数据库。');
 checkedDatabase(databasePath);unlinkSync(marker);
}
