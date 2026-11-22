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
