'use strict';
// Pure presentation validators: Crownicles 6.2.0.b @64d08c05; no game mutation.
module.exports=(function createWorld(){
 'use strict';
 const RC='ReactionCollector',A=RC+'AcceptReaction',R=RC+'RefuseReaction';
 const K={fight:RC+'FightData',pve:RC+'PveFightData',action:RC+'FightChooseActionData',pet:RC+'FightPetData',city:RC+'CityData'};
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k),obj=o=>o!==null&&typeof o==='object'&&!Array.isArray(o),exact=(o,keys)=>obj(o)&&Object.keys(o).length===keys.length&&keys.every(k=>own(o,k));
 const n=x=>Number.isFinite(x)&&x>=0,integer=x=>Number.isSafeInteger(x)&&x>=0,pos=x=>integer(x)&&x>0,cat=x=>integer(x)&&x<=3,key=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(x),uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(x);
 const clean=x=>typeof x==='string'?x.replace(/[\x00-\x1f\x7f<>*_~`@]/g,' ').replace(/\b[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\b/gi,'').replace(/\s+/g,' ').trim().slice(0,130):'';
 const local=(o,k)=>obj(o)&&own(o,k)?clean(typeof o[k]==='string'?o[k]:o[k]?.name):'';
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
   const label=pet?(own(petActions,id)?petActions[id]:''):playerActions.has(id)?local(models?.fight_actions,id):'';
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
 function cityOptions(p,models,renderer){
  if(!shape(p)||p.data.type!==K.city||typeof renderer!=='function')return null;
  const c=p.data.data,sigs=p.reactions.map(sig),counts=new Map();for(const s of sigs)if(s!==null)counts.set(s,(counts.get(s)||0)+1);
  return p.reactions.map((r,i)=>{try{if(sigs[i]===null||counts.get(sigs[i])!==1||!cityAllowed(r,c))return blocked();const opt=renderer(r,c,models);if(!opt||opt.supported!==true)return blocked();return {...opt,requiresConfirmation:!nav.has(r.type)};}catch{return blocked();}});
 }
 return {K,combat,petResult,cityAllowed,cityOptions,cityTypes,petActions};
})();
