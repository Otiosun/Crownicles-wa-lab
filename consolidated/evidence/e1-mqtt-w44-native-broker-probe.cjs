'use strict';
// W44 native P0-C only. Isolated ephemeral loopback broker, never production.
// Usage: node consolidated/evidence/e1-mqtt-w44-native-broker-probe.cjs /ABS/PATH/TO/CORE_WITH_MQTT_DEPENDENCY
// Distinguish BLOCKED prerequisites from FAIL security. No secrets in output.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {spawn,spawnSync}=require('node:child_process');
const net=require('node:net');
const {setTimeout:delay}=require('node:timers/promises');
const {createBrokerConfig}=require('../../candidate/bridge/mqtt-auth-lab.cjs');
function binary(name){const r=spawnSync(name,['--help'],{encoding:'utf8',timeout:3000,stdio:'ignore'});return r.error?.code!=='ENOENT'}
function result(code,status,reason){process.stdout.write(JSON.stringify({schema:'e1-mqtt-w44-native-probe-v1',status,reason,gates:{mqtt_acl:status==='PASS'?'PROBE_PASS_NOT_E2E':'NOT_HOMOLOGATED'},noProduction:true})+'\n');process.exitCode=code}
async function port(){const s=net.createServer();await new Promise((res,rej)=>{s.once('error',rej);s.listen(0,'127.0.0.1',res)});const p=s.address().port;await new Promise(r=>s.close(r));return p}
async function waitSocket(p,child){for(let i=0;i<40;i++){if(child.exitCode!==null)throw Error('BROKER_EARLY_EXIT');const ok=await new Promise(r=>{const c=net.connect({host:'127.0.0.1',port:p});c.setTimeout(250);c.once('connect',()=>{c.destroy();r(true)});c.once('error',()=>r(false));c.once('timeout',()=>{c.destroy();r(false)})});if(ok)return;await delay(100)}throw Error('BROKER_PORT_NOT_READY')}
function clientConnect(mqtt,url,auth){return new Promise((resolve,reject)=>{const c=mqtt.connect(url,{...auth,protocolVersion:4,connectTimeout:2000,reconnectPeriod:0,clean:true,queueQoSZero:false});let done=false;const t=setTimeout(()=>{if(!done){done=true;c.end(true);reject(Error('CONNECT_TIMEOUT'))}},3300);c.on('connect',()=>{if(!done){done=true;clearTimeout(t);resolve(c)}});c.on('error',e=>{if(!done){done=true;clearTimeout(t);c.end(true);reject(Error('CONNACK_REJECTED'))}})})}
async function mustReject(mqtt,url,auth,label){try{const c=await clientConnect(mqtt,url,auth);c.end(true);throw Error('ACL_ACCEPTED_'+label)}catch(e){if(String(e.message).startsWith('ACL_ACCEPTED_'))throw e;if(e.message!=='CONNACK_REJECTED')throw e}}
function subscribe(c,topic){return new Promise((resolve,reject)=>c.subscribe(topic,{qos:1},(e,grants)=>e?reject(Error('SUBSCRIBE_ERROR')):resolve(grants)))}
function publish(c,topic,text){return new Promise((resolve,reject)=>c.publish(topic,text,{qos:1,retain:false},e=>e?reject(Error('PUBLISH_ERROR')):resolve()))}
function message(c,topic,nonce,deadline=4000){return new Promise((resolve,reject)=>{const t=setTimeout(()=>{c.off('message',handler);reject(Error('MESSAGE_NOT_DELIVERED'))},deadline);function handler(tpc,data){if(tpc===topic&&data.toString()===nonce){clearTimeout(t);c.off('message',handler);resolve()}}c.on('message',handler)})}
async function main(){const root=process.argv[2];if(!root||!path.isAbsolute(root)||!fs.existsSync(root))return result(2,'BLOCKED','ABSOLUTE_CORE_PATH_REQUIRED');if(!binary('mosquitto')||!binary('mosquitto_passwd'))return result(2,'BLOCKED','MOSQUITTO_BINARIES_MISSING');let mqtt;try{mqtt=require(require.resolve('mqtt',{paths:[root]}))}catch{return result(2,'BLOCKED','CORE_MQTT_NODE_MODULE_MISSING')}
 const stateDir=fs.mkdtempSync(path.join(os.tmpdir(),'w44-native-private-'));fs.chmodSync(stateDir,0o700);
 let broker,proc,core,gateway;try{
  const tcp=await port(),prefix='cw_wa_mqtt_lab_'+crypto.randomBytes(12).toString('hex');
  broker=createBrokerConfig({stateDir,port:tcp,prefix});
  proc=spawn('mosquitto',['-c',broker.confFile],{stdio:'ignore'});
  await waitSocket(tcp,proc);
  const url='mqtt://127.0.0.1:'+tcp;
  await mustReject(mqtt,url,null,'ANONYMOUS');
  await mustReject(mqtt,url,{username:broker.core.username,password:'wrong-password'},'WRONG_PASSWORD');
  core=await clientConnect(mqtt,url,broker.core);
  gateway=await clientConnect(mqtt,url,broker.gateway);
  const cTopic=prefix+'/crownicles_core',gTopic=prefix+'/crownicles_websocket';
  const goodCore=await subscribe(core,cTopic),goodGateway=await subscribe(gateway,gTopic);
  if(goodCore[0]?.qos===128||goodGateway[0]?.qos===128)throw Error('PERMITTED_SUBSCRIBE_REJECTED');
  const deniedCore=await subscribe(core,gTopic),deniedGateway=await subscribe(gateway,cTopic);
  if(deniedCore[0]?.qos!==128||deniedGateway[0]?.qos!==128)throw Error('CROSS_SUBSCRIBE_NOT_REJECTED');
  const a=crypto.randomBytes(8).toString('hex'),b=crypto.randomBytes(8).toString('hex');
  const coreInbox=message(core,cTopic,a),gatewayInbox=message(gateway,gTopic,b);
  await Promise.all([publish(gateway,cTopic,a),publish(core,gTopic,b)]);
  await Promise.all([coreInbox,gatewayInbox]);
  // Assert a forbidden writer cannot inject into its own subscribed topic.
  let leaked=false;const probeCore=(t,d)=>{if(t===cTopic&&d.toString()==='forbid-'+a)leaked=true};
  const probeGateway=(t,d)=>{if(t===gTopic&&d.toString()==='forbid-'+b)leaked=true};
  core.on('message',probeCore);gateway.on('message',probeGateway);
  core.publish(cTopic,'forbid-'+a,{qos:0,retain:false});
  gateway.publish(gTopic,'forbid-'+b,{qos:0,retain:false});
  await delay(450);core.off('message',probeCore);gateway.off('message',probeGateway);
  if(leaked)throw Error('CROSS_TOPIC_PUBLISH_ACL_BYPASS');
  result(0,'PASS','ANONYMOUS_DENIED_BAD_PASSWORD_DENIED_CROSS_TOPIC_SUBSCRIBE_AND_PUBLISH_DENIED_BOTH_DIRECTIONS_DELIVERED');
 }catch(e){result(1,'FAIL',/^[A-Z_]+$/.test(e.message)?e.message:'NATIVE_PROBE_EXCEPTION')}
 finally{try{core?.end(true);gateway?.end(true)}catch{};try{proc?.kill('SIGTERM')}catch{};try{broker?.cleanup()}catch{};fs.rmSync(stateDir,{recursive:true,force:true})}}
main().catch(()=>result(1,'FAIL','NATIVE_PROBE_UNEXPECTED_EXCEPTION'));
