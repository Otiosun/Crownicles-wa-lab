#!/usr/bin/env node
'use strict';
/**
 * Actual MQTT 3.1.1 broker/TCP integration with deterministic SUBACK on reconnect and a mock Core responder.
 * No Crownicles Core main, MariaDB, Baileys or WhatsApp session is started.
 * This is a protocol/wire test, NOT native Crownicles game behavior validation.
 * Environment: Termux Node 22, local mosquitto executable, Core npm mqtt present.
 */
const {spawn,spawnSync}=require('node:child_process');
const {createServer,connect:tcpConnect}=require('node:net');
const {EventEmitter}=require('node:events');
const crypto=require('node:crypto');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {CrowniclesCore}=require('../src/core.cjs');
const {assertLabConfig}=require('../src/mqtt-isolation.cjs');
const {Store}=require('../src/store.cjs');
const {Presenter}=require('../src/presenter.cjs');
const {Gateway}=require('../src/gateway.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const within=async(fn,limit=10000,interval=60)=>{const start=Date.now();while(Date.now()-start<limit){try{if(await fn())return true}catch{}await wait(interval)}return false};
const coreDir=process.argv[2]||path.join(os.homedir(),'crownicles-whatsapp-lab','crownicles-dev','Core');
const UUID=()=>crypto.randomUUID(),id=UUID(),wa='5511999988776';
const rand=crypto.randomBytes(12).toString('hex'),prefix='cw_wa_mqtt_lab_'+rand;
let tmp,broker,sub,core,store;
const cleanup=async()=>{
 try{core?.close()}catch{}
 try{sub?.end(true)}catch{}
 try{store?.close()}catch{}
 if(broker&&broker.exitCode===null&&broker.signalCode===null){broker.kill('SIGTERM');await Promise.race([new Promise(resolve=>broker.once('exit',resolve)),wait(2500)]);}
 try{if(tmp)fs.rmSync(tmp,{recursive:true,force:true})}catch{}
};
async function freePort(){for(let tries=0;tries<24;tries++){const candidate=20000+crypto.randomInt(0,40999);try{return await new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(candidate,'127.0.0.1',()=>s.close(()=>resolve(candidate)))})}catch(e){if(e.code!=='EADDRINUSE')throw e;}}throw Error('SEM_PORTA_LOCAL_LIVRE')}
function canConnect(port){return new Promise(resolve=>{const s=tcpConnect({host:'127.0.0.1',port});let done=false;const finish=x=>{if(done)return;done=true;s.destroy();resolve(x)};s.on('connect',()=>finish(true));s.on('error',()=>finish(false));s.setTimeout(500,()=>finish(false))})}
async function startBroker(file,port){
 const b=spawn('mosquitto',['-c',file],{stdio:['ignore','pipe','pipe']});let errors='';
 b.stderr.on('data',v=>{errors=(errors+v.toString()).slice(-3000)});
 b.stdout.on('data',v=>{errors=(errors+v.toString()).slice(-3000)});
 let spawnError=null;b.once('error',e=>{spawnError=e});
 if(!await within(async()=>spawnError||b.exitCode!==null||await canConnect(port),5500,80))throw Error('MOSQUITTO_NAO_INICIOU '+errors.slice(-300));
 if(spawnError)throw spawnError;
 if(b.exitCode!==null)throw Error('MOSQUITTO_EXIT_'+b.exitCode+' '+errors.slice(-300));
 return b;
}
async function onceConnected(client,check){
 if(!await within(()=>client.connected===true&&check(),7000))throw Error('CLIENTE_MQTT_NAO_CONECTOU_OU_ASSINOU');
}
async function run(){
 const mosq=spawnSync('sh',['-c','command -v mosquitto'],{encoding:'utf8',timeout:2500});
 if(mosq.status!==0)throw Error('MOSQUITTO_AUSENTE');
 let mqtt;try{mqtt=require(require.resolve('mqtt',{paths:[coreDir]}))}catch{throw Error('NODE_MQTT_CORE_AUSENTE')}
 const port=await freePort();if(port<20000||port>60999)throw Error('PORTA_TEMPORARIA_FORA_DA_FAIXA_SEGURO');
 const cfg={mqttUrl:`mqtt://127.0.0.1:${port}`,mqttTo:prefix+'/crownicles_core',mqttFrom:prefix+'/crownicles_websocket',mqttIsolated:true,coreDir};
 const origin=UUID();assertLabConfig(cfg,origin);
 tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cw-mqtt-v5-'));fs.mkdirSync(path.join(tmp,'lang'));
 for(const name of ['events','models'])fs.writeFileSync(path.join(tmp,'lang',name+'.json'),'{}');
 const conf=path.join(tmp,'mosquitto-isolado.conf');
 fs.writeFileSync(conf,[`listener ${port} 127.0.0.1`,'allow_anonymous true','persistence false','log_type error',''].join('\n'),{mode:0o600});
 console.log('LAB=MQTT_REAL_ISOLADO_V5');
 console.log('BROKER_HOST=127.0.0.1');console.log('BROKER_PORTA_TEMPORARIA='+port);
 console.log('PREFIXO_TEMPORARIO='+prefix);
 broker=await startBroker(conf,port);
 // Instrument both MQTT.js clients: distinguish TCP, CONNECT and SUBACK failures.
 const events={mock:{connect:0,reconnect:0,offline:0,close:0,error:0,suback:0,subfail:0},gateway:{connect:0,reconnect:0,offline:0,close:0,error:0}};
 const installTelemetry=(client,label)=>{for(const event of ['connect','reconnect','offline','close'])client.on(event,()=>events[label][event]++);client.on('error',err=>{events[label].error++;events[label].lastError=typeof err?.code==='string'&&/^[A-Z0-9_]{2,35}$/.test(err.code)?err.code:'OUTRO';});};
 // Single owner of subscriptions: manual SUBSCRIBE per CONNACK. MQTT.js
 // resubscribe:true can skip an explicit second subscribe and callback [].
 sub=mqtt.connect(cfg.mqttUrl,{connectTimeout:3000,reconnectPeriod:1000,clean:true,resubscribe:false,queueQoSZero:false});
 let mockSubscribed=false,mockEpoch=0;
 installTelemetry(sub,'mock');
 sub.on('connect',()=>{
  const epoch=++mockEpoch;mockSubscribed=false;
  sub.subscribe(cfg.mqttTo,{qos:0},(err,granted)=>{
   if(epoch!==mockEpoch||!sub.connected)return;
   mockSubscribed=!err&&Array.isArray(granted)&&granted.some(x=>x.topic===cfg.mqttTo&&x.qos!==128);
   events.mock[mockSubscribed?'suback':'subfail']++;
  });
 });
 for(const event of ['close','offline'])sub.on(event,()=>{mockEpoch++;mockSubscribed=false});
 sub.on('error',()=>{if(!sub.connected){mockEpoch++;mockSubscribed=false}});
 let requestCount=0,replyCount=0;
 sub.on('message',(topic,payload)=>{
  if(topic!==cfg.mqttTo)return;
  let msg;try{msg=JSON.parse(payload.toString())}catch{return}
  if(msg?.packet?.name!=='CommandPingPacketReq'||msg.context?.frontEndOrigin!==origin||msg.context?.keycloakId!==id)return;
  requestCount++;
  const correct={context:{...msg.context},packets:[{name:'CommandPingPacketRes',packet:{clientTime:msg.packet.data.time}}]};
  // Deliberately send a wrong origin first; adapter must reject it.
  const wrong={context:{...msg.context,frontEndOrigin:'wrong-origin'},packets:correct.packets};
  sub.publish(cfg.mqttFrom,JSON.stringify(wrong),{qos:0,retain:false});
  setTimeout(()=>{
   if(!sub||!sub.connected)return;
   sub.publish(cfg.mqttFrom,JSON.stringify(correct),{qos:0,retain:false});
   sub.publish(cfg.mqttFrom,JSON.stringify(correct),{qos:0,retain:false});
   replyCount+=2;
  },70);
 });
 await onceConnected(sub,()=>mockSubscribed);
 store=new Store(path.join(tmp,'sqlite'));const delivered=[];
 core=new CrowniclesCore(cfg,origin);
 const gw=new Gateway({bindings:{[wa]:id}},store,new Presenter(path.join(tmp,'lang')),core,async(wh,text)=>delivered.push({wh,text}));
 const bridgeClient=core.connect();installTelemetry(bridgeClient,'gateway');
 if(!await within(()=>core.ready===true,8000))throw Error('BRIDGE_SUBACK_TIMEOUT');
 console.log('PASS=01_BROKER_ISOLADO_E_ASSINATURAS_REAIS');
 gw.receive('wamid.mqttv3-1',wa,'/ping');
 if(!await within(()=>delivered.length===1,8000))throw Error('PING_VIA_TCP_TIMEOUT');
 if(requestCount!==1||!delivered[0].text.includes('MOTOR ATIVO'))throw Error('PING_DADOS_INVALIDOS');
 console.log('PASS=02_GATEWAY_SQLITE_MQTT_PING_END_TO_END');
 if(!await within(()=>replyCount>=2,2500))throw Error('DUPLICATAS_NAO_PUBLICADAS');
 await wait(120);
 if(delivered.length!==1||core.stats.rejected<1)throw Error('ORIGEM_OU_DUPLICATAS_NAO_BLOQUEADAS');
 console.log('PASS=03_ORIGEM_INVALIDA_E_DUPLICATAS_REJEITADAS');
 const prev=core.stats.sent;
 // A broker outage must never cause replay of the already completed request.
 const oldBroker=broker;oldBroker.kill('SIGTERM');
 if(!await within(()=>oldBroker.exitCode!==null||oldBroker.signalCode!==null,3500))throw Error('BROKER_NAO_PAROU');
 if(!await within(()=>!core.ready,3500))throw Error('BRIDGE_NAO_DETECTOU_QUEDA');
 if(core.stats.sent!==prev)throw Error('REPLAY_APOS_QUEDA');
 console.log('PASS=04_QUEDA_BROKER_SEM_REENVIO_AUTOMATICO');
 broker=await startBroker(conf,port);
 // Native Android can pause JS timers during child-process teardown. 22 s is a
 // bound, not a reconnect trigger: no automatic replay or manual client reset.
 const reconnectStart=Date.now();
 const recovered=await within(()=>core.ready&&sub.connected&&mockSubscribed,22000,90);
 const tcpReady=await canConnect(port);
 const diag={tcp:tcpReady?1:0,mosquitto_alive:broker.exitCode===null&&broker.signalCode===null?1:0,
  gateway_socket:bridgeClient.connected?1:0,gateway_suback:core.ready?1:0,
  mock_socket:sub.connected?1:0,mock_suback:mockSubscribed?1:0,
  gateway_connects:core.stats.connects,gateway_disconnects:core.stats.disconnects,
  events,elapsed_ms:Date.now()-reconnectStart,original_requests:prev,current_requests:core.stats.sent};
 console.log('MQTT_RECONNECT_DIAG='+JSON.stringify(diag));
 if(!recovered){
  const reason=!tcpReady?'BROKER_INACESSIVEL':!sub.connected?'CORE_SIMULADO_SEM_CONEXAO':!mockSubscribed?'CORE_SIMULADO_SEM_SUBACK':!bridgeClient.connected?'GATEWAY_SEM_CONEXAO':'GATEWAY_SEM_SUBACK';
  throw Error('RECONEXAO_MQTT_NAO_OCORREU_'+reason);
 }
 if(core.stats.sent!==prev)throw Error('REPLAY_DURANTE_RECONEXAO');
 await wait(150);
 gw.receive('wamid.mqttv3-2',wa,'/ping');
 if(!await within(()=>delivered.length===2,8000))throw Error('PING_APOS_RECONEXAO_TIMEOUT');
 if(requestCount!==2||core.stats.sent!==prev+1)throw Error('NOVO_PEDIDO_DUPLICADO');
 console.log('PASS=05_RECONEXAO_E_SEGUNDA_SOLICITACAO_UNICA');
 console.log('MQTT_WIRE_TESTES=5/5');console.log('MQTT_WIRE_FALHAS=0');
 console.log('CORE_ORIGINAL_NAO_INICIADO=SIM');
 console.log('WHATSAPP_REAL_NAO_ACESSADO=SIM');
 console.log('BANCO_MARIADB_NAO_ACESSADO=SIM');
 console.log('LAB_SAIDA=0');
}
run().catch(e=>{console.log('MQTT_REAL_FALHOU='+String(e?.message||e).slice(0,350));console.log('LAB_SAIDA=1');process.exitCode=1}).finally(async()=>{await cleanup()});
