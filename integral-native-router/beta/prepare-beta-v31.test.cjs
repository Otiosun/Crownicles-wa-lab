'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {stageRelease,blob}=require('./patches/prepare-beta-v31.cjs');
const real=require('./patches/beta-v31-release-manifest.json');
function fixture(fn){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'crown-stage-'));
 const baseline=path.join(dir,'baseline'),candidate=path.join(dir,'candidate'),stage=path.join(dir,'beta-v31-stage-sample');
 const write=(root,rel,value)=>{const p=path.join(root,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,value)};
 const hash=s=>blob(Buffer.from(s));
 const spec=[['runtime.cjs','old','new'],['package.json','{}','{}'],['bridge/gateway.cjs','old bridge','new bridge'],['bridge/new.cjs',null,'addition']];
 const files=spec.map(([p,o,n])=>{if(o!==null)write(baseline,p,o);write(candidate,p,n);return {path:p,old:o===null?null:hash(o),sha:hash(n)}});
 write(candidate,'smoke.test.cjs','// fixture validation');
 const manifest={format:1,baseCommit:real.baseCommit,targetCommit:real.targetCommit,upstreamPin:real.upstreamPin,status:'laboratory-only',files,validationFiles:[{path:'smoke.test.cjs',sha:hash('// fixture validation')}]};
 const args={baseline,candidate,stage,manifest};
 try{fn({...args,dir,write,args})}finally{fs.rmSync(dir,{recursive:true,force:true})}
}
test('release manifest pins 46 runtime files and 41 validation tests',()=>{
 a.equal(real.files.length,46);a.equal(real.files.filter(f=>f.old===null).length,10);
 a.equal(real.files.filter(f=>f.old!==null&&f.old!==f.sha).length,9);
 a.equal(real.files.filter(f=>f.old===f.sha).length,27);
 a.equal(real.validationFiles.filter(f=>f.path.endsWith('.test.cjs')).length,41);
 a.equal(real.status,'laboratory-only');
});
test('stage creates independent verified code and backup, never copies state',()=>fixture(h=>{
 h.write(h.baseline,'store.sqlite','PRIVATE');h.write(h.baseline,'.env','PRIVATE');
 h.write(h.baseline,'node_modules/x/index.js','PRIVATE');h.write(h.candidate,'auth/creds.json','PRIVATE');
 const out=stageRelease(h.args);a.equal(out.activationBlocked,true);a.equal(out.replaced,2);a.equal(out.unchanged,1);a.equal(out.added,1);
 a.equal(fs.readFileSync(path.join(h.stage,'candidate/runtime.cjs'),'utf8'),'new');
 a.equal(fs.readFileSync(path.join(h.stage,'backup-code/runtime.cjs'),'utf8'),'old');
 a.equal(fs.readFileSync(path.join(h.baseline,'runtime.cjs'),'utf8'),'old');
 a.equal(fs.readFileSync(path.join(h.stage,'candidate/smoke.test.cjs'),'utf8'),'// fixture validation');
 for(const group of ['candidate','backup-code'])for(const p of ['store.sqlite','.env','node_modules','auth'])a.equal(fs.existsSync(path.join(h.stage,group,p)),false);
}));
test('divergent baseline fails without writing stage or replacing local edits',()=>fixture(h=>{
 h.write(h.baseline,'runtime.cjs','LOCAL EDIT');
 a.throws(()=>stageRelease(h.args),/BASE_V30_DIVERGENTE/);a.equal(fs.existsSync(h.stage),false);a.equal(fs.readFileSync(path.join(h.baseline,'runtime.cjs'),'utf8'),'LOCAL EDIT');
}));
test('previously unexpected source conflicts with new addition and is preserved',()=>fixture(h=>{
 h.write(h.baseline,'bridge/new.cjs','existing');
 a.throws(()=>stageRelease(h.args),/BASE_V30_DIVERGENTE/);a.equal(fs.existsSync(h.stage),false);
 a.equal(fs.readFileSync(path.join(h.baseline,'bridge/new.cjs'),'utf8'),'existing');
}));
test('candidate or validation tampering fails before creating output',()=>fixture(h=>{
 h.write(h.candidate,'smoke.test.cjs','tampered');a.throws(()=>stageRelease(h.args),/TESTE_DIVERGENTE/);a.equal(fs.existsSync(h.stage),false);
 h.write(h.candidate,'runtime.cjs','tampered');a.throws(()=>stageRelease(h.args),/CANDIDATO_DIVERGENTE/);a.equal(fs.existsSync(h.stage),false);
}));
test('symlink at file or directory fails closed, no external data copied',()=>fixture(h=>{
 fs.unlinkSync(path.join(h.baseline,'runtime.cjs'));fs.symlinkSync(path.join(h.candidate,'runtime.cjs'),path.join(h.baseline,'runtime.cjs'));
 a.throws(()=>stageRelease(h.args),/FONTE_INSEGURA/);a.equal(fs.existsSync(h.stage),false);
}));
test('existing, overlapping or symlink destination cannot be used',()=>fixture(h=>{
 fs.mkdirSync(h.stage);a.throws(()=>stageRelease(h.args),/STAGE_JA_EXISTE/);
 const nested=path.join(h.baseline,'beta-v31-stage-inner');a.throws(()=>stageRelease({...h.args,stage:nested}),/DESTINO_STAGE_INSEGURO/);
 const linked=path.join(h.dir,'linked');fs.symlinkSync(h.baseline,linked);a.throws(()=>stageRelease({...h.args,stage:path.join(linked,'beta-v31-stage-out')}),/DIRETORIO_ORIGEM_INSEGURO/);
}));
test('manifest path traversal, duplicate path and unknown state file refused',()=>fixture(h=>{
 for(const file of [{path:'../secret',old:null,sha:real.baseCommit},{path:'runtime.cjs',old:null,sha:real.baseCommit},{path:'baileys-auth/creds.json',old:null,sha:real.baseCommit}]){
  a.throws(()=>stageRelease({...h.args,manifest:{...h.manifest,files:[...h.manifest.files,file]}}),/MANIFESTO_CAMINHO_OU_HASH_INVALIDO/);a.equal(fs.existsSync(h.stage),false);
 }
}));
