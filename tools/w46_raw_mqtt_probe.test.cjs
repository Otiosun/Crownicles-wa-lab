'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const net=require('node:net'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {str,remainingLength,packet,parseOne,MqttWire,W44_SHA}=require('./w46_raw_mqtt_probe.cjs');
const ROOT=path.resolve(__dirname,'../candidate/bridge/mqtt-auth-lab.cjs');
const sha=require('node:crypto').createHash('sha256').update(require('node:fs').readFileSync(ROOT)).digest('hex');
test('source W44 sha exactly pinned',()=>assert.equal(sha,W44_SHA));
for(const [v,hex] of [[0,'00'],[1,'01'],[127,'7f'],[128,'8001'],[16383,'ff7f'],[16384,'808001'],[268435455,'ffffff7f']])test('MQTT remaining length '+v,()=>assert.equal(remainingLength(v).toString('hex'),hex));
test('invalid remaining length rejected',()=>{for(const n of [-1,268435456,1.1,NaN])assert.throws(()=>remainingLength(n),/MQTT_LENGTH_INVALID/)});
test('MQTT topic frame',()=>{let p=packet(0x30,Buffer.concat([str('abc'),Buffer.from('hello')]));const o=parseOne(p);assert.equal(o.header,0x30);assert.equal(o.size,p.length);assert.equal(o.payload.subarray(2,5).toString(),'abc');assert.equal(o.payload.subarray(5).toString(),'hello')});
test('fragmented packet waits and then reconstructs',()=>{let p=packet(0x30,Buffer.alloc(300,42));for(let j=1;j<p.length;j++)assert.equal(parseOne(p.subarray(0,j)),null);assert.equal(parseOne(p).payload.length,300)});
test('overlong header rejected',()=>assert.throws(()=>parseOne(Buffer.from('30ffffffff10','hex')),/MQTT_VARINT_TOO_LONG/));
test('unsupported string length rejected',()=>assert.throws(()=>str('x'.repeat(65536)),/MQTT_STRING_TOO_LONG/));
test('no dependencies needed for missing broker diagnosis (non-root child)',()=>{const p=spawnSync(process.execPath,[require.resolve('./w46_raw_mqtt_probe.cjs'),ROOT],{encoding:'utf8',timeout:8000,env:{...process.env,PATH:'/nonexistent-w46-path'},...(process.getuid?.()===0?{uid:65534,gid:65534}:{})});assert.equal(p.status,2);const out=JSON.parse(p.stdout.trim());assert.equal(out.status,'BLOCKED');assert.equal(out.reason,'MOSQUITTO_BINARIES_MISSING');assert.equal(out.homologated,false)});
test('mismatched W44 source rejected before broker/root checks',()=>{const p=spawnSync(process.execPath,[require.resolve('./w46_raw_mqtt_probe.cjs'),__filename],{encoding:'utf8',timeout:5000});assert.equal(p.status,2);assert.equal(JSON.parse(p.stdout).reason,'W44_SOURCE_SHA_MISMATCH')});
test('real wire client CONNECT, SUBSCRIBE, PUBLISH and fragmentation against isolated loopback fake transport (NOT native broker)',async()=>{
 const server=net.createServer(s=>{let buf=Buffer.alloc(0);s.on('data',d=>{buf=Buffer.concat([buf,d]);for(;;){let f;try{f=parseOne(buf)}catch{return};if(!f)break;buf=buf.subarray(f.size);const type=f.header>>4;if(type===1){s.write(Buffer.from([0x20,0x02,0x00,0x00]))}else if(type===8){const id=f.payload.subarray(0,2);s.write(Buffer.concat([Buffer.from([0x90,0x03]),id,Buffer.from([0x00])]))}else if(type===3){const echo=packet(0x30,f.payload);s.write(echo.subarray(0,2));setTimeout(()=>s.write(echo.subarray(2)),5)}}})});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let client;try{let c=await MqttWire.connect(server.address().port,{username:'user',password:'pass'});client=c.client;assert.equal(c.rc,0);assert.equal(await client.subscribe('abc'),0);const promise=client.waitMessage('abc','payload');client.publish('abc','payload');assert.equal(await promise,true)}finally{client?.close();await new Promise(r=>server.close(r))}
});
const {EventEmitter}=require('node:events');
const {proveTopicIsolation}=require('./w46_raw_mqtt_probe.cjs');
function topicPair({suback=0,leakRead=false,leakWrite=false,slowDeniedMs=0,dropFence=false}={}){
 const prefix='cw_wa_mqtt_lab_'+'a'.repeat(24),cTopic=prefix+'/crownicles_core',gTopic=prefix+'/crownicles_websocket';
 const bus=new EventEmitter();
 const mk=(role,read,write)=>{
  const self=new EventEmitter();self.subscriptions=[];
  self.subscribe=async t=>{self.subscriptions.push(t);return t===read?0:suback};
  self.waitMessage=(t,b)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{self.off('message',cb);reject(Error('MQTT_MESSAGE_TIMEOUT'))},450);const cb=m=>{if(m.topic===t&&m.body===b){clearTimeout(timer);self.off('message',cb);resolve(true)}};self.on('message',cb)});
  self.observe=(t,b)=>{let seen=0;const cb=m=>{if(m.topic===t&&m.body===b)seen++};self.on('message',cb);return ()=>{self.off('message',cb);return seen}};
  let queue=Promise.resolve();
  self.publish=(t,b)=>{queue=queue.then(async()=>{if(slowDeniedMs&&t!==write)await new Promise(r=>setTimeout(r,slowDeniedMs));if(!(dropFence&&b.startsWith('fence-')))bus.emit('publish',{role,topic:t,body:b,write,read})})};
  return self;
 };
 const core=mk('core',cTopic,gTopic),gateway=mk('gateway',gTopic,cTopic);
 bus.on('publish',m=>{
  if(m.topic!==m.write&&!leakWrite)return;
  for(const [target,read] of [[core,cTopic],[gateway,gTopic]]){
   const allowed=m.topic===read;
   if(allowed||(leakRead&&m.topic!==read)){target.emit('message',{topic:m.topic,body:m.body})}
  }
 });
 return {core,gateway,prefix};
}
test('RED old SUBACK=128 expectation; GREEN v2 accepts SUBACK=0 only when cross-delivery filtered',async()=>{
 const x=topicPair({suback:0});const proof=await proveTopicIsolation(x.core,x.gateway,x.prefix,{shortDelayMs:2,deniedDelayMs:2});
 assert.equal(proof.subscriptionSemantics,'GRANTS_POSSIBLE_DELIVERY_ACL_VERIFIED');
 assert.ok(x.core.subscriptions.includes(x.prefix+'/crownicles_websocket'));
});
test('v2 accepts broker that rejects unauthorized subscription with SUBACK=128',async()=>{
 const x=topicPair({suback:128});const proof=await proveTopicIsolation(x.core,x.gateway,x.prefix,{shortDelayMs:2,deniedDelayMs:2});
 assert.equal(proof.subscriptionSemantics,'ALL_DENIED_SUBACK');
});
test('v2 fails closed when unauthorized read topic delivers message despite legitimate directions',async()=>{
 const x=topicPair({suback:0,leakRead:true});await assert.rejects(proveTopicIsolation(x.core,x.gateway,x.prefix,{shortDelayMs:2,deniedDelayMs:2}),/CROSS_TOPIC_READ_DELIVERED/)
});
test('v2 fails closed when unauthorized publish is actually delivered',async()=>{
 const x=topicPair({suback:0,leakWrite:true});await assert.rejects(proveTopicIsolation(x.core,x.gateway,x.prefix,{shortDelayMs:2,deniedDelayMs:2}),/CROSS_TOPIC_PUBLISH_DELIVERED/)
});
const {stopBroker}=require('./w46_raw_mqtt_probe.cjs');
test('broker graceful shutdown acknowledged before SUCCESS',async()=>{
 const p=new EventEmitter();p.exitCode=null;p.signalCode=null;let signals=[];
 p.kill=s=>{signals.push(s);queueMicrotask(()=>{p.exitCode=0;p.emit('exit',0,s)});return true};
 await stopBroker(p,100);assert.deepEqual(signals,['SIGTERM']);
});
test('broker unresponsive shutdown is a hard failure, never PASS',async()=>{
 const p=new EventEmitter();p.exitCode=null;p.signalCode=null;let signals=[];
 p.kill=s=>{signals.push(s);return true};
 await assert.rejects(stopBroker(p,12),/BROKER_SHUTDOWN_TIMEOUT/);
 assert.deepEqual(signals,['SIGTERM','SIGKILL']);
});
test('broker shutdown signal rejection fails closed',async()=>{
 const p=new EventEmitter();p.exitCode=null;p.signalCode=null;p.kill=()=>false;
 await assert.rejects(stopBroker(p,100),/BROKER_SHUTDOWN_SIGNAL_REJECTED/);
});

test('W47 RED old silence-only window: slow FIFO unauthorized publish must FAIL after same-client fence',async()=>{
 const x=topicPair({suback:0,leakWrite:true,slowDeniedMs:60});
 const start=Date.now();
 await assert.rejects(proveTopicIsolation(x.core,x.gateway,x.prefix,{shortDelayMs:1,deniedDelayMs:1}),/CROSS_TOPIC_PUBLISH_DELIVERED/);
 assert.ok(Date.now()-start>=40,'the probe must await actual broker processing, not a one-ms silence window');
});
test('W47 slow but secure FIFO broker is accepted only after actual delivery fences',async()=>{
 const x=topicPair({suback:0,slowDeniedMs:60});const start=Date.now();
 const proof=await proveTopicIsolation(x.core,x.gateway,x.prefix,{shortDelayMs:1,deniedDelayMs:1});
 assert.equal(proof.subscriptionSemantics,'GRANTS_POSSIBLE_DELIVERY_ACL_VERIFIED');
 assert.ok(Date.now()-start>=40);
});
test('W47 missing causal fence fails closed instead of declaring silent ACL PASS',async()=>{
 const x=topicPair({suback:0,dropFence:true});
 await assert.rejects(proveTopicIsolation(x.core,x.gateway,x.prefix,{shortDelayMs:1,deniedDelayMs:1}),/MQTT_MESSAGE_TIMEOUT/);
});

 // This is a deliberately fake TCP MQTT broker, NOT Mosquitto. It exercises
 // real socket framing and FIFO processing to detect fence/test ordering bugs.
async function fakeTcpAclBroker({delayDeniedMs=0,leakDenied=false}={}){
 const sockets=new Set();let failed;
 const server=net.createServer(socket=>{
  const state={socket,buffer:Buffer.alloc(0),role:null,topics:new Set(),queue:Promise.resolve()};sockets.add(state);
  socket.on('close',()=>sockets.delete(state));
  const sendFrame=(type,payload)=>socket.write(packet(type,payload));
  const handle=async f=>{
   const kind=f.header>>4;
   if(kind===1){ // CONNECT, parse MQTT 3.1.1 variable header and username.
    let pos=0;const readStr=()=>{const n=f.payload.readUInt16BE(pos);pos+=2;const value=f.payload.subarray(pos,pos+n).toString();pos+=n;return value};
    const protocol=readStr();const level=f.payload[pos++],flags=f.payload[pos++];pos+=2;
    readStr();let username=null;
    if(flags&0x80)username=readStr();
    if(flags&0x40)readStr();
    state.role=username;
    sendFrame(0x20,Buffer.from([0x00,protocol==='MQTT'&&level===4&&['core','gateway'].includes(username)?0:5]));return;
   }
   if(kind===8){const id=f.payload.subarray(0,2);const size=f.payload.readUInt16BE(2);const topic=f.payload.subarray(4,4+size).toString();state.topics.add(topic);sendFrame(0x90,Buffer.concat([id,Buffer.from([0x00])]));return;}
   if(kind!==3)return;
   const n=f.payload.readUInt16BE(0);const topic=f.payload.subarray(2,2+n).toString();const body=f.payload.subarray(2+n).toString();
   const permitted=(state.role==='core'&&topic.endsWith('/crownicles_websocket'))||(state.role==='gateway'&&topic.endsWith('/crownicles_core'));
   if(!permitted&&delayDeniedMs)await new Promise(r=>setTimeout(r,delayDeniedMs));
   if(!permitted&&!leakDenied)return;
   for(const recipient of sockets){if(!recipient.topics.has(topic))continue;
    const canRead=(recipient.role==='core'&&topic.endsWith('/crownicles_core'))||(recipient.role==='gateway'&&topic.endsWith('/crownicles_websocket'));
    if(canRead){const bodyBuf=Buffer.from(body);recipient.socket.write(packet(0x30,Buffer.concat([str(topic),bodyBuf])))}
   }
  };
  socket.on('data',chunk=>{state.buffer=Buffer.concat([state.buffer,chunk]);for(;;){let f;try{f=parseOne(state.buffer)}catch(e){failed=e;socket.destroy();break}if(!f)break;state.buffer=state.buffer.subarray(f.size);state.queue=state.queue.then(()=>handle(f)).catch(e=>{failed=e;socket.destroy()})}});
 });
 await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes)});
 return {port:server.address().port,async close(){for(const c of sockets)c.socket.destroy();await new Promise(r=>server.close(r));if(failed)throw failed}};
}

test('W47 actual TCP fake broker: leaked unauthorized PUBLISH delayed after 1ms false-PASS window must be caught by fence',async()=>{
 const broker=await fakeTcpAclBroker({delayDeniedMs:80,leakDenied:true});let core,gateway;
 try{
  ({client:core}=await MqttWire.connect(broker.port,{username:'core',password:'not-real'}));
  ({client:gateway}=await MqttWire.connect(broker.port,{username:'gateway',password:'not-real'}));
  const prefix='cw_wa_mqtt_lab_'+ 'b'.repeat(24);
  const started=Date.now();
  await assert.rejects(proveTopicIsolation(core,gateway,prefix,{shortDelayMs:1,deniedDelayMs:1}),/CROSS_TOPIC_PUBLISH_DELIVERED/);
  assert.ok(Date.now()-started>=55);
 }finally{core?.close();gateway?.close();await broker.close()}
});
test('W47 actual TCP fake broker: slow protected PUBLISH is accepted only after sequential fences',async()=>{
 const broker=await fakeTcpAclBroker({delayDeniedMs:80,leakDenied:false});let core,gateway;
 try{
  ({client:core}=await MqttWire.connect(broker.port,{username:'core',password:'not-real'}));
  ({client:gateway}=await MqttWire.connect(broker.port,{username:'gateway',password:'not-real'}));
  const prefix='cw_wa_mqtt_lab_'+ 'c'.repeat(24);
  const started=Date.now();
  const result=await proveTopicIsolation(core,gateway,prefix,{shortDelayMs:1,deniedDelayMs:1});
  assert.equal(result.subscriptionSemantics,'GRANTS_POSSIBLE_DELIVERY_ACL_VERIFIED');
  assert.ok(Date.now()-started>=55);
 }finally{core?.close();gateway?.close();await broker.close()}
});
