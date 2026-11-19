'use strict';
// Original MissionManagerShopItems.ts and ReactionCollectorSkipMissionShopItem.ts.
// A prior shop quote is informative only. The original callback re-reads and charges
// the weekly count AFTER replacing the mission; the bridge cannot enforce a price cap.
const RC='ReactionCollector',K=RC+'SkipMissionShopItemData',SHOP=RC+'ShopData',CHOICE=RC+'SkipMissionShopItemReaction',CLOSE=RC+'SkipMissionShopItemCloseReaction';
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),own=(x,k)=>Object.hasOwn(x,k),exact=(x,k)=>obj(x)&&Object.keys(x).length===k.length&&k.every(v=>own(x,v));
const int=x=>Number.isSafeInteger(x)&&x>=0,uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(x);
const fmt=x=>x.toLocaleString('pt-BR');
const option=(label,supported=true,requiresConfirmation=false)=>({label,supported,requiresConfirmation});
const missionFields=['missionId','missionObjective','missionVariant','numberDone','missionType'],optional=['saveBlob','expiresAt','fightAction','mapType'];
function validMission(x){
 return obj(x)&&missionFields.every(k=>own(x,k))&&Object.keys(x).every(k=>missionFields.includes(k)||optional.includes(k))&&typeof x.missionId==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(x.missionId)&&int(x.missionObjective)&&x.missionObjective>0&&Number.isSafeInteger(x.missionVariant)&&int(x.numberDone)&&['daily','sideMission'].includes(x.missionType)&&optional.every(k=>x[k]===undefined||x[k]===null||(typeof x[k]==='string'&&x[k].length<=65536));
}
function description(m,models,missionName){
 const name=typeof missionName==='function'?missionName(models,m):'Objetivo';
 return (m.missionType==='daily'?'Diária':'Secundária')+' · '+name+' · '+fmt(m.numberDone)+'/'+fmt(m.missionObjective);
}
function isSkipOffer(r){return r?.type===RC+'ShopItemReaction'&&r.data?.shopItemId===13;}
function shopOption(r,d,original,actorId){
 if(!isSkipOffer(r))return original;
 const x=r.data;
 if(!exact(x,['shopCategoryId','shopItemId','price','amount'])||x.shopCategoryId!=='services'||x.amount!==1||!int(x.price)||d?.currency!=='gem'||!int(d.availableCurrency)||d.availableCurrency<x.price||!uuid(actorId)||original?.supported!==true)return option('Oferta de troca indisponível',false);
 return {...option('Consultar missões substituíveis · cotação de '+fmt(x.price)+' gema(s) · sem substituir agora',true,true),skipQuote:{actorId,price:x.price,currency:'gem'}};
}
function validQuote(q,actorId){return exact(q,['actorId','price','currency'])&&uuid(actorId)&&q.actorId===actorId&&int(q.price)&&q.currency==='gem';}
function menu(p,actorId,models,missionName,quote){
 const d=p?.data?.data,rx=p?.reactions;
 if(p?.data?.type!==K||!uuid(actorId)||!uuid(p.id)||!Number.isSafeInteger(p.endTime)||p.endTime<=Date.now()||!exact(d,[])||!Array.isArray(rx)||rx.length<2||rx.length>100||!rx.every(x=>obj(x)&&obj(x.data))||rx.at(-1).type!==CLOSE||!exact(rx.at(-1).data,[]))return null;
 const choices=rx.slice(0,-1);
 if(!choices.every((x,i)=>x.type===CHOICE&&exact(x.data,['missionIndex','mission'])&&x.data.missionIndex===i&&validMission(x.data.mission)))return null;
 const descriptions=choices.map((x,i)=>(i+1)+'. '+description(x.data.mission,models,missionName));
 const cost=validQuote(quote,actorId)?'Cotação da loja anterior: '+fmt(quote.price)+' gema(s).':'Não há cotação anterior vinculada a esta sessão.';
 return {title:'✦ SUBSTITUIÇÃO DE MISSÕES',story:[cost,'A troca está bloqueada: o Core original pode recalcular o preço depois de remover sua missão. Nenhuma gema será autorizada nesta tela.','Objetivos oferecidos pelo Core:',...descriptions,'Você pode voltar sem modificar suas missões.'].join('\n'),restrictedToPlayerId:actorId,options:[...choices.map(()=>option('Substituição indisponível',false)),option('Fechar sem substituir missão')]};
}
function authorizeReaction(menu,choice,actorId){return menu?.type!==K||(menu.restrictedToPlayerId===actorId&&choice===menu.options?.at(-1)&&choice?.label==='Fechar sem substituir missão'&&choice.supported===true&&choice.requiresConfirmation===false);}
function result(n,p,models,missionName){
 if(n==='CommandMissionShopNoMissionToSkip')return '*✦ MISSÕES*\nNão há missão substituível.';
 if(n!=='CommandMissionShopSkipMissionResult')return null;
 if(!validMission(p?.oldMission)||!validMission(p?.newMission))return '*✦ MISSÕES*\nResultado incompleto. Consulte /missoes e /perfil; não repita a operação.';
 return '*✦ MISSÃO SUBSTITUÍDA PELO CORE*\nAnterior: '+description(p.oldMission,models,missionName)+'\nNova: '+description(p.newMission,models,missionName)+'\nO pacote não informa o total cobrado. Confira suas gemas em /perfil.';
}
module.exports={K,SHOP,isSkipOffer,shopOption,validQuote,menu,authorizeReaction,result,validMission};
