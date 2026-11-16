'use strict';
/* Baileys 6.7-7.x can deliver participant as LID, while owner config is PN.
 * Never interpret unrelated LID digits as a phone number.
 * Prefer WhatsApp-provided PN fields, then the authenticated Baileys cache.
 */
const {normalizeJid}=require('./entrada.cjs');
async function resolveIncomingSender(msg,socket){
 const key=msg?.key||{};
 const chatJid=normalizeJid(key.remoteJid||'');
 if(!chatJid)return {chatJid:null,senderJid:null,mode:'invalid'};
 if(!chatJid.endsWith('@g.us'))return {chatJid,senderJid:chatJid,mode:'direct'};
 for(const raw of [key.participantPn,key.participantAlt,key.senderPn,key.remoteJidPn,key.participant]){
  const jid=normalizeJid(raw);
  if(jid?.endsWith('@s.whatsapp.net'))return {chatJid,senderJid:jid,mode:'pn'};
 }
 const lid=normalizeJid(key.participant||'');
 if(lid?.endsWith('@lid')){
  try{
   const pn=normalizeJid(await socket?.signalRepository?.lidMapping?.getPNForLID?.(lid));
   if(pn?.endsWith('@s.whatsapp.net'))return {chatJid,senderJid:pn,mode:'mapped'};
  }catch{} // Mapping is optional and must never change authorization on failure.
  return {chatJid,senderJid:lid,mode:'lid-unresolved'};
 }
 return {chatJid,senderJid:null,mode:'no-participant'};
}
module.exports={resolveIncomingSender};
