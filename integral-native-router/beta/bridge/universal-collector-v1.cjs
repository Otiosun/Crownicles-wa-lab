'use strict';
/**
 * Crownicles 6.2.0.b collector adapter (LAB ONLY).
 * Extends the seven upstream contracts in universal-collector.cjs.
 * Presenting a menu never sends a reaction. Unsupported options always fail closed.
 * Identity, expiry, nonce and MQTT are handled exclusively by the existing gateway.
 * Every additional schema below was inspected against Lib/src/packets/interaction.
 */
const previous=require('./universal-collector.cjs');
const ACCEPT='ReactionCollectorAcceptReaction',REFUSE='ReactionCollectorRefuseReaction';
const money=x=>Number.isSafeInteger(x)&&x>=0;
const positive=x=>Number.isSafeInteger(x)&&x>0;
const type=x=>x&&typeof x==='object'&&!Array.isArray(x);
const literal=(x,max=80)=>typeof x==='string'&&x.length<=max&&x.length>0&&!/[\x00-\x1f\x7f]/.test(x)&&!/[<>`*~_@]/.test(x);
const display=(x,max=52)=>previous.clean(x,max)||'Sem nome';
const id=x=>typeof x==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(x);
const empty=x=>type(x)&&Object.keys(x).length===0;
const noMeta=arr=>arr.every(r=>type(r)&&typeof r.type==='string'&&empty(r.data));
const clone=o=>({title:o.title,story:o.story,options:o.options});
const guild=x=>literal(x,48);
const binaryConfigs=Object.freeze({
 ReactionCollectorGuildDescriptionData:{
  title:'✦ DESCRIÇÃO DA GUILDA',verify:d=>typeof d.description==='string'&&d.description.length<=500&&d.description.length>0&&!/[\x00-\x1f\x7f]/.test(d.description),
  story:d=>`Texto proposto: ${display(d.description,180)}. O Core validará a alteração.`,label:()=> 'Confirmar nova descrição',enabled:true},
 ReactionCollectorGuildElderData:{title:'✦ PROMOVER ANCIÃO',verify:d=>guild(d.guildName)&&id(d.promotedKeycloakId),story:d=>`Guilda: ${display(d.guildName)}. A identidade do destinatário não aparece neste contrato de forma legível.`,label:()=> 'Promover integrante selecionado',enabled:false},
 ReactionCollectorGuildElderRemoveData:{title:'✦ REMOVER ANCIÃO',verify:d=>guild(d.guildName)&&id(d.demotedKeycloakId),story:d=>`Guilda: ${display(d.guildName)}. Alteração de cargo ainda não homologada.`,label:()=> 'Remover o cargo de ancião',enabled:false},
 ReactionCollectorGuildKickData:{title:'✦ EXPULSAR INTEGRANTE',verify:d=>guild(d.guildName)&&id(d.kickedKeycloakId),story:d=>`Guilda: ${display(d.guildName)}. Expulsões permanecem bloqueadas até identificação legível do alvo.`,label:()=> 'Expulsar integrante',enabled:false},
 ReactionCollectorGuildInviteData:{title:'✦ CONVIDAR PARA GUILDA',verify:d=>guild(d.guildName)&&id(d.invitedPlayerKeycloakId),story:d=>`Guilda: ${display(d.guildName)}. Convite a terceiro ainda não homologado.`,label:()=> 'Confirmar convite',enabled:false},
 ReactionCollectorUnlockData:{title:'✦ LIBERTAR JOGADOR',verify:d=>id(d.unlockedKeycloakId),story:()=> 'O custo e o jogador destinatário não estão descritos neste menu. A ação permanece indisponível.',label:()=> 'Pagar libertação',enabled:false},
 ReactionCollectorPetSellData:{title:'✦ VENDA DE COMPANHEIRO',verify:d=>id(d.sellerKeycloakId)&&money(d.price)&&type(d.pet)&&positive(d.pet.typeId),story:d=>`Companheiro: ${display(d.pet.nickname)} · preço: ${d.price.toLocaleString('pt-BR')} moedas. Transferência bloqueada até homologação da titularidade.`,label:()=> 'Transferir companheiro',enabled:false},
 ReactionCollectorPetFreeData:{title:'✦ LIBERTAR COMPANHEIRO',verify:d=>positive(d.petId)&&money(d.freeCost),story:d=>`Companheiro: ${display(d.petNickname)} · custo informado: ${d.freeCost.toLocaleString('pt-BR')} moedas. Liberação irreversível ainda bloqueada.`,label:()=> 'Libertar companheiro',enabled:false},
 ReactionCollectorPetFreeShelterConfirmData:{title:'✦ LIBERTAÇÃO DO ABRIGO',verify:d=>positive(d.petEntityId)&&positive(d.petId)&&money(d.freeCost)&&typeof d.isFromShelter==='boolean',story:d=>`Companheiro: ${display(d.petNickname)} · custo: ${d.freeCost.toLocaleString('pt-BR')} moedas. Ação irreversível bloqueada.`,label:()=> 'Libertar companheiro do abrigo',enabled:false}
});
function strictBinary(kind,d,reactions){
 const rule=binaryConfigs[kind];if(!rule||!type(d)||!rule.verify(d))return null;
 if(reactions.length!==2||!noMeta(reactions)||reactions.filter(r=>r.type===ACCEPT).length!==1||reactions.filter(r=>r.type===REFUSE).length!==1)return null;
 return {kind,title:rule.title,story:rule.story(d),options:reactions.map(r=>r.type===REFUSE?{label:'Cancelar sem executar',supported:true,requiresConfirmation:false}:{label:rule.label(d),supported:rule.enabled===true,requiresConfirmation:rule.enabled===true})};
}
function coinAltar(d,reactions){
 if(!money(d.poolAmount)||!positive(d.poolThreshold)||reactions.length<2||reactions.filter(r=>r.type===REFUSE).length!==1)return null;
 const amounts=reactions.filter(r=>r.type==='ReactionCollectorAltarContributeReaction').map(r=>r.data?.amount);
 if(amounts.length!==reactions.length-1||amounts.some(a=>!positive(a))||new Set(amounts).size!==amounts.length||!reactions.filter(r=>r.type===REFUSE).every(r=>empty(r.data)))return null;
 if(reactions.some(r=>r.type==='ReactionCollectorAltarContributeReaction'&&(!type(r.data)||Object.keys(r.data).length!==1)))return null;
 return {kind:'ReactionCollectorAltarData',title:'✦ CONTRIBUIÇÃO AO ALTAR',story:`Progresso: ${d.poolAmount.toLocaleString('pt-BR')} / ${d.poolThreshold.toLocaleString('pt-BR')}. A moeda cobrada não foi validada; contribuições bloqueadas.`,options:reactions.map(r=>r.type===REFUSE?{label:'Não contribuir',supported:true,requiresConfirmation:false}:{label:`Contribuir ${r.data.amount.toLocaleString('pt-BR')} (indisponível)`,supported:false,requiresConfirmation:false})};
}
function exactReactions(kind,d,reactions,types,labels,enabled=()=>false){
 if(!type(d)||!noMeta(reactions)||reactions.length!==types.length||new Set(reactions.map(r=>r.type)).size!==types.length||reactions.some(r=>!types.includes(r.type)))return null;
 return {kind,title:kind==='ReactionCollectorPetFoodSmallEventData'?'✦ ENCONTRO COM COMIDA':'✦ ESCOLHAS DO ENCONTRO',story:'Consequências e custos ainda não validados; ações bloqueadas nesta fase.',options:reactions.map(r=>({label:labels[r.type],supported:enabled(r),requiresConfirmation:enabled(r)}))};
}
const foodTypes=['ReactionCollectorPetFoodInvestigateReaction','ReactionCollectorPetFoodSendPetReaction','ReactionCollectorPetFoodContinueReaction'];
const foodLabels={ReactionCollectorPetFoodInvestigateReaction:'Investigar',ReactionCollectorPetFoodSendPetReaction:'Enviar companheiro',ReactionCollectorPetFoodContinueReaction:'Continuar'};
function petFreeSelection(kind,d,reactions){
 if(!Array.isArray(d.shelterPets)||d.shelterPets.length>50||d.shelterPets.some(x=>!positive(x?.petEntityId)||!type(x.pet)||!positive(x.pet.typeId))||reactions.length===0)return null;
 const refs=new Set(d.shelterPets.map(x=>x.petEntityId));if(refs.size!==d.shelterPets.length)return null;
 const ids=[];const options=[];let refuseCount=0;
 for(const r of reactions){
  if(r.type===REFUSE&&empty(r.data)&&++refuseCount===1){options.push({label:'Cancelar',supported:true,requiresConfirmation:false});continue}
  if(r.type!=='ReactionCollectorPetFreeSelectReaction'||!positive(r.data?.petEntityId)||Object.keys(r.data).length!==1||!refs.has(r.data.petEntityId)||ids.includes(r.data.petEntityId))return null;
  ids.push(r.data.petEntityId);const pet=d.shelterPets.find(x=>x.petEntityId===r.data.petEntityId).pet;
  options.push({label:`Selecionar ${display(pet.nickname)} (indisponível)`,supported:false,requiresConfirmation:false});
 }
 if(ids.length===0)return null;
 return {kind,title:'✦ SELECIONAR COMPANHEIRO DO ABRIGO',story:'Seleção para libertação de companheiros ainda bloqueada.',options};
}
function petTransfer(kind,d,reactions){
 if(!Array.isArray(d.shelterPets)||d.shelterPets.length>50||d.shelterPets.some(x=>!positive(x?.petEntityId)||!type(x.pet)||!positive(x.pet.typeId)))return null;
 const refs=new Set(d.shelterPets.map(x=>x.petEntityId));if(refs.size!==d.shelterPets.length)return null;
 const types=['ReactionCollectorPetTransferDepositReaction','ReactionCollectorPetTransferWithdrawReaction','ReactionCollectorPetTransferSwitchReaction'];
 const keys=new Set();const options=[];let depositCount=0;
 for(const r of reactions){
  if(!types.includes(r.type)||!type(r.data))return null;
  if(r.type===types[0]){if(!empty(r.data)||!type(d.ownPet)||++depositCount>1)return null;options.push({label:'Depositar companheiro (indisponível)',supported:false,requiresConfirmation:false});continue;}
  const eid=r.data.petEntityId;if(!positive(eid)||Object.keys(r.data).length!==1||!refs.has(eid))return null;
  const key=r.type+':'+eid;if(keys.has(key))return null;keys.add(key);
  const pet=d.shelterPets.find(x=>x.petEntityId===eid).pet;
  options.push({label:`${r.type===types[1]?'Retirar':'Trocar por'} ${display(pet.nickname)} (indisponível)`,supported:false,requiresConfirmation:false});
 }
 return options.length?{kind,title:'✦ ABRIGO DA GUILDA',story:'Transferências de propriedade aguardam homologação do Core e banco descartáveis.',options}:null;
}
function skipMission(kind,d,reactions){
 if(!type(d)||Object.keys(d).length!==0||!reactions.length)return null;
 const indexes=new Set();const options=[];let closeCount=0;
 for(const r of reactions){
  if(r.type==='ReactionCollectorSkipMissionShopItemCloseReaction'&&empty(r.data)&&++closeCount===1){options.push({label:'Fechar sem alterar missão',supported:true,requiresConfirmation:false});continue}
  if(r.type!=='ReactionCollectorSkipMissionShopItemReaction'||!type(r.data)||!Number.isSafeInteger(r.data.missionIndex)||r.data.missionIndex<0||!type(r.data.mission)||indexes.has(r.data.missionIndex))return null;
  indexes.add(r.data.missionIndex);options.push({label:`Pular missão ${r.data.missionIndex+1} (indisponível)`,supported:false,requiresConfirmation:false});
 }
 return {kind,title:'✦ TROCAR MISSÃO',story:'Custo e consequências de troca ainda não homologados.',options};
}
function compileCollector(packet){
 const existing=previous.compileCollector(packet);
 if(existing){
  if(existing.kind==='ReactionCollectorGoToPVEIslandData')return {...existing,options:existing.options.map(o=>o.label.includes('custo informado:')?{...o,label:o.label.replace(/\(moeda definida pelo Core\)/,'gemas')}:o)};
  if(existing.kind==='ReactionCollectorCartData')return {...existing,options:existing.options.map(o=>o.label.includes('custo informado:')?{...o,label:o.label.replace(/\(unidade a confirmar no Core\)/,'moedas')}:o),story:existing.story+' Atenção: o transporte pode esconder uma armadilha.'};
  return existing;
 }
 if(!type(packet)||!Array.isArray(packet.reactions)||!packet.reactions.length||packet.reactions.length>100||!type(packet.data)||!type(packet.data.data))return null;
 const kind=packet.data.type,d=packet.data.data,reactions=packet.reactions;
 if(Object.hasOwn(binaryConfigs,kind))return strictBinary(kind,d,reactions);
 if(kind==='ReactionCollectorAltarData')return coinAltar(d,reactions);
 if(kind==='ReactionCollectorPetFoodSmallEventData'){
  if(!literal(d.foodType,60)||!literal(d.petSex,4))return null;
  return exactReactions(kind,d,reactions,foodTypes,foodLabels);
 }
 if(kind==='ReactionCollectorPetFreeSelectionData')return petFreeSelection(kind,d,reactions);
 if(kind==='ReactionCollectorPetTransferData')return petTransfer(kind,d,reactions);
 if(kind==='ReactionCollectorSkipMissionShopItemData')return skipMission(kind,d,reactions);
 return null;
}
module.exports={compileCollector,binaryConfigs,sourceVersion:'Crownicles 6.2.0.b'};
