import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, readSummary, readSettings } from '../server/database.mjs';
import { createApp } from '../server/index.mjs';

test('empty schema, constraints and persistence survive reopening',()=>{
 const dir=mkdtempSync(join(tmpdir(),'project-desk-test-'));
 let db;
 try{
  db=openDatabase(dir).db;
  for(const name of ['projects','project_categories','journal_entries','resources','project_resources','file_assets','settings'])assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${name}`).get().n,0);
  assert.equal(readSummary(db).projects.total,0);
  assert.throws(()=>db.prepare('INSERT INTO projects(id,name,progress,created_at,updated_at) VALUES (?,?,?,?,?)').run('test','constraint',101,'now','now'));
  db.prepare("INSERT INTO settings VALUES ('theme','dark')").run();db.close();
  db=openDatabase(dir).db;assert.equal(readSettings(db).theme,'dark');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n,7);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 }finally{db?.close();rmSync(dir,{recursive:true,force:true});}
});

test('local API, theme validation and static boundary',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'project-desk-http-'));const {db,path}=openDatabase(dir);const server=createApp({db,databasePath:path});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
 try{
  assert.equal((await fetch(origin)).status,200);
  assert.equal((await (await fetch(origin+'/api/bootstrap')).json()).summary.projects.total,0);
  const put=(theme,headers={})=>fetch(origin+'/api/settings',{method:'PUT',headers:{'Content-Type':'application/json',Origin:origin,...headers},body:JSON.stringify({theme})});
  assert.equal((await put('invalid')).status,400);
  assert.equal((await put('dark',{Origin:'https://example.com'})).status,403);
  assert.equal((await put('dark')).status,200);
  assert.equal((await fetch(origin+'/data/project-desk.sqlite')).status,404);
  assert.equal((await fetch(origin+'/%2e%2e%2fpackage.json')).status,403);
  assert.equal((await fetch(origin+'/api/projects',{method:'POST'})).status,403);
 }finally{await new Promise(resolve=>server.close(resolve));db.close();rmSync(dir,{recursive:true,force:true});}
});
