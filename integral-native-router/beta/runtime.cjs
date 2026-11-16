'use strict';
/* Crownicles beta - isolated persistent native Core + MQTT + Baileys.
 * No upstream game rules reimplemented. No production databases/sessions touched.
 * Native Termux integration must be verified by user logs before treating as live.
 */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const crypto=require('node:crypto'),{spawn,spawnSync}=require('node:child_process');
const {createServer,connect:netConnect}=require('node:net'),{createRequire}=require('node:module');
const Module=require('node:module');
const {createBetaRuntime}=require('./integracao.cjs');
const {Presenter}=require('./bridge/presenter.cjs');
const {CrowniclesCore}=require('./bridge/core.cjs');
const {assertLabConfig}=require('./bridge/mqtt-isolation.cjs');
const {normalizeJid}=require('./entrada.cjs');
process.umask(0o077);
const HOME=process.env.HOME;
if(!HOME||!path.isAbsolute(HOME))throw Error('HOME_INVALIDO');
const project=path.join(HOME,'crownicles-whatsapp-lab');
const gameRoot=path.join(project,'crownicles-dev');
const core=path.join(gameRoot,'Core');
const dist=path.join(core,'dist','Core','src');
const stateDir=path.join(project,'crownicles-beta');
const mariaDir=path.join(stateDir,'mariadb-private');
const dataDir=path.join(mariaDir,'data');
const socket=path.join(mariaDir,'mysql.sock');
const mariaPid=path.join(mariaDir,'mysql.pid');
const mariaLog=path.join(mariaDir,'mysql.err');
const confPath=path.join(stateDir,'settings.json');
const lockPath=path.join(stateDir,'run.lock');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const status=(label,value)=>process.stdout.write(label+'='+String(value)+'\n');
const REQUIRED=[
 path.join(core,'package.json'),path.join(core,'config','config.toml'),
 path.join(dist,'bootstrap.js'),path.join(dist,'app.js'),path.join(dist,'main.js'),
 path.join(dist,'mqttClient.js'),path.join(dist,'core','bot','Crownicles.js'),
 path.join(gameRoot,'Lang','pt','events.json'),path.join(gameRoot,'Lang','pt','models.json')];
const compiledPaths={
 'CommandReportPacketReq':'commands/player/ReportCommand.js',
 'CommandProfilePacketReq':'commands/player/ProfileCommand.js',
 'CommandInventoryPacketReq':'commands/player/InventoryCommand.js',
 'CommandMissionsPacketReq':'commands/mission/MissionsCommand.js',
 'ReactionCollectorReactPacket':'core/packetHandlers/handlers/CoreHandlers.js'
};
let lockFd=null,mariaProc=null,mosqProc=null,adminConn=null,gameInstance=null,bridgeCore=null,bridgeRuntime=null,baileysSock=null;
let eventTimer=null,startedChildren=[];let shuttingDown=false,mqttOfficial=null;
function preflight(){
 status('BETA_ROOT',stateDir);status('CORE_COMPILADO',fs.existsSync(dist)?'SIM':'NAO');
 for(const f of REQUIRED){if(!fs.existsSync(f))throw Error('ARQUIVO_AUSENTE:'+f.replace(HOME,'~'))}
 const req=createRequire(path.join(core,'package.json'));
 const pkg=req('./package.json');
 if(pkg.version!=='6.2.0.b')throw Error('CORE_VERSAO_NAO_VALIDADA:'+pkg.version);
 for(const n of ['mariadb','mqtt','toml'])req.resolve(n);
 for(const n of ['mosquitto','mariadbd','mariadb-install-db']){
  const out=spawnSync('sh',['-c',`command -v ${n}`],{encoding:'utf8'});
  if(out.status!==0)throw Error('COMANDO_AUSENTE:'+n);
 }
 status('CORE_VERSAO',pkg.version);status('DEPENDENCIAS_NATIVE', 'SIM');
 status('BETA_OUTROS_BOTS','NAO_ALTERADOS');
}
function ownerSettings(){
 if(!fs.existsSync(confPath))throw Error('CONFIG_BETA_NAO_CRIADA_EXECUTE_SETUP_SH');
 const cfg=JSON.parse(fs.readFileSync(confPath,'utf8'));
 if(!/^\d{10,15}$/.test(String(cfg.botNumber||''))||!/^\d{10,15}$/.test(String(cfg.ownerNumber||'')))throw Error('NUMEROS_CONFIG_INVALIDOS');
 if(cfg.botNumber===cfg.ownerNumber)throw Error('USE_NUMERO_DE_BOT_SEPARADO_DO_DONO_NESTA_BETA');
 if(!/^[0-9a-f]{48}$/.test(cfg.dbPassword||''))throw Error('DB_CREDENCIAIS_INVALIDAS');
 return cfg;
}
function lock(){
 try{lockFd=fs.openSync(lockPath,'wx',0o600);fs.writeSync(lockFd,String(process.pid));return}catch(e){if(e.code!=='EEXIST')throw e}
 const pid=Number(fs.readFileSync(lockPath,'utf8'));
 if(Number.isInteger(pid)&&pid>1){try{process.kill(pid,0);throw Error('BETA_JA_ESTA_RODANDO_PID_'+pid)}catch(e){if(e.code!=='ESRCH')throw e}}
 fs.unlinkSync(lockPath);lockFd=fs.openSync(lockPath,'wx',0o600);fs.writeSync(lockFd,String(process.pid));
}
function releaseLock(){if(lockFd!==null){try{fs.closeSync(lockFd)}catch{};try{if(fs.readFileSync(lockPath,'utf8')===String(process.pid))fs.unlinkSync(lockPath)}catch{}}}
async function port(){const s=createServer();return new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(e=>e?reject(e):resolve(p))})})}
async function randomMqttPort(){for(let i=0;i<25;i++){let p=20000+crypto.randomInt(40999);try{await new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(p,'127.0.0.1',()=>s.close(e=>e?reject(e):resolve()))});return p}catch(e){if(e.code!=='EADDRINUSE')throw e}}throw Error('SEM_PORTA_MQTT')}
async function waitTcp(p,proc,limit=11000){const start=Date.now();while(Date.now()-start<limit){if(proc?.exitCode!==null)throw Error('PROCESSO_FECHADO_ANTES_DE_READY');const ok=await new Promise(resolve=>{let done=false;const s=netConnect({host:'127.0.0.1',port:p});const fin=v=>{if(done)return;done=true;s.destroy();resolve(v)};s.once('connect',()=>fin(true));s.once('error',()=>fin(false));s.setTimeout(300,()=>fin(false))});if(ok)return;await sleep(150)}throw Error('TIMEOUT_TCP_'+p)}
async function startMaria(Maria){
 fs.mkdirSync(mariaDir,{recursive:true,mode:0o700});
 if(!fs.existsSync(path.join(mariaDir,'OWNED_BY_CROWNICLES_BETA')))fs.writeFileSync(path.join(mariaDir,'OWNED_BY_CROWNICLES_BETA'),'Banco beta, resetavel somente sob comando explicito.\n',{mode:0o600,flag:'wx'});
 // Existing daemon must belong to this exact beta socket and datadir.
 if(fs.existsSync(socket)){
  try{const c=await Maria.createConnection({socketPath:socket,user:os.userInfo().username,connectTimeout:2000});const [r]=await c.query('SELECT @@socket sock,@@port port,@@datadir datadir');
   if(r.sock!==socket||path.resolve(r.datadir)!==path.resolve(dataDir)){await c.end();throw Error('MARIADB_ALVO_NAO_PERTENCE_A_BETA')}
   status('MARIA_REUSADA','SIM');status('MARIA_PORT',r.port);return {conn:c,port:Number(r.port)};
  }catch(e){if(!['ECONNREFUSED','ENOENT','ETIMEDOUT'].includes(e.code))throw e;}
 }
 if(!fs.existsSync(path.join(dataDir,'mysql'))){
  if(fs.existsSync(dataDir)&&fs.readdirSync(dataDir).length)throw Error('MARIA_DATADIR_INCONSISTENTE');
  fs.mkdirSync(dataDir,{recursive:true,mode:0o700});
  status('MARIA_INIT','PRIMEIRA_VEZ');
  const installed=spawnSync('mariadb-install-db',['--no-defaults','--datadir='+dataDir,'--auth-root-authentication-method=socket','--auth-root-socket-user='+os.userInfo().username,'--skip-test-db'],{encoding:'utf8',timeout:105000,maxBuffer:250000});
  if(installed.status!==0)throw Error('MARIA_INSTALL_DB_FALHOU_'+String(installed.stderr||'').slice(-300));
 }
 const p=await port();
 const log=fs.openSync(mariaLog,'a',0o600);
 mariaProc=spawn('mariadbd',['--no-defaults','--datadir='+dataDir,'--socket='+socket,'--bind-address=127.0.0.1','--port='+p,'--pid-file='+mariaPid,'--log-error='+mariaLog,'--skip-log-bin','--skip-name-resolve','--innodb-buffer-pool-size=48M','--max-connections=35'],{cwd:mariaDir,stdio:['ignore',log,log]});
 fs.closeSync(log);startedChildren.push(mariaProc);mariaProc.once('error',err=>status('MARIA_PROCESSO_ERRO',err.code));
 for(let i=0;i<85;i++){
  if(mariaProc.exitCode!==null)throw Error('MARIA_FALHOU_LOG_'+mariaLog);
  try{const c=await Maria.createConnection({socketPath:socket,user:os.userInfo().username,connectTimeout:800});const [r]=await c.query('SELECT @@socket sock,@@port port,@@datadir datadir');
   if(r.sock!==socket||path.resolve(r.datadir)!==path.resolve(dataDir)){await c.end();throw Error('MARIA_ISOLAMENTO_FALHOU')}
   status('MARIA_NOVA','SIM');status('MARIA_PORT',r.port);return {conn:c,port:Number(r.port)}
  }catch(e){if(e.message==='MARIA_ISOLAMENTO_FALHOU')throw e}await sleep(220)
 }throw Error('MARIA_TIMEOUT_LOG_'+mariaLog)
}
async function initCore(portMaria,cfg,req,admin){
 const prefix='crownicles_beta';
 const dbName=prefix+'_game';
 const pass=cfg.dbPassword;
 // Scope all SQL DDL to this private MariaDB socket, never shared servers.
 await admin.query('CREATE DATABASE IF NOT EXISTS `'+dbName+'` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin');
 for(const host of ['127.0.0.1','localhost']){
  await admin.query(`CREATE USER IF NOT EXISTS 'cw_beta'@'${host}' IDENTIFIED BY '${pass}'`);
  await admin.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO 'cw_beta'@'${host}'`);
 }
 const tc=await req('mariadb').createConnection({host:'127.0.0.1',port:portMaria,user:'cw_beta',password:pass,database:dbName,connectTimeout:3500});
 try{await tc.query('SELECT 1 AS ok')}finally{await tc.end()}
 const mqttShimPath=path.join(dist,'mqttClient.js');
 if(require.cache[mqttShimPath])throw Error('MQTT_LOAD_PREMATURO');
 const shim=new Module(mqttShimPath,module);shim.filename=mqttShimPath;shim.loaded=true;
 shim.exports={mqttClient:{connected:false,on(){return this},publish(){throw Error('CORE_MQTT_AINDA_SEM_BROKER')},subscribe(){},end(){}}};
 require.cache[mqttShimPath]=shim;
 process.chdir(core);
 process.env.CROWNICLES_DB_BASE_DIR=path.join(dist,'core','database','game');
 const bootstrap=require(path.join(dist,'bootstrap.js'));
 if(typeof bootstrap.setBotConfigForTests!=='function')throw Error('CONFIG_BETA_SEM_SETTER_ORIGINAL');
 const testCfg={MODE_MAINTENANCE:false,TEST_MODE:true,PREFIX:prefix,
  MARIADB_HOST:'127.0.0.1',MARIADB_PORT:portMaria,MARIADB_USER:'cw_beta',MARIADB_PASSWORD:pass,
  MARIADB_ROOT_PASSWORD:'',MQTT_HOST:'mqtt://127.0.0.1',WEB_SERVER_PORT:0,LOG_LEVEL:'error',LOG_LOCATIONS:[]};
 bootstrap.setBotConfigForTests(testCfg);
 const {getDatabaseConfiguration}=require(path.join(dist,'core','bot','CrowniclesConfig.js'));
 const check=getDatabaseConfiguration(bootstrap.botConfig,'game',{max:1,min:0,acquire:1000,idle:1000});
 if(check.prefix+'_'+check.databaseName!==dbName||check.host!=='127.0.0.1'||Number(check.port)!==portMaria||check.user!=='cw_beta'||check.rootPassword!=='')throw Error('CONFIG_BETA_DB_INVALIDA');
 const app=require(path.join(dist,'app.js'));
 const C=require(path.join(dist,'core','bot','Crownicles.js')).Crownicles;
 if(typeof C!=='function'||!(app.crowniclesInstance instanceof C))throw Error('CORE_SINGLETON_INVALIDO');
 gameInstance=app.crowniclesInstance;
 if(gameInstance.gameDatabase.databaseConfiguration.prefix!==prefix)throw Error('CORE_DB_PREFIXO_DIVERGENTE');
 await gameInstance.gameDatabase.init(true);
 if(typeof app.setCrowniclesInstanceForTests==='function')app.setCrowniclesInstanceForTests(gameInstance);
 gameInstance.setLogsDatabaseForTests?.(new Proxy({},{get:(_,key)=>key==='then'?undefined:async()=>{}}));
 for(const [packet,rel] of Object.entries(compiledPaths)){
  require(path.join(dist,rel));if(typeof gameInstance.packetListener.getListener(packet)!=='function')throw Error('HANDLER_CROWNICLES_AUSENTE_'+packet)
 }
 const {MapCache}=require(path.join(dist,'core','maps','MapCache.js'));
 const {LogsMapLinks}=require(path.join(dist,'core','database','logs','models','LogsMapLinks.js'));
 const original=LogsMapLinks.findAll;LogsMapLinks.findAll=async()=>[];
 try{await MapCache.init()}finally{LogsMapLinks.findAll=original}
 require(path.join(dist,'core','fights','AiBehaviorController.js')).initializeAllClassBehaviors();
 require(path.join(dist,'core','fights','PetAssistManager.js')).initializeAllPetBehaviors();
 status('CORE_ORIGINAL','PRONTO');status('CORE_DB','BETA_PERSISTENTE');
 return {bootstrap,shim,models:gameInstance.gameDatabase.sequelize.models};
}
async function startMqtt(req,coreBoot){
 const portMqtt=await randomMqttPort();
 const topic='cw_wa_mqtt_lab_'+crypto.randomBytes(12).toString('hex');
 const mqttCfg={mqttUrl:'mqtt://127.0.0.1:'+portMqtt,mqttTo:topic+'/crownicles_core',mqttFrom:topic+'/crownicles_websocket',mqttIsolated:true,coreDir:core};
 const conf=path.join(stateDir,'mosquitto-beta.conf');fs.writeFileSync(conf,`listener ${portMqtt} 127.0.0.1\nallow_anonymous true\npersistence false\nlog_type error\n`,{mode:0o600});
 mosqProc=spawn('mosquitto',['-c',conf],{stdio:'ignore'});mosqProc.once('error',e=>status('MOSQUITTO_PROCESSO_ERRO',e.code));startedChildren.push(mosqProc);
 await waitTcp(portMqtt,mosqProc,9000);
 const mqtt=req('mqtt');
 const origin=crypto.randomUUID();assertLabConfig(mqttCfg,origin);
 coreBoot.bootstrap.setBotConfigForTests({...coreBoot.bootstrap.botConfig,PREFIX:topic,MQTT_HOST:mqttCfg.mqttUrl});
 const {MqttTopicUtils}=require(path.join(core,'dist','Lib','src','utils','MqttTopicUtils.js'));
 if(MqttTopicUtils.getCoreTopic(topic)!==mqttCfg.mqttTo||MqttTopicUtils.getWebSocketTopic(topic)!==mqttCfg.mqttFrom)throw Error('MQTT_TOPICOS_DIVERGENTES');
 mqttOfficial=mqtt.connect(mqttCfg.mqttUrl,{connectTimeout:3000,reconnectPeriod:1500,clean:true,resubscribe:false,queueQoSZero:false});
 const originalInit=gameInstance.init;
 if(typeof originalInit!=='function')throw Error('CORE_INIT_AUSENTE');
 let initCount=0;gameInstance.init=function(){initCount++;return Promise.resolve()};
 coreBoot.shim.exports.mqttClient=mqttOfficial;
 require(path.join(dist,'main.js'));
 if(initCount!==1)throw Error('CORE_MAIN_INICIO_DIVERGENTE');
 bridgeCore=new CrowniclesCore(mqttCfg,origin);bridgeCore.connect();
 const maxTime=Date.now()+14000;
 while(Date.now()<maxTime){if(mqttOfficial.connected&&bridgeCore.ready){status('MQTT_ORIGINAL','PRONTO');status('MQTT_PORT',portMqtt);return}await sleep(75)}
 throw Error('MQTT_READY_TIMEOUT');
}
function extractText(message){
 let m=message?.message;if(!m)return null;
 for(let i=0;i<3;i++){if(m.ephemeralMessage?.message)m=m.ephemeralMessage.message;else if(m.viewOnceMessage?.message)m=m.viewOnceMessage.message;else if(m.viewOnceMessageV2?.message)m=m.viewOnceMessageV2.message;else break}
 const x=m.conversation||m.extendedTextMessage?.text||m.imageMessage?.caption||m.videoMessage?.caption||m.documentWithCaptionMessage?.message?.documentMessage?.caption;
 return typeof x==='string'?x:null;
}
async function startBaileys(cfg,coreBoot){
 const pino=require('pino');
 const mod=await import('@whiskeysockets/baileys');
 const makeWASocket=mod.default?.default||mod.default||mod.makeWASocket;
 const useMultiFileAuthState=mod.useMultiFileAuthState||mod.default?.useMultiFileAuthState;
 if(typeof makeWASocket!=='function'||typeof useMultiFileAuthState!=='function')throw Error('BAILEYS_INCOMPATIVEL');
 const qr=require('qrcode-terminal');
 const {state,saveCreds}=await useMultiFileAuthState(path.join(stateDir,'baileys-auth'));
  // A conta Pinguino ja foi pareada: esta beta NAO deve abrir login novo.
  if(state?.creds?.registered!==true)throw Error('SESSAO_ANTIGA_NAO_REGISTRADA_NOVO_PAREAMENTO_BLOQUEADO');
  const me=String(state.creds.me?.id||'');
  const currentNumber=/^(\d{10,15})(?::\d+)?@(?:s\.whatsapp\.net|lid)$/.exec(me)?.[1];
  if(currentNumber&&currentNumber!==cfg.botNumber)throw Error('WHATSAPP_DA_SESSAO_DIFERENTE_DO_BOT_CONFIGURADO');
 let codeIssued=false,ready=false,closing=false;
 const connect=async()=>{
  if(shuttingDown||closing)return;
  const socketClient=makeWASocket({auth:state,logger:pino({level:'silent'}),printQRInTerminal:false,
   markOnlineOnConnect:false,connectTimeoutMs:45000,defaultQueryTimeoutMs:30000,syncFullHistory:false});
  baileysSock=socketClient;
  socketClient.ev.on('creds.update',saveCreds);
  socketClient.ev.on('connection.update',async u=>{
   if(shuttingDown||socketClient!==baileysSock)return;
   if(u.qr && !state.creds.registered){
    if(!codeIssued && typeof socketClient.requestPairingCode==='function'){
     codeIssued=true;
     try{await sleep(1400);const code=await socketClient.requestPairingCode(cfg.botNumber);status('CODIGO_PAREAMENTO',code);status('PAREAMENTO','WhatsApp > Aparelhos conectados > Conectar com numero de telefone');}
     catch(e){status('CODIGO_FALHOU',e.message);qr.generate(u.qr,{small:true})}
    } else if(!codeIssued){qr.generate(u.qr,{small:true})}
   }
   if(u.connection==='open') {ready=true;status('WHATSAPP_BETA','CONECTADO');status('BETA_PRONTA_PARA_TESTE','SIM');}
   if(u.connection==='close'){
    ready=false;status('WHATSAPP_BETA','DESCONECTADO');
    const code=u.lastDisconnect?.error?.output?.statusCode;
    if(code===401||code===403){closing=true;status('PAREAMENTO_EXPIRADO','SIM');return}
    if(!shuttingDown){try{socketClient.ev.removeAllListeners()}catch{};await sleep(4500);await connect()}
   }
  });
  socketClient.ev.on('messages.upsert',async ({messages,type})=>{
   if(shuttingDown||!ready||type!=='notify')return;
   for(const msg of messages||[]){
    try{
     const chat=normalizeJid(msg.key?.remoteJid||'');
     const sender=normalizeJid(msg.key?.participantPn||msg.key?.participant||msg.key?.remoteJidPn||msg.key?.remoteJid||'');
     const body=extractText(msg);
     if(!chat||!sender||!body||!msg.key?.id)continue;
     const me=!!msg.key.fromMe;
     if(me)continue;
     await bridgeRuntime.handle({id:msg.key.id,chatJid:chat,senderJid:sender,text:body,fromMe:false});
    }catch(e){status('MENSAGEM_FALHOU',String(e.message||e).slice(0,150))}
   }
  });
  };
 await connect();
 return async(jid,text)=>{
  if(!ready||!baileysSock)throw Error('WHATSAPP_OFFLINE');
  await baileysSock.sendMessage(jid,{text});
 };
}
async function main(){
 preflight();
 if(process.argv.includes('--preflight')){status('PREFLIGHT','APROVADO');return}
 fs.mkdirSync(stateDir,{recursive:true,mode:0o700});
 const cfg=ownerSettings();lock();
 process.on('SIGINT',()=>shutdown(0));process.on('SIGTERM',()=>shutdown(0));
 process.on('uncaughtException',e=>{status('ERRO_NAO_TRATADO',e.message);shutdown(1)});
 process.on('unhandledRejection',e=>status('PROMISE_ERRO',String(e?.message||e).slice(0,180)));
 const req=createRequire(path.join(core,'package.json'));
 const Maria=req('mariadb');
 status('BETA_INICIO','ISOLADO');
 const maria=await startMaria(Maria);adminConn=maria.conn;
 const coreBoot=await initCore(maria.port,cfg,req,adminConn);
 await startMqtt(req,coreBoot);
 const waSender=async(jid,text)=>{if(!baileysSock)throw Error('BAILEYS_NAO_PRONTO');await baileysSock.sendMessage(jid,{text})};
 const {ItemCategory}=require(path.join(core,'dist','Lib','src','constants','ItemConstants.js'));
 bridgeRuntime=createBetaRuntime({dataDir:stateDir,ownerJids:[cfg.ownerNumber],core:bridgeCore,
  presenter:new Presenter(path.join(gameRoot,'Lang','pt')),send:waSender,
  Player:coreBoot.models.Player,InventoryInfo:coreBoot.models.InventoryInfo,
  InventorySlot:coreBoot.models.InventorySlot,ItemCategory});
 eventTimer=setInterval(()=>{try{bridgeRuntime.gateway.maintenance()}catch(e){status('MAINTENANCE_ERRO',e.message)}},15000);
 status('BETA_CADASTRO','HABILITADO');status('BETA_GRUPOS','SOMENTE_ATIVADOS');
 await startBaileys(cfg,coreBoot);
}
async function shutdown(code){
 if(shuttingDown)return;shuttingDown=true;status('BETA_ENCERRANDO','SIM');
 clearInterval(eventTimer);
 try{bridgeRuntime?.close()}catch{}
 try{bridgeCore?.close()}catch{}
 try{mqttOfficial?.end(true)}catch{}
 try{baileysSock?.end?.(undefined)}catch{}
 try{await gameInstance?.gameDatabase?.sequelize?.close()}catch{}
 try{await adminConn?.end()}catch{}
 for(const proc of [mosqProc,mariaProc]){try{if(proc&&proc.exitCode===null)proc.kill('SIGTERM')}catch{}}
 releaseLock();status('BANCO_BETA_PRESERVADO','SIM');process.exitCode=code;
}
if(require.main===module)main().catch(async e=>{status('BETA_FALHA',String(e?.message||e).replace(/[\r\n]/g,' ').slice(0,240));await shutdown(1)});
module.exports={preflight,extractText};
