'use strict';
/** WhatsApp-only presentation of original two-player Crownicles Core requests. */
const crypto=require('node:crypto');
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const CODE=/^[A-F0-9]{16}$/;
const COMMANDS=Object.freeze({
 '/convidarguilda':{name:'CommandGuildInvitePacketReq',price:false,title:'✦ CONVIDAR PARA GUILDA'},
 '/oferecerpet':{name:'CommandPetSellPacketReq',price:true,title:'✦ OFERTA DIRECIONADA DE PET'}
});
function parse(text){
 if(typeof text!=='string')return null;
 const xs=text.trim().split(/\s+/),verb=xs[0]?.toLocaleLowerCase('pt-BR');
 if(verb==='/meucodigo')return xs.length===1?{codeRequest:true}:{error:'Use apenas /meucodigo.'};
 const def=COMMANDS[verb];if(!def)return null;
 if(xs.length!==(def.price?3:2)||!CODE.test(String(xs[1]||'').toUpperCase())||def.price&&!/^[1-9]\d{0,8}$/.test(xs[2]||''))return {error:def.price?'Uso: /oferecerpet CODIGO VALOR':'Uso: /convidarguilda CODIGO'};
 return {action:verb,code:xs[1].toUpperCase(),price:def.price?Number(xs[2]):undefined};
}
function recipientCodeHash(code){return CODE.test(code)?crypto.createHash('sha256').update('crownicles-beta-social-v1:'+code).digest('hex'):null}
function makeMenu(request,recipient,actorId,now=Date.now()){
 if(!request||!COMMANDS[request.action]||!recipient||!UUID.test(actorId)||!UUID.test(recipient.player_id)||recipient.player_id===actorId||recipient.expires_at<=now||recipient.used!==0)return null;
 const def=COMMANDS[request.action],data=def.price?{price:request.price,askedPlayer:{keycloakId:recipient.player_id}}:{invitedPlayerKeycloakId:recipient.player_id};
 const expiry=Math.min(now+90000,recipient.expires_at);
 const label=def.price?'Oferecer pet por '+request.price.toLocaleString('pt-BR')+' moedas':'Enviar convite de guilda';
 return {id:'wa-social-'+crypto.randomUUID(),type:'LocalSocialNativeAuthorization',endTime:expiry,title:def.title,
  story:'Destinatário vinculado por código temporário. Esta primeira confirmação apenas solicita ao Core a proposta; a outra pessoa deverá aceitar no próprio WhatsApp, e o Core verificará os requisitos.',
  socialRequest:{name:def.name,data,codeDigest:recipient.digest,targetWa:recipient.wa,targetId:recipient.player_id},
  options:[{kind:'socialNative',label,supported:true,requiresConfirmation:true},{kind:'nativeCancel',label:'Cancelar sem enviar',supported:true,requiresConfirmation:false}]};
}
function authorized(menu,choice,actorId){
 if(!menu||menu.type!=='LocalSocialNativeAuthorization'||!UUID.test(actorId)||menu.options?.[0]!==choice||choice?.kind!=='socialNative'||choice.requiresConfirmation!==true||!Number.isSafeInteger(menu.endTime)||Date.now()>=menu.endTime)return null;
 const sr=menu.socialRequest;
 if(!sr||!['CommandGuildInvitePacketReq','CommandPetSellPacketReq'].includes(sr.name)||!UUID.test(sr.targetId)||sr.targetId===actorId||!/^[0-9a-f]{64}$/.test(sr.codeDigest)||!/^\d{8,25}@(s\.whatsapp\.net|lid)$/.test(sr.targetWa))return null;
 const valid=sr.name==='CommandGuildInvitePacketReq'?Object.keys(sr.data).length===1&&sr.data.invitedPlayerKeycloakId===sr.targetId:Object.keys(sr.data).length===2&&Number.isSafeInteger(sr.data.price)&&sr.data.price>0&&sr.data.price<=999999999&&sr.data.askedPlayer?.keycloakId===sr.targetId;
 if(!valid)return null;
 return {name:sr.name,data:sr.data,consent:{digest:sr.codeDigest,wa:sr.targetWa,playerId:sr.targetId}};
}
module.exports={parse,recipientCodeHash,makeMenu,authorized,COMMANDS};
