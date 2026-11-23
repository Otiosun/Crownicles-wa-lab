'use strict';
// W46: actual MQTT v3.1.1 frames, no third-party MQTT client. PRIVATE loopback only.
// Requires the exact W44 createBrokerConfig source and native mosquitto binaries.
// No Core, players, external broker, production credentials or generated secrets in output.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const net = require('node:net');
const {EventEmitter} = require('node:events');
const {spawn, spawnSync} = require('node:child_process');
const {setTimeout: sleep} = require('node:timers/promises');
const W44_SHA = '83b1729055cbb4027b68208811450937deb1d90090d404eff4a2b48526177beb';
const PREFIX = 'cw_wa_mqtt_lab_';
const TIMEOUT = 3200;
function sha(bytes){return crypto.createHash('sha256').update(bytes).digest('hex')}
function fail(code){throw Error(code)}
function u16(n){const b=Buffer.alloc(2);b.writeUInt16BE(n);return b}
function str(x){const b=Buffer.from(String(x));if(b.length>65535)fail('MQTT_STRING_TOO_LONG');return Buffer.concat([u16(b.length),b])}
function remainingLength(n){if(!Number.isSafeInteger(n)||n<0||n>268435455)fail('MQTT_LENGTH_INVALID');const b=[];do{let v=n%128;n=Math.floor(n/128);if(n)v|=128;b.push(v)}while(n);return Buffer.from(b)}
function packet(header,payload){return Buffer.concat([Buffer.from([header]),remainingLength(payload.length),payload])}
function parseOne(buffer){if(buffer.length<2)return null;let multiplier=1,value=0,i=1;for(let a=0;a<4;a++,i++){if(i>=buffer.length)return null;const b=buffer[i];value+=(b&127)*multiplier;if(!(b&128)){if(value>268435455)fail('MQTT_LENGTH_INVALID');if(buffer.length<i+1+value)return null;return {header:buffer[0],payload:buffer.subarray(i+1,i+1+value),size:i+1+value}}multiplier*=128}fail('MQTT_VARINT_TOO_LONG')}
class MqttWire extends EventEmitter {
 constructor(socket){super();this.socket=socket;this.buffer=Buffer.alloc(0);this.id=1;socket.on('data',chunk=>{try{this.buffer=Buffer.concat([this.buffer,chunk]);for(;;){const f=parseOne(this.buffer);if(!f)break;this.buffer=this.buffer.subarray(f.size);this.emit('frame',f);if((f.header>>4)===3){const n=f.payload.readUInt16BE(0);if(n+2>f.payload.length)fail('MQTT_BAD_PUBLISH');this.emit('message',{topic:f.payload.subarray(2,2+n).toString(),body:f.payload.subarray(2+n).toString()})}}}catch{this.emit('invalid')}});socket.on('error',()=>this.emit('lost'));socket.on('close',()=>this.emit('lost'))}
 static async connect(port,{username,password}={}){const s=net.connect({port,host:'127.0.0.1'});const c=new MqttWire(s);await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('error',reject)});const name='w46_'+crypto.randomBytes(10).toString('hex');let flags=2;const parts=[str('MQTT'),Buffer.from([4])];if(username!==undefined)flags|=0x80;if(password!==undefined)flags|=0x40;parts.push(Buffer.from([flags]),u16(20),str(name));if(username!==undefined)parts.push(str(username));if(password!==undefined)parts.push(str(password));const answer=c.awaitFrame(2);s.write(packet(0x10,Buffer.concat(parts)));let f;try{f=await answer}catch(e){c.close();throw e}if(f.payload.length!==2)fail('MQTT_CONNACK_INVALID');return {client:c,rc:f.payload[1]}}
 awaitFrame(type,timeout=TIMEOUT){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>done(Error('MQTT_TIMEOUT')),timeout);const frame=f=>{if((f.header>>4)===type)done(null,f)};const lost=()=>done(Error('MQTT_CONNECTION_LOST'));const invalid=()=>done(Error('MQTT_INVALID_PACKET'));const done=(err,value)=>{clearTimeout(timer);this.off('frame',frame);this.off('lost',lost);this.off('invalid',invalid);err?reject(err):resolve(value)};this.on('frame',frame);this.on('lost',lost);this.on('invalid',invalid)})}
 async subscribe(topic){const id=this.id++;const ans=this.awaitFrame(9);this.socket.write(packet(0x82,Buffer.concat([u16(id),str(topic),Buffer.from([0])])));const f=await ans;if(f.payload.length!==3||f.payload.readUInt16BE(0)!==id)fail('MQTT_SUBACK_INVALID');return f.payload[2]}
 publish(topic,body){this.socket.write(packet(0x30,Buffer.concat([str(topic),Buffer.from(String(body))])))}
 waitMessage(topic,body,timeout=TIMEOUT){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>done(Error('MQTT_MESSAGE_TIMEOUT')),timeout);const cb=m=>{if(m.topic===topic&&m.body===body)done(null,true)};const done=(err,value)=>{clearTimeout(timer);this.off('message',cb);err?reject(err):resolve(value)};this.on('message',cb)})}
 observe(topic,body){let count=0;const cb=m=>{if(m.topic===topic&&m.body===body)count++};this.on('message',cb);return ()=>{this.off('message',cb);return count}}
 close(){try{this.socket.end(packet(0xE0,Buffer.alloc(0)));this.socket.destroy()}catch{}}
}
async function pickPort(){const server=net.createServer();await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes)});const port=server.address().port;await new Promise(r=>server.close(r));if(port<20000||port>60999)return pickPort();return port}
async function waitReady(port,proc){for(let i=0;i<50;i++){if(proc.exitCode!==null)fail('BROKER_EARLY_EXIT');const good=await new Promise(resolve=>{const s=net.connect({port,host:'127.0.0.1'});s.setTimeout(220);s.once('connect',()=>{s.destroy();resolve(true)});s.once('error',()=>resolve(false));s.once('timeout',()=>{s.destroy();resolve(false)})});if(good)return;await sleep(100)}fail('BROKER_NOT_READY')}
function binary(name){const r=spawnSync(name,['--help'],{stdio:'ignore',timeout:3000});return r.error?.code!=='ENOENT'&&!r.error}
function report(status,reason,extra={}){console.log(JSON.stringify({schema:'crownicles-w46-mqtt-native-v2',status,reason,executedBroker:status==='PASS',homologated:false,productionTouched:false,...extra}))}
// Mosquitto's file ACL may grant an unauthorized SUBSCRIBE yet suppress all forbidden deliveries.
// Security invariant is message isolation, not a specific SUBACK return code.
async function proveTopicIsolation(core,gateway,prefix,{shortDelayMs=180,deniedDelayMs=450}={}){
 const tCore=prefix+'/crownicles_core',tGate=prefix+'/crownicles_websocket';
 if(await core.subscribe(tCore)!==0||await gateway.subscribe(tGate)!==0)fail('VALID_SUBSCRIPTION_DENIED');
 const rCore=await core.subscribe(tGate),rGate=await gateway.subscribe(tCore);
 const wCore=await core.subscribe(prefix+'/#'),wGate=await gateway.subscribe(prefix+'/#');
 for(const result of [rCore,rGate,wCore,wGate])if(result!==0&&result!==128)fail('MQTT_SUBACK_UNEXPECTED');
 const x=crypto.randomBytes(8).toString('hex'),y=crypto.randomBytes(8).toString('hex');
 const crossCore=core.observe(tGate,y),crossGate=gateway.observe(tCore,x);
 const expectedCore=core.waitMessage(tCore,x),expectedGate=gateway.waitMessage(tGate,y);
 gateway.publish(tCore,x);core.publish(tGate,y);
 await Promise.all([expectedCore,expectedGate]);await sleep(shortDelayMs);
 if(crossCore()>0||crossGate()>0)fail('CROSS_TOPIC_READ_DELIVERED');
 const aBad='deny-'+x,bBad='deny-'+y;
 const badCore=core.observe(tCore,aBad),badGate=gateway.observe(tGate,bBad);
 core.publish(tCore,aBad);gateway.publish(tGate,bBad);await sleep(deniedDelayMs);
 if(badCore()>0||badGate()>0)fail('CROSS_TOPIC_PUBLISH_DELIVERED');
 return {subscriptionSemantics:[rCore,rGate,wCore,wGate].every(v=>v===128)?'ALL_DENIED_SUBACK':'GRANTS_POSSIBLE_DELIVERY_ACL_VERIFIED'};
}
async function stopBroker(proc, timeout=1600){
 if(!proc||proc.exitCode!==null||proc.signalCode!==null)return;
 await new Promise((resolve,reject)=>{
  let done=false,timer;
  const finish=err=>{if(done)return;done=true;clearTimeout(timer);proc.off('exit',onExit);proc.off('error',onError);err?reject(err):resolve()};
  const onExit=()=>finish();const onError=()=>finish(Error('BROKER_SHUTDOWN_FAILED'));
  proc.once('exit',onExit);proc.once('error',onError);
  timer=setTimeout(()=>{try{proc.kill('SIGKILL')}catch{}finish(Error('BROKER_SHUTDOWN_TIMEOUT'))},timeout);
  try{if(!proc.kill('SIGTERM'))finish(Error('BROKER_SHUTDOWN_SIGNAL_REJECTED'))}catch{finish(Error('BROKER_SHUTDOWN_SIGNAL_REJECTED'))}
 });
}
async function run(modulePath){
 if(!modulePath||!path.isAbsolute(modulePath)||!fs.existsSync(modulePath)){report('BLOCKED','W44_SOURCE_ABSOLUTE_PATH_REQUIRED');return 2}
 const bytes=fs.readFileSync(modulePath);
 if(sha(bytes)!==W44_SHA){report('BLOCKED','W44_SOURCE_SHA_MISMATCH');return 2}
 if(process.getuid?.()===0){report('BLOCKED','RUN_AS_NONROOT_REQUIRED');return 2}
 if(!binary('mosquitto')||!binary('mosquitto_passwd')){report('BLOCKED','MOSQUITTO_BINARIES_MISSING');return 2}
 const {createBrokerConfig}=require(modulePath),dir=fs.mkdtempSync(path.join(os.tmpdir(),'w46-broker-'));
 fs.chmodSync(dir,0o700);let broker,processBroker;const clients=[];
 let outcome={status:'FAIL',reason:'NATIVE_PROBE_EXCEPTION',extra:{}};
 try{
  const port=await pickPort(),prefix=PREFIX+crypto.randomBytes(12).toString('hex');
  broker=createBrokerConfig({stateDir:dir,port,prefix});
  processBroker=spawn('mosquitto',['-c',broker.confFile],{stdio:'ignore'});
  await waitReady(port,processBroker);
  const a=await MqttWire.connect(port);a.client.close();if(a.rc===0)fail('ANONYMOUS_ACCEPTED');
  const b=await MqttWire.connect(port,{username:broker.core.username,password:'invalid'});b.client.close();if(b.rc===0)fail('BAD_PASSWORD_ACCEPTED');
  const c=await MqttWire.connect(port,broker.core),g=await MqttWire.connect(port,broker.gateway);
  clients.push(c.client,g.client);if(c.rc!==0||g.rc!==0)fail('VALID_AUTH_DENIED');
  const proof=await proveTopicIsolation(c.client,g.client,prefix);
  outcome={status:'PASS',reason:'NATIVE_MOSQUITTO_AUTH_DELIVERY_ACL_AND_BOTH_DIRECTIONS',extra:{w44SourceSha256:W44_SHA,coreOriginalExecuted:false,subscriptionSemantics:proof.subscriptionSemantics}};
 }catch(e){outcome={status:'FAIL',reason:/^[A-Z0-9_]+$/.test(e.message)?e.message:'NATIVE_PROBE_EXCEPTION',extra:{}}}
 finally{
  for(const c of clients)c.close();
  try{await stopBroker(processBroker)}catch{outcome={status:'FAIL',reason:'BROKER_SHUTDOWN_FAILED',extra:{}}}
  try{broker?.cleanup();fs.rmSync(dir,{recursive:true,force:true})}catch{outcome={status:'FAIL',reason:'BROKER_CLEANUP_FAILED',extra:{}}}
 }
 report(outcome.status,outcome.reason,outcome.extra);
 return outcome.status==='PASS'?0:1;
}
if(require.main===module){run(process.argv[2]).then(code=>{process.exitCode=code}).catch(()=>{report('FAIL','NATIVE_PROBE_UNHANDLED');process.exitCode=1})}
module.exports={str,remainingLength,packet,parseOne,MqttWire,run,proveTopicIsolation,stopBroker,W44_SHA};
