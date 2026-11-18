'use strict';
/* Scope: Core 6.2.0.b handler registration, never native action execution. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {
 NATIVE_READ_HANDLERS,NATIVE_MENU_HANDLERS,NATIVE_AUTH_HANDLERS,
 NATIVE_EXPANSION_HANDLERS,probeExpansionHandlers,renderHelp
}=require('./feature-manifest.cjs');
const ALL=[
 'CommandFriendlyFightPacketReq','CommandUnlockPacketReq',
 'CommandGuildCreatePacketReq','CommandGuildDescriptionPacketReq',
 'CommandGuildElderPacketReq','CommandGuildElderRemovePacketReq',
 'CommandGuildInvitePacketReq','CommandGuildKickPacketReq',
 'CommandGuildLeavePacketReq','CommandPetCaressPacketReq',
 'CommandPetFreePacketReq','CommandPetSellPacketReq',
 'CommandPetTransferPacketReq'
];
const fakeDist='/offline/core/dist/Core/src';
function fake(existing=[],unavailable=[],loadError=[]){
 const registered=new Set(existing),calls=[];
 const inv=new Map(Object.entries(NATIVE_EXPANSION_HANDLERS).map(([pkt,rel])=>[path.join(fakeDist,rel),pkt]));
 return {
  calls,
  dist:fakeDist,
  listener:{getListener:name=>registered.has(name)?()=>{}:undefined},
  exists:file=>inv.has(file)&&!unavailable.includes(inv.get(file)),
  load:file=>{
   const pkt=inv.get(file);calls.push(pkt||'unknown');
   if(!pkt||loadError.includes(pkt))throw Error('TEST_DEPENDENCY_UNAVAILABLE');
   registered.add(pkt);
  }
 };
}
test('the 13 missing Core command contracts are enumerated exactly',()=>{
 assert.deepEqual(Object.keys(NATIVE_EXPANSION_HANDLERS),ALL);
 for(const [name,rel] of Object.entries(NATIVE_EXPANSION_HANDLERS)){
  assert.match(name,/^Command[A-Za-z]+PacketReq$/);
  assert.match(rel,/^commands\/(?:player|guild|pet)\/[A-Za-z]+Command\.js$/);
 }
});
test('expansion does not duplicate base, read, menu or authorization handlers',()=>{
 const old=new Set([...Object.keys(NATIVE_READ_HANDLERS),...Object.keys(NATIVE_MENU_HANDLERS),...Object.keys(NATIVE_AUTH_HANDLERS)]);
 assert.equal(ALL.some(packet=>old.has(packet)),false);
});
test('all 13 official handlers load only when real listener registration succeeds',()=>{
 const x=fake(),res=probeExpansionHandlers(x);
 assert.equal(res.available.length,13);
 assert.deepEqual(res.available,ALL);
 assert.equal(res.unavailable.length,0);
 assert.deepEqual(x.calls,ALL);
});
test('pre-registered Core handlers do not re-import the command class',()=>{
 const x=fake(ALL),res=probeExpansionHandlers(x);
 assert.equal(res.available.length,13);
 assert.deepEqual(x.calls,[]);
});
test('missing compiled JS fails closed and does not load',()=>{
 const missing=ALL.slice(0,3),x=fake([],missing),res=probeExpansionHandlers(x);
 assert.deepEqual(res.unavailable,missing);
 assert.equal(res.available.length,10);
 assert.equal(x.calls.some(c=>missing.includes(c)),false);
});
test('a present JS file is NOT proof of handler registration',()=>{
 const x=fake([],[],[ALL[2],ALL[9]]),res=probeExpansionHandlers(x);
 assert.deepEqual(res.unavailable,[ALL[2],ALL[9]]);
 assert.equal(res.available.length,11);
});
test('expansion not falsely advertised as playable by the WhatsApp help',()=>{
 const onlyExpansion=renderHelp(ALL);
 for(const command of ['/criarguilda','/liberarpet','/expulsarguilda','/amistoso']){
  assert.equal(onlyExpansion.includes(command),false);
 }
 assert.equal(onlyExpansion.includes('/combate'),false);
});
test('invalid probe environment rejects without changes',()=>{
 assert.throws(()=>probeExpansionHandlers({dist:'relative/path',listener:{getListener:()=>{}}}),/CORE_PROBE_INVALIDO/);
});
