'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {inventory}=require('./coverage-inventory.cjs');
test('44 distinct original command contracts are inventoried, not 183 misc command files',()=>{
 const r=inventory();a.equal(r.totalHandlerContracts,44);a.equal(new Set(r.rows.map(x=>x.packet)).size,44);
 a.deepEqual(r.familyCounts,{'core-base':4,'read':16,'menu':7,'native-authorization':4,'pending-expansion':13});
});
test('separates structural mapping, offline review and real WhatsApp verification',()=>{
 const r=inventory();a.equal(r.rows.every(x=>x.runtimeRegistration==='requires actual Core packetListener verification'),true);
 a.equal(r.rows.every(x=>x.whatsappEndToEnd==='not demonstrated by this inventory'),true);
 a.equal(r.reviewedOfflineCount,6); // Seventh reviewed intent is expedition resolution inside CoreHandlers, not a new public command.
});
test('all reviewed expansion commands require a known original packet',()=>{
 const r=inventory();
 const reviewed=r.rows.filter(x=>x.reviewedOffline).map(x=>x.packet);
 a.deepEqual(reviewed.sort(),[
  'CommandGuildCreatePacketReq','CommandGuildDescriptionPacketReq','CommandGuildLeavePacketReq',
  'CommandPetCaressPacketReq','CommandPetFreePacketReq','CommandPetTransferPacketReq'
 ].sort());
});
test('no social or pet transfer target mutation is misrepresented as offline-reviewed',()=>{
 const r=inventory(),blocked=['CommandGuildInvitePacketReq','CommandGuildKickPacketReq','CommandGuildElderPacketReq','CommandPetSellPacketReq','CommandUnlockPacketReq'];
 for(const name of blocked){const row=r.rows.find(x=>x.packet===name);a(row);a.equal(row.reviewedOffline,false);}
});
