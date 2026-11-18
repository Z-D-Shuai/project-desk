import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,basename,sep} from 'node:path';
import {createStartupLog} from '../scripts/startup-log.mjs';

test('startup logging appends without replacing history and closes normally',()=>{
 const directory=mkdtempSync(join(tmpdir(),'desk-startup-')),path=join(directory,'server.log');
 try{writeFileSync(path,'history\n');const warnings=[],log=createStartupLog(path,{warn:s=>warnings.push(s)});assert.equal(log.path,path);log.write(Buffer.from('stdout\n'));log.write('stderr\n');log.close();log.close();assert.equal(readFileSync(path,'utf8'),'history\nstdout\nstderr\n');assert.deepEqual(warnings,[]);}
 finally{assert.ok(directory.startsWith(resolve(tmpdir())+sep)&&basename(directory).startsWith('desk-startup-'));rmSync(directory,{recursive:true,force:true});}
});
test('denied log creation or open degrades to console without retries or permission changes',()=>{
 for(const stage of ['mkdir','open']){let opens=0,writes=0;const warnings=[],failure=()=>{throw Object.assign(Error('denied'),{code:'EPERM'});};
  const log=createStartupLog('test.log',{mkdir:stage==='mkdir'?failure:()=>{},open:()=>{opens++;return failure();},write:()=>writes++,warn:s=>warnings.push(s)});
  assert.equal(log.path,null);assert.doesNotThrow(()=>{log.write('server ready');log.close();});assert.equal(opens,stage==='mkdir'?0:1);assert.equal(writes,0);assert.equal(warnings.length,1);assert.match(warnings[0],/EPERM/);
 }
});
test('runtime log write failure disables only file logging and reports once',()=>{
 let writes=0,closes=0;const warnings=[],log=createStartupLog('test.log',{mkdir:()=>{},open:()=>123,write:()=>{writes++;throw Object.assign(Error('full'),{code:'ENOSPC'});},close:()=>closes++,warn:s=>warnings.push(s)});
 assert.doesNotThrow(()=>{log.write('first');log.write('second');log.close();});assert.equal(log.path,null);assert.equal(writes,1);assert.equal(closes,1);assert.equal(warnings.length,1);assert.match(warnings[0],/ENOSPC/);
});
test('startup logging completes partial writes without dropping output',()=>{
 const output=[],log=createStartupLog('test.log',{mkdir:()=>{},open:()=>123,write:(fd,b,offset,count)=>{const n=Math.min(2,count);output.push(b.subarray(offset,offset+n));return n;},close:()=>{},warn:()=>assert.fail('unexpected warning')});log.write('abcdef');log.close();assert.equal(Buffer.concat(output).toString(),'abcdef');
});
