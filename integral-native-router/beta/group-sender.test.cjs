'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {resolveIncomingSender}=require('./group-sender.cjs');
const GROUP='120363111111111111@g.us', OWNER='5511999000099@s.whatsapp.net',LID='123456789012345@lid';
test('participante telefone original',async()=>{
 const x=await resolveIncomingSender({key:{remoteJid:GROUP,participant:OWNER}});
 assert.equal(x.senderJid,OWNER);assert.equal(x.mode,'pn');
});
test('Baileys alternate PN prevalece sobre LID',async()=>{
 const x=await resolveIncomingSender({key:{remoteJid:GROUP,participant:LID,participantAlt:OWNER}});
 assert.equal(x.senderJid,OWNER);assert.equal(x.mode,'pn');
});
test('LID mapeado por cache do socket',async()=>{
 const sock={signalRepository:{lidMapping:{getPNForLID:async id=>id===LID?OWNER:null}}};
 const x=await resolveIncomingSender({key:{remoteJid:GROUP,participant:LID}},sock);
 assert.equal(x.senderJid,OWNER);assert.equal(x.mode,'mapped');
});
test('LID sem mapeamento mantem LID sem elevar privilegios',async()=>{
 const x=await resolveIncomingSender({key:{remoteJid:GROUP,participant:LID}});
 assert.equal(x.senderJid,LID);assert.equal(x.mode,'lid-unresolved');
});
test('Mensagem grupo sem participante nao imputa identidade bot',async()=>{
 const x=await resolveIncomingSender({key:{remoteJid:GROUP}});
 assert.equal(x.senderJid,null);assert.equal(x.mode,'no-participant');
});
test('Chat privado usa JID da propria conversa',async()=>{
 const x=await resolveIncomingSender({key:{remoteJid:OWNER}});
 assert.equal(x.senderJid,OWNER);assert.equal(x.mode,'direct');
});
