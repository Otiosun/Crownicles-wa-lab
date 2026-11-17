'use strict';
/**
 * Lote 07 — funções de transporte/apresentação para Crownicles 6.2.0.b.
 * Nenhuma regra econômica criada: o Core calcula e executa cada ação.
 * Contratos: CommandSellPacket, CommandPetFeedPacket, CommandGuildStoragePacket,
 * ReactionCollectorSell, ReactionCollectorPetFeed{With,Without}Guild, PetFood.
 */
const {safe,itemName}=require('./lote04.cjs');
const int=v=>Number.isInteger(v)&&v>=0;
const money=n=>n.toLocaleString('pt-BR');
const option=(label,requiresConfirmation=false)=>({label,supported:true,requiresConfirmation});
const disabled=()=>({label:'',supported:false,requiresConfirmation:false});
const categories=['Arma','Armadura','Poção','Objeto'];
const foods={commonFood:'Ração comum',herbivorousFood:'Ração herbívora',carnivorousFood:'Ração carnívora',ultimateFood:'Ração especial'};
function resolveCommand(line){
 const [name,...args]=String(line||'').trim().toLocaleLowerCase('pt-BR').split(/\s+/);
 if(args.length)return null;
 if(['/vender','/venda'].includes(name))return {name:'CommandSellPacketReq',data:{}};
 if(['/alimentar','/alimentarpet','/alimentarpetzinho'].includes(name))return {name:'CommandPetFeedPacketReq',data:{}};
 if(['/despensa','/estoqueguilda','/estoque-guilda'].includes(name))return {name:'CommandGuildStoragePacketReq',data:{}};
 return null;
}
function sellOption(reaction,models){
 if(reaction?.type==='ReactionCollectorRefuseReaction')return option('Cancelar venda');
 if(reaction?.type!=='ReactionCollectorSellItemReaction')return disabled();
 const r=reaction.data||{},item=r.item||{};
 if(!int(item.category)||item.category>=categories.length||!int(item.id)||!Number.isInteger(r.slot)||r.slot<1||!int(r.price))return disabled();
 const name=itemName(models,item.category,item.id);
 // Sem nome confirmado, a venda seria ambígua. Recusar é preferível a vender o item errado.
 if(!name)return disabled();
 return option(`Vender ${name} · reserva ${r.slot} · receber ${money(r.price)} moedas`,true);
}
function petFeedOption(kind,reaction,data){
 const r=reaction?.data||{};
 if(reaction?.type==='ReactionCollectorRefuseReaction')return option('Não alimentar agora');
 if(kind==='ReactionCollectorPetFeedWithoutGuildData'){
  if(reaction?.type!=='ReactionCollectorAcceptReaction'||!int(data.price)||!Object.hasOwn(foods,data.food))return disabled();
  return option(`Comprar ${foods[data.food]} · ${money(data.price)} moedas · alimentar companheiro`,true);
 }
 if(kind==='ReactionCollectorPetFeedWithGuildData'){
  if(reaction?.type!=='ReactionCollectorPetFeedWithGuildFoodReaction'||!Object.hasOwn(foods,r.food)||!int(r.amount)||r.amount<1)return disabled();
  return option(`Dar 1 ${foods[r.food].toLowerCase()} · estoque da guilda: ${money(r.amount)}`,true);
 }
 return disabled();
}
function petName(p){return safe(p?.nickname,48)||'seu companheiro'}
function guildStorage(p){
 if(!Array.isArray(p.foods))return '*✦ DESPENSA DA GUILDA*\nDados indisponíveis.';
 const out=['*✦ DESPENSA DA GUILDA*',safe(p.guildName,75)||'Sua guilda',''];
 let total=0;
 for(const food of p.foods){
  if(!Object.hasOwn(foods,food?.id)||!int(food.amount)||!int(food.maxAmount))continue;
  total++;
  out.push(`${foods[food.id]}: ${money(food.amount)}/${money(food.maxAmount)}`);
 }
 if(!total)out.push('O motor não enviou estoques reconhecidos.');
 out.push('', 'Consulte /alimentar para oferecer comida a um companheiro, quando disponível.');
 return out.join('\n');
}
function renderPacket(name,p,models){
 switch(name){
  case 'CommandSellNoItemErrorPacket':return '*✦ VENDA*\nVocê não possui itens de reserva para vender.';
  case 'CommandSellCancelErrorPacket':return '*✦ VENDA*\nVenda cancelada. Seu inventário não foi alterado por esta escolha.';
  case 'CommandSellItemSuccessPacket':{
   const value=int(p.price)?money(p.price)+' moedas':'valor não informado';
   const item=p.item||{};
   const name=int(item.category)&&int(item.id)?itemName(models,item.category,item.id):null;
   return `*✦ VENDA REALIZADA*\n${name?'Item: '+name+'\n':''}O motor confirmou a venda. Valor recebido: ${value}. Consulte /inventario e /perfil para conferir o resultado.`;
  }
  case 'CommandPetFeedNoPetErrorPacket':return '*✦ ALIMENTAÇÃO*\nVocê ainda não possui um companheiro.';
  case 'CommandPetFeedPetOnExpeditionErrorPacket':return '*✦ ALIMENTAÇÃO*\nSeu companheiro está em uma expedição e não pode comer agora.';
  case 'CommandPetFeedNotHungryErrorPacket':return `*✦ ALIMENTAÇÃO*\n${petName(p.pet)} ainda não está com fome.`;
  case 'CommandPetFeedNoMoneyFeedErrorPacket':return '*✦ ALIMENTAÇÃO*\nMoedas insuficientes. Nenhuma comida foi comprada.';
  case 'CommandPetFeedGuildStorageEmptyErrorPacket':return '*✦ ALIMENTAÇÃO*\nNão há alimento disponível na despensa da guilda.';
  case 'CommandPetFeedSituationChangedErrorPacket':return '*✦ ALIMENTAÇÃO*\nA situação do companheiro mudou. Nenhuma alimentação foi concluída.';
  case 'CommandPetFeedCancelErrorPacket':return '*✦ ALIMENTAÇÃO*\nVocê decidiu não alimentar seu companheiro.';
  case 'CommandPetFeedSuccessPacket':{
   const labels={happy:'O companheiro ficou satisfeito.',veryHappy:'Seu companheiro gostou muito da comida.',veryVeryHappy:'Seu companheiro adorou a refeição.',dislike:'Seu companheiro não gostou da comida.'};
   return `*✦ COMPANHEIRO ALIMENTADO*\n${labels[p.result]||'O motor concluiu a alimentação.'}`;
  }
  case 'CommandGuildStoragePacketRes':return guildStorage(p);
  default:return null;
 }
}
function feedStory(kind,data){
 if(kind==='ReactionCollectorPetFeedWithoutGuildData'){
  return `Alimentar ${petName(data.pet)} exige comprar alimento. O preço é exibido antes da confirmação.`;
 }
 return `Escolha um alimento da despensa para ${petName(data.pet)}. A decisão consome 1 unidade do estoque da guilda.`;
}
function sellStory(){return 'Escolha cuidadosamente um item da reserva. Vender remove o item do inventário e concede as moedas informadas pelo motor. Cada venda exige código de confirmação.'}
function gardenStory(data){
 const garden=data?.home?.owned?.garden;
 const info=['Consulte as ações disponíveis para sua horta.'];
 if(!garden||typeof garden!=='object')return info[0];
 const plots=Array.isArray(garden.plots)?garden.plots:[];
 if(int(garden.totalPlots))info.push(`Canteiros: ${garden.totalPlots}`);
 if(plots.length)info.push(`Plantas prontas para colher: ${plots.filter(x=>x?.isReady===true).length}`);
 if(garden.accessMode==='readOnly')info.push('Acesso à distância: apenas colheita, quando disponível.');
 if(garden.eligibility?.canWaterGarden===false)info.push('Regar: indisponível agora.');
 return info.join('\n');
}
function rankingNavigation(kind,p){
 // Só anunciar páginas se a resposta do Core permitir calcular o total.
 if(!Number.isInteger(p.pageNumber)||p.pageNumber<1||!int(p.totalElements)||!Number.isInteger(p.elementsPerPage)||p.elementsPerPage<1)return [];
 const pages=Math.ceil(p.totalElements/p.elementsPerPage);
 if(pages<=1)return [];
 const base=kind==='PONTOS'?`pontos ${p.timing==='Week'?'semanal':'geral'}`:kind==='GLÓRIA'?'gloria semanal':'guildas geral';
 const paths=[];
 if(p.pageNumber>1)paths.push(`Anterior: /ranking ${base} ${p.pageNumber-1}`);
 if(p.pageNumber<pages)paths.push(`Próxima: /ranking ${base} ${p.pageNumber+1}`);
 return paths;
}
module.exports={resolveCommand,sellOption,petFeedOption,renderPacket,feedStory,sellStory,gardenStory,rankingNavigation,foods};
