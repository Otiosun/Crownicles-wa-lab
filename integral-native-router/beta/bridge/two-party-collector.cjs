'use strict';
/**
 * Official Crownicles 6.2.0.b two-party collectors.
 * Pure recipient/permission policy. No Core sends or game mutations.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const JID=/^[0-9]{8,25}@(s\.whatsapp\.net|lid)$/;
const ACCEPT='ReactionCollectorAcceptReaction',REFUSE='ReactionCollectorRefuseReaction';
const supportedKinds=new Set(['ReactionCollectorGuildInviteData','ReactionCollectorPetSellData']);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const isId=x=>typeof x==='string'&&UUID.test(x);
const safeName=x=>typeof x==='string'&&x.length>0&&x.length<=70&&!/[\x00-\x1f\x7f<>`*~@]/.test(x);
const clean=x=>x.replace(/[\r\n\t*_~]/g,' ').replace(/\s+/g,' ').trim();
const pet=x=>obj(x)&&Number.isSafeInteger(x.typeId)&&x.typeId>0&&safeName(x.nickname)&&['m','f'].includes(x.sex)&&Number.isSafeInteger(x.rarity)&&x.rarity>=0&&Number.isFinite(x.loveLevel)&&x.loveLevel>=0&&Number.isFinite(x.force)&&x.force>=0&&Number.isFinite(x.feedDelay)&&x.feedDelay>=0;
function recipientJid(bindings,playerId){
 if(!obj(bindings)||!isId(playerId))return null;
 const names=Object.entries(bindings).filter(([jid,id])=>id===playerId&&JID.test(jid));
 // Refuse unverified aliases and ambiguity instead of guessing a device.
 if(Object.values(bindings).filter(id=>id===playerId).length!==1||names.length!==1)return null;
 return names[0][0];
}
 // Relay only the exact collector authorized by the initiating conversation.
 // A valid-shaped social packet is not by itself proof of authorized intent.
function matchesAuthorizedProposal({packet,proof,actorId,actorWa,bindings}={}){
 if(!obj(proof)||proof.actorId!==actorId||proof.actorWa!==actorWa||bindings?.[actorWa]!==actorId||!isId(proof.targetId)||proof.targetId===actorId||recipientJid(bindings,proof.targetId)!==proof.targetWa)return false;
 const kind=packet?.data?.type,d=packet?.data?.data;
 if(!obj(d))return false;
 if(proof.name==='CommandGuildInvitePacketReq')return kind==='ReactionCollectorGuildInviteData'&&d.invitedPlayerKeycloakId===proof.targetId;
 if(proof.name==='CommandPetSellPacketReq')return kind==='ReactionCollectorPetSellData'&&d.sellerKeycloakId===actorId&&d.buyerKeycloakId===proof.targetId&&Number.isSafeInteger(proof.price)&&d.price===proof.price;
 return false;
}
function plan({packet,actorId,actorWa,bindings,now=Date.now()}={}){
 const kind=packet?.data?.type;
 if(!supportedKinds.has(kind))return {handled:false};
 const blocked=reason=>({handled:true,ok:false,reason});
 if(!obj(packet)||!isId(packet.id)||!Number.isSafeInteger(packet.endTime)||packet.endTime<=now||packet.endTime>now+30*60*1000||!obj(packet.data)||!obj(packet.data.data)||!Array.isArray(packet.reactions)||!isId(actorId)||!JID.test(actorWa)||bindings?.[actorWa]!==actorId)return blocked('contrato-invalido');
 const rx=packet.reactions;
 if(rx.length!==2||rx.filter(x=>x?.type===ACCEPT).length!==1||rx.filter(x=>x?.type===REFUSE).length!==1||rx.some(x=>!obj(x.data)||Object.keys(x.data).length!==0))return blocked('reacoes-invalidas');
 const d=packet.data.data;let recipientId,story,title;
 if(kind==='ReactionCollectorGuildInviteData'){
  if(Object.keys(d).sort().join('|')!=='guildName|invitedPlayerKeycloakId'||!safeName(d.guildName)||!isId(d.invitedPlayerKeycloakId))return blocked('destinatario-invalido');
  recipientId=d.invitedPlayerKeycloakId;title='✦ CONVITE PARA GUILDA';
  story=`Você recebeu um convite para a guilda «${clean(d.guildName)}». Só você pode aceitar. O Core verificará novamente os requisitos.`;
 }else{
  if(Object.keys(d).some(x=>!['sellerKeycloakId','buyerKeycloakId','price','pet'].includes(x))||!isId(d.sellerKeycloakId)||d.sellerKeycloakId!==actorId||!isId(d.buyerKeycloakId)||!Number.isSafeInteger(d.price)||d.price<=0||!pet(d.pet))return blocked('venda-sem-comprador-verificado');
  recipientId=d.buyerKeycloakId;title='✦ PROPOSTA DE COMPRA DE COMPANHEIRO';
  story=`Oferta de ${clean(d.pet.nickname)} (espécie ${d.pet.typeId}), por ${d.price.toLocaleString('pt-BR')} moedas. O Core verifica seu saldo, sua guilda e a disponibilidade antes de efetivar a compra.`;
 }
 if(recipientId===actorId)return blocked('mesmo-jogador');
 const to=recipientJid(bindings,recipientId);
 if(!to||to===actorWa)return blocked('destinatario-nao-verificado');
 const menu={id:packet.id,endTime:packet.endTime,type:kind,title,story,restrictedToPlayerId:recipientId,
  options:rx.map(x=>x.type===ACCEPT?{label:kind==='ReactionCollectorGuildInviteData'?'Aceitar convite':'Aceitar compra',supported:true,requiresConfirmation:true}:{label:'Recusar a proposta',supported:true,requiresConfirmation:false})};
 return {handled:true,ok:true,to,recipientId,menu,actorNotice:'*✦ PROPOSTA ENCAMINHADA*\nA proposta foi enfileirada para o WhatsApp privado do destinatário. Aguarde a decisão dele; o Core ainda verificará os requisitos.'};
}
module.exports={plan,recipientJid,supportedKinds,matchesAuthorizedProposal};
