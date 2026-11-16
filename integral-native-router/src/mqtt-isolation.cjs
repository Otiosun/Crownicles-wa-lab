'use strict';
/** Safety gate for isolated transport proof. Not a substitute for MQTT authentication. */
const HOSTS = new Set(['127.0.0.1','localhost','[::1]']);
const TOPIC=/^[A-Za-z0-9_-]+\/(?:crownicles_core|crownicles_websocket)$/;
const PREFIX=/^cw_wa_mqtt_lab_[a-f0-9]{20,40}$/;
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
function assertLabConfig(config,origin){
 if(!config||typeof origin!=='string'||!UUID.test(origin))throw Error('MQTT_LAB_ORIGIN_INVALIDO');
 let url;try{url=new URL(config.mqttUrl)}catch{throw Error('MQTT_LAB_URL_INVALIDA')}
 if(url.protocol!=='mqtt:'||!HOSTS.has(url.hostname)||url.username||url.password||(url.pathname&&url.pathname!=='/')||url.search||url.hash)throw Error('MQTT_LAB_NAO_LOOPBACK');
 const port=Number(url.port);if(!Number.isInteger(port)||port<20000||port>60999)throw Error('MQTT_LAB_PORTA_INSEGURA');
 if(typeof config.mqttTo!=='string'||typeof config.mqttFrom!=='string'||!TOPIC.test(config.mqttTo)||!TOPIC.test(config.mqttFrom))throw Error('MQTT_LAB_TOPICOS_INVALIDOS');
 const tp=config.mqttTo.split('/')[0],fp=config.mqttFrom.split('/')[0];
 if(!PREFIX.test(tp)||tp!==fp||config.mqttTo!==tp+'/crownicles_core'||config.mqttFrom!==tp+'/crownicles_websocket')throw Error('MQTT_LAB_PREFIXO_NAO_ISOLADO');
 return {prefix:tp,port};
}
module.exports={assertLabConfig};
