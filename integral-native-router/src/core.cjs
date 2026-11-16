'use strict';
const EventEmitter=require('node:events');
const {assertLabConfig}=require('./mqtt-isolation.cjs');
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const PACKET_NAME=/^[A-Za-z][A-Za-z0-9]{1,100}$/;
const MAX_RESPONSE_BYTES=262144; // Prevent broker payloads from overwhelming the front end.
const MAX_REQUEST_BYTES=32768;
/**
 * The original Core MQTT protocol is transport-only. No application retry here:
 * a QoS 0 publication can be applied by Core even if the reply is lost.
 * Gateway's SQLite request ledger owns idempotent inbound decisions/timeouts.
 */
class CrowniclesCore extends EventEmitter{
 constructor(config,origin,{mqttModule}={}){
  super();this.config=config;this.origin=origin;this.ready=false;this.client=null;
  this.mqttModule=mqttModule;this.closed=false;this.subscriptionEpoch=0;
  this.stats={connects:0,disconnects:0,sent:0,responses:0,rejected:0,publishErrors:0};
 }
 connect(){
  if(this.client)throw Error('MQTT_JA_CONECTADO');
  if(this.closed)throw Error('MQTT_ADAPTADOR_ENCERRADO');
  if(this.config.mqttIsolated===true)assertLabConfig(this.config,this.origin);
  const mqtt=this.mqttModule||require(require.resolve('mqtt',{paths:[this.config.coreDir]}));
  const client=mqtt.connect(this.config.mqttUrl,{connectTimeout:7000,reconnectPeriod:1500,clean:true});
  this.client=client;
  client.on('connect',()=>{
   if(this.closed)return;
   const epoch=++this.subscriptionEpoch;this.stats.connects++;this.ready=false;
   client.subscribe(this.config.mqttFrom,{qos:0},(err,granted)=>{
    if(this.closed||epoch!==this.subscriptionEpoch||this.client!==client)return;
    if(err||!Array.isArray(granted)||!granted.some(x=>x.topic===this.config.mqttFrom&&x.qos!==128)){
     this.markUnavailable();this.emit('subscribeError',err||Error('MQTT_SUBACK_INVALIDO'));return;
    }
    if(!this.ready){this.ready=true;this.emit('ready')}
   });
  });
  const unavailable=()=>this.markUnavailable();
  for(const event of ['close','offline','end','error'])client.on(event,unavailable);
  client.on('message',(topic,payload)=>this.receive(topic,payload));
  return client;
 }
 markUnavailable(){const wasReady=this.ready;this.ready=false;this.subscriptionEpoch++;if(wasReady){this.stats.disconnects++;this.emit('unavailable')}}
 receive(topic,payload){
  if(this.closed||!this.ready||topic!==this.config.mqttFrom)return;
  if(!Buffer.isBuffer(payload)&&typeof payload!=='string'){this.stats.rejected++;return}
  if(Buffer.byteLength(payload)>MAX_RESPONSE_BYTES){this.stats.rejected++;return}
  let reply;try{reply=JSON.parse(payload.toString())}catch{this.stats.rejected++;return}
  if(!reply||typeof reply!=='object'||Array.isArray(reply)||
     reply.context?.frontEndOrigin!==this.origin||!UUID.test(reply.context?.frontEndSubOrigin||'')||
     !UUID.test(reply.context?.keycloakId||'')||!Array.isArray(reply.packets)||reply.packets.length>150||
     reply.packets.some(p=>!p||typeof p!=='object'||!PACKET_NAME.test(p.name||'')||p.packet===null||typeof p.packet!=='object'||Array.isArray(p.packet))){
   this.stats.rejected++;return;
  }
  this.stats.responses++;this.emit('response',reply);
 }
 send(name,data,playerId,requestId){
  if(!this.ready||this.closed)throw Error('Core MQTT indisponível');
  if(!PACKET_NAME.test(name||'')||!UUID.test(playerId||'')||!UUID.test(requestId||'')||!data||typeof data!=='object'||Array.isArray(data))throw Error('MQTT_REQUEST_INVALIDO');
  const payload=JSON.stringify({context:{frontEndOrigin:this.origin,frontEndSubOrigin:requestId,keycloakId:playerId,webSocket:{}},packet:{name,data}});
  if(Buffer.byteLength(payload)>MAX_REQUEST_BYTES)throw Error('MQTT_REQUEST_GRANDE_DEMAIS');
  // QoS 0: callback only means local send completion, never a durable Core commit.
  this.client.publish(this.config.mqttTo,payload,{qos:0,retain:false},err=>{
   if(err){this.stats.publishErrors++;this.emit('publishError',err);}
  });
  this.stats.sent++;
 }
 close(){this.closed=true;this.markUnavailable();this.client?.end(true);this.client=null;}
}
module.exports={CrowniclesCore,MAX_RESPONSE_BYTES,MAX_REQUEST_BYTES};
