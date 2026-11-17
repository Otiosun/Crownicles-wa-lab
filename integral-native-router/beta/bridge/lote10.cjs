'use strict';
/** Lote 10 — comandos nativos com autorização explícita e respostas de serviços.
 * Nenhuma recompensa, custo, elegibilidade, tempo ou regra de cidade é calculado no gateway.
 * O único executor de alterações no jogo é o Core Crownicles 6.2.0.b.
 */
const crypto=require('node:crypto');
const {safe}=require('./lote04.cjs');
const nf=n=>Number.isFinite(n)?n.toLocaleString('pt-BR',{maximumFractionDigits:2}):'—';
const displayName=x=>safe(x,70).replace(/\/\w+(?:\s+[^\/]+)?/g,'').replace(/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/gi,'').trim();
const count=n=>Number.isSafeInteger(n)&&n>=0;
const positive=n=>Number.isFinite(n)&&n>=0;
const labels={
  resurrection:{title:'✦ RETORNAR À VIDA',details:'Renascer pode reduzir seus pontos e reiniciar a viagem. O motor decide a perda real. Não execute se não deseja aceitar essa consequência.',choice:'Autorizar renascimento e possível perda de pontos',request:'CommandRespawnPacketReq'},
  league:{title:'✦ RECOMPENSA DA LIGA',details:'Solicita a recompensa da temporada anterior, quando disponível. O motor verifica dia, nível, localização, elegibilidade e recebimento anterior; uma concessão pode mudar seus recursos.',choice:'Solicitar a recompensa da liga agora',request:'CommandLeagueRewardPacketReq'},
  guildDaily:{title:'✦ RECOMPENSA DA GUILDA',details:'A ativação altera a recarga da guilda e pode conceder recompensas a vários membros. Faça isso somente com autorização dos participantes. O motor controla a elegibilidade.',choice:'Autorizar a recompensa diária da guilda',request:'CommandGuildDailyPacketReq'}
};
const alias=new Map([
 ['/versao','version'],['/versão','version'],['/versaocore','version'],
 ['/ressuscitar','resurrection'],['/renascer','resurrection'],
 ['/recompensaliga','league'],['/premioliga','league'],
 ['/diarioguilda','guildDaily'],['/bonusguilda','guildDaily'],['/bônusguilda','guildDaily']
]);
function resolveCommand(text){const cmd=alias.get(String(text||'').trim().toLocaleLowerCase('pt-BR'));
 if(cmd==='version')return {name:'CommandUpdatePacketReq',data:{}};
 if(cmd&&Object.hasOwn(labels,cmd))return {localAuthorization:cmd};
 return null;
}
function makeMenu(key){const d=labels[key];if(!d)return null;
 return {id:'wa-authorize-'+crypto.randomUUID(),endTime:Date.now()+90000,type:'LocalNativeAuthorization',title:d.title,story:d.details,
  options:[{label:d.choice,supported:true,requiresConfirmation:true,kind:'nativeAuth',key},
           {label:'Cancelar sem enviar comando ao jogo',supported:true,requiresConfirmation:false,kind:'nativeCancel'}]};
}
function authorizedCommand(menu,choice){if(menu?.type!=='LocalNativeAuthorization'||!String(menu.id||'').startsWith('wa-authorize-')||!Number.isFinite(menu.endTime)||Date.now()>=menu.endTime||!Array.isArray(menu.options)||menu.options.length!==2||menu.options[0]!==choice||choice?.kind!=='nativeAuth')return null;
 const label=labels[choice.key];if(!label||choice.requiresConfirmation!==true||menu.title!==label.title||menu.options[1]?.kind!=='nativeCancel')return null;
 return {name:label.request,data:{}};
}
const errorMessages={
 CommandRespawnErrorAlreadyAlive:'*✦ RETORNO À VIDA*\nVocê não está morto. Nenhuma perda de pontos foi aplicada.',
 CommandLeagueRewardNoPointsPacketRes:'*✦ RECOMPENSA DA LIGA*\nVocê não possui pontos da temporada anterior para resgatar.',
 CommandLeagueRewardAlreadyClaimedPacketRes:'*✦ RECOMPENSA DA LIGA*\nA recompensa dessa temporada já foi recebida.',
 CommandGuildDailyPveIslandErrorPacket:'*✦ RECOMPENSA DA GUILDA*\nA recompensa da guilda não pode ser ativada nesta ilha.',
 CommandReportErrorNoMonsterRes:'*✦ EXPLORAÇÃO*\nO inimigo não está mais disponível.',
 CommandReportRefusePveFightRes:'*✦ CONFRONTO RECUSADO*\nVocê não iniciou esse combate.',
 CommandReportUseTokensRefusePacketRes:'*✦ VIAGEM*\nVocê decidiu não gastar tokens.',
 CommandReportTokenMerchantTooMuchRes:'*✦ MERCADOR*\nO limite dessa negociação foi atingido.',
 CommandReportTokenMerchantFullRes:'*✦ MERCADOR*\nVocê já está no limite de tokens permitido.',
 CommandReportTokenMerchantRefuseRes:'*✦ MERCADOR*\nA negociação foi recusada.',
 CommandReportTokenMerchantCannotAffordRes:'*✦ MERCADOR*\nVocê não possui recursos suficientes.',
 CommandReportTokenMerchantCharityAlreadyUsedRes:'*✦ MERCADOR*\nA ajuda gratuita já foi utilizada.',
 CommandReportBuyHealRefusePacketRes:'*✦ CURA*\nVocê recusou o tratamento.',
 CommandReportBuyHealNoAlterationPacketRes:'*✦ CURA*\nNão há alteração para curar.',
 CommandReportBuyHealCannotHealOccupiedPacketRes:'*✦ CURA*\nSeu estado atual impede o tratamento.',
 CommandReportItemCannotBeEnchantedRes:'*✦ ENCANTAMENTO*\nO item não pode receber esse encantamento.',
 CommandReportUpgradeItemMissingMaterialsRes:'*✦ MELHORIA*\nFaltam materiais para melhorar o equipamento.',
 CommandReportUpgradeItemMaxLevelRes:'*✦ MELHORIA*\nO item já atingiu o nível máximo permitido.',
 CommandReportEquipmentChangedRes:'*✦ EQUIPAMENTO ALTERADO*\nO item mudou desde a abertura da escolha. Reabra a consulta antes de tentar novamente.',
 CommandReportBlacksmithMissingMaterialsRes:'*✦ FERREIRO*\nFaltam materiais para essa melhoria.',
 CommandReportRoyalBlacksmithMissingMaterialsRes:'*✦ FERREIRO REAL*\nFaltam materiais para essa melhoria.',
 CommandReportRoyalBlacksmithMockBadgeGivenRes:'*✦ FERREIRO REAL*\nUma insígnia foi concedida pelo motor.',
 CommandReportRoyalBlacksmithMockBadgeAlreadyOwnedRes:'*✦ FERREIRO REAL*\nVocê já possui a insígnia especial.',
 CommandReportHomeBedAlreadyFullRes:'*✦ DESCANSO*\nVocê já está com a vida completa.',
 CommandReportCookingNoWoodRes:'*✦ COZINHA*\nNão há madeira disponível para cozinhar.'
};
const cityTitles={
 CommandReportUseTokensAcceptPacketRes:'VIAGEM ACELERADA',CommandReportTokenMerchantBoughtRes:'NEGOCIAÇÃO',CommandReportTokenMerchantCharityRes:'AJUDA RECEBIDA',CommandReportBuyHealAcceptPacketRes:'CURA',CommandReportEatInnMealRes:'REFEIÇÃO',CommandReportSleepRoomRes:'DESCANSO',CommandReportBuyHomeRes:'CASA ADQUIRIDA',CommandReportUpgradeHomeRes:'CASA MELHORADA',CommandReportMoveHomeRes:'CASA TRANSFERIDA',CommandReportUpgradeItemRes:'EQUIPAMENTO MELHORADO',CommandReportBlacksmithUpgradeRes:'FORJA CONCLUÍDA',CommandReportScrapDealerRecycleRes:'RECICLAGEM',CommandReportRoyalBlacksmithUpgradeRes:'FORJA REAL',CommandReportHomeBedRes:'DESCANSO EM CASA',CommandReportGardenHarvestRes:'COLHEITA',CommandReportGardenPlantRes:'PLANTIO',CommandReportGardenWaterRes:'HORTA REGADA',CommandReportGardenCompostRes:'COMPOSTAGEM',CommandReportGuildDomainPurchaseRes:'DOMÍNIO ADQUIRIDO',CommandReportGuildDomainRelocateRes:'DOMÍNIO TRANSFERIDO',CommandReportGuildDomainUpgradeRes:'DOMÍNIO MELHORADO',CommandReportFoodShopBuyRes:'RACÕES DA GUILDA',CommandReportGuildDomainDepositTreasuryRes:'TESOURO DA GUILDA',CommandReportApartmentBuyRes:'APARTAMENTO ADQUIRIDO',CommandReportApartmentClaimRentRes:'ALUGUEL RECEBIDO',CommandReportEnchanterDisenchantRes:'ENCANTAMENTO REMOVIDO',CommandReportItemEnchantedRes:'ITEM ENCANTADO',CommandReportBlacksmithEnchantmentTransferRes:'ENCANTAMENTO TRANSFERIDO',CommandReportCookingCraftRes:'RECEITA PREPARADA',CommandReportCookingIgniteRes:'FOGO ACESO',CommandReportCookingReviveRes:'FOGO REACENDIDO',CommandReportCookingMenuRes:'COZINHA',CommandReportCookingPinRes:'RECEITA FIXADA',CommandReportCookingUnpinRes:'RECEITA LIBERADA',CommandReportCookingSetSpecialtyRes:'ESPECIALIDADE DEFINIDA',CommandReportCookingRemoveSpecialtyRes:'ESPECIALIDADE REMOVIDA',CommandReportGardenErrorRes:'HORTA INDISPONÍVEL',CommandReportPlantTransferRes:'ARMAZENAMENTO DE PLANTAS',CommandReportHomeChestActionRes:'BAÚ DA CASA',CommandReportGuildDomainUpgradeErrorRes:'DOMÍNIO INDISPONÍVEL',CommandReportFoodShopBuyErrorRes:'COMPRA RECUSADA',CommandReportGuildDomainDepositTreasuryErrorRes:'DEPÓSITO RECUSADO'
};
const amountFields={score:'Pontos',xp:'XP',money:'Moedas',personalXp:'XP pessoal',guildXp:'XP da guilda',guildPoints:'Pontos da guilda',commonFood:'Ração comum',heal:'Vida recuperada',advanceTime:'Tempo avançado',tokensSpent:'Tokens consumidos',energy:'Energia',health:'Vida',moneySpent:'Moedas gastas',cost:'Custo em moedas',newItemLevel:'Novo nível de melhoria',totalCost:'Moedas gastas',gemCost:'Gemas gastas',upgradeCost:'Custo de melhoria',materialsCost:'Custo dos materiais',moneyGained:'Moedas obtidas',newTreasury:'Tesouro atualizado',newPlayerMoney:'Moedas restantes',newFoodStock:'Estoque atualizado',amountBought:'Quantidade comprada',treasuryDeposited:'Moedas depositadas',rentClaimed:'Aluguel recebido',slotsWatered:'Canteiros regados',plantsHarvested:'Plantas colhidas',plantsComposted:'Plantas compostadas',quantity:'Quantidade',gardenSlot:'Canteiro',xpGained:'XP de cozinha',cookingXpGained:'XP de cozinha',newLevel:'Novo nível',lossScore:'Pontos perdidos'};
const fieldsByPacket={
 CommandReportUseTokensAcceptPacketRes:['tokensSpent'],CommandReportTokenMerchantBoughtRes:['amount'],CommandReportTokenMerchantCharityRes:['amount'],CommandReportBuyHealAcceptPacketRes:['healPrice'],CommandReportEatInnMealRes:['energy','moneySpent'],CommandReportSleepRoomRes:['health','moneySpent'],CommandReportBuyHomeRes:['cost'],CommandReportUpgradeHomeRes:['cost'],CommandReportMoveHomeRes:['cost','rentDeducted'],CommandReportUpgradeItemRes:['newItemLevel'],CommandReportBlacksmithUpgradeRes:['newItemLevel','totalCost'],CommandReportScrapDealerRecycleRes:['moneyGained'],CommandReportRoyalBlacksmithUpgradeRes:['upgradeCost','materialsCost','gemCost'],CommandReportHomeBedRes:['health'],CommandReportGardenHarvestRes:['plantsHarvested','plantsComposted'],CommandReportGardenPlantRes:['gardenSlot'],CommandReportGardenWaterRes:['slotsWatered','slotsBecameReady'],CommandReportGardenCompostRes:['quantity'],CommandReportGuildDomainPurchaseRes:['cost'],CommandReportGuildDomainRelocateRes:['cost'],CommandReportGuildDomainUpgradeRes:['newLevel','cost','newTreasury','xpGained'],CommandReportFoodShopBuyRes:['amountBought','totalCost','newFoodStock','newTreasury'],CommandReportGuildDomainDepositTreasuryRes:['treasuryDeposited','newPlayerMoney','newTreasury'],CommandReportApartmentBuyRes:['cost'],CommandReportApartmentClaimRentRes:['rentClaimed'],CommandReportBlacksmithEnchantmentTransferRes:['cost'],CommandReportCookingCraftRes:['cookingXpGained']
};
function renderPacket(name,p={}){
 if(name==='CommandUpdatePacketRes'){const v=String(p.coreVersion||'');return '*✦ VERSÃO DO MOTOR*\n'+(/^[a-z0-9][a-z0-9.+_-]{0,39}$/i.test(v)?v:'Versão não informada pelo motor.');}
 if(name==='CommandRespawnPacketRes')return '*✦ RETORNO À VIDA*\nO motor confirmou o renascimento.'+(positive(p.lostScore)?`\nPontos perdidos: ${nf(p.lostScore)}.`:'');
 if(name==='CommandLeagueRewardNotSundayPacketRes')return '*✦ RECOMPENSA DA LIGA*\nO resgate só pode ocorrer no dia permitido pelo motor.';
 if(name==='CommandLeagueRewardSuccessPacketRes')return ['*✦ RECOMPENSA DA LIGA RECEBIDA*',...[['score','Pontos'],['money','Moedas'],['xp','XP'],['gloryPoints','Glória da temporada']].filter(([k])=>positive(p[k])).map(([k,label])=>`${label}: ${nf(p[k])}`),count(p.rank)&&p.rank>0?`Sua posição: ${p.rank}º`:null].filter(Boolean).join('\n');
 if(name==='CommandGuildDailyCooldownErrorPacket')return '*✦ RECOMPENSA DA GUILDA*\nAinda está em recarga.'+(positive(p.remainingTime)?`\nAguarde aproximadamente ${Math.ceil(p.remainingTime/60000)} minuto(s).`:'');
 if(name==='CommandGuildDailyRewardPacket')return ['*✦ RECOMPENSA DA GUILDA*',displayName(p.guildName)||'Guilda',...[['money','Moedas'],['personalXp','XP pessoal'],['guildXp','XP da guilda'],['guildPoints','Pontos da guilda'],['commonFood','Ração comum'],['heal','Vida recuperada']].filter(([k])=>positive(p[k])).map(([k,lab])=>`${lab}: ${nf(p[k])}`),p.fullHeal===true?'A guilda recebeu cura completa.':null,p.pet?'O motor concedeu um companheiro à guilda.':null,p.badge||p.superBadge?'Uma insígnia foi conquistada.':null].filter(Boolean).join('\n');
 if(Object.hasOwn(errorMessages,name))return errorMessages[name];
 if(name==='CommandReportNotEnoughMoneyRes')return '*✦ RECURSOS INSUFICIENTES*'+(positive(p.missingMoney)?`\nFaltam ${nf(p.missingMoney)} moedas.`:'\nO motor recusou o gasto.');
 if(name==='CommandReportEnchantNotEnoughCurrenciesRes')return ['*✦ RECURSOS INSUFICIENTES*',positive(p.missingMoney)?`Faltam ${nf(p.missingMoney)} moedas.`:null,positive(p.missingGems)?`Faltam ${nf(p.missingGems)} gemas.`:null].filter(Boolean).join('\n');
 if(name==='CommandReportBlacksmithNotEnoughMoneyRes'||name==='CommandReportRoyalBlacksmithNotEnoughMoneyRes')return '*✦ FERREIRO*\nFaltam moedas para concluir a melhoria.'+(positive(p.missingMoney)?`\nFaltam: ${nf(p.missingMoney)} moedas.`:'');
 if(name==='CommandReportRoyalBlacksmithNotEnoughGemsRes')return '*✦ FERREIRO REAL*\nFaltam gemas para concluir a melhoria.'+(positive(p.missingGems)?`\nFaltam: ${nf(p.missingGems)} gemas.`:'');
 if(name==='CommandReportGardenCompostNotEnoughPlantsRes')return '*✦ COMPOSTAGEM*\nNão há plantas suficientes para a quantidade escolhida.';
 if(name==='CommandReportApartmentClaimRentTooLowRes')return '*✦ ALUGUEL*\nAinda não há renda suficiente para o resgate.';
 if(name==='CommandReportApartmentAlreadyOwnedRes')return '*✦ APARTAMENTO*\nVocê já possui um apartamento nesta cidade.';
 if(name==='CommandReportApartmentRequiresHomeRes')return '*✦ APARTAMENTO*\nÉ necessário possuir uma casa antes de comprar um apartamento.';
 if(name==='CommandReportBedCooldownRes'||name==='CommandReportEatInnMealCooldownRes')return '*✦ DESCANSO*\nEste serviço ainda está em recarga.';
 const title=cityTitles[name];if(!title)return null;
 const rows=[`*✦ ${name==='CommandReportCookingCraftRes'&&p.success===false?'RECEITA NÃO PRODUZIDA':title}*`];
 if(/ErrorRes$/.test(name))rows.push('O motor recusou a operação.');
 if(typeof p.success==='boolean')rows.push(p.success?'O motor confirmou a operação.':'O motor recusou a operação. Nenhuma nova tentativa será enviada automaticamente.');
 if(p.error&&p.success!==true)rows.push('Consulte o estado do item ou serviço antes de tentar novamente.');
 for(const k of fieldsByPacket[name]||[]){if(positive(p[k]))rows.push(`${amountFields[k]||k}: ${nf(p[k])}`)}
 if(name==='CommandReportCookingCraftRes'&&p.success===true)rows.push('Consulte o inventário e a cozinha para conferir o item preparado.');
 if(name==='CommandReportCookingCraftRes'&&p.success===false)rows.push('A receita não foi produzida. Consulte a cozinha antes de tentar novamente.');
 if(name==='CommandReportGardenErrorRes'&&!p.error)rows.push('O motor recusou a ação de horta.');
 if(name==='CommandReportHomeChestActionRes'&&p.success===true)rows.push('Consulte o baú e o inventário para conferir a alteração.');
 return rows.join('\n');
}
module.exports={resolveCommand,makeMenu,authorizedCommand,renderPacket,labels,cityTitles};
