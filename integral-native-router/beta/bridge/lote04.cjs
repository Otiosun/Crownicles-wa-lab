'use strict';
/**
 * Crownicles 6.2.0.b — menus contextuais e notificações do Core.
 * Apenas apresenta os snapshots emitidos pelo Core; não calcula regras, cobra,
 * concede recompensas, adianta relógios ou consulta identificadores de terceiros.
 * Ações de custo/irreversíveis exigem /confirmar N no gateway, na mesma janela.
 */
const {missName}=require('./lote02.cjs');
const integer=n=>Number.isInteger(n)&&n>=0;
const price=n=>Number.isFinite(n)&&n>=0;
const num=n=>Number.isFinite(n)?n.toLocaleString('pt-BR'):'—';
const safe=(x,max=90)=>String(x??'').replace(/[\x00-\x1f\x7f]/g,' ').replace(/[*_~`]/g,'').replace(/\{[^}]+\}/g,'').replace(/\s+/g,' ').trim().slice(0,max);
const itemGroups=['weapons','armors','potions','objects'];
const types=['Arma','Armadura','Poção','Objeto'];
const itemName=(models,category,id)=>{
 const group=itemGroups[category];const v=group?models?.[group]?.[String(id)]:null;
 return safe(typeof v==='string'?v:v?.name,70)||null;
};
const addCost=(money,gems)=>[price(money)&&money>0?`${num(money)} moedas`:null,price(gems)&&gems>0?`${num(gems)} gemas`:null].filter(Boolean).join(' + ')||'sem cobrança informada';
const currencyName={money:'moedas',gem:'gemas',gems:'gemas'};
const shopItems=['Poção do dia','Equipamento aleatório','Curar alteração','Restaurar energia e vida','Ampliar inventário','Insígnia Boca de Ouro','Ração comum','Ração herbívora','Ração carnívora','Ração especial','Moedas','Tesouro','Favor do Rei','Avançar missão','Afinidade do companheiro','XP de guilda','Restaurar energia','XP de guilda adicional','Insígnia de Mestre das Missões','Tokens','Ampliar espaço de plantas','Plantas semanais I','Plantas semanais II','Plantas semanais III','Análise de mercado','Madeira comum','Madeira incomum','Pacote de materiais','Talismã de colheita remota','Doação de tokens'];
const shopItemNames={dailyPotion:shopItems[0],randomItem:shopItems[1],alterationHeal:shopItems[2],fullRegen:shopItems[3],slotExtension:shopItems[4],moneyMouthBadge:shopItems[5],token:shopItems[19]};
const shops={royalMarket:'Mercado Real',generalShop:'Loja geral',stockExchange:'Bolsa de comércio',tanner:'Curtidor',herbalist:'Herborista',lumberjack:'Lenhador',veterinarian:'Veterinário',materialMerchant:'Mercador de materiais'};
function entry(label,confirm=false){return {label,supported:true,requiresConfirmation:confirm}}
function blocked(){return {label:'',supported:false,requiresConfirmation:false}}
function matchSlot(arr,reaction,opts={}){return Array.isArray(arr)?arr.find(x=>x.slot===reaction.slot&&x.category=== (reaction.itemCategory??reaction.category) && (opts.itemId===undefined||x.itemId===opts.itemId)):undefined}
function cityOption(reaction,city,models){
 const type=reaction?.type, r=reaction?.data||{}, c=city||{}, home=c.home||{}, owned=home.owned||{}, garden=owned.garden||{};
 switch(type){
 case 'ReactionCollectorExitCityReaction':return entry('Sair da cidade e escolher um destino');
 case 'ReactionCollectorRefuseReaction':return entry(c.gardenOnly?'Fechar horta':'Permanecer na cidade');
 case 'ReactionCollectorInnMealReaction':{
  const inn=(c.inns||[]).find(i=>i.innId===r.innId), meal=inn?.meals?.find(x=>x.mealId===r.meal?.mealId);
  if(!meal||!price(meal.price))return blocked();
  return entry(`Refeição na hospedaria · ${num(meal.price)} moedas · +${num(meal.energy)} energia`,true)}
 case 'ReactionCollectorInnRoomReaction':{
  const inn=(c.inns||[]).find(i=>i.innId===r.innId), room=inn?.rooms?.find(x=>x.roomId===r.room?.roomId);
  if(!room||!price(room.price))return blocked();
  return entry(`Descansar na hospedaria · ${num(room.price)} moedas · +${num(room.health)} vida`,true)}
 case 'ReactionCollectorCityShopReaction':{
  const shop=(c.shops||[]).find(x=>x.shopId===r.shopId&&!x.isEmpty);
  return shop&&shops[r.shopId]?entry(`Visitar ${shops[r.shopId]}`):blocked()}
 case 'ReactionCollectorCityBuyHomeReaction':return price(home.manage?.newPrice)&&home.manage?.canBuy===true?entry(`Comprar casa · ${num(home.manage.newPrice)} moedas`,true):blocked();
 case 'ReactionCollectorCityUpgradeHomeReaction':return price(home.manage?.upgrade?.price)&&home.manage?.canUpgrade===true?entry(`Ampliar casa · ${num(home.manage.upgrade.price)} moedas`,true):blocked();
 case 'ReactionCollectorCityMoveHomeReaction':return price(home.manage?.movePrice)&&home.manage?.canMove===true?entry(`Mudar de casa · ${num(home.manage.movePrice)} moedas`,true):blocked();
 case 'ReactionCollectorHomeMenuReaction':return home.owned?entry('Visitar sua casa'):blocked();
 case 'ReactionCollectorHomeChestCloseReaction':return home.owned?entry('Voltar aos serviços urbanos'):blocked();
 case 'ReactionCollectorHomeBedReaction':return home.owned?entry('Descansar na própria cama · ação com efeito de tempo',true):blocked();
 case 'ReactionCollectorEnchantReaction':{
  const item=matchSlot(c.enchanter?.enchantableItems,r), cost=c.enchanter?.enchantmentCost;
  if(!item||!price(cost?.money)||!price(cost?.gems))return blocked();
  const name=itemName(models,item.category,item.details?.id)||types[item.category]||'Equipamento';
  return entry(`Encantar ${name} · ${addCost(cost.money,cost.gems)}`,true)}
 case 'ReactionCollectorEnchanterDisenchantReaction':{
  const item=matchSlot(c.enchanter?.disenchantableItems,r);
  if(!item)return blocked();const name=itemName(models,item.category,item.details?.id)||types[item.category]||'Equipamento';
  return entry(`Remover encantamento de ${name} · gratuito`,true)}
 case 'ReactionCollectorUpgradeItemReaction':{
  const item=matchSlot(owned.upgradeStation?.upgradeableItems,r);
  return item?.canUpgrade===true?entry(`Melhorar ${itemName(models,item.category,item.details?.id)||'equipamento'} ao nível ${num(item.nextLevel)} · consome materiais`,true):blocked()}
 case 'ReactionCollectorBlacksmithMenuReaction':return c.blacksmith?entry('Consultar ferreiro'):blocked();
 case 'ReactionCollectorBlacksmithUpgradeReaction':{
  const item=matchSlot(c.blacksmith?.upgradeableItems,r);
  if(!item||!price(item.upgradeCost))return blocked();
  if(r.buyMaterials===true&&item.canBuyAndUpgrade!==true)return blocked();
  if(r.buyMaterials!==true&&item.canUpgrade!==true)return blocked();
  const total=item.upgradeCost+(r.buyMaterials?item.missingMaterialsCost:0);
  if(!price(total))return blocked();
  return entry(`Forjar ${itemName(models,item.category,item.details?.id)||'equipamento'} · ${num(total)} moedas${r.buyMaterials?' (inclui materiais)':''}`,true)}
 case 'ReactionCollectorBlacksmithEnchantmentTransferReaction':{
  const source=(c.blacksmith?.enchantmentTransfers||[]).find(x=>x.slot===r.sourceSlot&&x.category===r.itemCategory);
  const target=source?.targets?.find(x=>x.slot===r.targetSlot);
  return target?.canAfford===true&&price(target.cost)?entry(`Transferir encantamento · ${num(target.cost)} moedas`,true):blocked()}
 case 'ReactionCollectorScrapDealerMenuReaction':return c.scrapDealer?entry('Consultar reciclador'):blocked();
 case 'ReactionCollectorScrapDealerRecycleReaction':{
  const i=(c.scrapDealer?.recyclableItems||[]).find(x=>x.slot===r.slot&&x.category===r.itemCategory&&x.itemId===r.itemId);
  if(!i)return blocked();
  const name=itemName(models,i.category,i.itemId)||'equipamento';
  return entry(`RECICLAR ${name} · destrói o item${price(i.recoveredMoney)?` · recupera ${num(i.recoveredMoney)} moedas`:''}`,true)}
 case 'ReactionCollectorRoyalBlacksmithMenuReaction':return c.royalBlacksmith?entry('Consultar ferreiro real'):blocked();
 case 'ReactionCollectorRoyalBlacksmithUpgradeReaction':{
  const item=matchSlot(c.royalBlacksmith?.upgradeableItems,r);
  if(!item||!price(item.upgradeCost)||!price(item.gemCost))return blocked();
  if(r.buyMaterials===true&&item.canBuyAndUpgrade!==true)return blocked();
  if(r.buyMaterials!==true&&item.canUpgrade!==true)return blocked();
  const total=item.upgradeCost+(r.buyMaterials?item.missingMaterialsCost:0);
  return price(total)?entry(`Forja real · ${addCost(total,item.gemCost)}${r.buyMaterials?' (inclui materiais)':''}`,true):blocked()}
 case 'ReactionCollectorGardenHarvestReaction':return garden.eligibility?.canHarvest===true?entry('Colher plantas prontas na horta',true):blocked();
 case 'ReactionCollectorGardenWaterReaction':return garden.eligibility?.canWaterGarden===true?entry('Regar sua horta',true):blocked();
 case 'ReactionCollectorGardenCompostReaction':{
  const stock=(garden.plantStorage||[]).find(x=>x.plantId===r.plantId);
  if(garden.eligibility?.canCompost!==true||!integer(r.quantity)||r.quantity<1||!stock)return blocked();
  return entry(`Compostar ${num(r.quantity)} unidade(s) de planta · consome itens`,true)}
 case 'ReactionCollectorGuildDomainMenuReaction':return c.guildDomain?.isInCity===true?entry(`Domínio da guilda ${safe(c.guildDomain.guildName,45)}`):blocked();
 case 'ReactionCollectorGuildDomainNotaryReaction':{
  const n=c.guildDomainNotary;
  return n?.isChief===true&&n.canAfford===true&&price(n.cost)?entry(`${n.hasDomain?'Transferir':'Comprar'} domínio da guilda · ${num(n.cost)} moedas do tesouro`,true):blocked()}
 case 'ReactionCollectorApartmentBuyReaction':{
  const x=c.apartmentNotary?.forSale;
  return x?.canAfford===true&&price(x.price)?entry(`Comprar apartamento · ${num(x.price)} moedas`,true):blocked()}
 case 'ReactionCollectorApartmentClaimRentReaction':{
  const x=(c.apartmentNotary?.ownedApartments||[]).find(v=>v.apartmentId===r.apartmentId);
  if(!x||x.canClaim!==true||!price(x.accumulatedRent))return blocked();
  const name=models?.map_locations?.[String(x.mapLocationId)]?.name;
  return entry(`Receber ${num(x.accumulatedRent)} moedas de aluguel${name?` · ${safe(name,55)}`:''}`,true)}
 default:return blocked();
 }
}
function shopOption(reaction,data){const r=reaction?.data||{};switch(reaction?.type){
 case 'ReactionCollectorShopCloseReaction':return entry('Fechar loja');
 case 'ReactionCollectorShopItemReaction':{
  if(!integer(r.amount)||r.amount<1||!price(r.price))return blocked();
  const currency=currencyName[data.currency];if(!currency||!price(data.availableCurrency)||r.price>data.availableCurrency)return blocked();
  const label=integer(r.shopItemId)?shopItems[r.shopItemId]:shopItemNames[r.shopItemId];if(!label)return blocked();
  return entry(`${label} · ${num(r.amount)} unidade(s) · ${num(r.price)} ${currency}`,true)}
 default:return blocked();}}
function additionalOption(kind,reaction,data,models){
 const t=reaction?.type,r=reaction?.data||{};
 if(t==='ReactionCollectorRefuseReaction'||t==='ReactionCollectorBuyCategorySlotCancelReaction'||t==='ReactionCollectorEquipCloseReaction')return entry('Cancelar e voltar');
 if(kind==='ReactionCollectorBuyCategorySlotData'&&t==='ReactionCollectorBuyCategorySlotReaction'&&integer(r.categoryId)&&types[r.categoryId])return entry(`Ampliar espaço de ${types[r.categoryId]} · restam ${num(r.remaining)} ampliações`,true);
 if(kind==='ReactionCollectorDailyBonusData'&&t==='ReactionCollectorDailyBonusReaction'){
  const x=r.object,label=itemName(models,x?.itemCategory,x?.id);
  return label?entry(`Escolher ${label} como recompensa diária`,true):blocked();
 }
 if(kind==='ReactionCollectorItemAcceptData'){
  const name=itemName(models,data.itemWithDetails?.itemCategory,data.itemWithDetails?.id);
  if(!name)return blocked();
  if(t==='ReactionCollectorAcceptReaction')return entry(`Receber ${name}`,true);
  if(t==='ReactionCollectorItemAcceptDrinkPotionReaction'&&data.itemWithDetails?.itemCategory===2)return entry(`Beber ${name}`,true);
 }
 if(kind==='ReactionCollectorDrinkData'&&t==='ReactionCollectorDrinkReaction'){
  const name=itemName(models,r.potion?.itemCategory,r.potion?.id);
  return name?entry(`Beber ${name} · consome 1 poção`,true):blocked();
 }
 if(kind==='ReactionCollectorUseTokensData'&&t==='ReactionCollectorAcceptReaction'){
  return integer(data.cost)&&integer(data.playerTokens)&&data.playerTokens>=data.cost?entry(`Acelerar viagem · gastar ${num(data.cost)} tokens`,true):blocked();
 }
 return blocked();
}
function encounterOption(kind,reaction,data,models){
 const t=reaction?.type,r=reaction?.data||{};
 if(t==='ReactionCollectorRefuseReaction')return entry('Recusar e continuar');
 if(t==='ReactionCollectorAcceptReaction')return entry(kind==='ReactionCollectorPveFightData'?'Enfrentar o monstro':'Aceitar o combate',true);
 if(kind==='ReactionCollectorFightChooseActionData'&&t==='ReactionCollectorFightChooseActionReaction'){
  const n=models?.fight_actions?.[String(r.id)], val=typeof n==='string'?n:n?.name;
  return val?entry(safe(val,95)):blocked();
 }
 return blocked();
}
function notification(name,p,models){if(!p||typeof p!=='object')return null;
 switch(name){
 case 'PlayerLevelUpPacket':{
  if(!integer(p.level))return null;
  const lines=[`*✦ NOVO NÍVEL · ${num(p.level)}*`];
  const perks=[['fightUnlocked','Combates desbloqueados'],['guildUnlocked','Guildas desbloqueadas'],['missionSlotUnlocked','Nova vaga de missão'],['pveUnlocked','Expedições PvE disponíveis'],['healthRestored','Vida restaurada'],['statsIncreased','Atributos fortalecidos']].filter(([key])=>p[key]===true).map(([,s])=>`✓ ${s}`);
  const tiers=['classesTier1Unlocked','classesTier2Unlocked','classesTier3Unlocked','classesTier4Unlocked','classesTier5Unlocked'].filter(k=>p[k]===true).length;
  if(tiers)perks.push('✓ Nova etapa de classes');
  if(perks.length)lines.push('',...perks);
  if(Array.isArray(p.discoveredRecipes)&&p.discoveredRecipes.length)lines.push(`Receitas desbloqueadas: ${num(p.discoveredRecipes.length)}`);
  return lines.join('\n')}
 case 'MissionsExpiredPacket':{
  if(!Array.isArray(p.missions)||!p.missions.length)return null;
  return ['*✦ MISSÕES EXPIRADAS*',...p.missions.slice(0,15).map(m=>`• ${missName(models,m)}`),p.missions.length>15?`Outras ${num(p.missions.length-15)} missão(ões) expiradas.`:null].filter(Boolean).join('\n')}
 case 'PlayerDeathPacket':return '*✦ PERSONAGEM DERROTADO*\nSua jornada foi interrompida. Consulte /perfil antes de prosseguir.';
 case 'PlayerReceivePetPacket':{
  if(!integer(p.petTypeId))return null;
  const sex=String(p.petSex).toLowerCase(),key=`${p.petTypeId}_${sex==='f'||sex==='female'?'female':'male'}`;
  const species=models?.pets?.[key],title=safe(species||'Novo companheiro');
  const where=p.giveInGuild?'Enviado ao abrigo da guilda.':p.giveInPlayerInv?'Agora está com você.':p.noRoomInGuild?'Sem espaço no abrigo da guilda.':'Destino do companheiro não informado.';
  return `*✦ NOVO COMPANHEIRO*\n${title}\n${where}`}
 case 'GuildLevelUpPacket':return integer(p.level)?`*✦ GUILDA EM ASCENSÃO*\n${safe(p.guildName,80)} chegou ao nível ${num(p.level)}.`:null;
 case 'KingChallengeTierReachedPacket':{
  if(!integer(p.tier))return null;
  const a=p.reward||{};return ['*✦ DESAFIO DO REI*',`Patamar alcançado: ${num(p.tier)}`,integer(p.crossedTiers)?`Patamares conquistados: ${num(p.crossedTiers)}`:null,['Moedas','Tokens','Gemas'].map((k,i)=>Number.isFinite([a.money,a.tokens,a.gems][i])?`${k} +${num([a.money,a.tokens,a.gems][i])}`:null).filter(Boolean).join(' · '),price(p.pointsToNextTier)?`Próximo patamar: faltam ${num(p.pointsToNextTier)} pontos`:null].filter(Boolean).join('\n')}
 case 'PlayerLeavePveIslandPacket':return price(p.moneyLost)&&price(p.guildPointsLost)?`*✦ RETORNO DA ILHA*\nMoedas perdidas: ${num(p.moneyLost)}\nPontos de guilda perdidos: ${num(p.guildPointsLost)}`:null;
 case 'ItemFoundPacket':{
  const i=p.itemWithDetails;const label=itemName(models,i?.itemCategory,i?.id);
  return label?`*✦ ITEM ENCONTRADO*\n${label}`:'*✦ ITEM ENCONTRADO*\nUm item foi registrado no inventário. Confira /inventario.'}
 case 'CommandShopClosed':return '*✦ LOJA*\nVocê encerrou o atendimento.';
 case 'CommandShopNotEnoughCurrency':return '*✦ COMPRA NÃO REALIZADA*\nSaldo insuficiente. Nenhuma nova tentativa foi enviada pelo WhatsApp.';
 case 'CommandShopGenericPurchase':return `*✦ COMPRA CONCLUÍDA*\n${safe(integer(p.shopItemId)?shopItems[p.shopItemId]:(shopItemNames[p.shopItemId]||'Item'),60)}${integer(p.amount)?` · ${num(p.amount)} unidade(s)`:''}`;
 case 'CommandShopNoPlantSlotAvailable':return '*✦ COMPRA NÃO CONCLUÍDA*\nNão há espaço para receber as plantas.';
 case 'CommandShopNoGardenForRemoteHarvestTalisman':return '*✦ COMPRA NÃO CONCLUÍDA*\nÉ necessário ter uma horta para esse talismã.';
 case 'CommandShopBoughtTooMuchDailyPotions':return '*✦ LIMITE DE POÇÕES*\nVocê atingiu o limite diário dessa compra.';
 case 'CommandShopBadgeBought':return '*✦ COMPRA CONCLUÍDA*\nInsígnia adquirida.';
 case 'CommandShopAlreadyHaveBadge':return '*✦ INSÍGNIA*\nVocê já possui essa insígnia.';
 case 'CommandShopNoAlterationToHeal':return '*✦ CURA*\nNão há alteração de estado para curar.';
 case 'CommandShopHealAlterationDone':return '*✦ CURA REALIZADA*\nO efeito foi tratado pelo motor.';
 default:return null;
 }
}
module.exports={cityOption,shopOption,encounterOption,additionalOption,notification,safe,itemName};
