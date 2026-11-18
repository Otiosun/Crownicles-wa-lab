'use strict';
// Pure presentation validators: Crownicles 6.2.0.b @64d08c05; no game mutation.
module.exports=(function createWorld(){
 'use strict';
 const RC='ReactionCollector',A=RC+'AcceptReaction',R=RC+'RefuseReaction';
 const K={fight:RC+'FightData',pve:RC+'PveFightData',action:RC+'FightChooseActionData',pet:RC+'FightPetData',city:RC+'CityData'};
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k),obj=o=>o!==null&&typeof o==='object'&&!Array.isArray(o),exact=(o,keys)=>obj(o)&&Object.keys(o).length===keys.length&&keys.every(k=>own(o,k));
 const n=x=>Number.isFinite(x)&&x>=0,integer=x=>Number.isSafeInteger(x)&&x>=0,pos=x=>integer(x)&&x>0,cat=x=>integer(x)&&x<=3,key=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(x),uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(x);
 const clean=x=>typeof x==='string'?x.replace(/[\x00-\x1f\x7f<>*_~`@]/g,' ').replace(/\b[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\b/gi,'').replace(/\s+/g,' ').trim().slice(0,130):'';
 const local=(o,k)=>obj(o)&&own(o,k)?clean(typeof o[k]==='string'?o[k]:(o[k]?.name||o[k]?.name_one)):'';
 const entry=(label,requiresConfirmation=false)=>({label,supported:true,requiresConfirmation}),blocked=()=>({label:'Indisponível: contrato não validado',supported:false,requiresConfirmation:false});
 const unique=(a,f)=>{if(!Array.isArray(a))return null;const m=a.filter(x=>obj(x)&&f(x));return m.length===1?m[0]:null};
 const shape=p=>obj(p)&&obj(p.data)&&obj(p.data.data)&&Array.isArray(p.reactions)&&p.reactions.length&&p.reactions.length<=220;
 const validRx=x=>obj(x)&&typeof x.type==='string'&&obj(x.data);
 const playerActions=new Set('benediction boomerangAttack breathTakingAttack canonAttack chargeChargingAttack chargeUltimateAttack chargingAttack concentration counterAttack cursedAttack darkAttack defenseBuff divineAttack energeticAttack fireAttack getDirty guildAttack heavyAttack intenseAttack none piercingAttack poisonousAttack powerfulAttack protection quickAttack rageExplosion ramAttack resting sabotageAttack shieldAttack simpleAttack ultimateAttack'.split(' '));
 const petActions=Object.freeze({fistHit:'Dar um soco',runAway:'Fugir',focusEnergy:'Concentrar energia e atacar',intimidate:'Intimidar a criatura',baitWithMeat:'Distrair com carne',baitWithVegetables:'Distrair com um vegetal',provoke:'Provocar a fera',doNothing:'Não fazer nada',lastEffort:'Atacar com todas as forças',usePlayerPet:'Chamar seu companheiro',protect:'Proteger-se',playDead:'Fingir de morto',scream:'Gritar',prayGod:'Rezar',attackLeft:'Atacar pela esquerda',attackRight:'Atacar pela direita',helpFromMates:'Chamar os membros da guilda',channelRage:'Canalizar a fúria',stealthApproach:'Aproximar-se furtivamente',analyze:'Analisar os pontos fracos',guildBanner:'Erguer o estandarte da guilda',throwRock:'Arremessar uma pedra para longe',battleCry:'Soltar um grito de guerra',feint:'Fintar',shareSoup:'Usar o aroma da sopa'});
 const stats=s=>obj(s)&&integer(s.classId)&&n(s.fightRanking?.glory)&&n(s.energy?.value)&&n(s.energy?.max)&&['attack','defense','speed'].every(k=>n(s[k]))&&['base','max','regen'].every(k=>n(s.breath?.[k]));
 function combat(p,models,playerId){
  if(!shape(p)||!p.reactions.every(validRx))return null;
  const kind=p.data.type,d=p.data.data,rx=p.reactions;
  if(kind===K.fight||kind===K.pve){
   if(rx.length!==2||rx.filter(x=>x.type===A).length!==1||rx.filter(x=>x.type===R).length!==1||rx.some(x=>!exact(x.data,[])))return null;
   let title,story;
   if(kind===K.fight){const s=d.playerStats;if(!stats(s))return null;title='⚔️ DESAFIO DE COMBATE';story=`Atributos informados pelo Core:\nEnergia: ${s.energy.value}/${s.energy.max} · ATQ ${s.attack} · DEF ${s.defense} · VEL ${s.speed}\nFôlego: ${s.breath.base}/${s.breath.max} · regeneração ${s.breath.regen}`;}
   else{const m=d.monster;if(!obj(m)||!key(m.id)||!integer(d.mapId)||!pos(m.level)||!['energy','attack','defense','speed'].every(k=>n(m[k])))return null;title='⚔️ ENCONTRO HOSTIL';story=`${local(models?.monsters,m.id)||'Criatura hostil'} · Nível ${m.level}\nEnergia: ${m.energy} · ATQ ${m.attack} · DEF ${m.defense} · VEL ${m.speed}`;}
   return {kind,title,story,options:rx.map(x=>x.type===A?entry('Aceitar o confronto',true):entry('Recusar o confronto'))};
  }
  if(kind!==K.action&&kind!==K.pet)return null;
  const pet=kind===K.pet;
  if(rx.length>40)return null;
  if(pet?(!exact(d,['petId','isFemale'])||!pos(d.petId)||typeof d.isFemale!=='boolean'):(!exact(d,['fightId','fighterKeycloakId'])||!key(d.fightId)||!uuid(d.fighterKeycloakId)||!uuid(playerId)||d.fighterKeycloakId!==playerId))return null;
  const seen=new Set(),options=[];
  for(const x of rx){
   const id=pet?x.data.actionId:x.data.id,hasMultiplier=own(x.data,'powerMultiplier');
   if(x.type!==RC+(pet?'FightPetReaction':'FightChooseActionReaction')||!exact(x.data,pet?['actionId']:hasMultiplier?['id','powerMultiplier']:['id'])||!key(id)||seen.has(id)||(!pet&&hasMultiplier&&!n(x.data.powerMultiplier)))return null;
   seen.add(id);
   const label=pet?(own(petActions,id)?petActions[id]:''):playerActions.has(id)?(local(models?.fight_actions,id)||(id==='none'?'Não agir':'')):'';
   options.push(label?entry(label+(!pet&&hasMultiplier?` · potência ×${x.data.powerMultiplier}`:''),pet):blocked());
  }
  const species=pet?(local(models?.pets,`${d.petId}_${d.isFemale?'female':'male'}`)||local(models?.pets,String(d.petId))||'Animal selvagem'):'';
  return {kind,title:pet?'⚔️ ANIMAL SELVAGEM':'⚔️ SUA VEZ',story:pet?`${species} bloqueia seu caminho. A escolha pode ter consequências; o Core determina o resultado.`:'Escolha uma ação para o seu turno. O Core controla fôlego, dano, efeito e tempo.',options,...(!pet?{restrictedToPlayerId:d.fighterKeycloakId}:{})};
 }
 function petResult(p){return obj(p)&&typeof p.isSuccess==='boolean'&&typeof p.isFemale==='boolean'&&own(petActions,p.fightPetActionId)?`*✦ ENCONTRO COM ANIMAL SELVAGEM*\n${petActions[p.fightPetActionId]}: ${p.isSuccess?'ação bem-sucedida.':'a ação não teve sucesso.'}\nConsulte /perfil para conferir as consequências registradas pelo Core.`:null;}
 const kinds=s=>new Set(s.split(' ').map(x=>RC+x+'Reaction'));
 const empty=kinds('ExitCity Refuse CityBuyHome CityUpgradeHome CityMoveHome HomeMenu HomeBed HomeChestClose BlacksmithMenu ScrapDealerMenu RoyalBlacksmithMenu GardenHarvest GardenWater GuildDomainMenu GuildDomainNotary ApartmentBuy');
 const home=kinds('Refuse HomeMenu HomeBed HomeChestClose UpgradeItem GardenHarvest GardenWater GardenCompost');
 const slots=kinds('Enchant EnchanterDisenchant UpgradeItem'),forge=kinds('BlacksmithUpgrade RoyalBlacksmithUpgrade');
 const cityTypes=new Set([...empty,...slots,...forge,...kinds('InnMeal InnRoom CityShop BlacksmithEnchantmentTransfer ScrapDealerRecycle GardenCompost ApartmentClaimRent')]);
 const nav=kinds('Refuse ExitCity CityShop HomeMenu HomeChestClose BlacksmithMenu ScrapDealerMenu RoyalBlacksmithMenu GuildDomainMenu');
 const slotRef=(a,v)=>unique(a,x=>x.slot===v.slot&&x.category===v.itemCategory),details=x=>obj(x?.details)&&pos(x.details.id),money=(...a)=>a.every(n);
 function cityShape(r){
  if(!validRx(r)||!cityTypes.has(r.type))return false;
  const t=r.type,v=r.data;
  if(empty.has(t))return exact(v,[]);
  if(slots.has(t))return exact(v,['slot','itemCategory'])&&integer(v.slot)&&cat(v.itemCategory);
  if(forge.has(t))return exact(v,['slot','itemCategory','buyMaterials'])&&integer(v.slot)&&cat(v.itemCategory)&&typeof v.buyMaterials==='boolean';
  switch(t){
   case RC+'InnMealReaction':return exact(v,['innId','meal'])&&key(v.innId)&&exact(v.meal,['mealId','price','energy'])&&key(v.meal.mealId)&&money(v.meal.price,v.meal.energy);
   case RC+'InnRoomReaction':return exact(v,['innId','room'])&&key(v.innId)&&exact(v.room,['roomId','price','health'])&&key(v.room.roomId)&&money(v.room.price,v.room.health);
   case RC+'CityShopReaction':return exact(v,['shopId'])&&key(v.shopId);
   case RC+'BlacksmithEnchantmentTransferReaction':return exact(v,['sourceSlot','targetSlot','itemCategory'])&&integer(v.sourceSlot)&&integer(v.targetSlot)&&v.sourceSlot!==v.targetSlot&&cat(v.itemCategory);
   case RC+'ScrapDealerRecycleReaction':return exact(v,['slot','itemCategory','itemId'])&&integer(v.slot)&&cat(v.itemCategory)&&pos(v.itemId);
   case RC+'GardenCompostReaction':return exact(v,['plantId','quantity'])&&pos(v.plantId)&&v.plantId<=10&&[1,5].includes(v.quantity);
   case RC+'ApartmentClaimRentReaction':return exact(v,['apartmentId'])&&pos(v.apartmentId);
   default:return false;
  }
 }
 function sig(r){if(!cityShape(r))return null;const t=r.type,v=r.data;if(t===RC+'InnMealReaction')return JSON.stringify([t,v.innId,v.meal.mealId]);if(t===RC+'InnRoomReaction')return JSON.stringify([t,v.innId,v.room.roomId]);return JSON.stringify([t,...Object.keys(v).sort().map(k=>[k,v[k]])]);}
 function cityAllowed(r,c){
  if(!cityShape(r)||!obj(c)||c.gardenOnly!==undefined&&typeof c.gardenOnly!=='boolean')return false;
  const t=r.type,v=r.data,h=c.home||{},o=h.owned||{},g=o.garden||{};
  if(c.gardenOnly===true&&!home.has(t))return false;
  switch(t){
   case RC+'ExitCityReaction':return c.gardenOnly!==true;
   case R:return true;
   case RC+'InnMealReaction':{const inn=unique(c.inns,x=>x.innId===v.innId),x=unique(inn?.meals,x=>x.mealId===v.meal.mealId);return !!x&&x.price===v.meal.price&&x.energy===v.meal.energy;}
   case RC+'InnRoomReaction':{const inn=unique(c.inns,x=>x.innId===v.innId),x=unique(inn?.rooms,x=>x.roomId===v.room.roomId);return !!x&&x.price===v.room.price&&x.health===v.room.health;}
   case RC+'CityShopReaction':{const x=unique(c.shops,x=>x.shopId===v.shopId);return !!x&&(x.isEmpty===undefined||x.isEmpty===false);}
   case RC+'CityBuyHomeReaction':return h.manage?.canBuy===true&&money(h.manage.newPrice,h.manage.currentMoney)&&h.manage.newPrice<=h.manage.currentMoney;
   case RC+'CityUpgradeHomeReaction':return h.manage?.canUpgrade===true&&money(h.manage.upgrade?.price,h.manage.currentMoney)&&h.manage.upgrade.price<=h.manage.currentMoney;
   case RC+'CityMoveHomeReaction':return h.manage?.canMove===true&&money(h.manage.movePrice,h.manage.currentMoney)&&h.manage.movePrice<=h.manage.currentMoney;
   case RC+'HomeMenuReaction':return obj(h.owned);
   case RC+'HomeBedReaction':return obj(h.owned)&&g.accessMode!=='readOnly'&&(!c.gardenOnly||g.accessMode==='full');
   case RC+'HomeChestCloseReaction':return obj(o.chest);
   case RC+'EnchantReaction':{const e=c.enchanter,x=slotRef(e?.enchantableItems,v),cost=e?.enchantmentCost;return details(x)&&money(cost?.money,cost?.gems,e.playerMoney,e.playerGems)&&cost.money<=e.playerMoney&&cost.gems<=e.playerGems;}
   case RC+'EnchanterDisenchantReaction':return details(slotRef(c.enchanter?.disenchantableItems,v));
   case RC+'UpgradeItemReaction':{const x=slotRef(o.upgradeStation?.upgradeableItems,v);return details(x)&&x.canUpgrade===true&&pos(x.nextLevel)&&g.accessMode!=='readOnly'&&(!c.gardenOnly||g.accessMode==='full');}
   case RC+'BlacksmithMenuReaction':return obj(c.blacksmith);
   case RC+'RoyalBlacksmithMenuReaction':return obj(c.royalBlacksmith);
   case RC+'ScrapDealerMenuReaction':return obj(c.scrapDealer);
   case RC+'BlacksmithUpgradeReaction':
   case RC+'RoyalBlacksmithUpgradeReaction':{const royal=t===RC+'RoyalBlacksmithUpgradeReaction',s=royal?c.royalBlacksmith:c.blacksmith,x=slotRef(s?.upgradeableItems,v);if(!details(x)||!money(x.upgradeCost,s.playerMoney)||!(v.buyMaterials?x.canBuyAndUpgrade===true:x.canUpgrade===true)||v.buyMaterials&&!n(x.missingMaterialsCost))return false;const total=x.upgradeCost+(v.buyMaterials?x.missingMaterialsCost:0);return n(total)&&total<=s.playerMoney&&(!royal||(s.status==='ready'&&money(x.gemCost,s.playerGems)&&x.gemCost<=s.playerGems));}
   case RC+'BlacksmithEnchantmentTransferReaction':{const s=c.blacksmith,x=unique(s?.enchantmentTransfers,x=>x.slot===v.sourceSlot&&x.category===v.itemCategory),y=unique(x?.targets,x=>x.slot===v.targetSlot);return details(x)&&details(y)&&y.canAfford===true&&money(y.cost,s.playerMoney)&&y.cost<=s.playerMoney;}
   case RC+'ScrapDealerRecycleReaction':{const x=slotRef(c.scrapDealer?.recyclableItems,v);return details(x)&&x.itemId===v.itemId&&x.details.id===v.itemId&&n(x.recoveredMoney);}
   case RC+'GardenHarvestReaction':return ['full','readOnly'].includes(g.accessMode)&&g.eligibility?.canHarvest===true;
   case RC+'GardenWaterReaction':return g.accessMode==='full'&&g.eligibility?.canWaterGarden===true;
   case RC+'GardenCompostReaction':{const x=unique(g.plantStorage,x=>x.plantId===v.plantId);return g.accessMode==='full'&&g.eligibility?.canCompost===true&&!!x&&integer(x.quantity)&&x.quantity>=v.quantity;}
   case RC+'GuildDomainMenuReaction':return c.guildDomain?.isInCity===true;
   case RC+'GuildDomainNotaryReaction':{const x=c.guildDomainNotary;return x?.isChief===true&&x.canAfford===true&&typeof x.hasDomain==='boolean'&&money(x.cost,x.treasury)&&x.cost<=x.treasury;}
   case RC+'ApartmentBuyReaction':{const x=c.apartmentNotary?.forSale;return x?.canAfford===true&&n(x.price);}
   case RC+'ApartmentClaimRentReaction':{const x=unique(c.apartmentNotary?.ownedApartments,x=>x.apartmentId===v.apartmentId);return !!x&&x.canClaim===true&&n(x.accumulatedRent);}
   default:return false;
  }
 }

 // PT-BR presentation labels derived from Lang/pt/commands.json report.city.inns
 // at the pinned upstream SHA. These dictionaries never determine game effects.
 const innNames=Object.freeze({lordInn:'Pousada do Senhor',bravesStop:'Parada dos Valentes',hotSwallow:'Gole Ardente',fireside:'À Beira do Fogo',bloodyTankard:'Caneca Sangrenta',royalPavilion:'Pavilhão Real'});
 const mealNames=Object.freeze({breadAndCheese:'Pão e queijo',roastedFowl:'Ave assada',roastedBeef:'Carne assada',stew:'Ensopado',lordPie:'Torta do Senhor',potatoSoup:'Sopa de batata',friedEggs:'Ovos fritos',curryRice:'Arroz com curry',sushi:'Sushi',bravesPanOfFood:'Panela dos Valentes',fishAndChips:'Peixe com batata frita',coldVegetableStew:'Ensopado frio de legumes',roastedPork:'Porco assado',oysterPlatter:'Prato de ostras',tamale:'Tamale',friedShrimp:'Camarão frito',clamChowder:'Sopa de mariscos',grilledFish:'Peixe grelhado',lobsterRoll:'Sanduíche de lagosta',jellyfishCarpaccio:'Carpaccio de água-viva',bread:'Pão',pretzels:'Pretzels',simpleSalad:'Salada simples'});
 const roomNames=Object.freeze({horribleRoom:'Quarto ruim',simpleRoom:'Quarto simples',comfortableRoom:'Quarto confortável',luxuryRoom:'Quarto de luxo',royalSuite:'Suíte real',imperialSuite:'Suíte imperial',commonRoom:'Dormitório coletivo'});
 const named=(dict,id,fallback)=>own(dict,id)?dict[id]:fallback+' ('+clean(id)+')';
 const unit=x=>x.toLocaleString('pt-BR');
 const itemGroup=['weapons','armors','potions','objects'];
 const itemLabel=(models,category,id)=>local(models?.[itemGroup[category]],String(id))||'Item #'+id;
 function cityMeta(d,models){
  const lines=[],place=integer(d.mapLocationId)?local(models?.map_locations,String(d.mapLocationId)):'';
  if(place)lines.push(place);
  const st=[];
  if(money(d.energy?.current,d.energy?.max))st.push('Energia '+unit(d.energy.current)+'/'+unit(d.energy.max));
  if(money(d.health?.current,d.health?.max))st.push('Vida '+unit(d.health.current)+'/'+unit(d.health.max));
  if(st.length)lines.push(st.join(' · '));
  return lines.join('\n');
 }
 function cityDecorate(r,c,models,opt){
  const t=r.type,v=r.data;
  let label=opt.label,section='Serviços';
  if(t===R||t===RC+'ExitCityReaction')section='Jornada';
  else if(t===RC+'InnMealReaction'||t===RC+'InnRoomReaction'){
   section=named(innNames,v.innId,'Hospedaria');
   if(t===RC+'InnMealReaction')label=named(mealNames,v.meal.mealId,'Refeição')+' · '+unit(v.meal.price)+' moedas · +'+unit(v.meal.energy)+' energia';
   else label=named(roomNames,v.room.roomId,'Quarto')+' · '+unit(v.room.price)+' moedas · +'+unit(v.room.health)+' vida';
  }else if(t===RC+'CityShopReaction')section='Comércio';
  else if(t.includes('Garden')){section='Horta';if(t===RC+'GardenCompostReaction'){const name=local(models?.plants,String(v.plantId))||'Planta #'+v.plantId;label='Compostar '+unit(v.quantity)+'× '+name+' · consome plantas';}}
  else if(t.includes('RoyalBlacksmith'))section='Forja real';
  else if(t.includes('Blacksmith'))section='Ferraria';
  else if(t.includes('Enchant'))section='Encantamentos';
  else if(t.includes('ScrapDealer'))section='Reciclagem';
  else if(t.includes('GuildDomain'))section='Domínio da guilda';
  else if(t.includes('Apartment'))section='Apartamentos';
  else if(t.includes('Home')||t===RC+'UpgradeItemReaction')section='Casa';
  // Distinguish identical items in different inventory positions; no guessed slot numbering.
  if(own(v,'slot')&&(slots.has(t)||forge.has(t)||t===RC+'ScrapDealerRecycleReaction'))label+=' · posição '+v.slot;
  if(t===RC+'BlacksmithEnchantmentTransferReaction'){
   const src=unique(c.blacksmith?.enchantmentTransfers,x=>x.slot===v.sourceSlot&&x.category===v.itemCategory);
   const dest=unique(src?.targets,x=>x.slot===v.targetSlot);
   if(src&&dest)label=itemLabel(models,v.itemCategory,src.details.id)+' (posição '+v.sourceSlot+') → '+itemLabel(models,v.itemCategory,dest.details.id)+' (posição '+v.targetSlot+') · '+unit(dest.cost)+' moedas';
  }
  return {...opt,label,section,requiresConfirmation:!nav.has(t)};
 }

 function cityOptions(p,models,renderer){
  if(!shape(p)||p.data.type!==K.city||typeof renderer!=='function')return null;
  const c=p.data.data,sigs=p.reactions.map(sig),counts=new Map();for(const s of sigs)if(s!==null)counts.set(s,(counts.get(s)||0)+1);
  return p.reactions.map((r,i)=>{try{if(sigs[i]===null||counts.get(sigs[i])!==1||!cityAllowed(r,c))return blocked();const opt=renderer(r,c,models);if(!opt||opt.supported!==true)return blocked();return cityDecorate(r,c,models,opt);}catch{return blocked();}});
 }

 // Original binary journey offers: no local transaction or invented outcome.
 const journeyKinds=new Set(['BuyHeal','Cart','Gardener','GoToPVEIsland'].map(k=>RC+k+'Data'));
 const seedConditions=new Set('free paid paidAccepted moon night herbivorePet legendaryHerbivorePet mage firePet fireItem carnivorePet'.split(' '));
 const plant=(models,id)=>local(models?.plants,String(id))||'Planta #'+id;
 function journey(p,models){
  if(!shape(p)||!journeyKinds.has(p.data.type)||p.reactions.length!==2||!p.reactions.every(validRx)||p.reactions.filter(x=>x.type===A).length!==1||p.reactions.filter(x=>x.type===R).length!==1||p.reactions.some(x=>!exact(x.data,[])))return null;
  const kind=p.data.type,d=p.data.data;let title,story,yes,allowed=true;
  if(kind===RC+'BuyHealData'){
   if(!exact(d,['healPrice','playerMoney'])||!integer(d.healPrice)||!integer(d.playerMoney))return null;
   title='✦ TRATAMENTO';story='Remover a alteração pelo serviço original do Core.\nSaldo: '+unit(d.playerMoney)+' moedas';yes='Pagar '+unit(d.healPrice)+' moedas pelo tratamento';allowed=d.healPrice<=d.playerMoney;
  }else if(kind===RC+'CartData'){
   const dest=d.displayedDestination;if(!exact(d,['displayedDestination','price'])||!integer(d.price)||!obj(dest)||typeof dest.isDisplayed!=='boolean'||Object.keys(dest).some(k=>!['isDisplayed','id','type'].includes(k))||(dest.id!==undefined&&!integer(dest.id))||(dest.type!==undefined&&!key(dest.type))||(dest.isDisplayed&&!integer(dest.id)))return null;
   title='✦ CARONA';story=(dest.isDisplayed?'Destino anunciado: '+(local(models?.map_locations,String(dest.id))||'Local #'+dest.id):'Destino desconhecido')+'. A oferta pode não corresponder ao destino real.';yes='Aceitar carona · '+unit(d.price)+' moedas';
  }else if(kind===RC+'GardenerData'){
   if(!exact(d,own(d,'isFirstEncounter')?['seedId','cost','conditionKey','isFirstEncounter']:['seedId','cost','conditionKey'])||!pos(d.seedId)||d.seedId>10||!pos(d.cost)||!seedConditions.has(d.conditionKey)||(own(d,'isFirstEncounter')&&typeof d.isFirstEncounter!=='boolean'))return null;
   title='✦ JARDINEIRO';story='O jardineiro oferece uma semente de '+plant(models,d.seedId)+'.';yes='Comprar semente · '+unit(d.cost)+' moedas';
  }else{
   if(!exact(d,['price','energy'])||!integer(d.price)||!exact(d.energy,['current','max'])||!n(d.energy.current)||!n(d.energy.max))return null;
   title='✦ ILHA DE EXPEDIÇÃO';story='Embarcar para a ilha PvE. Energia: '+unit(d.energy.current)+'/'+unit(d.energy.max)+'. O Core verifica as condições e o saldo de gemas.';yes='Embarcar · '+unit(d.price)+' gemas';
  }
  return {kind,title,story,options:p.reactions.map(r=>r.type===R?entry('Recusar'):allowed?entry(yes,true):blocked())};
 }
 function journeyResult(name,p,models){
  if(!obj(p))return null;
  const generic='Resultado incompleto; consulte /perfil antes de repetir a ação.';
  switch(name){
   case 'CommandReportBuyHealAcceptPacketRes':return integer(p.healPrice)&&typeof p.isArrived==='boolean'?'Tratamento realizado · '+unit(p.healPrice)+' moedas.'+(p.isArrived?' O Core informou a chegada ao destino.':''):generic;
   case 'CommandReportBuyHealRefusePacketRes':return 'Tratamento recusado.';
   case 'CommandReportBuyHealNoAlterationPacketRes':return 'Não há alteração para tratar.';
   case 'CommandReportBuyHealCannotHealOccupiedPacketRes':return 'O Core não permite tratar esta alteração enquanto o personagem está ocupado.';
   case 'SmallEventCartPacket':{
    const t=p.travelDone;if(!obj(t)||typeof t.isAccepted!=='boolean'||typeof t.hasEnoughMoney!=='boolean'||typeof p.isScam!=='boolean'||typeof p.isDisplayed!=='boolean'||!n(p.pointsWon))return generic;
    if(!t.isAccepted)return 'Carona recusada.';
    if(!t.hasEnoughMoney)return 'Carona não realizada: moedas insuficientes.';
    return (p.isScam?'A carona era uma armadilha.':'Carona realizada.')+(p.pointsWon?' Pontos recebidos: '+unit(p.pointsWon)+'.':'')+' Consulte /perfil para conferir o destino.';
   }
   case 'SmallEventGoToPVEIslandAcceptPacket':return typeof p.alone==='boolean'&&n(p.pointsWon)?'Embarque confirmado pelo Core'+(p.alone?' (sozinho)':'')+'.'+(p.pointsWon?' Pontos recebidos: '+unit(p.pointsWon)+'.':''):generic;
   case 'SmallEventGoToPVEIslandNotEnoughGemsPacket':return 'Embarque não realizado: gemas insuficientes.';
   case 'SmallEventGoToPVEIslandRefusePacket':return 'Embarque recusado.';
   case 'SmallEventGoToPVEIslandNoAnswerPacket':return 'A oportunidade de embarcar terminou sem resposta.';
   case 'SmallEventGardenerPacket':
    if(p.interactionName==='seed')return pos(p.plantId)&&p.plantId<=10&&integer(p.cost)&&seedConditions.has(p.conditionKey)?'Semente recebida: '+plant(models,p.plantId)+(p.cost?' · '+unit(p.cost)+' moedas.':'.'):generic;
    if(p.interactionName==='advice'&&p.conditionKey==='refused')return 'Oferta do jardineiro recusada.';
    if(p.interactionName==='advice'&&p.conditionKey==='needMoney')return 'O jardineiro não vendeu a semente: moedas insuficientes.';
    return null; // Non-purchase advice, material and plant paths keep their existing rendering.
   default:return null;
  }
 }

 return {K,combat,petResult,cityAllowed,cityOptions,cityTypes,petActions,cityMeta,journey,journeyKinds,journeyResult};
})();
