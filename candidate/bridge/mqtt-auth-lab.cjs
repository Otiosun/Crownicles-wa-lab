'use strict';
// W44 P0-C — private LAB broker only. No production credentials or shared broker.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const TOPIC_PREFIX=/^cw_wa_mqtt_lab_[a-f0-9]{24}$/;
const CLIENT=/^[a-z0-9_]{8,100}$/;
function createBrokerConfig({stateDir,port,prefix,runner=spawnSync,random=crypto.randomBytes}){
 if(typeof stateDir!=='string'||!path.isAbsolute(stateDir)||/[\r\n#\s]/.test(stateDir))throw Error('MQTT_AUTH_DIRETORIO_INSEGURO');
 const s=fs.lstatSync(stateDir);
 if(!s.isDirectory()||s.isSymbolicLink()||(s.mode&0o077)!==0)throw Error('MQTT_AUTH_PERMISSOES_DIRETORIO');
 if(!Number.isInteger(port)||port<20000||port>60999||!TOPIC_PREFIX.test(prefix))throw Error('MQTT_AUTH_TOPICO_OU_PORTA');
 const nonce=random(12).toString('hex');
 const dir=fs.mkdtempSync(path.join(stateDir,'mqtt-auth-'));fs.chmodSync(dir,0o700);
 const passwd=path.join(dir,'passwd'),acl=path.join(dir,'acl'),conf=path.join(dir,'mosquitto.conf');
 try{
  const core={username:'cwcore_'+nonce,password:random(32).toString('hex')};
  const gateway={username:'cwwa_'+nonce,password:random(32).toString('hex')};
  if(!CLIENT.test(core.username)||!CLIENT.test(gateway.username)||core.password===gateway.password)throw Error('MQTT_AUTH_ENTROPIA_INVALIDA');
  fs.writeFileSync(passwd,`${core.username}:${core.password}\n${gateway.username}:${gateway.password}\n`,{flag:'wx',mode:0o600});
  // -U upgrades a private plaintext fixture into Mosquitto password hashes.
  // Never pass credentials through argv, environment, stdout or stderr.
  const result=runner('mosquitto_passwd',['-U',passwd],{encoding:'utf8',timeout:15000,stdio:'ignore'});
  if(result?.status!==0)throw Error('MQTT_AUTH_HASH_FALHOU');
  const hashed=fs.readFileSync(passwd,'utf8');
  const rows=hashed.trimEnd().split(/\n/);
  if(rows.length!==2||rows.some((x,i)=>!x.startsWith([core.username,gateway.username][i]+':$'))||
     hashed.includes(core.password)||hashed.includes(gateway.password))throw Error('MQTT_AUTH_HASH_INVALIDO');
  const coreTopic=prefix+'/crownicles_core',gatewayTopic=prefix+'/crownicles_websocket';
  fs.writeFileSync(acl,
   `user ${core.username}\ntopic read ${coreTopic}\ntopic write ${gatewayTopic}\n`+
   `user ${gateway.username}\ntopic read ${gatewayTopic}\ntopic write ${coreTopic}\n`,{flag:'wx',mode:0o600});
  fs.writeFileSync(conf,
   `listener ${port} 127.0.0.1\nallow_anonymous false\npersistence false\n`+
   `password_file ${passwd}\nacl_file ${acl}\nlog_type error\n`,{flag:'wx',mode:0o600});
  for(const f of [passwd,acl,conf])if((fs.statSync(f).mode&0o077)!==0)throw Error('MQTT_AUTH_PERMISSOES_ARQUIVO');
  let cleaned=false;
  return {confFile:conf,aclFile:acl,passwordFile:passwd,core,gateway,
   cleanup(){if(cleaned)return;cleaned=true;fs.rmSync(dir,{recursive:true,force:true})}};
 }catch(e){fs.rmSync(dir,{recursive:true,force:true});
  // No process stderr or plaintext is ever included in the failure message.
  throw Error(/^MQTT_AUTH_/.test(e.message)?e.message:'MQTT_AUTH_PROVISIONAMENTO_FALHOU');}
}
module.exports={createBrokerConfig,TOPIC_PREFIX};
