'use strict';
// Original ItemUtils / Shop / ReportTokenMerchantService, Crownicles 6.2.0.b.
// Only labels and validation; the native reaction index is never rewritten.
const RC='ReactionCollector',A=RC+'AcceptReaction',R=RC+'RefuseReaction';
const K={choice:RC+'ItemChoiceData',accept:RC+'ItemAcceptData',shop:RC+'ShopSmallEventData',epic:RC+'EpicShopSmallEventData',token:RC+'TokenMerchantData'};
const kinds=new Set(Object.values(K));
const groups=['weapons','armors','potions','objects'],cats=['Arma','Armadura','Poção','Objeto'],rarities=['Básico','Comum','Incomum','Exótico','Raro','Especial','Épico','Lendário','Mítico'],natures=['Sem efeito','Vida','Velocidade','Ataque','Defesa','Tempo de viagem','Moedas','Energia'];
const own=(x,k)=>Object.hasOwn(x,k),obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),exact=(x,keys)=>obj(x)&&Object.keys(x).length===keys.length&&keys.every(k=>own(x,k));
const integer=x=>Number.isSafeInteger(x)&&x>=0,pos=x=>integer(x)&&x>0,cat=x=>integer(x)&&x<4,num=x=>Number.isFinite(x),cap=x=>x===null||num(x),fmt=x=>x.toLocaleString('pt-BR');
const safe=x=>typeof x==='string'?x.replace(/[\x00-\x1f\x7f<>*_~\x60@]/g,' ').replace(/\s+/g,' ').trim().slice(0,110):'';
function name(models,c,id){const group=models?.[groups[c]],v=obj(group)&&own(group,String(id))?group[String(id)]:null;return safe(typeof v==='string'?v:v?.name||v?.name_one)||cats[c]+' #'+id;}
const brief=(x)=>exact(x,['id','category'])&&integer(x.id)&&cat(x.category);
const stat=x=>obj(x)&&num(x.baseValue)&&num(x.upgradeValue)&&cap(x.maxValue);
function details(x){if(!obj(x)||!integer(x.id)||!cat(x.itemCategory)||!integer(x.rarity)||x.rarity>8)return false;
 if(x.itemCategory<2)return integer(x.itemLevel)&&x.itemLevel<=5&&['attack','defense','speed'].every(k=>stat(x[k]))&&(x.itemEnchantmentId===undefined||typeof x.itemEnchantmentId==='string');
 return integer(x.nature)&&x.nature<=7&&num(x.power)&&cap(x.maxPower)&&(x.usages===undefined||integer(x.usages))&&(x.maxUsages===undefined||integer(x.maxUsages))&&(x.usages===undefined||x.maxUsages===undefined||x.usages<=x.maxUsages);
}
function describe(x,models){const head=name(models,x.itemCategory,x.id)+' · '+rarities[x.rarity];if(x.itemCategory<2){const stats=['attack','defense','speed'].map((k,i)=>['ATQ','DEF','VEL'][i]+' '+fmt(x[k].baseValue+x[k].upgradeValue)+(x[k].maxValue!==null?' (lim. '+fmt(x[k].maxValue)+')':''));return head+' · nível '+x.itemLevel+' · '+stats.join(' / ')+(x.itemEnchantmentId?' · encantado':'');}
 return head+' · '+natures[x.nature]+' '+fmt(x.power)+(x.maxPower!==null?' (lim. '+fmt(x.maxPower)+')':'')+(x.usages!==undefined?' · usos '+x.usages+(x.maxUsages!==undefined?'/'+x.maxUsages:''):'');
}
const option=(label,requiresConfirmation=false)=>({label,supported:true,requiresConfirmation});
const blocked=label=>({label,supported:false,requiresConfirmation:false});
function uniqueTypes(rx,allowed,required){return rx.every(x=>allowed.includes(x.type)&&exact(x.data,[]))&&new Set(rx.map(x=>x.type)).size===rx.length&&required.every(k=>rx.some(x=>x.type===k));}
const refuseNote=c=>c===2?'descarta a poção recebida':'vende o item recebido pelo valor calculado pelo Core';
const replaceNote=c=>c===2?'descarta a poção anterior':'vende o item anterior pelo valor calculado pelo Core';
function menu(p,models){
 const kind=p?.data?.type,d=p?.data?.data,rx=p?.reactions;
 if(!kinds.has(kind)||!obj(d)||!Array.isArray(rx)||!rx.length||rx.length>220||!rx.every(x=>obj(x)&&typeof x.type==='string'&&obj(x.data)))return null;
 if(kind===K.accept){const i=d.itemWithDetails,D=RC+'ItemAcceptDrinkPotionReaction';if(!exact(d,['itemWithDetails'])||!details(i)||!uniqueTypes(rx,i.itemCategory===2?[A,R,D]:[A,R],[A,R]))return null;
 // The ItemAcceptData describes the OLD item (not the reward). ItemFoundPacket announces the new one.
 return {title:'✦ INVENTÁRIO CHEIO',story:'Para ficar com o item recém-recebido, você precisa substituir o que está no inventário:\n'+describe(i,models)+'\nEscolher manter o atual '+refuseNote(i.itemCategory)+'.',options:rx.map(x=>x.type===A?option('Substituir '+name(models,i.itemCategory,i.id)+' · '+replaceNote(i.itemCategory),true):x.type===D?option('Beber a poção recém-recebida agora',true):option('Manter o item atual · '+refuseNote(i.itemCategory),true))};
 }
 if(kind===K.choice){const i=d.item,S=RC+'ItemChoiceItemReaction',D=RC+'ItemChoiceDrinkPotionReaction',F=RC+'ItemChoiceRefuseReaction';if(!exact(d,['item'])||!brief(i))return null;
 const slots=rx.filter(x=>x.type===S);if(!slots.length||rx.filter(x=>x.type===F).length!==1||rx.filter(x=>x.type===D).length>1||new Set(slots.map(x=>x.data.slot)).size!==slots.length)return null;
 if(!rx.every(x=>x.type===S?exact(x.data,['slot','itemWithDetails'])&&integer(x.data.slot)&&details(x.data.itemWithDetails)&&x.data.itemWithDetails.itemCategory===i.category:x.type===F?exact(x.data,[]):x.type===D&&i.category===2&&exact(x.data,[])))return null;
 return {title:'✦ ESCOLHA O ITEM A SUBSTITUIR',story:'Novo item: '+name(models,i.category,i.id)+'\nInventário cheio. Escolha o espaço que deseja liberar. A recusa '+refuseNote(i.category)+'.',options:rx.map(x=>x.type===S?option('Espaço '+(x.data.slot+1)+' · '+describe(x.data.itemWithDetails,models)+' · '+replaceNote(i.category),true):x.type===D?option('Beber a poção recém-recebida agora',true):option('Manter todos os itens atuais · '+refuseNote(i.category),true))};
 }
 if(kind===K.shop||kind===K.epic){const epic=kind===K.epic,i=d.item;if(!exact(d,epic?['item','price','tip']:['item','price'])||!details(i)||!integer(d.price)||!uniqueTypes(rx,[A,R],[A,R])||(epic&&(typeof d.tip!=='boolean'||i.itemCategory===2||i.rarity<6||i.rarity>7)))return null;
 return {title:epic?'✦ MERCADOR DE EQUIPAMENTOS RAROS':'✦ MERCADOR NA ESTRADA',story:describe(i,models)+'\nPreço: '+fmt(d.price)+' moedas.'+(epic&&d.tip?'\nO mercador sugere que há ofertas melhores na Estrada das Maravilhas.':'')+'\nSe não houver espaço, o Core abrirá uma escolha de inventário. O preço da compra é confirmado antes disso.',options:rx.map(x=>x.type===A?option('Comprar por '+fmt(d.price)+' moedas',true):option('Recusar a oferta'))};
 }
 if(kind===K.token){const B=RC+'TokenMerchantBuyReaction';if(!exact(d,['pricePerToken','playerMoney','playerTokens','amounts'])||!pos(d.pricePerToken)||!integer(d.playerMoney)||!integer(d.playerTokens)||!Array.isArray(d.amounts)||!d.amounts.length||!d.amounts.every(pos)||new Set(d.amounts).size!==d.amounts.length||rx.length!==d.amounts.length+1||rx.filter(x=>x.type===R).length!==1)return null;
 const buys=rx.filter(x=>x.type===B);if(new Set(buys.map(x=>x.data.amount)).size!==d.amounts.length||!rx.every(x=>x.type===R?exact(x.data,[]):x.type===B&&exact(x.data,['amount'])&&d.amounts.includes(x.data.amount)&&pos(x.data.amount*d.pricePerToken)))return null;
 return {title:'✦ MERCADOR DE TOKENS',story:'Saldo: '+fmt(d.playerMoney)+' moedas · '+fmt(d.playerTokens)+' tokens\nPreço unitário: '+fmt(d.pricePerToken)+' moedas. Limites e saldo são revalidados pelo Core.',options:rx.map(x=>{if(x.type===R)return option('Recusar a oferta');const cost=x.data.amount*d.pricePerToken;return cost<=d.playerMoney?option('Comprar '+fmt(x.data.amount)+' token(s) por '+fmt(cost)+' moedas',true):blocked('Saldo insuficiente')})};
 }
 return null;
}
function result(n,p,models){
 if(n==='ItemFoundPacket'||n==='ItemAcceptPacket'){if(!details(p?.itemWithDetails))return '*✦ ITEM*\\nDetalhes incompletos. Consulte /inventario.'.replace('\\n','\n');return (n==='ItemFoundPacket'?'*✦ ITEM ENCONTRADO*\n':'*✦ ITEM ACEITO*\n')+describe(p.itemWithDetails,models)+(n==='ItemFoundPacket'?'\nAguarde a decisão do inventário, se necessária.':'');}
 if(n==='ItemRefusePacket'){if(!brief(p?.item)||typeof p.autoSell!=='boolean'||!integer(p.soldMoney))return '*✦ ITEM*\nResultado incompleto. Consulte /inventario.';return '*✦ '+(p.autoSell?'VENDA AUTOMÁTICA':'ITEM NÃO MANTIDO')+'*\n'+name(models,p.item.category,p.item.id)+'\n'+(p.item.category===2?'Poção descartada.':'Valor informado pelo Core: '+fmt(p.soldMoney)+' moedas.');}
 const shop=/^SmallEvent(?:EpicItemShop|Shop)(Accept|Refuse|CannotBuy)Packet$/.exec(n);if(shop)return {'Accept':'*✦ COMPRA ACEITA*\nAguarde a entrega ou a escolha de inventário.','Refuse':'*✦ MERCADOR*\nOferta recusada.','CannotBuy':'*✦ COMPRA NÃO REALIZADA*\nSaldo insuficiente.'}[shop[1]];
 const s={CommandReportTokenMerchantTooMuchRes:'Limite de compra atingido.',CommandReportTokenMerchantFullRes:'Capacidade de tokens atingida.',CommandReportTokenMerchantRefuseRes:'Oferta recusada.',CommandReportTokenMerchantCannotAffordRes:'Saldo insuficiente.',CommandReportTokenMerchantCharityAlreadyUsedRes:'A ajuda desta semana já foi recebida.'};if(own(s,n))return '*✦ MERCADOR DE TOKENS*\n'+s[n];
 if(n==='CommandReportTokenMerchantBoughtRes'||n==='CommandReportTokenMerchantCharityRes')return '*✦ MERCADOR DE TOKENS*\n'+(pos(p?.amount)?fmt(p.amount)+' token(s) '+(n.endsWith('BoughtRes')?'comprado(s).':'recebido(s) como ajuda.'):'Resultado incompleto. Consulte /perfil.');
 return null;
}
module.exports={K,kinds,menu,result,details,describe};
