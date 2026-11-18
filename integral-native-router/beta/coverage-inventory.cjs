'use strict';
// Structural inventory only; this NEVER claims gameplay or WhatsApp verification.
// Crownicles/Crownicles@64d08c05f11949029317341735f6f73024f19f9b
const {NATIVE_READ_HANDLERS,NATIVE_MENU_HANDLERS,NATIVE_AUTH_HANDLERS,NATIVE_EXPANSION_HANDLERS}=require('./feature-manifest.cjs');
const {NATIVE,REVIEWED_LIVE_KEYS}=require('./bridge/native-universal.cjs');
const CORE_BASE=Object.freeze({
 CommandReportPacketReq:'commands/player/ReportCommand.js',
 CommandProfilePacketReq:'commands/player/ProfileCommand.js',
 CommandInventoryPacketReq:'commands/player/InventoryCommand.js',
 CommandMissionsPacketReq:'commands/mission/MissionsCommand.js'
});
const FAMILIES=Object.freeze([
 ['core-base',CORE_BASE],['read',NATIVE_READ_HANDLERS],['menu',NATIVE_MENU_HANDLERS],
 ['native-authorization',NATIVE_AUTH_HANDLERS],['pending-expansion',NATIVE_EXPANSION_HANDLERS]
]);
function inventory(){
 const rows=[],seen=new Set();
 for(const [family,mapping] of FAMILIES)for(const [packet,source] of Object.entries(mapping)){
  if(seen.has(packet))throw Error('CORE_HANDLER_DUPLICATE_'+packet);
  seen.add(packet);
  if(!/^Command[A-Za-z]+(?:PacketReq|ActionReq)$/.test(packet)||!/^commands\/(?:player|pet|guild|mission)\/[A-Za-z]+\.js$/.test(source))throw Error('CORE_PATH_UNREVIEWED_'+packet);
  const native=Object.entries(NATIVE).find(([key,def])=>def.request===packet&&REVIEWED_LIVE_KEYS.includes(key));
  rows.push(Object.freeze({
   family,packet,source,
   reviewedOffline:Boolean(native),
   reviewedAliases:native?native[1].aliases:[],
   runtimeRegistration:'requires actual Core packetListener verification',
   whatsappEndToEnd:'not demonstrated by this inventory'
  }));
 }
 return Object.freeze({upstream:'Crownicles/Crownicles@64d08c05f11949029317341735f6f73024f19f9b',
  totalHandlerContracts:rows.length,
  familyCounts:Object.fromEntries(FAMILIES.map(([name,obj])=>[name,Object.keys(obj).length])),
  reviewedOfflineCount:rows.filter(x=>x.reviewedOffline).length,
  rows:Object.freeze(rows)});
}
if(require.main===module)process.stdout.write(JSON.stringify(inventory(),null,2)+'\n');
module.exports={inventory,CORE_BASE,FAMILIES};
