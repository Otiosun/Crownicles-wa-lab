'use strict';
/** Crownicles 6.2.0.b - adaptador WhatsApp, sem regras de jogo duplicadas.
 * Contratos: CommandClassesPacket, ReactionCollectorChangeClass,
 * CommandGuildShelterPacket, CommandJoinBoatPacket/ReactionCollectorJoinBoat,
 * CommandPetNickPacket. O Core e o seu banco seguem como autoridade.
 */
const crypto=require('node:crypto');
const {safe}=require('./lote04.cjs');
const num=x=>Number.isFinite(x)?x.toLocaleString('pt-BR',{maximumFractionDigits:1}):'?';
const limited=(v,max=60)=>safe(v,max).replace(/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/gi,'').trim();
const nickCheck=(name)=>{
 if(typeof name!=='string'||name.length<3||name.length>16)return false;
 // Validação de entrada alinhada ao StringUtils.checkNameString do Core;
 // o Core revalida e decide sozinho se aplicará a alteração.
 const allowed=/^[A-Za-z0-9 ÇçÜüÉéÂâÄäÀàÊêËëÈèÏïÎîÔôÖöÛû!,'.:()-]+$/u;
 const special=/^[0-9 ]+$|( {2})+$|([ÇçÜüÉéÂâÄäÀàÊêËëÈèÏïÎîÔôÖöÛû]{2})+$|([!,'.:()-]{2})+/u;
 return allowed.test(name)&&!special.test(name);
};
function resolveCommand(line){
 if(typeof line!=='string')return null;
 const trimmed=line.trim();const lower=trimmed.toLocaleLowerCase('pt-BR');
 if(['/mudarclasse','/trocarclasse','/escolherclasse'].includes(lower))return {name:'CommandClassesPacketReq',data:{}};
 if(['/abrigo','/abrigoguilda','/abrigodaguilda'].includes(lower))return {name:'CommandGuildShelterPacketReq',data:{}};
 if(['/embarcar','/barcodaguilda','/juntarbarco'].includes(lower))return {name:'CommandJoinBoatPacketReq',data:{}};
 if(['/cidade','/servicos','/serviços'].includes(lower))return {name:'CommandReportPacketReq',data:{},guardMenu:true};
 if(/^\/(?:renomearpet|apelidopet)(?:\s|$)/iu.test(trimmed)){
  const m=trimmed.match(/^\/(?:renomearpet|apelidopet)\s+([^\r\n]*)$/iu);
  const nickname=m?.[1]?.trim();
  if(!nickCheck(nickname))return {local:'*✦ APELIDO DO COMPANHEIRO*\nUse /renomearpet NOME (3 a 16 caracteres, sem formatação, emojis ou duas pontuações consecutivas). Nenhuma mudança foi enviada.'};
  return {petNickname:nickname};
 }
 return null;
}
function makeNicknameMenu(nickname){if(!nickCheck(nickname))return null;
 return {id:'wa-pet-nick-'+crypto.randomUUID(),endTime:Date.now()+90000,type:'LocalPetNickname',title:'✦ NOME DO COMPANHEIRO',story:'O apelido será alterado no Core somente após confirmação. Esta ação modifica o nome persistente do seu próprio companheiro.',
  options:[{label:`Renomear companheiro para "${limited(nickname,16)}"`,supported:true,requiresConfirmation:true,kind:'petNickname',nickname},
   {label:'Cancelar sem alterar o nome',supported:true,requiresConfirmation:false,kind:'nativeCancel'}]};
}
function authorizedNickname(menu,choice,playerId){
 if(!menu||menu.type!=='LocalPetNickname'||!String(menu.id||'').startsWith('wa-pet-nick-')||Date.now()>=menu.endTime||!Number.isFinite(menu.endTime)||!Array.isArray(menu.options)||menu.options.length!==2||menu.options[0]!==choice||choice.kind!=='petNickname'||choice.requiresConfirmation!==true||menu.options[1]?.kind!=='nativeCancel'||!nickCheck(choice.nickname))return null;
 if(typeof playerId!=='string'||!(/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i).test(playerId))return null;
 return {name:'CommandPetNickPacketReq',data:{keycloakId:playerId,newNickname:choice.nickname}};
}
function collectorOption(kind,r,d,models){const t=r?.type,v=r?.data||{};
 if(kind==='ReactionCollectorChangeClassData'){
  if(t==='ReactionCollectorRefuseReaction')return {label:'Continuar com a classe atual',supported:true,requiresConfirmation:false};
  const clazz=Array.isArray(d.classesDetails)?d.classesDetails.find(x=>x.id===v.classId):null;
  if(t!=='ReactionCollectorChangeClassReaction'||!clazz||!Number.isInteger(clazz.id)||clazz.id<0||!Number.isFinite(clazz.health)||!Number.isFinite(clazz.attack)||!Number.isFinite(clazz.defense)||!Number.isFinite(clazz.speed))return {supported:false};
  const raw=models?.classes?.[String(clazz.id)];const name=limited(typeof raw==='string'?raw:raw?.name||`Classe ${clazz.id}`,40)||`Classe ${clazz.id}`;
  return {label:`Mudar para ${name} · Vida ${num(clazz.health)} · Atq ${num(clazz.attack)} · Def ${num(clazz.defense)} · Vel ${num(clazz.speed)}`,supported:true,requiresConfirmation:true};
 }
 if(kind==='ReactionCollectorJoinBoatData'){
  if(t==='ReactionCollectorRefuseReaction')return {label:'Não embarcar',supported:true,requiresConfirmation:false};
  if(t!=='ReactionCollectorAcceptReaction'||!Number.isFinite(d.price)||d.price<0||!Number.isFinite(d.energy?.current)||!Number.isFinite(d.energy?.max))return {supported:false};
  return {label:`Embarcar na ilha PvE · custo de ${num(d.price)} gemas`,supported:true,requiresConfirmation:true};
 }
 return {supported:false};
}
function collectorStory(kind,d){
 if(kind==='ReactionCollectorChangeClassData')return `Escolha uma nova classe. O motor pode impor uma recarga de ${Number.isFinite(d.cooldownSeconds)?Math.ceil(d.cooldownSeconds/86400)+' dia(s)':'tempo desconhecido'}; sua personalidade de defesa pode ser alterada. A escolha exige confirmação.`;
 if(kind==='ReactionCollectorJoinBoatData')return `Seus companheiros estão no barco. Embarcar pode gastar gemas e iniciar viagem para a ilha PvE. Custo informado: ${num(d.price)} gemas. Energia: ${num(d.energy?.current)}/${num(d.energy?.max)}. O Core revalida tudo após sua confirmação.`;
 return '';
}
function renderPacket(name,p,models){switch(name){
 case 'CommandClassesCooldownErrorPacket':return '*✦ CLASSES*\nAinda há recarga para trocar de classe.'+(Number.isFinite(p.timestamp)&&p.timestamp>1e12?`\nDisponível a partir de ${new Date(p.timestamp).toLocaleString('pt-BR')}.`:'');
 case 'CommandClassesCancelErrorPacket':return '*✦ CLASSES*\nVocê permaneceu na classe atual.';
 case 'CommandClassesChangeSuccessPacket':{const cls=models?.classes?.[String(p.classId)];const label=limited(typeof cls==='string'?cls:cls?.name||'nova classe');return `*✦ CLASSE ALTERADA*\n${label||'Sua classe foi alterada pelo motor.'}${p.lostDefensePersonality?'\nUma configuração de personalidade de defesa foi redefinida.':''}`;}
 case 'CommandGuildShelterNoPetErrorPacket':return '*✦ ABRIGO DA GUILDA*\nO abrigo não possui companheiros no momento.';
 case 'CommandGuildShelterPacketRes':{
  if(!Array.isArray(p.pets))return '*✦ ABRIGO DA GUILDA*\nO Core não forneceu a lista de companheiros.';
  const pets=p.pets.slice(0,15).map((x,i)=>{
   const sex=String(x?.sex||'').toLowerCase();const key=`${x?.typeId}_${sex==='f'||sex==='female'?'female':'male'}`;
   const model=models?.pets?.[key];const species=limited(typeof model==='string'?model:model?.name||'Companheiro');
   const nickname=limited(x?.nickname,30);
   return `${i+1}. ${nickname||species||'Companheiro'}${nickname&&species?` · ${species}`:''}${Number.isInteger(x?.loveLevel)?` · afinidade ${x.loveLevel}`:''}`;
  });
  return [`*✦ ABRIGO DA GUILDA*`,limited(p.guildName,65)||'Guilda',`Companheiros: ${p.pets.length}/${Number.isInteger(p.maxCount)&&p.maxCount>=0?p.maxCount:'?'}`,...pets,p.pets.length>15?`Outros ${p.pets.length-15} não exibidos.`:null].filter(Boolean).join('\n');}
 case 'CommandJoinBoatAcceptPacketRes':return `*✦ EMBARQUE REALIZADO*\nO Core iniciou sua viagem.${Number.isFinite(p.score)?`\nPontos: +${num(p.score)}`:''}`;
 case 'CommandJoinBoatRefusePacketRes':return '*✦ EMBARQUE CANCELADO*\nVocê não iniciou a viagem.';
 case 'CommandJoinBoatNoGuildPacketRes':return '*✦ BARCO DA GUILDA*\nÉ necessário pertencer a uma guilda.';
 case 'CommandJoinBoatTooManyRunsPacketRes':return '*✦ BARCO DA GUILDA*\nLimite de viagens à ilha PvE atingido nesta semana.';
 case 'CommandJoinBoatNoMemberOnBoatPacketRes':return '*✦ BARCO DA GUILDA*\nNenhum integrante da sua guilda está no barco.';
 case 'CommandJoinBoatNotTravellingPacketRes':return '*✦ BARCO DA GUILDA*\nVocê precisa estar viajando para embarcar.';
 case 'CommandJoinBoatNotEnoughEnergyPacketRes':return '*✦ BARCO DA GUILDA*\nEnergia insuficiente.';
 case 'CommandJoinBoatNotEnoughGemsPacketRes':return '*✦ BARCO DA GUILDA*\nGemas insuficientes para essa viagem.';
 case 'CommandPetNickPacketRes':{
  if(p.foundPet!==true)return '*✦ APELIDO DO COMPANHEIRO*\nVocê não possui um companheiro disponível para renomear.';
  if(p.nickNameIsAcceptable!==true)return '*✦ APELIDO DO COMPANHEIRO*\nO motor recusou o nome solicitado. Nenhuma alteração confirmada.';
  return `*✦ COMPANHEIRO RENOMEADO*\n${limited(p.newNickname,16)||'Apelido redefinido pelo motor.'}`;}
 default:return null;
 }}
module.exports={resolveCommand,makeNicknameMenu,authorizedNickname,collectorOption,collectorStory,renderPacket,nickCheck};
