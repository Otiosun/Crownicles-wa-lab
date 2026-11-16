'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {randomUUID}=require('node:crypto');
const {CrowniclesCore}=require('../src/core.cjs');
const config={mqttUrl:'mqtt://127.0.0.1:42761',mqttTo:'cw_wa_mqtt_lab_0123456789abcdefabcd/crownicles_core',mqttFrom:'cw_wa_mqtt_lab_0123456789abcdefabcd/crownicles_websocket',mqttIsolated:true};
function fixture(){
 class MqttLikeClient extends EventEmitter {
  constructor(options){super();this.options=options;this.topics=new Set();this.subacks=0;this.submissions=[];this.published=[];this.connected=false;}
  subscribe(topic,opts,cb){
   this.submissions.push({topic,opts});
   if(this.options.resubscribe!==false&&this.topics.has(topic))return cb(null,[]);
   this.topics.add(topic);this.subacks++;
   cb(null,[{topic,qos:opts.qos}]);
  }
  publish(topic,msg,opts,cb){this.published.push({topic,msg,opts});cb?.(null)}
  end(force){this.closed=force;this.connected=false;this.emit('close')}
  onBrokerConnection(){this.connected=true;this.emit('connect')}
  onBrokerOutage(){this.connected=false;this.emit('offline');this.emit('close')}
 }
 let client;
 const mqttModule={connect(url,opts){client=new MqttLikeClient(opts);return client}};
 const core=new CrowniclesCore(config,randomUUID(),{mqttModule});
 core.connect();return {core,client,close:()=>core.close()};
}
test('MQTT manual subscription is sole readiness owner; auto resubscribe and QoS0 offline queue disabled',()=>{
 const t=fixture();try{
  assert.equal(t.client.options.resubscribe,false);
  assert.equal(t.client.options.queueQoSZero,false);
  assert.equal(t.client.options.clean,true);
  assert.equal(t.client.options.reconnectPeriod,1500);
  assert.equal(t.core.ready,false);
  t.client.onBrokerConnection();assert.equal(t.core.ready,true);
  t.client.onBrokerOutage();assert.equal(t.core.ready,false);
  t.client.onBrokerConnection();assert.equal(t.core.ready,true);
  assert.equal(t.client.subacks,2);
  assert.equal(t.client.submissions.length,2);
  assert.equal(t.core.stats.connects,2);
 }finally{t.close()}
});
test('MQTT broker outage does not replay previous request after confirmed fresh SUBACK',()=>{
 const t=fixture();try{
  t.client.onBrokerConnection();const id=randomUUID(),req=randomUUID();
  t.core.send('CommandPingPacketReq',{time:1},id,req);
  assert.equal(t.client.published.length,1);
  t.client.onBrokerOutage();
  assert.throws(()=>t.core.send('CommandPingPacketReq',{time:2},id,randomUUID()),/indisponível/);
  t.client.onBrokerConnection();assert.equal(t.core.ready,true);
  assert.equal(t.client.published.length,1);
  t.core.send('CommandPingPacketReq',{time:3},id,randomUUID());
  assert.equal(t.client.published.length,2);
  assert.equal(t.core.stats.sent,2);
 }finally{t.close()}
});
