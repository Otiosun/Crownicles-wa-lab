'use strict';
/**
 * Faithful binary collectors for Crownicles 6.2.0.b, pinned to
 * Crownicles/Crownicles@64d08c05f11949029317341735f6f73024f19f9b.
 * All accept choices require a SECOND SQLite one-use confirmation.
 * Fail-closed: no guessed defaults, no UUIDs in player-visible labels.
 * Enabled only with CROWNICLES_WA_UNIVERSAL_COLLECTORS=lab in isolated process.
 */
const previous=require('./universal-collector-v2.cjs');
const transfer=require('./pet-transfer-collector.cjs');
const expedition=require('./pet-expedition-collector.cjs');
const EXPEDITION_KINDS=new Set(Object.values(expedition.K));
const {safeDescription}=require('./native-universal.cjs');
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const ACCEPT='ReactionCollectorAcceptReaction';
const REFUSE='ReactionCollectorRefuseReaction';
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const zero=x=>obj(x)&&Object.keys(x).length===0;
const id=x=>typeof x==='string'&&UUID.test(x);
const name=x=>typeof x==='string'&&x.length>0&&x.length<=70&&!/[\x00-\x1f\x7f<>`*~@]/.test(x);
const clean=x=>String(x).replace(/[\x00-\x1f\x7f<>`*~@]/g,' ').replace(/\s+/g,' ').trim().slice(0,140);
const cost=x=>Number.isSafeInteger(x)&&x>=0;
const rule=Object.freeze({
 ReactionCollectorGuildCreateData:{title:'✦ CONFIRMAR CRIAÇÃO DE GUILDA',check:d=>name(d.guildName),story:d=>`O Core propõe fundar «${clean(d.guildName)}». Confirme somente se deseja criar a guilda e aceitar seus custos.`,action:()=> 'Confirmar fundação no Core original'},
 ReactionCollectorGuildDescriptionData:{title:'✦ CONFIRMAR DESCRIÇÃO',check:d=>safeDescription(d.description),story:d=>`Nova descrição: «${clean(d.description)}». O Core valida novamente o papel de chefia ou ancião.`,action:()=> 'Confirmar mudança da descrição'},
 ReactionCollectorGuildLeaveData:{title:'✦ CONFIRMAR SAÍDA DA GUILDA',check:d=>name(d.guildName)&&typeof d.isGuildDestroyed==='boolean'&&(d.newChiefKeycloakId===''||id(d.newChiefKeycloakId)),story:d=>`Guilda: ${clean(d.guildName)}. ${d.isGuildDestroyed?'ATENÇÃO: aceitar DESTRÓI a guilda.':d.newChiefKeycloakId?'O Core informa transferência de chefia ao sucessor.':'Você deixará de ser membro.'} Esta é a confirmação FINAL do Core.`,action:d=>d.isGuildDestroyed?'Confirmar DESTRUIÇÃO e saída':'Confirmar saída da guilda'},
 ReactionCollectorGuildElderRemoveData:{blockedUntilIdentity:true,title:'✦ REBAIXAMENTO DE ANCIÃO',check:d=>name(d.guildName)&&id(d.demotedKeycloakId),story:d=>`Guilda: ${clean(d.guildName)}. O ancião perderá o cargo; identidade omitida para privacidade.`,action:()=> 'Confirmar remoção do ancião'},
 ReactionCollectorGuildKickData:{blockedUntilIdentity:true,title:'✦ EXPULSÃO DA GUILDA',check:d=>name(d.guildName)&&id(d.kickedKeycloakId),story:d=>`Guilda: ${clean(d.guildName)}. O membro selecionado será expulso se as condições do Core permanecerem válidas.`,action:()=> 'Confirmar expulsão do membro'},
 ReactionCollectorUnlockData:{blockedUntilIdentity:true,title:'✦ LIBERTAR JOGADOR',check:d=>id(d.unlockedKeycloakId),story:()=> 'A libertação do jogador preso consome a quantia definida pelo Core. Verifique seu saldo antes de aceitar.',action:()=> 'Confirmar libertação e custo'},
 ReactionCollectorPetFreeData:{title:'✦ LIBERTAR COMPANHEIRO',check:d=>Number.isSafeInteger(d.petId)&&d.petId>0&&['m','f'].includes(d.petSex)&&cost(d.freeCost)&&(d.petNickname==null||d.petNickname===''||name(d.petNickname)),story:d=>`Companheiro ${clean(d.petNickname||'sem apelido')} (espécie ${d.petId}). Custo: ${d.freeCost.toLocaleString('pt-BR')} moedas. ATENÇÃO: esta libertação pode ser irreversível.`,action:()=> 'Confirmar libertação do companheiro'},
 ReactionCollectorPetFreeShelterConfirmData:{title:'✦ CONFIRMAR LIBERTAÇÃO DO COMPANHEIRO',check:d=>Number.isSafeInteger(d.petEntityId)&&d.petEntityId>0&&Number.isSafeInteger(d.petId)&&d.petId>0&&['m','f'].includes(d.petSex)&&cost(d.freeCost)&&typeof d.isFromShelter==='boolean'&&(d.petNickname==null||d.petNickname===''||name(d.petNickname)),story:d=>`${d.isFromShelter?'Companheiro do abrigo da guilda':'Seu companheiro'}: ${clean(d.petNickname||'sem apelido')} (espécie ${d.petId}). Custo ${d.freeCost.toLocaleString('pt-BR')} moedas. ATENÇÃO: libertação irreversível.`,action:()=> 'Confirmar libertação do pet selecionado'}
});
const declared=new Set(Object.keys(rule));
function compileCollector(packet){
 if(packet?.data?.type===transfer.K)return transfer.compileCollector(packet);
 if(EXPEDITION_KINDS.has(packet?.data?.type))return expedition.compileCollector(packet);
 if(!obj(packet)||!obj(packet.data)||!obj(packet.data.data)||!Array.isArray(packet.reactions))return previous.compileCollector(packet);
 const kind=packet.data.type,def=rule[kind];
 if(!def)return previous.compileCollector(packet);
 // Own these audited types: don't let older display-only fallbacks bypass validation.
 const rx=packet.reactions,d=packet.data.data;
 if(!def.check(d)||rx.length!==2||rx.some(x=>!obj(x)||!zero(x.data))||rx.filter(x=>x.type===ACCEPT).length!==1||rx.filter(x=>x.type===REFUSE).length!==1)return null;
 return {kind,title:def.title,story:def.story(d)+(def.blockedUntilIdentity?' Identidade do destinatário não é exibida no pacote original; ação bloqueada até existir vínculo de nome verificado.':''),options:rx.map(x=>x.type===REFUSE?{label:'Recusar sem aplicar a ação',supported:true,requiresConfirmation:false}:def.blockedUntilIdentity?{label:'Indisponível: identidade do destinatário não verificada',supported:false,requiresConfirmation:false}:{label:def.action(d),supported:true,requiresConfirmation:true})};
}
function isKnownKind(k){return previous.isKnownKind(k)||declared.has(k)||EXPEDITION_KINDS.has(k)}
module.exports={compileCollector,isKnownKind,knownKinds:new Set([...previous.knownKinds,...declared,...EXPEDITION_KINDS]),binaryRules:rule};
