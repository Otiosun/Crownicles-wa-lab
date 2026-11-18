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
  ping:Object.freeze({aliases:['/ping','/latencia','/latência'],kind:'query',request:'CommandPingPacketReq',args:'none',description:'Conferir resposta do motor'}),
  petCaress:Object.freeze({aliases:['/acariciar','/carinhopet'],kind:'mutation',request:'CommandPetCaressPacketReq',args:'none',title:'✦ CARINHO NO COMPANHEIRO',description:'Acariciar o companheiro; o Core verifica os efeitos e limites.',choice:'Solicitar carinho'}),
  expeditionResolve:Object.freeze({aliases:['/resgatarexpedicao','/resolverexpedicao'],kind:'mutation',request:'CommandPetExpeditionResolvePacketReq',args:'none',title:'✦ REGRESSO DE EXPEDIÇÃO',description:'O Core determina se a expedição pode ser concluída e quais recompensas cabem.',choice:'Solicitar resolução da expedição'}),
  guildCreate:Object.freeze({aliases:['/criarguilda','/fundarguilda'],kind:'mutation',request:'CommandGuildCreatePacketReq',args:'guildName',title:'✦ FUNDAÇÃO DE GUILDA',description:'O Core verifica nome, requisitos e custos; depois apresenta sua confirmação própria.',choice:'Solicitar criação de guilda'}),
  guildDescription:Object.freeze({aliases:['/descricaoguilda','/descriçãoguilda'],kind:'mutation',request:'CommandGuildDescriptionPacketReq',args:'description',title:'✦ DESCRIÇÃO DA GUILDA',description:'Alterar a descrição da guilda requer função de chefe ou ancião e outra confirmação no Core.',choice:'Solicitar atualização da descrição'}),
  guildLeave:Object.freeze({aliases:['/sairdaguilda','/deixarguilda'],kind:'mutation',request:'CommandGuildLeavePacketReq',args:'none',title:'✦ SAIR DA GUILDA',description:'ATENÇÃO: se você for o chefe sem sucessor, aceitar a confirmação ORIGINAL pode DESTRUIR a guilda. Nenhuma ação será realizada sem as duas autorizações.',choice:'Solicitar menu original de saída'}),
  guildElderRemove:Object.freeze({aliases:['/removeranciao','/removerancião'],kind:'mutation',request:'CommandGuildElderRemovePacketReq',args:'none',title:'✦ REMOVER ANCIÃO',description:'Remover a função de ancião exige ser chefe, cumprir requisitos e confirmar com o Core.',choice:'Solicitar remoção de ancião'}),
  guildKick:Object.freeze({aliases:['/expulsarguilda'],kind:'mutation',request:'CommandGuildKickPacketReq',args:'rank',title:'✦ EXPULSAR DA GUILDA',description:'Solicitar a expulsão de membro por classificação numérica; o Core valida a identidade, autoridade e pede confirmação.',choice:'Solicitar expulsão'}),
  petFree:Object.freeze({aliases:['/liberarpet','/soltarpet'],kind:'mutation',request:'CommandPetFreePacketReq',args:'self',title:'✦ LIBERTAR COMPANHEIRO',description:'A libertação de pet pode ser irreversível e custar moedas. O Core apresentará o animal e pedirá outra confirmação.',choice:'Consultar disponibilidade para libertação'}),
  petTransfer:Object.freeze({aliases:['/transferirpet','/petabrigo'],kind:'mutation',request:'CommandPetTransferPacketReq',args:'none',title:'✦ TRANSFERIR COMPANHEIRO',description:'O Core gerencia depósito, retirada e troca no abrigo da guilda; cada escolha depende do menu original.',choice:'Abrir opções de transferência'}),
  friendlyFight:Object.freeze({aliases:['/amistoso','/combateamistoso'],kind:'mutation',request:'CommandFriendlyFightPacketReq',args:'rank',title:'✦ COMBATE AMISTOSO',description:'Iniciar simulação de combate sem consequências de progressão; o Core escolhe lutadores e regras.',choice:'Solicitar combate amistoso'}),
  unlock:Object.freeze({aliases:['/libertarjogador','/soltarjogador'],kind:'mutation',request:'CommandUnlockPacketReq',args:'rank',title:'✦ LIBERTAÇÃO DE JOGADOR',description:'Libertar alguém preso pode consumir suas moedas. O Core valida o alvo e exige outra confirmação.',choice:'Solicitar libertação do jogador'})
});
const safeDescription = s=>typeof s==='string'&&s===s.trim()&&s.length>=2&&s.length<=140&&/^[\p{L}\p{N} .,!?:;()'\-]+$/u.test(s)&&!/[\r\n<>`*_@]/.test(s);
const safeRank = s=>typeof s==='string'&&/^[1-9][0-9]{0,5}$/.test(s)&&Number(s)<=100000;
// Live is never inferred from a declared alias: it requires a registered Core
// listener for the exact request at both opening and confirmation.
const REVIEWED_LIVE_KEYS=Object.freeze(['petCaress','expeditionResolve','guildCreate','guildDescription','guildLeave','petFree','petTransfer']);
const REVIEWED_LIVE_SET=new Set(REVIEWED_LIVE_KEYS);
function allowed(key,env,canSendPacket){
 if(labAllowed(env))return true;
 if(!REVIEWED_LIVE_SET.has(key)||typeof canSendPacket!=='function')return false;
 try{return canSendPacket(NATIVE[key].request)===true}catch{return false}
}
function payloadFrom(key,raw,playerId,now=Date.now()){
  const d=NATIVE[key];if(!d||!UUID.test(playerId))return null;
  if(d.args==='none')return raw===''?(key==='ping'?{time:now}:{}):null;
  if(d.args==='self')return raw===''?{keycloakId:playerId}:null;
  if(d.args==='guildName')return safeName(raw)?{keycloakId:playerId,askedGuildName:raw}:null;
  if(d.args==='description')return safeDescription(raw)?{description:raw}:null;
  if(d.args==='rank')return safeRank(raw)?{askedPlayer:{rank:Number(raw)}}:null;
  return null;
}
function matchesIntent(key,data,playerId){
  const d=NATIVE[key];if(!d||d.kind!=='mutation'||!data||typeof data!=='object'||Array.isArray(data))return false;
  let raw='';
  if(d.args==='guildName')raw=data.askedGuildName;
  if(d.args==='description')raw=data.description;
  if(d.args==='rank')raw=String(data.askedPlayer?.rank??'');
  const expected=payloadFrom(key,raw,playerId,0);
  return expected!==null&&JSON.stringify(expected)===JSON.stringify(data);
}

const byAlias = new Map();
for (const [key,d] of Object.entries(NATIVE))for(const a of d.aliases){
 if(byAlias.has(a))throw Error('NATIVE_ALIAS_DUPLICADO');byAlias.set(a,key);
}
const frozenData = d=>JSON.parse(JSON.stringify(d));
function resolve(text,playerId,{env=process.env,now=Date.now(),canSendPacket=null}={}){
  if(typeof text!=='string'||!UUID.test(playerId))return null;
  const cleaned=text.trim();const sp=cleaned.indexOf(' ');const verb=(sp<0?cleaned:cleaned.slice(0,sp)).toLocaleLowerCase('pt-BR');
  const key=byAlias.get(verb);if(!key)return null;
  const def=NATIVE[key],tail=(sp<0?'':cleaned.slice(sp+1)).trim();
  const data=payloadFrom(key,tail,playerId,now);
  if(data===null){const hint=def.args==='rank'?' RANK':def.args==='guildName'?' NOME':def.args==='description'?' TEXTO':'';return {local:`Uso: ${def.aliases[0]}${hint}. Dados inválidos; nada foi enviado ao motor.`};}
  if(def.kind==='mutation'&&!allowed(key,env,canSendPacket))return {local:'Esse comando nativo ainda não foi homologado para jogadores. Nenhuma alteração foi enviada ao motor.'};
  if(def.kind==='query')return {name:def.request,data};
  return {universalIntent:{key,data}};
}
function signature(menuId,key,playerId,data){return crypto.createHash('sha256').update(JSON.stringify([menuId,key,playerId,data])).digest('hex')}
function makeMenu(intent,playerId,{now=Date.now()}={}){
 if(!UUID.test(playerId)||!intent||!Object.hasOwn(NATIVE,intent.key))return null;
 const def=NATIVE[intent.key];if(def.kind!=='mutation')return null;
 let data;try{data=frozenData(intent.data)}catch{return null}
 if(JSON.stringify(data).length>512)return null;
 if(!matchesIntent(intent.key,data,playerId))return null;
 const id='wa-universal-'+crypto.randomUUID();
 const title=def.title,detail=data.askedGuildName||data.description||(data.askedPlayer?.rank?`rank ${data.askedPlayer.rank}`:''),action=def.choice+(detail?` «${clean(detail)}»`:'');
 return {id,endTime:now+90000,type:'LocalUniversalNativeAuthorization',title,
   story:def.description+'\nEsta solicitação não será enviada antes da confirmação.',
   nativeIntent:{key:intent.key,data,playerId,signature:signature(id,intent.key,playerId,data)},
   options:[{kind:'universalNative',key:intent.key,label:action,supported:true,requiresConfirmation:true},
            {kind:'nativeCancel',label:'Cancelar sem enviar ao jogo',supported:true,requiresConfirmation:false}]};
}
function authorized(menu,choice,playerId,{env=process.env,now=Date.now(),canSendPacket=null}={}){
 if(!menu||menu.type!=='LocalUniversalNativeAuthorization'||
   !/^wa-universal-[a-f0-9-]{36}$/i.test(menu.id)||!Number.isSafeInteger(menu.endTime)||now>=menu.endTime||
   !UUID.test(playerId)||!Array.isArray(menu.options)||menu.options.length!==2||menu.options[0]!==choice||
   choice?.kind!=='universalNative'||choice.supported!==true||choice.requiresConfirmation!==true||
   menu.options[1]?.kind!=='nativeCancel'||menu.options[1].supported!==true||
   !menu.nativeIntent||menu.nativeIntent.playerId!==playerId)return null;
 const {key,data,signature:old}=menu.nativeIntent,def=NATIVE[key];if(!def||def.kind!=='mutation'||choice.key!==key||!allowed(key,env,canSendPacket))return null;
 if(typeof old!=='string'||!/^[a-f0-9]{64}$/.test(old))return null;
 let expected;try{expected=signature(menu.id,key,playerId,data)}catch{return null}
 if(!crypto.timingSafeEqual(Buffer.from(old,'hex'),Buffer.from(expected,'hex')))return null;
 if(!matchesIntent(key,data,playerId))return null;
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
 const staticResponses={
   CommandGuildDescriptionAcceptPacketRes:'*✦ GUILDA*\nO Core confirmou a nova descrição.',
   CommandGuildDescriptionRefusePacketRes:'*✦ GUILDA*\nA alteração da descrição foi cancelada.',
   CommandGuildDescriptionNoGuildPacket:'*✦ GUILDA*\nVocê não pertence a uma guilda.',
   CommandGuildDescriptionNotAnElderPacket:'*✦ GUILDA*\nSomente chefe ou ancião podem alterar a descrição.',
   CommandGuildLeaveRefusePacketRes:'*✦ GUILDA*\nVocê decidiu permanecer na guilda.',
   CommandGuildLeaveNotInAGuildPacketRes:'*✦ GUILDA*\nVocê não pertence a uma guilda.',
   CommandGuildElderRemoveNoElderPacket:'*✦ GUILDA*\nNão há ancião disponível para remoção.',
   CommandGuildElderRemoveRefusePacketRes:'*✦ GUILDA*\nRemoção de ancião cancelada.',
   CommandGuildElderRemoveAcceptPacketRes:'*✦ GUILDA*\nO Core confirmou a remoção do ancião.',
   CommandGuildKickBlockedErrorPacket:'*✦ GUILDA*\nA expulsão está bloqueada pelo Core.',
   CommandGuildKickRefusePacketRes:'*✦ GUILDA*\nExpulsão cancelada.',
   CommandGuildKickAcceptPacketRes:'*✦ GUILDA*\nO Core confirmou a expulsão do membro.',
   CommandPetFreeRefusePacketRes:'*✦ COMPANHEIRO*\nLibertação cancelada.',
   CommandPetTransferCancelErrorPacket:'*✦ ABRIGO*\nTransferência cancelada.',
   CommandPetTransferNoPetErrorPacket:'*✦ ABRIGO*\nVocê não tem companheiro para transferir.',
   CommandPetTransferFeistyErrorPacket:'*✦ ABRIGO*\nO companheiro está arisco; transferência indisponível.',
   CommandPetTransferPetOnExpeditionErrorPacket:'*✦ ABRIGO*\nO companheiro está em expedição.',
   CommandPetTransferSituationChangedErrorPacket:'*✦ ABRIGO*\nA situação mudou. Consulte /pet antes de tentar novamente.',
   CommandUnlockNoPlayerFound:'*✦ LIBERTAÇÃO*\nJogador não encontrado.',
   CommandUnlockNotInJail:'*✦ LIBERTAÇÃO*\nO jogador indicado não está preso.',
   CommandUnlockHimself:'*✦ LIBERTAÇÃO*\nVocê não pode libertar a si mesmo.',
   CommandUnlockRefusePacketRes:'*✦ LIBERTAÇÃO*\nPedido cancelado.',
   CommandUnlockAcceptPacketRes:'*✦ LIBERTAÇÃO*\nO Core confirmou a libertação do jogador.',
   CommandGuildInvitePlayerNotFound:'*✦ GUILDA*\nJogador convidado não encontrado.'
 };
 if(Object.hasOwn(staticResponses,name))return staticResponses[name];
 if(name==='CommandGuildDescriptionInvalidPacket')return Number.isSafeInteger(p?.min)&&Number.isSafeInteger(p?.max)?`*✦ GUILDA*\nDescrição inválida. Use de ${p.min} a ${p.max} caracteres.`:'*✦ GUILDA*\nDescrição recusada pelo Core.';
 if(name==='CommandGuildLeaveAcceptPacketRes')return p?.isGuildDestroyed===true?'*✦ GUILDA*\nO Core confirmou sua saída e a destruição da guilda.':p?.newChiefKeycloakId?'*✦ GUILDA*\nO Core confirmou sua saída e a transferência de chefia.':'*✦ GUILDA*\nO Core confirmou sua saída da guilda.';
 if(name==='CommandGuildKickPacketRes'){
   if(p?.foundPlayer===false)return '*✦ GUILDA*\nJogador não encontrado.';
   if(p?.himself===true)return '*✦ GUILDA*\nVocê não pode expulsar a si mesmo.';
   if(p?.sameGuild===false)return '*✦ GUILDA*\nO jogador não pertence à sua guilda.';
   return null; // successful initiation needs the official collector
 }
 if(name==='CommandFriendlyFightErrorPacketRes'){
   const messages={opponentNotFound:'Adversário não encontrado.',selfFight:'Você não pode desafiar a si mesmo.',opponentLevelTooLow:'O nível do adversário é insuficiente.'};
   return '*✦ AMISTOSO*\n'+(messages[p?.error]||'O Core recusou este confronto.');
 }
 if(name==='CommandUnlockNotEnoughMoney')return '*✦ LIBERTAÇÃO*\nMoedas insuficientes para libertar o jogador.';
 if(name==='CommandPetFreePacketRes'){
   if(p?.foundPet===false)return '*✦ COMPANHEIRO*\nNenhum companheiro encontrado.';
   if(Number.isSafeInteger(p?.missingMoney)&&p.missingMoney>0)return `*✦ COMPANHEIRO*\nFaltam ${p.missingMoney.toLocaleString('pt-BR')} moedas para libertar.`;
   if(p?.petOnExpedition===true)return '*✦ COMPANHEIRO*\nCompanheiro em expedição; libertação indisponível.';
   if(p?.petCanBeFreed===false)return '*✦ COMPANHEIRO*\nO Core não permite libertar o companheiro agora.';
   if(p?.needsSelection===true)return '*✦ COMPANHEIRO*\nO Core solicitou seleção do animal. Escolha somente no menu original.';
   return null;
 }
 if(name==='CommandPetFreeAcceptPacketRes'||name==='CommandPetFreeShelterSuccessPacketRes')return '*✦ COMPANHEIRO*\nO Core confirmou a libertação.'+(Number.isSafeInteger(p?.freeCost)?` Custo: ${p.freeCost.toLocaleString('pt-BR')} moedas.`:'');
 if(name==='CommandPetFreeShelterCooldownErrorPacketRes')return '*✦ COMPANHEIRO*\nA libertação está em tempo de espera.';
 if(name==='CommandPetFreeShelterMissingMoneyErrorPacketRes')return '*✦ COMPANHEIRO*\nMoedas insuficientes para libertar o animal do abrigo.';
 if(name==='CommandPetTransferSuccessPacket')return '*✦ ABRIGO*\nO Core confirmou a transferência do companheiro.';
 if(name==='CommandPetTransferAnotherMemberTransferringErrorPacket')return '*✦ ABRIGO*\nOutro membro está realizando transferência agora.';
 if(name==='CommandPetExpeditionResolvePacketRes'){
   if(p?.success!==true)return '*✦ EXPEDIÇÃO*\nA expedição não foi concluída com sucesso.';
   const r=p.rewards||{},fields=[];
   for(const [key,label] of [['money','Moedas'],['experience','XP'],['points','Pontos'],['tokens','Tokens']])if(Number.isSafeInteger(r[key])&&r[key]>=0)fields.push(`${label}: ${r[key].toLocaleString('pt-BR')}`);
   return '*✦ EXPEDIÇÃO CONCLUÍDA*'+(p.partialSuccess?' (resultado parcial)':'')+'\n'+(fields.join(' · ')||'Recompensas determinadas pelo motor.');
 }
 // Do not infer pet, guild or expedition success from request. Crownicles
 // may emit a confirmation collector or an error. Existing Presenter handles
 // those packets; unknown outcomes remain visibly unconfirmed.
 return null;
}
function help(canSendPacket=null){const listed=REVIEWED_LIVE_KEYS.filter(k=>allowed(k,process.env,canSendPacket)).map(k=>NATIVE[k].aliases[0]+(NATIVE[k].args==='guildName'?' NOME':NATIVE[k].args==='description'?' TEXTO':''));return ['*✦ ACESSO NATIVO*',
'/ping — conferir o motor (consulta)',
'', listed.length?'*Disponíveis no motor*\n'+listed.join(' · '):'Nenhuma ação nativa adicional liberada pelo motor.','Comandos não listados permanecem bloqueados. Toda alteração exige prévia, código único e as condições do Core original.'].join('\n')}

module.exports={NATIVE,resolve,makeMenu,authorized,renderResponse,help,labAllowed,REVIEWED_LIVE_KEYS,allowed,safeName,safeDescription,safeRank,payloadFrom,matchesIntent};
