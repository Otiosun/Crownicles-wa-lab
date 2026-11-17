'use strict';
const fs=require('node:fs');const path=require('node:path');
function loadConfig(env=process.env){
 const lab=env.CW_LAB_DIR||path.join(env.HOME||'', 'crownicles-whatsapp-lab');
 const coreDir=env.CW_CORE_DIR||path.join(lab,'crownicles-dev','Core');
 const gameIdFile=path.join(lab,'infra','test-player-id');
 const bindingsFile=env.WA_BINDINGS_FILE||path.join(lab,'infra','wa-private-bindings.json');
 const verifyToken=env.WA_VERIFY_TOKEN||'';
 const appSecret=env.WA_APP_SECRET||'';
 if(verifyToken.length<24||appSecret.length<24)throw Error('WA_VERIFY_TOKEN e WA_APP_SECRET devem ter pelo menos 24 caracteres.');
 if(!fs.existsSync(bindingsFile))throw Error('Arquivo de vinculos de teste ausente: '+bindingsFile);
 const bindings=JSON.parse(fs.readFileSync(bindingsFile,'utf8'));
 const idRe=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
 const waRe=/^[1-9][0-9]{7,15}$/;
 for(const [wa,id] of Object.entries(bindings)){
   if(!waRe.test(wa)||!idRe.test(id))throw Error('Vinculo de teste invalido. Numero ou UUID malformado.');
 }
 if(!Object.keys(bindings).length)throw Error('Arquivo de vinculos vazio.');
 const mode=env.WA_SEND_MODE||'mock';
 if(!['mock','cloud'].includes(mode))throw Error('WA_SEND_MODE deve ser mock ou cloud.');
 const graphVersion=env.WA_GRAPH_VERSION||'v27.0';
 if(!/^v\d+\.\d+$/.test(graphVersion))throw Error('Versao Graph invalida.');
 if(mode==='cloud'&&(!env.WA_ACCESS_TOKEN||!env.WA_PHONE_NUMBER_ID))throw Error('Modo cloud exige WA_ACCESS_TOKEN e WA_PHONE_NUMBER_ID.');
 return {lab,coreDir,gameIdFile,bindings,verifyToken,appSecret,mode,
   graphVersion,accessToken:env.WA_ACCESS_TOKEN||'',phoneNumberId:env.WA_PHONE_NUMBER_ID||'',
   mqttUrl:env.CW_MQTT_URL||'mqtt://127.0.0.1:18883',
   mqttTo:env.CW_MQTT_TO||'crownicles_wa_lab/crownicles_core',
   mqttFrom:env.CW_MQTT_FROM||'crownicles_wa_lab/crownicles_websocket',
   port:Number(env.WA_PORT||8787),host:env.WA_HOST||'127.0.0.1',
   dataDir:env.WA_DATA_DIR||path.join(lab,'infra','wa-gateway'),
   langDir:path.join(lab,'crownicles-dev','Lang','pt')};
}
module.exports={loadConfig};
