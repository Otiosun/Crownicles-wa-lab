'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {CrowniclesCore,MAX_REQUEST_BYTES}=require('../src/core.cjs');
const {assertLabConfig}=require('../src/mqtt-isolation.cjs');
const {Store}=require('../src/store.cjs');
const {Gateway}=require('../src/gateway.cjs');
const {Presenter}=require('../src/presenter.cjs');
const PREFIX='cw_wa_mqtt_lab_0123456789abcdefabcd', ORIGIN=randomUUID(),USER=randomUUID(),WA='5511991112222';
const base=()=>({mqttUrl:'mqtt://127.0.0.1:42761',mqttTo:PREFIX+'/crownicles_core',mqttFrom:PREFIX+'/crownicles_websocket',mqttIsolated:true});
class Client extends EventEmitter{
 constructor(){super();this.subscriptions=[];this.published=[];this.closed=false;this.subCallback=null;this.publishCallback=null;this.connectOptions=null;}
 subscribe(topic,opts,cb){this.subscriptions.push({topic,opts});this.subCallback=cb;}
 ack(err=null,granted){this.subCallback(err,granted===undefined?[{topic:base().mqttFrom,qos:0}]:granted)}
 publish(topic,payload,opts,cb){this.published.push({topic,payload:JSON.parse(payload),opts});this.publishCallback=cb}
 end(force){this.closed=force;this.emit('close')}
}
const fixture=()=>{const client=new Client(),factory={connect(url,opts){client.connectOptions={url,opts};return client}},core=new CrowniclesCore(base(),ORIGIN,{mqttModule:factory});core.connect();return {core,client,up(){client.emit('connect');client.ack();assert.equal(core.ready,true)},close(){core.close()}}};
const packet=(origin=ORIGIN,uid=USER,req=randomUUID(),data=[])=>({context:{frontEndOrigin:origin,frontEndSubOrigin:req,keycloakId:uid},packets:data});
const validPacket={name:'CommandPingPacketRes',packet:{clientTime:Date.now()}};
const receive=(client,response,topic=base().mqttFrom)=>client.emit('message',topic,Buffer.from(JSON.stringify(response)));

test('strict lab only: rejects remote brokers, production topics, non-random topics, accidental live ports',()=>{
 const valid=base();assert.equal(assertLabConfig(valid,ORIGIN).prefix,PREFIX);
 for(const change of [
  {mqttUrl:'mqtt://192.168.1.1:42761'},{mqttUrl:'mqtt://127.0.0.1:18883'},
  {mqttUrl:'mqtts://127.0.0.1:42761'},{mqttUrl:'mqtt://user:pass@localhost:42761'},
  {mqttTo:'crownicles/crownicles_core'},{mqttFrom:'production/crownicles_websocket'},
  {mqttTo:'cw_wa_mqtt_lab_0123456789abcdefabcd/other'},
  {mqttTo:'cw_wa_mqtt_lab_eeeeeeeeeeeeeeeeeeee/crownicles_core'}]){
   assert.throws(()=>assertLabConfig({...valid,...change},ORIGIN),/MQTT_LAB_/);
  }
 assert.throws(()=>assertLabConfig(valid,'not-uuid'),/ORIGIN_INVALIDO/);
});

test('no premature ready until exact suback; outgoing request has official Core envelope and QoS0',()=>{
 const t=fixture();try{
  assert.equal(t.core.ready,false);t.client.emit('connect');assert.equal(t.core.ready,false);
  assert.equal(t.client.subscriptions[0].topic,base().mqttFrom);assert.deepEqual(t.client.subscriptions[0].opts,{qos:0});
  assert.throws(()=>t.core.send('CommandPingPacketReq',{},USER,randomUUID()),/indisponível/);
  t.client.ack();assert.equal(t.core.ready,true);
  const req=randomUUID();t.core.send('CommandPingPacketReq',{time:15},USER,req);
  assert.deepEqual(t.client.published[0],{topic:base().mqttTo,opts:{qos:0,retain:false},payload:{context:{frontEndOrigin:ORIGIN,frontEndSubOrigin:req,keycloakId:USER,webSocket:{}},packet:{name:'CommandPingPacketReq',data:{time:15}}}});
  assert.equal(t.core.stats.sent,1);
 }finally{t.close()}
});

test('SUBACK error/no granted topic/qos128 blocks all outgoing traffic',()=>{
 for(const args of [[Error('not authorized')],[null,[]],[null,[{topic:'other',qos:0}]],[null,[{topic:base().mqttFrom,qos:128}]]]){
  const t=fixture();try{t.client.emit('connect');t.client.ack(...args);assert.equal(t.core.ready,false);assert.throws(()=>t.core.send('CommandPingPacketReq',{},USER,randomUUID()),/indisponível/);assert.equal(t.client.published.length,0)}finally{t.close()}
 }
});

test('reconnection requires new SUBACK; late callbacks cannot revive disconnected session',()=>{
 const t=fixture();try{
  t.client.emit('connect');const old=t.client.subCallback;
  t.client.emit('offline');old(null,[{topic:base().mqttFrom,qos:0}]);assert.equal(t.core.ready,false);
  t.client.emit('connect');t.client.ack();assert.equal(t.core.ready,true);
  t.client.emit('close');assert.equal(t.core.ready,false);
  t.client.emit('connect');assert.equal(t.core.ready,false);t.client.ack();assert.equal(t.core.ready,true);
  assert.equal(t.core.stats.connects,3);assert.equal(t.core.stats.disconnects,1);
 }finally{t.close()}
});

test('no republish on reconnect or after explicit QoS0 error',()=>{
 const t=fixture();try{t.up();t.core.send('CommandGuildLeavePacketReq',{},USER,randomUUID());t.client.publishCallback(Error('connection lost'));
  assert.equal(t.core.stats.publishErrors,1);
  t.client.emit('offline');t.client.emit('connect');t.client.ack();
  assert.equal(t.client.published.length,1);assert.equal(t.core.stats.sent,1);
 }finally{t.close()}
});

test('wrong topic/origin/UUID/JSON/packet type/oversized and unsolicited messages are rejected',()=>{
 const t=fixture();try{t.up();let got=0;t.core.on('response',()=>got++);
  receive(t.client,packet(ORIGIN,USER,randomUUID(),[validPacket]),'other');
  receive(t.client,packet('other',USER,randomUUID(),[validPacket]));
  receive(t.client,packet(ORIGIN,'wrong',randomUUID(),[validPacket]));
  receive(t.client,packet(ORIGIN,USER,'not-uuid',[validPacket]));
  receive(t.client,packet(ORIGIN,USER,randomUUID(),[{name:'Bad;Packet',packet:{}}]));
  receive(t.client,packet(ORIGIN,USER,randomUUID(),[{name:'CommandPingPacketRes',packet:'not-object'}]));
  receive(t.client,packet(ORIGIN,USER,randomUUID(),Array.from({length:151},()=>validPacket)));
  t.client.emit('message',base().mqttFrom,Buffer.from('bad{json'));
  t.client.emit('message',base().mqttFrom,Buffer.alloc(300000));
  assert.equal(got,0);
  receive(t.client,packet(ORIGIN,USER,randomUUID(),[validPacket]));assert.equal(got,1);
  assert.equal(t.core.stats.rejected,8);
 }finally{t.close()}
});

test('send rejects arbitrary packet, wrong identity, huge payload and unbounded request',()=>{
 const t=fixture();try{t.up();
 for(const [n,d,p,r] of [
  ['CommandPacket;',{},USER,randomUUID()],['CommandPingPacketReq',{},'other',randomUUID()],
  ['CommandPingPacketReq',{},USER,'notUUID'],['CommandPingPacketReq','bad',USER,randomUUID()],
  ['CommandPingPacketReq',{x:'A'.repeat(MAX_REQUEST_BYTES)},USER,randomUUID()]])
  assert.throws(()=>t.core.send(n,d,p,r),/MQTT_REQUEST/);
 assert.equal(t.client.published.length,0);
 }finally{t.close()}
});

test('close marks unavailable and forbids later publication or callbacks',()=>{
 const t=fixture();t.up();t.close();assert.equal(t.core.ready,false);assert.equal(t.client.closed,true);
 t.client.emit('connect');assert.equal(t.core.ready,false);
 assert.throws(()=>t.core.send('CommandPingPacketReq',{},USER,randomUUID()),/indisponível/);
 assert.throws(()=>t.core.connect(),/ENCERRADO/);
});

test('Gateway real SQLite uses response correlation; duplicate/foreign packet never delivers twice',async()=>{
 const t=fixture(),root=fs.mkdtempSync(path.join(os.tmpdir(),'crownicles-mqtt-v3-'));
 const lang=path.join(root,'lang');fs.mkdirSync(lang);fs.writeFileSync(path.join(lang,'models.json'),'{}');fs.writeFileSync(path.join(lang,'events.json'),'{}');
 const store=new Store(path.join(root,'db')),sent=[];
 const gateway=new Gateway({bindings:{[WA]:USER}},store,new Presenter(lang),t.core,async(wa,text)=>sent.push({wa,text}));
 try{
  t.up();assert.equal(gateway.receive('wamid.v3-ping',WA,'/ping'),true);
  assert.equal(t.client.published.length,1);
  const one=t.client.published[0].payload;
  assert.equal(one.packet.name,'CommandPingPacketReq');
  receive(t.client,packet(ORIGIN,randomUUID(),one.context.frontEndSubOrigin,[validPacket]));
  assert.equal(store.getRequest(one.context.frontEndSubOrigin).done,0);
  const correct=packet(ORIGIN,USER,one.context.frontEndSubOrigin,[{name:'CommandPingPacketRes',packet:{clientTime:one.packet.data.time}}]);
  receive(t.client,correct);await new Promise(r=>setTimeout(r,20));
  assert.equal(store.getRequest(one.context.frontEndSubOrigin).done,1);assert.equal(sent.length,1);
  receive(t.client,correct);await new Promise(r=>setTimeout(r,20));assert.equal(sent.length,1);
  assert.equal(gateway.receive('wamid.v3-ping',WA,'/ping'),false);assert.equal(t.client.published.length,1);
 }finally{t.close();store.close();fs.rmSync(root,{recursive:true,force:true})}
});

test('transport loss mid-operation leaves request pending, never auto-reissues on reconnect',async()=>{
 const t=fixture(),root=fs.mkdtempSync(path.join(os.tmpdir(),'crownicles-mqtt-loss-'));
 const lang=path.join(root,'lang');fs.mkdirSync(lang);for(const n of ['events','models'])fs.writeFileSync(path.join(lang,n+'.json'),'{}');
 const store=new Store(path.join(root,'db'));
 try{const gateway=new Gateway({bindings:{[WA]:USER}},store,new Presenter(lang),t.core,async()=>{});t.up();gateway.receive('wamid.v3-loss',WA,'/perfil');assert.equal(t.client.published.length,1);
 const rid=t.client.published[0].payload.context.frontEndSubOrigin;
 t.client.emit('close');assert.equal(t.core.ready,false);t.client.emit('connect');t.client.ack();assert.equal(t.core.ready,true);
 assert.equal(t.client.published.length,1);assert.equal(store.getRequest(rid).done,0);
 const delayed=packet(ORIGIN,USER,rid,[{name:'CommandProfilePlayerNotFound',packet:{}}]);receive(t.client,delayed);
 assert.equal(store.getRequest(rid).done,1);receive(t.client,delayed);assert.equal(store.getRequest(rid).done,1);await new Promise(r=>setTimeout(r,30));
 }finally{t.close();store.close();fs.rmSync(root,{recursive:true,force:true})}
});

test('restart with an awaiting request never retries unknown Core mutation; timeout says reconcile state',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'cw-mqtt-crash-'));
 const lang=path.join(root,'lang');fs.mkdirSync(lang);for(const name of ['models','events'])fs.writeFileSync(path.join(lang,name+'.json'),'{}');
 const f1=fixture(),dbPath=path.join(root,'db');let store1=new Store(dbPath),store2;
 try{
  const gw=new Gateway({bindings:{[WA]:USER}},store1,new Presenter(lang),f1.core,async()=>{});
  f1.up();gw.receive('wamid.once',WA,'/perfil');
  assert.equal(f1.client.published.length,1);
  const rid=f1.client.published[0].payload.context.frontEndSubOrigin;
  store1.close();store1=null;f1.close();
  store2=new Store(dbPath);const f2=fixture();try{
   const messages=[];const newGateway=new Gateway({bindings:{[WA]:USER}},store2,new Presenter(lang),f2.core,async(wa,text)=>messages.push(text));
   f2.up();assert.equal(store2.getRequest(rid).done,0);assert.equal(f2.client.published.length,0);
   assert.equal(newGateway.receive('wamid.once',WA,'/perfil'),false);
   assert.equal(f2.client.published.length,0);
   store2.db.prepare('UPDATE requests SET created=? WHERE id=?').run(Date.now()-60000,rid);
   newGateway.maintenance();await new Promise(r=>setTimeout(r,25));
   assert.equal(store2.getRequest(rid).done,1);assert.equal(f2.client.published.length,0);
   assert.ok(messages.some(x=>/não respondeu a tempo/i.test(x)));
  }finally{f2.close()}
 }finally{try{store1?.close()}catch{}try{store2?.close()}catch{}fs.rmSync(root,{recursive:true,force:true})}
});
