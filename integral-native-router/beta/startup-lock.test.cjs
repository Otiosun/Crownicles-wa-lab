'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {acquireBetaLock}=require('./startup-lock.cjs');
const withDir=fn=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'crown-lock-'));try{fn(d)}finally{fs.rmSync(d,{force:true,recursive:true})}};
test('fresh lock is exclusive and writes own PID',()=>withDir(d=>{
 const p=path.join(d,'run.lock'),s=acquireBetaLock({lockPath:p,backupDir:path.join(d,'backups'),pid:17001});
 a.equal(s.recovered,false);a.equal(fs.readFileSync(p,'utf8'),'17001');fs.closeSync(s.fd);
}));
test('alive PID blocks replacement',()=>withDir(d=>{
 const p=path.join(d,'run.lock');fs.writeFileSync(p,'17001');
 a.throws(()=>acquireBetaLock({lockPath:p,backupDir:path.join(d,'backups'),kill:()=>{},pid:17002}),/BETA_JA_ESTA_RODANDO_PID_17001/);
 a.equal(fs.readFileSync(p,'utf8'),'17001');
}));
test('ESRCH archives old lock and acquires new one',()=>withDir(d=>{
 const p=path.join(d,'run.lock');fs.writeFileSync(p,'17001');
 const x=acquireBetaLock({lockPath:p,backupDir:path.join(d,'backups'),kill:()=>{throw Object.assign(Error('gone'),{code:'ESRCH'})},pid:17002});
 a.equal(x.recovered,true);a.equal(x.reason,'ESRCH');a.equal(fs.readFileSync(x.archive,'utf8'),'17001');a.equal(fs.readFileSync(p,'utf8'),'17002');fs.closeSync(x.fd);
}));
test('EPERM reused foreign PID archives only beta-owned stale lock',()=>withDir(d=>{
 const p=path.join(d,'run.lock');fs.writeFileSync(p,'17001');
 const x=acquireBetaLock({lockPath:p,backupDir:path.join(d,'backups'),kill:()=>{throw Object.assign(Error('foreign'),{code:'EPERM'})},pid:17002});
 a.equal(x.reason,'EPERM');a.equal(fs.readFileSync(x.archive,'utf8'),'17001');a.equal(fs.readFileSync(p,'utf8'),'17002');fs.closeSync(x.fd);
}));
test('unexpected PID error fails closed',()=>withDir(d=>{
 const p=path.join(d,'run.lock');fs.writeFileSync(p,'17001');
 a.throws(()=>acquireBetaLock({lockPath:p,backupDir:path.join(d,'backups'),kill:()=>{throw Object.assign(Error('unexpected'),{code:'EIO'})},pid:17002}),/unexpected/);
 a.equal(fs.readFileSync(p,'utf8'),'17001');
}));
test('symlink lock fails closed',()=>withDir(d=>{
 const real=path.join(d,'real'),p=path.join(d,'run.lock');fs.writeFileSync(real,'17001');fs.symlinkSync(real,p);
 a.throws(()=>acquireBetaLock({lockPath:p,backupDir:path.join(d,'backups'),pid:17002}),/BETA_LOCK_ORIGEM_INSEGURA/);
 a.equal(fs.readFileSync(real,'utf8'),'17001');
}));
test('invalid PID in existing lock fails closed',()=>withDir(d=>{
 const p=path.join(d,'run.lock');fs.writeFileSync(p,'../../..');
 a.throws(()=>acquireBetaLock({lockPath:p,backupDir:path.join(d,'backups'),pid:17002}),/BETA_LOCK_CONTEUDO_INVALIDO/);
 a.equal(fs.readFileSync(p,'utf8'),'../../..');
}));
test('swapped lock after process check fails without moving replacement',()=>withDir(d=>{
 const p=path.join(d,'run.lock');fs.writeFileSync(p,'17001');
 a.throws(()=>acquireBetaLock({lockPath:p,backupDir:path.join(d,'backups'),pid:17002,kill:()=>{
  fs.renameSync(p,p+'.old');fs.writeFileSync(p,'17003');throw Object.assign(Error('stale'),{code:'ESRCH'});
 }}),/BETA_LOCK_ALTERADO_DURANTE_VERIFICACAO/);
 a.equal(fs.readFileSync(p,'utf8'),'17003');
}));
test('locked file owned by another UID fails closed',()=>withDir(d=>{
 const p=path.join(d,'run.lock');fs.writeFileSync(p,'17001');
 a.throws(()=>acquireBetaLock({lockPath:p,backupDir:path.join(d,'backups'),pid:17002,uid:9999999}),/BETA_LOCK_ORIGEM_INSEGURA/);
 a.equal(fs.readFileSync(p,'utf8'),'17001');
}));
test('runtime uses safe lock guard and waits for MariaDB crash recovery without data deletion',()=>{
 const s=fs.readFileSync(path.join(__dirname,'runtime.cjs'),'utf8');
 a.match(s,/acquireBetaLock\(\{lockPath,backupDir:/);
 a.match(s,/startupBudgetMs=120000/);
 a.match(s,/MARIA_RECUPERACAO_LENTA/);
 a.doesNotMatch(s,/fs\.unlinkSync\(lockPath\)/);
 a.doesNotMatch(s,/rmSync\(dataDir/);
});
