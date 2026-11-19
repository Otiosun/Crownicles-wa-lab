'use strict';
// Prepare ONLY a disposable full upstream checkout. No DB, network, runtime,
// dependency installation, production paths, or configuration is touched.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {BLOBS,buildCandidate}=require('./core-v31-safety-candidate.cjs');
const PIN='64d08c05f11949029317341735f6f73024f19f9b';
const TEST='Core/__tests__-integration/handlers/crownicles-v31-safety.integration.test.ts';
const MARK='.crownicles-v31-lab';
function stageCandidate(dir){
 if(typeof dir!=='string'||!path.isAbsolute(dir)||!/^upstream-v31-lab(?:-[a-zA-Z0-9_-]+)?$/.test(path.basename(dir)))throw Error('LAB_STAGE_ABSOLUTO_E_NOME_EXPLICITO_OBRIGATORIOS');
 const stage=fs.realpathSync(dir);
 if(stage!==path.resolve(dir))throw Error('LAB_STAGE_SYMLINK_PROIBIDO');
 const git=(args)=>cp.execFileSync('git',['-C',stage,...args],{encoding:'utf8'}).trim();
 if(git(['rev-parse','--show-toplevel'])!==stage||git(['rev-parse','HEAD'])!==PIN)throw Error('LAB_UPSTREAM_REVISAO_INVALIDA');
 if(git(['status','--porcelain','--untracked-files=no']))throw Error('LAB_STAGE_COM_MUDANCAS');
 if(!fs.existsSync(path.join(stage,MARK))||fs.lstatSync(path.join(stage,MARK)).isSymbolicLink()||fs.readFileSync(path.join(stage,MARK),'utf8').trim()!=='CROWNICLES_V31_DISPOSABLE_LAB')throw Error('LAB_MARCADOR_EXPLICITO_AUSENTE');
 // A fresh stage must not contain any already compiled or runtime-owned assets.
 for(const p of ['Core/dist','Core/config/config.toml','Core/logs','crownicles-beta','mariadb-private','baileys-auth'])if(fs.existsSync(path.join(stage,p)))throw Error('LAB_STAGE_NAO_LIMPO:'+p);
 const originals={};
 for(const p of Object.keys(BLOBS)){
  const abs=path.join(stage,p);
  if(fs.realpathSync(abs)!==abs||!fs.lstatSync(abs).isFile())throw Error('LAB_SOURCE_UNSAFE:'+p);
  originals[p]=fs.readFileSync(abs,'utf8');
 }
 const result=buildCandidate(originals);
 const testDest=path.join(stage,TEST),testSource=path.join(__dirname,'crownicles-v31-safety.integration.test.ts');
 if(fs.existsSync(testDest)||fs.realpathSync(path.dirname(testDest))!==path.dirname(testDest))throw Error('LAB_TEST_DESTINO_INSEGURO');
 const test=fs.readFileSync(testSource,'utf8');
 // All validation above happens before the first write. Only this disposable
 // worktree is modified; failure never causes a retry against installed Core.
 for(const [p,s] of Object.entries(result))fs.writeFileSync(path.join(stage,p),s);
 fs.writeFileSync(testDest,test,{flag:'wx'});
 return {stage,pin:PIN,modified:Object.keys(result),test:TEST,activated:false};
}
if(require.main===module){try{if(process.env.CROWNICLES_V31_STAGE_CONFIRM!=='ISOLATED')throw Error('LAB_CONFIRMACAO_ISOLATED_OBRIGATORIA');console.log(JSON.stringify(stageCandidate(process.argv[2]),null,2))}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={stageCandidate,PIN,TEST,MARK};
