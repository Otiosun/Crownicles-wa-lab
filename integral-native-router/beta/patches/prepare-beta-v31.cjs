'use strict';
// Prepare an isolated upgrade rehearsal. NEVER import or run runtime.cjs.
// The source baseline stays read-only; only explicitly listed files are copied.
// No node_modules, SQLite, auth sessions, MariaDB, .env or other state copied.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const HASH=/^[a-f0-9]{40}$/;
const RUNTIME=/^(?:bridge\/[a-z0-9-]+\.cjs|[a-z0-9-]+\.cjs|package\.json|start\.sh|setup\.sh)$/;
const VALIDATION=/^(?:[a-z0-9-]+\.test\.cjs|collector-coverage\.cjs|coverage-inventory\.cjs|patches\/core-v31-safety-candidate\.cjs)$/;
const blob=content=>crypto.createHash('sha1').update('blob '+content.length+'\0').update(content).digest('hex');
function rootDir(p){
 if(typeof p!=='string'||!path.isAbsolute(p)||p!==path.resolve(p)||fs.realpathSync(p)!==p||!fs.lstatSync(p).isDirectory())throw Error('DIRETORIO_ORIGEM_INSEGURO');
 return p;
}
function within(child,root){return child===root||child.startsWith(root+path.sep)}
function readSource(root,rel,optional=false){
 const segments=rel.split('/');
 let p=root;
 for(let i=0;i<segments.length;i++){
  p=path.join(p,segments[i]);
  let st;try{st=fs.lstatSync(p)}catch(e){if(optional&&e.code==='ENOENT')return null;throw e}
  if(st.isSymbolicLink()||i<segments.length-1&&!st.isDirectory()||i===segments.length-1&&!st.isFile())throw Error('FONTE_INSEGURA:'+rel);
  if(i===segments.length-1){
   if(st.size>2*1024*1024)throw Error('FONTE_GRANDE_DEMAIS:'+rel);
   const content=fs.readFileSync(p);return {content,hash:blob(content),mode:st.mode&0o777};
  }
 }
 throw Error('CAMINHO_VAZIO');
}
function validateManifest(m){
 if(!m||m.format!==1||m.status!=='laboratory-only'||!HASH.test(m.baseCommit)||!HASH.test(m.targetCommit)||m.upstreamPin!=='64d08c05f11949029317341735f6f73024f19f9b'||!Array.isArray(m.files)||!m.files.length||!Array.isArray(m.validationFiles))throw Error('MANIFESTO_INVALIDO');
 const seen=new Set();
 for(const [list,re,baseline] of [[m.files,RUNTIME,true],[m.validationFiles,VALIDATION,false]]){
  for(const f of list){
   if(!f||typeof f.path!=='string'||!re.test(f.path)||!HASH.test(f.sha)||seen.has(f.path)||(baseline&&!(f.old===null||HASH.test(f.old))))throw Error('MANIFESTO_CAMINHO_OU_HASH_INVALIDO');
   seen.add(f.path);
  }
 }
 if(!seen.has('runtime.cjs')||!seen.has('package.json')||!seen.has('bridge/gateway.cjs')||!m.validationFiles.some(f=>f.path.endsWith('.test.cjs')))throw Error('MANIFESTO_INCOMPLETO');
}
function stageRelease({baseline,candidate,stage,manifest=require('./beta-v31-release-manifest.json')}){
 validateManifest(manifest);
 baseline=rootDir(baseline);candidate=rootDir(candidate);
 if(within(baseline,candidate)||within(candidate,baseline))throw Error('ORIGENS_SOBREPOSTAS');
 if(typeof stage!=='string'||!path.isAbsolute(stage)||stage!==path.resolve(stage)||!/^beta-v31-stage-[a-zA-Z0-9_-]+$/.test(path.basename(stage))||within(stage,baseline)||within(stage,candidate)||within(baseline,stage)||within(candidate,stage))throw Error('DESTINO_STAGE_INSEGURO');
 const parent=rootDir(path.dirname(stage));
 const absent=p=>{try{fs.lstatSync(p);return false}catch(e){if(e.code==='ENOENT')return true;throw e}};
 if(!absent(stage))throw Error('STAGE_JA_EXISTE');
 // Read and check all bytes before creating the stage. Unknown files are not
 // copied, overwritten or removed; a partial or locally edited installation is refused.
 const copies=[],rows=[];
 for(const f of manifest.files){
  const src=readSource(candidate,f.path);
  if(src.hash!==f.sha)throw Error('CANDIDATO_DIVERGENTE:'+f.path);
  const before=readSource(baseline,f.path,f.old===null);
  if(f.old===null?before!==null:before.hash!==f.old)throw Error('BASE_V30_DIVERGENTE:'+f.path);
  copies.push({group:'candidate',rel:f.path,source:src});
  if(before)copies.push({group:'backup-code',rel:f.path,source:before});
  rows.push({path:f.path,before:f.old,after:f.sha,originalMode:before?.mode??null,action:f.old===null?'add':f.old===f.sha?'keep':'replace'});
 }
 for(const f of manifest.validationFiles){
  const src=readSource(candidate,f.path);
  if(src.hash!==f.sha)throw Error('TESTE_DIVERGENTE:'+f.path);
  copies.push({group:'candidate',rel:f.path,source:src});
 }
 let shadow;
 try{
  shadow=fs.mkdtempSync(path.join(parent,'.beta-v31-shadow-'));
  fs.chmodSync(shadow,0o700);
  for(const c of copies){
   const dest=path.join(shadow,c.group,c.rel);
   fs.mkdirSync(path.dirname(dest),{recursive:true,mode:0o700});
   fs.writeFileSync(dest,c.source.content,{flag:'wx',mode:c.source.mode&0o700});
   if(blob(fs.readFileSync(dest))!==c.source.hash)throw Error('COPIA_VERIFICACAO_FALHOU:'+c.rel);
  }
  // Recheck both sources after staging, guarding against an edited baseline.
  for(const f of manifest.files){
   const before=readSource(baseline,f.path,f.old===null);
   if((f.old===null?before!==null:before.hash!==f.old)||readSource(candidate,f.path).hash!==f.sha)throw Error('ORIGEM_MUDOU_DURANTE_STAGE:'+f.path);
  }
  for(const f of manifest.validationFiles)if(readSource(candidate,f.path).hash!==f.sha)throw Error('TESTE_MUDOU_DURANTE_STAGE:'+f.path);
  const report={status:'STAGE_SOMENTE_LABORATORIO',activationBlocked:true,baseCommit:manifest.baseCommit,targetCommit:manifest.targetCommit,upstreamPin:manifest.upstreamPin,baselineFiles:rows.filter(x=>x.before!==null).length,unchanged:rows.filter(x=>x.action==='keep').length,replaced:rows.filter(x=>x.action==='replace').length,added:rows.filter(x=>x.action==='add').length,validationFiles:manifest.validationFiles.length,tests:manifest.validationFiles.filter(x=>x.path.endsWith('.test.cjs')).length,rows,stateBackupRequiredBeforeActivation:true};
  fs.writeFileSync(path.join(shadow,'stage-report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  if(!absent(stage))throw Error('STAGE_JA_EXISTE');
  fs.renameSync(shadow,stage);shadow=null;
  return report;
 }finally{if(shadow)fs.rmSync(shadow,{recursive:true,force:true})}
}
if(require.main===module){
 try{
  if(process.argv.length!==5)throw Error('USO: node prepare-beta-v31.cjs BASE_V30 CANDIDATO DESTINO_ABSOLUTO_beta-v31-stage-NOME');
  const [, , baseline,candidate,stage]=process.argv;
  const report=stageRelease({baseline,candidate,stage});
  console.log(JSON.stringify({status:report.status,stage,activationBlocked:true,replaced:report.replaced,added:report.added,unchanged:report.unchanged,tests:report.tests},null,2));
 }catch(e){console.error(String(e.message).replace(/[\r\n]/g,' '));process.exitCode=1}
}
module.exports={stageRelease,validateManifest,blob};
