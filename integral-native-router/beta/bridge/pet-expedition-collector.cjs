'use strict';
/** Original Crownicles 6.2.0.b pet expedition decision renderer; no game rules. */
const {isDeepStrictEqual}=require('node:util');
const K={choice:'ReactionCollectorPetExpeditionChoiceData',active:'ReactionCollectorPetExpeditionData',finished:'ReactionCollectorPetExpeditionFinishedData'};
const R={select:'ReactionCollectorPetExpeditionSelectReaction',cancel:'ReactionCollectorPetExpeditionCancelReaction',recall:'ReactionCollectorPetExpeditionRecallReaction',close:'ReactionCollectorPetExpeditionCloseReaction',claim:'ReactionCollectorPetExpeditionClaimReaction'};
const locations=new Set(['forest','mountain','desert','swamp','ruins','cave','plains','coast']);
const placeNames={forest:'Floresta',mountain:'Montanhas',desert:'Deserto',swamp:'Pântano',ruins:'Ruínas',cave:'Cavernas',plains:'Planícies',coast:'Litoral'};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const nat=x=>Number.isSafeInteger(x)&&x>=0;
const positive=x=>Number.isSafeInteger(x)&&x>0;
const percentage=x=>Number.isFinite(x)&&x>=0&&x<=100;
const safeText=(x,max=64)=>typeof x==='string'&&x.length<=max&&!/[\x00-\x1f\x7f*_~\x60<>]/.test(x);
const name=x=>x?.petNickname&&safeText(x.petNickname,48)?x.petNickname:'seu companheiro';
const pet=x=>obj(x)&&nat(x.petTypeId)&&['m','f'].includes(x.petSex)&&(!Object.hasOwn(x,'petNickname')||safeText(x.petNickname,48));
const keysOnly=(x,keys)=>obj(x)&&Object.keys(x).every(k=>keys.includes(k));
const empty=x=>obj(x)&&Object.keys(x).length===0;
const option=(label,confirmation=false)=>({label,supported:true,requiresConfirmation:confirmation});
const f=x=>Number(x).toLocaleString('pt-BR',{maximumFractionDigits:2});
function validExp(x){
 if(!obj(x)||!keysOnly(x,['id','mapLocationId','locationType','durationMinutes','displayDurationMinutes','riskRate','difficulty','foodCost','rewardIndex','isDistantExpedition','hasCloneTalismanBonus','hasBonusTokens']))return false;
 return safeText(x.id,80)&&x.id.length>0&&nat(x.mapLocationId)&&locations.has(x.locationType)&&positive(x.durationMinutes)&&positive(x.displayDurationMinutes)&&percentage(x.riskRate)&&percentage(x.difficulty)&&nat(x.foodCost)&&nat(x.rewardIndex)&&x.rewardIndex<=9
  &&['isDistantExpedition','hasCloneTalismanBonus','hasBonusTokens'].every(k=>!Object.hasOwn(x,k)||typeof x[k]==='boolean');
}
function validContext(x,kind){
 if(!obj(x)||!pet(x.pet)||!nat(x.mapLocationId)||!locations.has(x.locationType)||!percentage(x.riskRate))return false;
 if(Object.hasOwn(x,'foodConsumed')&&!nat(x.foodConsumed))return false;
 if(Object.hasOwn(x,'isDistantExpedition')&&typeof x.isDistantExpedition!=='boolean')return false;
 if(kind===K.active){
  if(!Number.isSafeInteger(x.returnTime)||x.returnTime<1000000000000||x.returnTime>100000000000000)return false;
  if(Object.hasOwn(x,'foodConsumedDetails')&&!Array.isArray(x.foodConsumedDetails))return false;
 }
 return true;
}
function compileCollector(packet){
 const kind=packet?.data?.type;
 if(!Object.values(K).includes(kind))return null;
 if(!obj(packet)||!obj(packet.data)||!obj(packet.data.data)||!Array.isArray(packet.reactions)||packet.reactions.length<1||packet.reactions.length>20||!Number.isSafeInteger(packet.endTime)||packet.endTime<1000000000000)return null;
 const d=packet.data.data,rx=packet.reactions;
 if(!rx.every(x=>obj(x)&&typeof x.type==='string'&&obj(x.data)))return null;
 const who=name(d.pet);
 if(kind===K.choice){
  if(!pet(d.pet)||typeof d.hasGuild!=='boolean'||!Array.isArray(d.expeditions)||d.expeditions.length<1||d.expeditions.length>12||rx.length!==d.expeditions.length+1||!d.expeditions.every(validExp)||new Set(d.expeditions.map(x=>x.id)).size!==d.expeditions.length||!keysOnly(d,['pet','expeditions','hasGuild','guildFoodAmount'])||(d.guildFoodAmount!==undefined&&!nat(d.guildFoodAmount)))return null;
  const ids=new Set(),options=[];let cancellations=0;
  const byId=new Map(d.expeditions.map(x=>[x.id,x]));
  for(const r of rx){
   if(r.type===R.cancel){if(!empty(r.data)||++cancellations!==1)return null;options.push(option('Cancelar escolha de expedição (pode diminuir a afinidade)',true));continue}
   if(r.type!==R.select||!keysOnly(r.data,['expedition'])||!validExp(r.data.expedition))return null;
   const selected=r.data.expedition,truth=byId.get(selected.id);
   if(!truth||ids.has(selected.id)||!isDeepStrictEqual(selected,truth))return null;
   ids.add(selected.id);
   const poorFood=d.hasGuild&&nat(d.guildFoodAmount)&&d.guildFoodAmount<selected.foodCost;
   const label=placeNames[selected.locationType]+' · '+f(selected.displayDurationMinutes)+' min · risco '+f(selected.riskRate)+'% · dificuldade '+f(selected.difficulty)+'/100 · ração '+f(selected.foodCost)+(poorFood?' · estoque insuficiente (risco maior)':'');
   options.push(option(label,true));
  }
  if(ids.size!==d.expeditions.length||cancellations!==1)return null;
  return {kind,title:'✦ ESCOLHER EXPEDIÇÃO',story:'Selecione uma viagem para '+who+'. Duração, risco, alimentação e recompensas são calculados pelo Crownicles original. O cancelamento também pode afetar a afinidade.',options};
 }
 if(!validContext(d,kind))return null;
 if(kind===K.active){
  if(!keysOnly(d,['pet','mapLocationId','locationType','riskRate','returnTime','foodConsumed','foodConsumedDetails','isDistantExpedition'])||rx.length!==2||rx.filter(x=>x.type===R.recall).length!==1||rx.filter(x=>x.type===R.close).length!==1||rx.some(x=>!empty(x.data)))return null;
  return {kind,title:'✦ EXPEDIÇÃO EM ANDAMENTO',story:who+' está em '+placeNames[d.locationType]+'. Retorno previsto: '+new Date(d.returnTime).toLocaleString('pt-BR')+'. Recolher antes do fim reduz a afinidade.',options:rx.map(x=>x.type===R.recall?option('Recolher companheiro agora (perda de afinidade)',true):option('Apenas fechar consulta'))};
 }
 if(!keysOnly(d,['pet','mapLocationId','locationType','riskRate','foodConsumed','isDistantExpedition'])||rx.length!==1||rx[0].type!==R.claim||!empty(rx[0].data))return null;
 return {kind,title:'✦ EXPEDIÇÃO CONCLUÍDA',story:who+' regressou de '+placeNames[d.locationType]+'. As recompensas serão apuradas exclusivamente pelo Core após sua confirmação.',options:[option('Resgatar recompensas da expedição',true)]};
}
module.exports={compileCollector,K,R,validExp,validContext};
