'use strict';
/** Lote 08: fluxos oficiais de expedição, poções, bônus diário e consulta de equipamento.
 *  Contratos conferidos na tag Crownicles 6.2.0.b; sem RNG, preço ou regra local.
 *  Ação nativa de troca de equipamento NÃO é enviada: depende de fluxo assíncrono
 *  distinto que exige snapshot, confirmação, resposta e término correto do coletor.
 */
const {safe,itemName}=require('./lote04.cjs');
const fmt=n=>Number.isFinite(n)?n.toLocaleString('pt-BR',{maximumFractionDigits:2}):'—';
const isNumber=n=>Number.isFinite(n)&&n>=0;
const integer=n=>Number.isInteger(n)&&n>=0;
const opt=(label,requiresConfirmation=false)=>({label,supported:true,requiresConfirmation});
const no=()=>({label:'',supported:false,requiresConfirmation:false});
const titles={ReactionCollectorPetExpeditionChoiceData:'✦ EXPEDIÇÃO DO COMPANHEIRO',ReactionCollectorPetExpeditionData:'✦ COMPANHEIRO EM EXPEDIÇÃO',ReactionCollectorPetExpeditionFinishedData:'✦ EXPEDIÇÃO CONCLUÍDA',ReactionCollectorDrinkData:'✦ POÇÕES',ReactionCollectorDailyBonusData:'✦ BÔNUS DIÁRIO',ReactionCollectorEquipData:'✦ EQUIPAMENTOS'};
const kinds=Object.keys(titles);
const aliases={
 '/expedicao':'CommandPetExpeditionPacketReq','/expedição':'CommandPetExpeditionPacketReq','/expedicaopet':'CommandPetExpeditionPacketReq',
 '/pocao':'CommandDrinkPacketReq','/poção':'CommandDrinkPacketReq','/beber':'CommandDrinkPacketReq',
 '/diario':'CommandDailyBonusPacketReq','/diário':'CommandDailyBonusPacketReq','/bonusdiario':'CommandDailyBonusPacketReq','/bônusdiário':'CommandDailyBonusPacketReq',
 '/equipamentos':'CommandEquipPacketReq','/equipamento':'CommandEquipPacketReq'
};
function resolveCommand(line){const words=String(line||'').trim().toLocaleLowerCase('pt-BR').split(/\s+/);return words.length===1&&Object.hasOwn(aliases,words[0])?{name:aliases[words[0]],data:{}}:null;}
const minutes=(v)=>integer(v)?`${fmt(v)} min`:'duração não informada';
function petName(p){return safe(p?.nickname,48)||'seu companheiro';}
function expeditionOption(kind,reaction,data){
 const type=reaction?.type,r=reaction?.data||{};
 if(kind==='ReactionCollectorPetExpeditionChoiceData'){
  if(type==='ReactionCollectorPetExpeditionCancelReaction')return opt('Cancelar proposta · pode reduzir afinidade após o primeiro cancelamento',true);
  if(type!=='ReactionCollectorPetExpeditionSelectReaction')return no();
  const ex=r.expedition;
  const official=Array.isArray(data?.expeditions)&&data.expeditions.find(x=>x?.id===ex?.id);
  if(!official||typeof ex?.id!=='string'||!ex.id||!integer(ex.durationMinutes)||!isNumber(ex.riskRate)||ex.riskRate>100||!isNumber(ex.difficulty)||ex.difficulty>100||!integer(ex.foodCost)||!isNumber(official.riskRate)||official.riskRate!==ex.riskRate||official.durationMinutes!==ex.durationMinutes||official.foodCost!==ex.foodCost)return no();
  const lackFood=data.hasGuild===true&&Number.isFinite(data.guildFoodAmount)&&data.guildFoodAmount<ex.foodCost;
  return opt(`Expedição · ${minutes(ex.displayDurationMinutes??ex.durationMinutes)} · risco ${fmt(ex.riskRate)}% · dificuldade ${fmt(ex.difficulty)}/100 · ração ${fmt(ex.foodCost)}${lackFood?' · ESTOQUE INSUFICIENTE, RISCO MAIOR':''}`,true);
 }
 if(kind==='ReactionCollectorPetExpeditionData'){
  if(type==='ReactionCollectorPetExpeditionCloseReaction')return opt('Fechar consulta sem recolher');
  if(type==='ReactionCollectorPetExpeditionRecallReaction')return opt('Recolher companheiro agora · perde afinidade e encerra expedição',true);
  return no();
 }
 if(kind==='ReactionCollectorPetExpeditionFinishedData')return type==='ReactionCollectorPetExpeditionClaimReaction'?opt('Receber recompensas da expedição concluída',true):no();
 return no();
}
function story(kind,d,models){
 const pet=petName(d.pet);
 if(kind==='ReactionCollectorPetExpeditionChoiceData')return [`Escolha uma rota para ${pet}. O risco, a dificuldade e a alimentação são definidos pelo motor.`,d.hasGuild===false?'Sem despensa da guilda: o risco efetivo pode aumentar.':null,'A seleção inicia uma viagem de verdade. Cancelamentos repetidos podem reduzir a afinidade.'].filter(Boolean).join('\n');
 if(kind==='ReactionCollectorPetExpeditionData'){
  const when=isNumber(d.returnTime)?new Date(d.returnTime).toLocaleString('pt-BR'):'não informado';
  return `${pet} ainda está viajando.\nRetorno estimado: ${when}.\nRecolher agora encerra a viagem e reduz a afinidade.`;
 }
 if(kind==='ReactionCollectorPetExpeditionFinishedData')return `${pet} terminou sua expedição. As recompensas serão calculadas e entregues pelo motor quando você autorizar o resgate.`;
 if(kind==='ReactionCollectorDrinkData')return 'Escolha uma poção disponível. Beber consome a poção e pode alterar vida, energia ou outros efeitos.';
 if(kind==='ReactionCollectorDailyBonusData')return 'Selecione um objeto para ativar o bônus diário. A escolha usa a recarga do motor; confirme somente se desejar consumi-la.';
 if(kind==='ReactionCollectorEquipData')return equipSummary(d,models);
 return '';
}
function equipSummary(d,models={}){
 const out=['Inspecione seu equipamento e os itens na reserva. Alterações de equipamento estão bloqueadas nesta tela até o fluxo assíncrono ser homologado.'];
 if(!Array.isArray(d.categories))return out.join('\n');
 for(const c of d.categories.slice(0,4)){
  if(!integer(c?.category)||c.category>3)continue;
  const names=['Arma','Armadura','Poção','Objeto'];
  const equipped=c.equippedItem?.details;
  const active=equipped?itemName(models,c.category,equipped.id):null;
  out.push(`${names[c.category]}: ${active||'sem item ativo'}`);
  const reserve=Array.isArray(c.reserveItems)?c.reserveItems:[];
  for(const x of reserve.slice(0,12)){
   if(!integer(x?.slot)||x.slot<1||!integer(x?.details?.id))continue;
   const n=itemName(models,c.category,x.details.id);
   if(n)out.push(`  Reserva ${x.slot}: ${n}`);
  }
  if(integer(c.maxReserveSlots))out.push(`  Espaços de reserva: ${reserve.length}/${c.maxReserveSlots}`);
 }
 return out.join('\n');
}
function parseOption(kind,reaction,data,models){
 if(kinds.includes(kind)&&kind.startsWith('ReactionCollectorPetExpedition'))return expeditionOption(kind,reaction,data);
 if(kind==='ReactionCollectorEquipData')return reaction?.type==='ReactionCollectorEquipCloseReaction'?opt('Fechar equipamentos'):no();
 if(kind==='ReactionCollectorDrinkData'||kind==='ReactionCollectorDailyBonusData'){
  if(reaction?.type==='ReactionCollectorRefuseReaction')return opt('Voltar sem consumir');
  const thing=kind==='ReactionCollectorDrinkData'?'potion':'object';
  const wanted=kind==='ReactionCollectorDrinkData'?'ReactionCollectorDrinkReaction':'ReactionCollectorDailyBonusReaction';
  if(reaction?.type!==wanted)return no();
  const item=reaction.data?.[thing];
  const category=kind==='ReactionCollectorDrinkData'?2:3;
  if(!integer(item?.id)||item?.itemCategory!==category)return no();
  const name=itemName(models,item.itemCategory,item.id);
  if(!name)return no();
  return opt(kind==='ReactionCollectorDrinkData'?`Beber ${name} · consome 1 poção`:`Ativar ${name} · consome o bônus diário`,true);
 }
 return no();
}
function fmtDuration(v){return isNumber(v)&&v>0?minutes(Math.ceil(v)):'não informada';}
const nature=['Sem efeito','Vida','Velocidade','Ataque','Defesa','Aceleração do tempo','Moedas','Energia'];
function renderPacket(name,p,models){
 switch(name){
  case 'CommandPetExpeditionPacketRes':{
   const code=safe(p.cannotStartReason,50);
   const why={noTalisman:'Você precisa do talismã de expedição.',noPet:'Você ainda não possui companheiro.',insufficientLove:'Seu companheiro precisa de mais afinidade.',petHungry:'Alimente seu companheiro antes de partir.',notOnContinent:'Você precisa estar no continente.'};
   return ['*✦ EXPEDIÇÕES*',p.canStartExpedition===true?'Seu companheiro está preparado; consulte /expedicao para escolher uma rota.':why[code]||'O motor informou que a expedição não pode começar nas condições atuais.',code&&!Object.hasOwn(why,code)?'Verifique a situação em /pet e /perfil.':null].filter(Boolean).join('\n');
  }
  case 'CommandPetExpeditionChoicePacketRes':{
   if(p.success!==true)return '*✦ EXPEDIÇÃO NÃO INICIADA*\nO motor recusou a partida. Confira /pet antes de tentar novamente.';
   const ex=p.expedition||{};
   return ['*✦ EXPEDIÇÃO INICIADA*',`${petName(ex.pet)} partiu.`,isNumber(ex.endTime)?`Retorno estimado: ${new Date(ex.endTime).toLocaleString('pt-BR')}`:`Duração: ${fmtDuration(ex.durationMinutes)}`,integer(p.foodConsumed)?`Rações consumidas: ${fmt(p.foodConsumed)}`:null,p.insufficientFood===true?'Rações insuficientes: o risco da viagem aumentou.':null,'Consulte /expedicao para acompanhar.'].filter(Boolean).join('\n');
  }
  case 'CommandPetExpeditionCancelPacketRes':return ['*✦ PARTIDA CANCELADA*',p.isFreeCancellation===true?'Primeiro cancelamento da semana: sem perda de afinidade.':isNumber(p.loveLost)?`Afinidade perdida: ${fmt(p.loveLost)}.`:'O cancelamento pode ter reduzido a afinidade.'].join('\n');
  case 'CommandPetExpeditionRecallPacketRes':return ['*✦ COMPANHEIRO RECOLHIDO*',isNumber(p.loveLost)?`Afinidade perdida: ${fmt(p.loveLost)}.`:'O motor concluiu o recolhimento.'].join('\n');
  case 'CommandPetExpeditionResolvePacketRes':{
   const v=p.rewards||{};
   return ['*✦ EXPEDIÇÃO CONCLUÍDA*',p.totalFailure===true?'Seu companheiro retornou sem recompensas.':p.partialSuccess===true?'Seu companheiro trouxe parte das recompensas.':'O motor concluiu o resgate.',isNumber(v.money)?`Moedas: +${fmt(v.money)}`:null,isNumber(v.experience)?`XP: +${fmt(v.experience)}`:null,isNumber(v.points)?`Pontos: +${fmt(v.points)}`:null,isNumber(v.tokens)?`Tokens: +${fmt(v.tokens)}`:null,Number.isFinite(p.loveChange)?`Afinidade: ${p.loveChange>=0?'+':''}${fmt(p.loveChange)}`:null,p.badgeEarned?'Uma insígnia foi concedida pelo motor.':null].filter(Boolean).join('\n');
  }
  case 'CommandPetExpeditionErrorPacket':{const reasons={noPet:'Você ainda não possui um companheiro.',noExpedition:'Não há uma expedição ativa para concluir.',expeditionNotComplete:'A expedição ainda não terminou.',invalidState:'O estado da expedição mudou antes da confirmação.',expeditionInProgress:'Seu companheiro já está em expedição.',noTalisman:'Você precisa do talismã de expedição.',insufficientLove:'Seu companheiro precisa de mais afinidade.',petHungry:'Alimente seu companheiro antes de partir.',notOnContinent:'Você precisa retornar ao continente.',cannotRecallOnIsland:'Não é possível recolher o companheiro nesta ilha.'};return '*✦ EXPEDIÇÃO INDISPONÍVEL*\n'+(reasons[p.errorCode]||'O motor recusou essa ação. Consulte /pet ou /expedicao para verificar o estado atual.');}
  case 'CommandDrinkNoAvailablePotion':return '*✦ POÇÕES*\nVocê não possui poções utilizáveis nas condições atuais.';
  case 'CommandDrinkCancelDrink':return '*✦ POÇÕES*\nNenhuma poção foi consumida.';
  case 'CommandDrinkPacketRes':return `*✦ POÇÃO CONSUMIDA*\n${nature[p.itemNature]||'Efeito'}: ${Number.isFinite(p.value)?fmt(p.value):'valor informado pelo motor'}. Consulte /perfil.`;
  case 'CommandDailyBonusNoAvailableObject':return '*✦ BÔNUS DIÁRIO*\nVocê não possui objeto adequado para esse bônus.';
  case 'CommandDailyBonusCancelPacket':return '*✦ BÔNUS DIÁRIO*\nVocê não consumiu o bônus.';
  case 'CommandDailyBonusInCooldown':{
  // Original Core sends milliseconds since epoch and a duration in hours.
  // Never guess a date if either value is missing or malformed.
  const start=p?.lastDailyTimestamp,hours=p?.timeBetweenDailies;
  const finish=Number.isFinite(start)&&start>1e12&&Number.isFinite(hours)&&hours>=0&&hours<=168?start+hours*3600000:NaN;
  const when=Number.isFinite(finish)&&finish>Date.now()&&finish<Date.now()+8*86400000?new Date(finish).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'';
  return '*✦ BÔNUS DIÁRIO*\nA recarga ainda não terminou.'+(when?'\nDisponível a partir de '+when+' (horário de Brasília).':'');
 }
  case 'CommandDailyBonusPacketRes':return `*✦ BÔNUS RECEBIDO*\n${nature[p.itemNature]||'Efeito'}: ${Number.isFinite(p.value)?fmt(p.value):'valor confirmado pelo motor'}.`;
  case 'CommandEquipErrorNoItem':return '*✦ EQUIPAMENTOS*\nNenhum equipamento disponível para consultar.';
  case 'CommandEquipActionRes':return p.success===true?'*✦ EQUIPAMENTO ATUALIZADO*\nO motor confirmou a alteração. Confira /inventario.':'*✦ EQUIPAMENTO NÃO ALTERADO*\nO motor recusou a operação.';
  default:return null;
 }
}
module.exports={resolveCommand,expeditionOption,parseOption,story,equipSummary,renderPacket,titles,kinds};
