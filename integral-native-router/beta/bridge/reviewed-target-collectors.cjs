'use strict';
// Crownicles 6.2.0.b @64d08c05. A public game reference is NOT identity authentication.
// Requests use the existing verified WA binding, one-use preview, Core listener and Core authorization.
// A second native collector must match the exact UUID and request authorized by this actor.
const crypto=require('node:crypto'),{recipientJid}=require('./two-party-collector.cjs');
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const REF=/^P-[A-F0-9]{20}$/;
const RC='ReactionCollector',AC=RC+'AcceptReaction',NO=RC+'RefuseReaction';
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),own=(x,k)=>Object.hasOwn(x,k);
const exact=(x,ks)=>obj(x)&&Object.keys(x).length===ks.length&&ks.every(k=>own(x,k));
const id=x=>typeof x==='string'&&UUID.test(x),int=x=>Number.isSafeInteger(x)&&x>=0;
const safeName=x=>typeof x==='string'&&x.trim()===x&&x.length>0&&x.length<=70&&!/[\x00-\x1f\x7f<>*_~\x60@]/.test(x);
const DEFS=Object.freeze({
 promote:Object.freeze({verb:'/promoveranciao',request:'CommandGuildElderPacketReq',kind:RC+'GuildElderData',field:'promotedKeycloakId',title:'✦ PROMOVER A ANCIÃO',action:'Promover',detail:'O posto de ancião é único. A promoção pode substituir o ancião atual. O Core deve validar a chefia e a participação na mesma guilda.'}),
 kick:Object.freeze({verb:'/expulsarguilda',request:'CommandGuildKickPacketReq',kind:RC+'GuildKickData',field:'kickedKeycloakId',title:'✦ EXPULSAR DA GUILDA',action:'Expulsar',detail:'O Core verifica chefia, guilda e alvo. Expulsar remove o jogador da guilda.'}),
 unlock:Object.freeze({verb:'/libertarjogador',request:'CommandUnlockPacketReq',kind:RC+'UnlockData',field:'unlockedKeycloakId',title:'✦ LIBERTAR JOGADOR PRESO',action:'Libertar',detail:'Custo original: 3.000 moedas do personagem que solicita. O Core verifica a prisão e o saldo.'})
});
const byKind=Object.fromEntries(Object.entries(DEFS).map(([k,d])=>[d.kind,k]));
const REMOVE=RC+'GuildElderRemoveData',POOR=RC+'InteractOtherPlayersPoorData',SKIP=RC+'SkipMissionShopItemData';
const kinds=new Set([...Object.keys(byKind),REMOVE,POOR,SKIP]);
const ready=(fn,n)=>{try{return typeof fn==='function'&&fn(n)===true}catch{return false}};
function reference(origin,playerId){
 if(typeof origin!=='string'||!/^crownicles-wa-v1-[a-f0-9-]{36}$/i.test(origin)||!id(playerId))return null;
 return 'P-'+crypto.createHmac('sha256',origin).update('player-reference-v1:'+playerId.toLowerCase()).digest('hex').slice(0,20).toUpperCase();
}
function resolveReference(ref,{origin,bindings}={}){
 if(!REF.test(ref)||!obj(bindings))return null;
 const matches=[...new Set(Object.values(bindings).filter(id))].filter(p=>reference(origin,p)===ref);
 return matches.length===1&&recipientJid(bindings,matches[0])?matches[0]:null;
}
function verifiedActor(actorId,actorWa,ctx){return id(actorId)&&recipientJid(ctx?.bindings,actorId)===actorWa;}
function bindingProof(proof,actorId,actorWa,ctx){
 if(!exact(proof,['key','actorId','targetId','ref'])||!own(DEFS,proof.key)||proof.actorId!==actorId||!verifiedActor(actorId,actorWa,ctx)||proof.targetId===actorId||!id(proof.targetId)||!REF.test(proof.ref)||resolveReference(proof.ref,ctx)!==proof.targetId)return false;
 return ready(ctx.canSendPacket,DEFS[proof.key].request)&&ready(ctx.canSendPacket,'ReactionCollectorReactPacket');
}
function parse(text,actorId,actorWa,ctx){
 if(typeof text!=='string')return null;
 const [raw,...rest]=text.trim().split(/\s+/),verb=raw.toLowerCase();
 if(verb==='/minharef'){
  const ref=verifiedActor(actorId,actorWa,ctx)&&reference(ctx.origin,actorId);
  return {local:!rest.length&&ref?'*✦ REFERÊNCIA DO PERSONAGEM*\n'+ref+'\nIdentificador do RPG para reconhecer seu personagem. Não é senha, código de participação nem autorização.':'Referência indisponível: confirme seu vínculo no privado.'};
 }
 const key=Object.keys(DEFS).find(k=>DEFS[k].verb===verb||(k==='promote'&&verb==='/promoverancião')||(k==='unlock'&&verb==='/soltarjogador'));
 if(!key)return null;
 const def=DEFS[key],ref=rest.length===1?rest[0].toUpperCase():'';
 // Keep old numeric rank commands disabled. Rank can change between lookup and dispatch.
 if(!REF.test(ref))return {local:'Esse comando por rank, nome ou UUID não foi homologado. Use '+def.verb+' P-REFERÊNCIA, obtida em /guilda ou compartilhada pelo jogador via /minharef.'};
 const targetId=resolveReference(ref,ctx),proof={key,actorId,targetId,ref};
 if(!bindingProof(proof,actorId,actorWa,ctx))return {local:'Referência inválida, ambígua, própria ou recurso indisponível. Nada foi enviado ao motor.'};
 return {proof};
}
function makeMenu(proof,actorId,actorWa,ctx,now=Date.now()){
 if(!bindingProof(proof,actorId,actorWa,ctx))return null;
 const d=DEFS[proof.key];
 return {id:'wa-target-'+crypto.randomUUID(),endTime:now+90000,type:'LocalVerifiedTargetAuthorization',title:d.title,story:'Personagem: '+proof.ref+'\n'+d.detail+'\nPrimeira autorização: solicitar a verificação original do Core. Ainda não altera o jogo.',restrictedToPlayerId:actorId,targetProof:{...proof},options:[{kind:'targetRequest',label:'Solicitar '+d.action.toLowerCase()+' · '+proof.ref,supported:true,requiresConfirmation:true},{kind:'nativeCancel',label:'Cancelar sem enviar ao motor',supported:true,requiresConfirmation:false}]};
}
function authorize(menu,choice,actorId,actorWa,ctx,now=Date.now()){
 if(menu?.type!=='LocalVerifiedTargetAuthorization'||!/^wa-target-[a-f0-9-]{36}$/i.test(menu.id)||!Number.isSafeInteger(menu.endTime)||now>=menu.endTime||menu.restrictedToPlayerId!==actorId||menu.options?.[0]!==choice||choice.kind!=='targetRequest'||choice.supported!==true||choice.requiresConfirmation!==true||!bindingProof(menu.targetProof,actorId,actorWa,ctx))return null;
 const proof=menu.targetProof,d=DEFS[proof.key];
 if(choice.label!=='Solicitar '+d.action.toLowerCase()+' · '+proof.ref)return null;
 return {name:d.request,data:proof.key==='promote'?{askedPlayerKeycloakId:proof.targetId}:{askedPlayer:{keycloakId:proof.targetId}},proof:{...proof}};
}
const option=(label,supported=true,requiresConfirmation=false)=>({label,supported,requiresConfirmation});
const binary=rx=>rx.length===2&&rx.every(x=>obj(x)&&exact(x.data,[])&&[AC,NO].includes(x.type))&&new Set(rx.map(x=>x.type)).size===2;
function nativeMenu(p,actorId,actorWa,ctx={},proof=null){
 const kind=p?.data?.type,d=p?.data?.data,rx=p?.reactions;
 if(!kinds.has(kind)||kind===SKIP||!id(actorId)||!id(p.id)||!Number.isSafeInteger(p.endTime)||p.endTime<=Date.now()||!obj(d)||!Array.isArray(rx)||!binary(rx))return null;
 if(kind===POOR){
  if(!Object.keys(d).every(k=>['keycloakId','rank'].includes(k))||!id(d.keycloakId)||d.keycloakId===actorId||(d.rank!==undefined&&!int(d.rank)))return null;
  return {title:'✦ UM PEDIDO DE AJUDA',story:'Um viajante sem muitos recursos pede ajuda. Você pode oferecer 1 moeda do jogo ao personagem escolhido pelo Core. A doação é anônima nesta interface.',restrictedToPlayerId:actorId,options:rx.map(x=>x.type===AC?option('Oferecer 1 moeda ao viajante',true,true):option('Seguir viagem sem doar'))};
 }
 if(kind===REMOVE){
  if(!exact(d,['guildName','demotedKeycloakId'])||!safeName(d.guildName)||!id(d.demotedKeycloakId)||d.demotedKeycloakId===actorId)return null;
  return {title:'✦ REMOVER ANCIÃO',story:'Guilda: '+d.guildName+'\nO Core original pode reavaliar quem ocupa o cargo depois desta tela. A remoção está bloqueada até que a identidade seja revalidada dentro da transação.',restrictedToPlayerId:actorId,options:rx.map(x=>x.type===NO?option('Cancelar remoção'):option('Remover ancião · indisponível',false))};
 }
 const key=byKind[kind],def=DEFS[key],isGuild=key!=='unlock';
 if(!exact(d,isGuild?['guildName',def.field]:[def.field])||(isGuild&&!safeName(d.guildName))||!id(d[def.field])||d[def.field]===actorId)return null;
 const verified=bindingProof(proof,actorId,actorWa,ctx)&&proof.key===key&&proof.targetId===d[def.field];
 const story=(isGuild?'Guilda: '+d.guildName+'\n':'')+(verified?'Personagem confirmado pelo Core: '+proof.ref+'\n'+def.detail:'Identidade da solicitação não confirmada. Apenas o cancelamento está disponível.');
 return {title:def.title,story,restrictedToPlayerId:actorId,...(verified?{targetProof:{...proof}}:{}),options:rx.map(x=>x.type===NO?option('Recusar sem aplicar a ação'):verified?option(def.action+' '+proof.ref+(key==='unlock'?' · 3.000 moedas':''),true,true):option('Identidade não verificada',false))};
}
function authorizeReaction(menu,choice,actorId,actorWa,ctx){
 if(!own(byKind,menu?.type))return true;
 // Refuse is the only non-confirmed action. Never let legacy menus authorize target mutations.
 if(choice?.requiresConfirmation!==true)return choice?.supported===true&&choice.label==='Recusar sem aplicar a ação';
 const proof=menu.targetProof,d=DEFS[byKind[menu.type]];
 return menu.restrictedToPlayerId===actorId&&bindingProof(proof,actorId,actorWa,ctx)&&proof.key===byKind[menu.type]&&choice.supported===true&&choice.label===d.action+' '+proof.ref+(proof.key==='unlock'?' · 3.000 moedas':'');
}
function roster(p,actorId,actorWa,ctx){
 const d=p?.data;
 if(p?.foundGuild!==true||p.askedPlayerKeycloakId!==actorId||!verifiedActor(actorId,actorWa,ctx)||!obj(d)||!safeName(d.name)||!Array.isArray(d.members)||!d.members.length||d.members.length>100||!int(d.chiefId)||!(d.elderId===null||int(d.elderId)))return '';
 const ms=d.members;if(!ms.every(m=>obj(m)&&int(m.id)&&id(m.keycloakId)&&(m.rank===null||int(m.rank)))||new Set(ms.map(m=>m.id)).size!==ms.length||new Set(ms.map(m=>m.keycloakId)).size!==ms.length||!ms.some(m=>m.keycloakId===actorId)||!ms.some(m=>m.id===d.chiefId)||(d.elderId!==null&&!ms.some(m=>m.id===d.elderId)))return '';
 const rows=ms.map(m=>{const role=m.id===d.chiefId?'Chefe':m.id===d.elderId?'Ancião':'Membro',ref=reference(ctx.origin,m.keycloakId);return role+(m.keycloakId===actorId?' · Você':'')+(m.rank>0?' · rank '+m.rank:'')+' · '+(ref&&resolveReference(ref,ctx)===m.keycloakId?ref:'sem vínculo WA verificável');});
 return ['*✦ MEMBROS DA GUILDA*',...rows,'A referência identifica um personagem do RPG, nunca autoriza uma ação.'].join('\n');
}
function result(n,p){
 const names={CommandGuildElderFoundPlayerPacketRes:'Personagem não encontrado.',CommandGuildElderSameGuildPacketRes:'O Core não validou a guilda do personagem.',CommandGuildElderHimselfPacketRes:'Você não pode promover a si mesmo.',CommandGuildElderAlreadyElderPacketRes:'O personagem já é ancião.',CommandGuildElderRefusePacketRes:'Promoção recusada.'};
 if(own(names,n))return '*✦ GUILDA*\n'+names[n];
 if(n==='CommandGuildElderAcceptPacketRes')return id(p?.promotedKeycloakId)&&safeName(p.guildName)?'*✦ GUILDA*\nO Core confirmou uma promoção a ancião em '+p.guildName+'.':'*✦ GUILDA*\nResultado incompleto. Consulte /guilda.';
 if(n==='SmallEventInteractOtherPlayersAcceptToGivePoorPacket')return '*✦ AJUDA AO VIAJANTE*\nA escolha de oferecer 1 moeda foi processada. O Core não confirma a transferência neste pacote; consulte /perfil para conferir o saldo.';
 if(n==='SmallEventInteractOtherPlayersRefuseToGivePoorPacket')return '*✦ AJUDA AO VIAJANTE*\nVocê seguiu viagem sem doar.';
 return null;
}
module.exports={DEFS,kinds,REMOVE,POOR,SKIP,reference,resolveReference,parse,makeMenu,authorize,nativeMenu,authorizeReaction,roster,result,bindingProof};
