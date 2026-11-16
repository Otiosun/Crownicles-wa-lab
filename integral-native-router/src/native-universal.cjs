'use strict';
/**
 * Contratos nativos Crownicles 6.2.0.b, motor genérico de intenções.
 * LAB ONLY for mutating requests. No packet is sent from here.
 * Source pinned: Crownicles/Crownicles@64d08c05f11949029317341735f6f73024f19f9b
 * - Lib/src/packets/commands/{CommandPingPacket,CommandPetPacket,
 *   CommandPetExpeditionPacket,CommandGuildCreatePacket}.ts
 * - Core/src/commands/player/PingCommand.ts
 * Outgoing packets are sent ONLY by existing Gateway, with its SQLite nonce,
 * player binding, duplicate-message protection, and existing Core transport.
 */
const crypto = require('node:crypto');
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const labAllowed = env => env.CROWNICLES_WA_UNIVERSAL_COMMANDS === 'lab'
  && env.CROWNICLES_WA_LAB_ISOLATED === 'SIM_ISOLADO'
  && !String(env.WA_BAILEYS_SEND_MODE || '').trim()
  && env.CROWNICLES_WA_EQUIP_ACTIONS !== 'enabled';
const safeName = s => typeof s === 'string' && s === s.trim() && s.length >= 3 && s.length <= 32
  && /^[\p{L}\p{N}][\p{L}\p{N} '\-]{1,30}[\p{L}\p{N}]$/u.test(s)
  && !/ {2}|--|''/.test(s);
const clean = s => String(s).replace(/[\x00-\x1f\x7f*_~`<>@]/g,' ').replace(/\s+/g,' ').trim().slice(0,65);
// Requests requiring mutations are NEVER allowed without explicit LAB gates.
// To add a real system: schema, semantic risk and authoritative Core output
// must be verified. The generic Gateway/nonce code is NEVER copied again.
const NATIVE = Object.freeze({
  ping:Object.freeze({aliases:['/ping','/latencia','/latência'],kind:'query',request:'CommandPingPacketReq',
    description:'Conferir resposta do motor',create:(_args,_playerId,now)=>({time:now})}),
  petCaress:Object.freeze({aliases:['/acariciar','/carinhopet'],kind:'mutation',request:'CommandPetCaressPacketReq',
    title:'✦ CARINHO NO COMPANHEIRO',description:'Acariciar seu companheiro pelo Core original. A ação pode afetar a afinidade e seus limites; o motor decide o resultado.',
    choice:'Autorizar carinho no companheiro',create:()=>({})}),
  expeditionResolve:Object.freeze({aliases:['/resgatarexpedicao','/resolverexpedicao'],kind:'mutation',request:'CommandPetExpeditionResolvePacketReq',
    title:'✦ REGRESSO DE EXPEDIÇÃO',description:'Solicitar ao Core original a resolução de uma expedição concluída. Recompensas, inventário e condições serão determinados pelo motor.',
    choice:'Autorizar resolução da expedição',create:()=>({})}),
  guildCreate:Object.freeze({aliases:['/criarguilda','/fundarguilda'],kind:'mutation',request:'CommandGuildCreatePacketReq',
    title:'✦ FUNDAÇÃO DE GUILDA',description:'Criar guilda envolve nome, requisitos e recursos. Somente o motor original autoriza e determina custos.',
    choice:'Solicitar criação de guilda',validate:safeName,
    create:(args,playerId)=>({keycloakId:playerId,askedGuildName:args})})
});
const byAlias = new Map();
for (const [key,d] of Object.entries(NATIVE))for(const a of d.aliases){
 if(byAlias.has(a))throw Error('NATIVE_ALIAS_DUPLICADO');byAlias.set(a,key);
}
const frozenData = d=>JSON.parse(JSON.stringify(d));
function resolve(text,playerId,{env=process.env,now=Date.now()}={}){
 if(typeof text!=='string'||!UUID.test(playerId))return null;
 const cleaned=text.trim();const sp=cleaned.indexOf(' ');const verb=(sp<0?cleaned:cleaned.slice(0,sp)).toLocaleLowerCase('pt-BR');
 const key=byAlias.get(verb);if(!key)return null;
 const def=NATIVE[key];const tail=(sp<0?'':cleaned.slice(sp+1)).trim();
 if(def.validate && !def.validate(tail))return {local:'Nome inválido. Use /criarguilda NOME (3 a 32 caracteres; apenas letras, números, espaços, hífen e apóstrofo). Nenhum pedido foi enviado.'};
 if(!def.validate && tail)return {local:`Uso: ${def.aliases[0]}${key==='guildCreate'?' NOME':''}. Nenhum pedido foi enviado.`};
 if(def.kind==='mutation'&&!labAllowed(env))return {local:'Esse comando nativo ainda não foi homologado para jogadores. Nenhuma alteração foi enviada ao motor.'};
 const data=def.create(tail,playerId,now);
 if(def.kind==='query')return {name:def.request,data};
 return {universalIntent:{key,data}};
}
function signature(menuId,key,playerId,data){return crypto.createHash('sha256').update(JSON.stringify([menuId,key,playerId,data])).digest('hex')}
function makeMenu(intent,playerId,{now=Date.now()}={}){
 if(!UUID.test(playerId)||!intent||!Object.hasOwn(NATIVE,intent.key))return null;
 const def=NATIVE[intent.key];if(def.kind!=='mutation')return null;
 let data;try{data=frozenData(intent.data)}catch{return null}
 if(JSON.stringify(data).length>512)return null;
 if(intent.key==='guildCreate' && (data.keycloakId!==playerId||!safeName(data.askedGuildName)))return null;
 if(intent.key!=='guildCreate'&&Object.keys(data).length!==0)return null;
 const id='wa-universal-'+crypto.randomUUID();
 const title=def.title,action=def.choice+(intent.key==='guildCreate'?` «${clean(data.askedGuildName)}»`:'');
 return {id,endTime:now+90000,type:'LocalUniversalNativeAuthorization',title,
   story:def.description+'\nEsta solicitação não será enviada antes da confirmação.',
   nativeIntent:{key:intent.key,data,playerId,signature:signature(id,intent.key,playerId,data)},
   options:[{kind:'universalNative',key:intent.key,label:action,supported:true,requiresConfirmation:true},
            {kind:'nativeCancel',label:'Cancelar sem enviar ao jogo',supported:true,requiresConfirmation:false}]};
}
function authorized(menu,choice,playerId,{env=process.env,now=Date.now()}={}){
 if(!labAllowed(env)||!menu||menu.type!=='LocalUniversalNativeAuthorization'||
   !/^wa-universal-[a-f0-9-]{36}$/i.test(menu.id)||!Number.isSafeInteger(menu.endTime)||now>=menu.endTime||
   !UUID.test(playerId)||!Array.isArray(menu.options)||menu.options.length!==2||menu.options[0]!==choice||
   choice?.kind!=='universalNative'||choice.supported!==true||choice.requiresConfirmation!==true||
   menu.options[1]?.kind!=='nativeCancel'||menu.options[1].supported!==true||
   !menu.nativeIntent||menu.nativeIntent.playerId!==playerId)return null;
 const {key,data,signature:old}=menu.nativeIntent,def=NATIVE[key];if(!def||def.kind!=='mutation'||choice.key!==key)return null;
 if(typeof old!=='string'||!/^[a-f0-9]{64}$/.test(old))return null;
 let expected;try{expected=signature(menu.id,key,playerId,data)}catch{return null}
 if(!crypto.timingSafeEqual(Buffer.from(old,'hex'),Buffer.from(expected,'hex')))return null;
 if(key==='guildCreate'&&(!safeName(data?.askedGuildName)||data?.keycloakId!==playerId))return null;
 if(key!=='guildCreate'&&(!data||Object.keys(data).length!==0))return null;
 return {name:def.request,data:frozenData(data)};
}
function renderResponse(name,p,{now=Date.now()}={}){
 if(name==='CommandGuildCreatePacketRes'){
   if(p?.foundGuild===true)return '*✦ GUILDA*\nVocê já participa de uma guilda.';
   if(p?.guildNameIsAvailable===false)return '*✦ GUILDA*\nEsse nome já está em uso.';
   if(p?.guildNameIsAcceptable===false)return '*✦ GUILDA*\nO motor recusou esse nome.';
   if(Number.isSafeInteger(p?.missingMoney)&&p.missingMoney>0)return `*✦ GUILDA*\nFaltam ${p.missingMoney.toLocaleString('pt-BR')} moedas para fundar sua guilda.`;
   return '*✦ GUILDA*\nO motor não autorizou a criação. Nenhuma fundação confirmada.';
 }
 if(name==='CommandGuildCreateAcceptPacketRes')return '*✦ GUILDA FUNDADA*\n'+(safeName(p?.guildName)?clean(p.guildName):'O motor confirmou a criação.');
 if(name==='CommandGuildCreateRefusePacketRes')return '*✦ GUILDA*\nA criação foi cancelada no motor.';
 if(name==='CommandPingPacketRes'){
   if(!Number.isSafeInteger(p?.clientTime)||p.clientTime<0||p.clientTime>now+1000)return '*✦ MOTOR*\nTempo de resposta indisponível.';
   const delta=now-p.clientTime;return `*✦ MOTOR ATIVO*\nResposta do Crownicles: ${delta>=0&&delta<=60000?delta+' ms':'recebida'}.`;
 }
 // Do not infer pet, guild or expedition success from request. Crownicles
 // may emit a confirmation collector or an error. Existing Presenter handles
 // those packets; unknown outcomes remain visibly unconfirmed.
 return null;
}
function help(){return '*✦ ACESSO NATIVO*\n/ping — consultar o motor original\n/acariciar — companheiro (laboratório)\n/resgatarexpedicao — expedição (laboratório)\n/criarguilda NOME — fundar guilda (laboratório)\n\nAs alterações permanecem bloqueadas na instalação real. O Core original determina todas as regras.'}
module.exports={NATIVE,resolve,makeMenu,authorized,renderResponse,help,labAllowed,safeName};
