'use strict';
/* Crownicles beta: exclusive PID lock, never kills a process. Android may reuse
 * an obsolete PID owned by another app; process.kill(pid,0) then raises EPERM.
 * Only a regular, beta-owned lock file may be archived before retrying wx.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
// Release only the regular file represented by this still-open descriptor.
// The path alone (even with our PID) is not proof of lock ownership.
function releaseOwnedFile({lockPath,fd,expectedText,uid=process.getuid?.(),io=fs}={}) {
 if(!Number.isInteger(fd)||fd<0)return false;
 try {
  const held=io.fstatSync(fd),current=io.lstatSync(lockPath);
  if(!held.isFile()||!current.isFile()||current.isSymbolicLink()||held.dev!==current.dev||held.ino!==current.ino||(Number.isInteger(uid)&&(held.uid!==uid||current.uid!==uid)))return false;
  if(expectedText!==undefined&&io.readFileSync(lockPath,'utf8')!==expectedText)return false;
  const final=io.lstatSync(lockPath);
  if(final.dev!==held.dev||final.ino!==held.ino||!final.isFile()||final.isSymbolicLink())return false;
  io.unlinkSync(lockPath);return true;
 }catch{return false}finally{try{io.closeSync(fd)}catch{}}
}
function releaseBetaLock({lockPath,fd,pid=process.pid,uid=process.getuid?.(),io=fs}={}){
 return releaseOwnedFile({lockPath,fd,expectedText:String(pid),uid,io});
}
function acquireBetaLock({lockPath,backupDir,kill=process.kill.bind(process),pid=process.pid,uid=process.getuid?.(),io=fs}={}) {
 if(!path.isAbsolute(lockPath)||!path.isAbsolute(backupDir)) throw TypeError('BETA_LOCK_CAMINHO_INVALIDO');
 if(!Number.isSafeInteger(pid)||pid<2) throw TypeError('BETA_LOCK_PID_INVALIDO');
 const acquire=()=>{
  let fd=null;
  try {
   fd=io.openSync(lockPath,'wx',0o600);
   const data=String(pid);
   if(io.writeSync(fd,data)!==Buffer.byteLength(data))throw Error('BETA_LOCK_ESCRITA_INCOMPLETA');
   return fd;
  }catch(e){if(fd!==null)releaseOwnedFile({lockPath,fd,uid,io});throw e}
 };
 try{return {fd:acquire(),recovered:false}}catch(e){if(e.code!=='EEXIST')throw e}
 // Serialize competing stale-lock recovery attempts. Never remove a foreign
 // recovery guard automatically; an interrupted recovery needs inspection.
 const guardPath=lockPath+'.recovery';let guardFd;
 try{guardFd=io.openSync(guardPath,'wx',0o600)}catch(e){if(e.code==='EEXIST')throw Error('BETA_RECUPERACAO_EM_ANDAMENTO_OU_INTERROMPIDA');throw e}
 try{
 // The former holder may have shut down while we acquired the recovery guard.
 try{return {fd:acquire(),recovered:false}}catch(e){if(e.code!=='EEXIST')throw e}
 const st=io.lstatSync(lockPath);
 if(!st.isFile()||st.isSymbolicLink()||(Number.isInteger(uid)&&st.uid!==uid))throw Error('BETA_LOCK_ORIGEM_INSEGURA');
 const oldText=io.readFileSync(lockPath,'utf8').trim();
 if(!/^[1-9][0-9]{0,9}$/.test(oldText))throw Error('BETA_LOCK_CONTEUDO_INVALIDO');
 const oldPid=Number(oldText);
 if(oldPid<2||!Number.isSafeInteger(oldPid))throw Error('BETA_LOCK_PID_INVALIDO');
 let reason;
 try{kill(oldPid,0);throw Error('BETA_JA_ESTA_RODANDO_PID_'+oldPid)}catch(e){
  if(e.code==='ESRCH'||e.code==='EPERM')reason=e.code;
  else throw e;
 }
 const st2=io.lstatSync(lockPath);
 if(st2.dev!==st.dev||st2.ino!==st.ino||io.readFileSync(lockPath,'utf8').trim()!==oldText)throw Error('BETA_LOCK_ALTERADO_DURANTE_VERIFICACAO');
 io.mkdirSync(backupDir,{recursive:true,mode:0o700});
 const archive=path.join(backupDir,'run.lock.stale-'+Date.now()+'-'+pid+'-'+crypto.randomBytes(4).toString('hex'));
 io.renameSync(lockPath,archive);
 return {fd:acquire(),recovered:true,reason,archive};
 }finally{releaseOwnedFile({lockPath:guardPath,fd:guardFd,uid,io});}
}
module.exports={acquireBetaLock,releaseBetaLock};
