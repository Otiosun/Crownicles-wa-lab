'use strict';
// Local-only, single-use ownership challenge. Never output credentials or JIDs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
function issue(directory,clock=Date.now){
 const file=path.join(directory,'access','beta-access.sqlite');
 if(!fs.existsSync(file))throw Error('BETA_ACCESS_NAO_ENCONTRADO');
 const db=new DatabaseSync(file);db.exec('PRAGMA busy_timeout=5000');
 try{
  const table=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='admin_claims'").get();
  if(!table)throw Error('EXECUTE_BETA_V2_3_ANTES_DE_EMITIR_CHAVE');
  const code=crypto.randomBytes(12).toString('hex').toUpperCase();
  const digest=crypto.createHash('sha256').update(code).digest('hex');
  const now=clock();
  db.prepare("DELETE FROM admin_claims WHERE expires<? OR stage='complete'").run(now);
  db.prepare("INSERT INTO admin_claims(private_digest,stage,expires) VALUES(?,'issued',?)").run(digest,now+600000);
  return code;
 }finally{db.close()}
}
if(require.main===module){
 try{
  const dir=path.join(process.env.HOME||'','crownicles-whatsapp-lab','crownicles-beta');
  const code=issue(dir);
  console.log('CHAVE_LOCAL_DE_IDENTIDADE=CRIADA');
  console.log('ENVIE_SOMENTE_NO_PRIVADO_DO_PINGUINO=/vinculardono '+code);
  console.log('VALIDADE=10_MINUTOS');
  console.log('NAO_COMPARTILHE_ESTA_CHAVE=SIM');
 }catch(e){console.error('IDENTIDADE_ERRO='+e.message);process.exitCode=2}
}
module.exports={issue};
