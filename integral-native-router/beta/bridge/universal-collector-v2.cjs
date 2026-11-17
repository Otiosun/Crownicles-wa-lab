'use strict';
/**
 * Offline laboratory-only expansion of official Crownicles 6.2.0.b contracts.
 * No Core writes, no packet sends. Return menu descriptors preserving reaction
 * array position, never user-controlled IDs. Fail closed for unidentified effects.
 * Explicitly audited against Lib/src/packets/interaction and Core sources.
 */
const base=require('./universal-collector-v1.cjs');
const A='ReactionCollectorAcceptReaction',R='ReactionCollectorRefuseReaction';
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const zero=x=>obj(x)&&Object.keys(x).length===0;
const nat=x=>Number.isSafeInteger(x)&&x>=0;
const pos=x=>Number.isSafeInteger(x)&&x>0;
const tiny=(x,max=90)=>typeof x==='string'&&x.length>0&&x.length<=max&&!/[\x00-\x1f\x7f<>`*@]/.test(x);
const label=x=>(typeof x==='string'?x:'').replace(/[\x00-\x1f\x7f<>`*~_@]/g,' ').replace(/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/gi,'').replace(/\s+/g,' ').trim().slice(0,70);
const num=x=>x.toLocaleString('pt-BR');
const option=(label,supported=false)=>({label,supported,requiresConfirmation:supported});
const cancel=l=>({label:l||'Cancelar sem alterar nada',supported:true,requiresConfirmation:false});
const ID=x=>typeof x==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(x);
function binary(kind,data,reactions,rule){
 if(!obj(data)||!rule.check(data)||reactions.length!==2||reactions.filter(x=>x.type===A).length!==1||reactions.filter(x=>x.type===R).length!==1||reactions.some(x=>!zero(x.data)))return null;
 return {kind,title:rule.title,story:rule.story(data),options:reactions.map(x=>x.type===R?cancel():option(rule.action(data),Boolean(rule.enabled?.(data))))};
}
const binaryTypes=Object.freeze({
 ReactionCollectorGardenerData:{
  title:'✦ ENCONTRO COM JARDINEIRO',
  check:d=>nat(d.seedId)&&nat(d.cost)&&tiny(d.conditionKey,70)&&(d.isFirstEncounter===undefined||typeof d.isFirstEncounter==='boolean'),
  story:d=>`Semente oferecida: ${d.seedId}. Custo oficial: ${num(d.cost)} moedas. O Core verifica a disponibilidade novamente.`,
  action:d=>`Obter semente por ${num(d.cost)} moedas`,enabled:()=>true},
 ReactionCollectorShopSmallEventData:{
  title:'✦ LOJA ENCONTRADA',
  check:d=>obj(d.item)&&pos(d.item.id)&&nat(d.item.itemCategory)&&d.item.itemCategory<=3&&nat(d.price),
  story:d=>`Oferta do Core: item ${d.item.id} · preço ${num(d.price)} moedas.`,
  action:d=>`Comprar item ${d.item.id} por ${num(d.price)} moedas`,enabled:d=>d.price>0},
 ReactionCollectorEpicShopSmallEventData:{
  title:'✦ COMERCIANTE RARO',
  check:d=>obj(d.item)&&pos(d.item.id)&&nat(d.item.itemCategory)&&d.item.itemCategory<=3&&nat(d.price)&&typeof d.tip==='boolean',
  story:d=>`Oferta rara: item ${d.item.id} · preço ${num(d.price)} moedas. Condições da gorjeta ainda não homologadas.`,
  action:()=> 'Comprar oferta rara',enabled:()=>false},
 ReactionCollectorInteractOtherPlayersPoorData:{
  title:'✦ AJUDAR OUTRO VIAJANTE',
  check:d=>ID(d.keycloakId)&&(d.rank===undefined||nat(d.rank)),
  story:()=> 'A identidade e os efeitos dessa ajuda precisam de confirmação adicional; ação bloqueada.',
  action:()=> 'Ajudar jogador',enabled:()=>false},
 ReactionCollectorLimogesData:{
  title:'✦ PERGUNTA DO VIAJANTE',
  check:d=>tiny(d.questionId,80),
  story:()=> 'Resposta com consequências não verificadas no Core. Consulta informativa.',
  action:()=> 'Aceitar proposta',enabled:()=>false},
 ReactionCollectorRecipeShopSmallEventData:{
  title:'✦ RECEITA DE COZINHA',
  check:d=>['farmer','gaspardJo'].includes(d.source)&&obj(d.recipe)&&tiny(d.recipe.recipeId,100)&&nat(d.recipe.level)&&nat(d.recipeCost),
  story:d=>`Receita ${label(d.recipe.recipeId)} · custo informado ${num(d.recipeCost)}. Efeito e moeda ainda dependem da origem do evento.`,
  action:()=> 'Comprar receita',enabled:()=>false}
});
function fixed(kind,data,reactions,types,names){
 if(!zero(data)||reactions.length!==types.length||new Set(reactions.map(x=>x.type)).size!==types.length||reactions.some(x=>!types.includes(x.type)||!zero(x.data)))return null;
 return {kind,title:kind==='ReactionCollectorGobletsGameData'?'✦ ESCOLHA DOS CÁLICES':'✦ ESCOLHAS DO JOGO',story:'Consequências ainda não homologadas. Todas as alternativas permanecem bloqueadas.',options:reactions.map(x=>option(names[x.type]||'Escolha indisponível'))};
}
function keyed(kind,data,reactions,rule){
 if(!rule.check(data)||reactions.length<1||reactions.length>50)return null;
 const ids=new Set();const opts=[];
 for(let i=0;i<reactions.length;i++){
  const x=reactions[i];if(x.type!==rule.react||!obj(x.data)||Object.keys(x.data).length!==1||!tiny(x.data[rule.key],90)||ids.has(x.data[rule.key]))return null;
  ids.add(x.data[rule.key]);opts.push(option(`Escolha ${i+1} (efeitos não homologados)`));
 }
 return {kind,title:rule.title,story:rule.story(data),options:opts};
}
const keyRules=Object.freeze({
 ReactionCollectorWitchData:{react:'ReactionCollectorWitchReaction',key:'id',check:zero,title:'✦ INGREDIENTES DA BRUXA',story:()=> 'Ingredientes e efeitos não homologados.'},
 ReactionCollectorBadPetSmallEventData:{react:'ReactionCollectorBadPetReaction',key:'id',check:d=>obj(d)&&pos(d.petId)&&tiny(d.sex,12)&&(d.petNickname===undefined||tiny(d.petNickname,80)),title:'✦ ENCONTRO DO COMPANHEIRO',story:d=>`Companheiro: ${label(d.petNickname)||'Sem apelido'}. Escolhas perigosas bloqueadas.`},
 ReactionCollectorFightPetData:{react:'ReactionCollectorFightPetReaction',key:'actionId',check:d=>obj(d)&&pos(d.petId)&&typeof d.isFemale==='boolean',title:'✦ AÇÃO DO COMPANHEIRO',story:()=> 'Efeitos de combate não foram homologados em banco descartável.'}
});
function itemChoice(kind,data,reactions){
 if(!obj(data.item)||!nat(data.item.category)||data.item.category>3||!pos(data.item.id)||reactions.length>60)return null;
 const opts=[],slots=new Set();let drink=false,refuse=false;
 for(const rx of reactions){
  if(rx.type==='ReactionCollectorItemChoiceRefuseReaction'&&zero(rx.data)&&!refuse){refuse=true;opts.push(cancel('Manter o inventário como está'));continue}
  if(rx.type==='ReactionCollectorItemChoiceDrinkPotionReaction'&&zero(rx.data)&&!drink){drink=true;opts.push(option('Consumir poção (bloqueado)'));continue}
  if(rx.type!=='ReactionCollectorItemChoiceItemReaction'||!obj(rx.data)||Object.keys(rx.data).length!==2||!nat(rx.data.slot)||!obj(rx.data.itemWithDetails)||!pos(rx.data.itemWithDetails.id)||!nat(rx.data.itemWithDetails.itemCategory))return null;
  const k=`${rx.data.slot}:${rx.data.itemWithDetails.id}`;if(slots.has(k))return null;slots.add(k);
  opts.push(option(`Escolher slot ${rx.data.slot+1} (bloqueado)`));
 }
 return {kind,title:'✦ ESCOLHA DE ITEM',story:`Novo item recebido: categoria ${data.item.category}, ID ${data.item.id}. Trocas e consumo aguardam validação do inventário real.`,options:opts};
}
// Display-only labels follow the original numeric ShopItemType enum (0..29).
// Never used to decide costs, quantities, inventory or state.
const SHOP_ITEM_NAMES=Object.freeze([
 'poção diária','item aleatório','cura de alteração','regeneração completa',
 'espaço de inventário','insígnia Boca de Ouro','ração comum','ração herbívora',
 'ração carnívora','ração suprema','moedas','tesouro','favor do rei',
 'troca de missão','pontos de afeto','experiência pequena de guilda',
 'recuperação de energia','experiência grande de guilda','insígnia do Mestre de Missões',
 'token','espaço para plantas','planta semanal (faixa 1)',
 'planta semanal (faixa 2)','planta semanal (faixa 3)',
 'análise de mercado','madeira comum','madeira incomum',
 'pacote de materiais aleatórios','talismã de colheita remota','caridade de tokens'
]);
const MAX_ITEM_TYPE=SHOP_ITEM_NAMES.length-1;
function shop(kind,data,reactions){
 if(!nat(data.availableCurrency)||!['money','gem'].includes(data.currency)||!obj(data.additionalShopData)||reactions.length<1||reactions.length>100)return null;
 const unit=data.currency==='money'?'moedas':'gemas',seen=new Set();let close=false;const options=[];
 for(const rx of reactions){
  if(rx.type==='ReactionCollectorShopCloseReaction'&&zero(rx.data)&&!close){close=true;options.push(cancel('Fechar a loja'));continue}
  if(rx.type!=='ReactionCollectorShopItemReaction'||!obj(rx.data)||Object.keys(rx.data).length!==4||!tiny(rx.data.shopCategoryId,70)||!nat(rx.data.shopItemId)||rx.data.shopItemId>MAX_ITEM_TYPE||!nat(rx.data.price)||!pos(rx.data.amount))return null;
  const key=`${rx.data.shopCategoryId}:${rx.data.shopItemId}:${rx.data.amount}`;if(seen.has(key))return null;seen.add(key);
  options.push(option(`Comprar ${SHOP_ITEM_NAMES[rx.data.shopItemId]} ×${num(rx.data.amount)} · ${num(rx.data.price)} ${unit}`,rx.data.price>0&&rx.data.price<=data.availableCurrency));
 }
 if(!close)return null;
 return {kind,title:'✦ COMÉRCIO',story:`Saldo do Core: ${num(data.availableCurrency)} ${unit}. Itens e preços são os do menu original, confirmados individualmente.`,options};
}
const goblets=['ReactionCollectorGobletsGameMetalReaction','ReactionCollectorGobletsGameBiggestReaction','ReactionCollectorGobletsGameSparklingReaction','ReactionCollectorGobletsGameCrackedReaction'];
const gobletsLabels=Object.fromEntries(goblets.map((s,i)=>[s,['Cálice metálico','Cálice maior','Cálice brilhante','Cálice rachado'][i]]));
function compileCollector(packet){
 const existing=base.compileCollector(packet);if(existing)return existing;
 if(!obj(packet)||!obj(packet.data)||!obj(packet.data.data)||!Array.isArray(packet.reactions)||packet.reactions.length<1||packet.reactions.length>100||!packet.reactions.every(x=>obj(x)&&typeof x.type==='string'&&obj(x.data)))return null;
 const kind=packet.data.type,data=packet.data.data,rx=packet.reactions;
 if(Object.hasOwn(binaryTypes,kind))return binary(kind,data,rx,binaryTypes[kind]);
 if(Object.hasOwn(keyRules,kind))return keyed(kind,data,rx,keyRules[kind]);
 if(kind==='ReactionCollectorGobletsGameData')return fixed(kind,data,rx,goblets,gobletsLabels);
 if(kind==='ReactionCollectorItemChoiceData')return itemChoice(kind,data,rx);
 if(kind==='ReactionCollectorShopData')return shop(kind,data,rx);
 return null;
}
const knownKinds=new Set([
 ...Object.keys(require('./universal-collector.cjs').binaryRules),
 ...Object.keys(require('./universal-collector-v1.cjs').binaryConfigs),
 ...Object.keys(binaryTypes),...Object.keys(keyRules),
 'ReactionCollectorTokenMerchantData','ReactionCollectorLotteryData',
 'ReactionCollectorAltarData','ReactionCollectorPetFoodSmallEventData',
 'ReactionCollectorPetFreeSelectionData','ReactionCollectorPetTransferData',
 'ReactionCollectorSkipMissionShopItemData','ReactionCollectorGobletsGameData',
 'ReactionCollectorItemChoiceData','ReactionCollectorShopData'
]);
function isKnownKind(kind){return knownKinds.has(kind)}
module.exports={compileCollector,isKnownKind,knownKinds,binaryTypes,keyRules,sourceVersion:'Crownicles 6.2.0.b',contractsAdded:12,SHOP_ITEM_NAMES};
