'use strict';
/** Local-only migration of an already paired Crownicles WhatsApp session.
 * Does not log credentials, doesn't alter the previous session, and refuses to create a new unpaired session.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const SOURCES=['wa-baileys-session-w3-fix','wa-baileys-session'];
function readCreds(dir){
 const file=path.join(dir,'creds.json');
 if(!fs.existsSync(file))return null;
 try {const c=JSON.parse(fs.readFileSync(file,'utf8')); return c?.registered===true?c:null} catch{return null}
}
function credentialNumber(creds){
 const id=String(creds?.me?.id||'');
 const match=/^(\d{10,15})(?::\d+)?@(s\.whatsapp\.net|lid)$/.exec(id);
 return match?match[1]:null;
}
function noSymlinks(dir){
 const st=fs.lstatSync(dir);if(st.isSymbolicLink()||(!st.isDirectory()&&!st.isFile()))throw Error('SESSAO_CONTEM_LINK_OU_ARQUIVO_NAO_SUPORTADO');
 if(st.isDirectory())for(const child of fs.readdirSync(dir))noSymlinks(path.join(dir,child));
}
function restrict(dir){
 const st=fs.lstatSync(dir);fs.chmodSync(dir,st.isDirectory()?0o700:0o600);
 if(st.isDirectory())for(const child of fs.readdirSync(dir))restrict(path.join(dir,child));
}
function importSession(stateDir,infraDir){
 if(!path.isAbsolute(stateDir)||!path.isAbsolute(infraDir))throw Error('CAMINHO_ABSOLUTO_OBRIGATORIO');
 const dest=path.join(stateDir,'baileys-auth');
 if(readCreds(dest))return {mode:'already',directory:dest};
 if(fs.existsSync(dest)&&fs.readdirSync(dest).length)throw Error('SESSAO_BETA_INCOMPLETA_JA_EXISTENTE_NAO_SOBRESCREVER');
 let chosen=null;
 for(const name of SOURCES){const dir=path.join(infraDir,name);if(readCreds(dir)){chosen={dir,name};break}}
 if(!chosen)throw Error('SESSAO_ANTIGA_NAO_ENCONTRADA_SEM_PAREAMENTO_NOVO');
 noSymlinks(chosen.dir);
 fs.mkdirSync(stateDir,{recursive:true,mode:0o700});
 const temp=path.join(stateDir,'.baileys-auth-import-'+crypto.randomBytes(6).toString('hex'));
 try{
  fs.cpSync(chosen.dir,temp,{recursive:true,errorOnExist:true,force:false,dereference:false});
  restrict(temp);
  if(!readCreds(temp))throw Error('SESSAO_COPIADA_NAO_REGISTRADA');
  if(fs.existsSync(dest)){if(fs.readdirSync(dest).length)throw Error('SESSAO_BETA_APARECEU_DURANTE_IMPORTACAO');fs.rmdirSync(dest)}
  fs.renameSync(temp,dest);
  return {mode:'reused',source:chosen.name,directory:dest};
 }catch(e){fs.rmSync(temp,{recursive:true,force:true});throw e}
}
function verifyNumber(authDir,number){
 const c=readCreds(authDir);if(!c)throw Error('SESSAO_NAO_PAREADA_BLOQUEANDO_NOVO_LOGIN');
 const current=credentialNumber(c);
 if(current&&current!==String(number))throw Error('NUMERO_CONFIGURADO_NAO_CORRESPONDE_A_SESSAO_ANTIGA');
 return true;
}
if(require.main===module){
 try{
  if(process.argv[2]==='--verify-number'){
   verifyNumber(process.argv[3],process.argv[4]);console.log('SESSAO_NUMERO_CONFERIDO=SIM');
  }else{
   const s=importSession(process.argv[2],process.argv[3]);
   console.log('SESSAO_EXISTENTE='+s.mode.toUpperCase());
   if(s.source)console.log('ORIGEM='+s.source);
   console.log('PAREAMENTO_NOVO=NAO');
  }
 }catch(e){console.error('REUSO_SESSAO_BLOQUEADO='+e.message);process.exitCode=2}
}
module.exports={SOURCES,readCreds,credentialNumber,importSession,verifyNumber};
