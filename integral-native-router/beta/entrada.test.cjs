'use strict';
const test=require('node:test'); const assert=require('node:assert/strict');const os=require('node:os');const fs=require('node:fs');const path=require('node:path');
const {BetaEntrance, normalizeJid, makeCoreRegistration}=require('./entrada.cjs');
const waA='5511999000001@s.whatsapp.net',waB='5511999000002@s.whatsapp.net',owner='5511999000099@s.whatsapp.net',grp='120363111111111111@g.us';
function setup(opts={}) {const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cw-beta-entry-'));const sent=[],calls=[],dbPlayers=new Map();let fail=false;
 const newOne=()=>new BetaEntrance({dir,ownerJids:[owner],send:async(jid,text)=>sent.push({jid,text}),createPlayer:async(uuid,jid)=>{if(fail)throw Error('db down');dbPlayers.set(jid,uuid);},dispatchGame:async e=>{calls.push(e);return true;},...opts});
 const e=newOne();const input=(id,sender,text,chat=sender)=>({id,chatJid:chat,senderJid:sender,text});return {e,newOne,input,sent,calls,dbPlayers,dir,setFail:v=>{fail=v},close:()=>{e.close();fs.rmSync(dir,{recursive:true,force:true})}} }
test('normalize user/device and group JIDs without guessing owners',()=>{assert.equal(normalizeJid('5511999000001:12@s.whatsapp.net'),waA);assert.equal(normalizeJid(grp),grp);assert.equal(normalizeJid('foo'),null)});
test('unknown owner or empty owner list fails closed',()=>{assert.throws(()=>setup({ownerJids:['not-a-jid']}));});
test('only owner can activate selected group; others remain off',async()=>{const x=setup();try{assert.equal((await x.e.handle(x.input('a',waA,'/ativar',grp))).handled,false);assert.equal(x.e.groupEnabled(grp),false);await x.e.handle(x.input('b',owner,'/ativar',grp));assert.equal(x.e.groupEnabled(grp),true);assert.equal(x.e.groupEnabled('120363222222222222@g.us'),false);await x.e.handle(x.input('c',owner,'/desativar',grp));assert.equal(x.e.groupEnabled(grp),false)}finally{x.close()}});
test('group switch persists across process restart',async()=>{const x=setup();try{await x.e.handle(x.input('a',owner,'/ativar',grp));x.e.close();const e=x.newOne();assert.equal(e.groupEnabled(grp),true);e.close()}finally{fs.rmSync(x.dir,{recursive:true,force:true})}});
test('private registration is explicit, idempotent and uses stable UUID',async()=>{const x=setup();try{assert.equal(x.e.player(waA),null);await x.e.handle(x.input('r1',waA,'/cadastro'));const id=x.e.player(waA).uuid;assert.match(id,/^[0-9a-f-]{36}$/);assert.equal(x.e.player(waA).state,'active');await x.e.handle(x.input('r2',waA,'/cadastro'));assert.equal(x.e.player(waA).uuid,id);assert.equal(x.dbPlayers.size,1)}finally{x.close()}});
test('retry pending registration after DB fails uses SAME uuid',async()=>{const x=setup();try{x.setFail(true);await x.e.handle(x.input('a',waA,'/cadastro'));const id=x.e.player(waA).uuid;assert.equal(x.e.player(waA).state,'pending');x.setFail(false);await x.e.handle(x.input('b',waA,'/cadastro'));assert.equal(x.e.player(waA).uuid,id);assert.equal(x.e.player(waA).state,'active')}finally{x.close()}});
test('unregistered player cannot play; registered routed by player JID',async()=>{const x=setup();try{await x.e.handle(x.input('a',waA,'/jogar'));assert.equal(x.calls.length,0);await x.e.handle(x.input('b',waA,'/cadastro'));await x.e.handle(x.input('c',waA,'/jogar'));assert.equal(x.calls.length,1);assert.equal(x.calls[0].playerJid,waA);assert.equal(x.calls[0].replyJid,waA)}finally{x.close()}});
test('group disabled ignores commands but private remains available',async()=>{const x=setup();try{assert.equal((await x.e.handle(x.input('a',waA,'/cadastro',grp))).handled,false);await x.e.handle(x.input('b',waA,'/cadastro'));assert.equal(x.e.player(waA).state,'active')}finally{x.close()}});
test('group enabled: registration, gateway and replies are private to sender',async()=>{const x=setup();try{await x.e.handle(x.input('a',owner,'/ativar',grp));await x.e.handle(x.input('b',waA,'/cadastro',grp));assert.equal(x.sent.at(-1).jid,waA);await x.e.handle(x.input('c',waA,'/jogar',grp));assert.equal(x.calls[0].replyJid,waA);assert.equal(x.calls[0].sourceChat,grp)}finally{x.close()}});
test('same message ID cannot duplicate a command or activation',async()=>{const x=setup();try{await x.e.handle(x.input('a',waA,'/cadastro'));const a=await x.e.handle(x.input('b',waA,'/jogar'));const b=await x.e.handle(x.input('b',waA,'/jogar'));assert.equal(a.handled,true);assert.equal(b.reason,'duplicate');assert.equal(x.calls.length,1)}finally{x.close()}});
test('another player retains a different UUID',async()=>{const x=setup();try{await x.e.handle(x.input('a',waA,'/cadastro'));await x.e.handle(x.input('b',waB,'/cadastro'));assert.notEqual(x.e.player(waA).uuid,x.e.player(waB).uuid)}finally{x.close()}});
test('owner control cannot be used in private to enable other groups',async()=>{const x=setup();try{let r=await x.e.handle(x.input('a',owner,'/ativar'));assert.match(r.text,/dentro do grupo/i);assert.equal(x.e.groupEnabled(grp),false)}finally{x.close()}});
test('owner can list only explicitly enabled groups',async()=>{const x=setup();try{await x.e.handle(x.input('a',owner,'/ativar',grp));let r=await x.e.handle(x.input('b',owner,'/grupos'));assert.match(r.text,/120363/);assert.equal(r.to,owner)}finally{x.close()}});
test('JID mismatch or missing sender is ignored without creating player',async()=>{const x=setup();try{assert.equal((await x.e.handle(x.input('a',waA,'/cadastro',waB))).reason,'jid-mismatch');assert.equal(x.e.player(waA),null)}finally{x.close()}});
test('makeCoreRegistration uses original models idempotently, no event fixture',async()=>{const players=new Map(),inv=new Map(),slots=new Map();let idx=0;const mkModel=(store,key,construct)=>({findOrCreate:async ({where,defaults})=>{const k=key(where);if(!store.has(k))store.set(k,construct(defaults));return [store.get(k),true]}});
 const Player=mkModel(players,x=>x.keycloakId,x=>({id:++idx,...x}));const InventoryInfo=mkModel(inv,x=>x.playerId,x=>({...x}));const InventorySlot=mkModel(slots,x=>`${x.playerId}:${x.itemCategory}:${x.slot}`,x=>({...x}));const fn=makeCoreRegistration({Player,InventoryInfo,InventorySlot,ItemCategory:{WEAPON:0,ARMOR:1,POTION:2,OBJECT:3}});
 await fn('aa-bb');await fn('aa-bb');assert.equal(players.size,1);assert.equal(inv.size,1);assert.equal(slots.size,4);assert.equal([...players.values()][0].nextEvent,undefined);
});
test('allow registration via phone owner normalized; owner identity only',async()=>{const x=setup({ownerJids:['5511999000099']});try{const r=await x.e.handle(x.input('a',owner,'/ativar',grp));assert.equal(r.handled,true)}finally{x.close()}});

test('dono pode emitir chave no privado e autorizar um grupo com LID sem PN',async()=>{
 const x=setup();const lid='123456789012345@lid';try{
  await x.e.handle(x.input('g1',owner,'/chavegrupo'));
  const msg=x.sent.at(-1);const token=/\/ativar ([A-F0-9]{12})/.exec(msg.text)?.[1];
  assert.equal(msg.jid,owner);assert(token);
  const result=await x.e.handle(x.input('g2',lid,'/ativar '+token,grp));
  assert.equal(result.handled,true);assert.equal(x.e.groupEnabled(grp),true);
  const replay=await x.e.handle(x.input('g3',lid,'/ativar '+token,'120363222222222222@g.us'));
  assert.equal(replay.reason,'invalid-group-key');assert.equal(x.e.groupEnabled('120363222222222222@g.us'),false);
 }finally{x.close()}
});
test('chave de grupo expirada ou comando diferente nao concede acesso',async()=>{
 let now=100000;const x=setup({clock:()=>now});const lid='123456789012345@lid';
 try{await x.e.handle(x.input('i1',owner,'/chavegrupo'));
  const token=/\/ativar ([A-F0-9]{12})/.exec(x.sent.at(-1).text)?.[1];assert(token);
  const wrong=await x.e.handle(x.input('i2',lid,'/desativar '+token,grp));assert.equal(wrong.handled,false);
  now+=300001;const expired=await x.e.handle(x.input('i3',lid,'/ativar '+token,grp));
  assert.equal(expired.reason,'invalid-group-key');assert.equal(x.e.groupEnabled(grp),false);
 }finally{x.close()}
});
test('codigo nunca permite emitir chave a terceiro ou ativar em privado',async()=>{
 const x=setup();try{
  const no=await x.e.handle(x.input('i1',waA,'/chavegrupo'));assert.equal(no.handled,false);
  await x.e.handle(x.input('i2',owner,'/chavegrupo'));
  const token=/\/ativar ([A-F0-9]{12})/.exec(x.sent.at(-1).text)?.[1];assert(token);
  const r=await x.e.handle(x.input('i3',waA,'/ativar '+token));assert.match(r.text,/dentro do grupo/i);
  assert.equal(x.e.groupEnabled(grp),false);
 }finally{x.close()}
});

test('ajuda e comandos em grupo ativo respondem no grupo sem expor dados de jogador',async()=>{
 const x=setup();try{
  await x.e.handle(x.input('on',owner,'/ativar',grp));
  for(const [i,cmd] of ['/ajuda','/comandos'].entries()){
   const r=await x.e.handle(x.input('help-'+i,waA,cmd,grp));
   assert.equal(r.handled,true);
   assert.equal(r.to,grp);
   assert.equal(x.sent.at(-1).jid,grp);
  }
  assert.equal(x.e.player(waA),null);
  const privateResult=await x.e.handle(x.input('private-help',waA,'/ajuda'));
  assert.equal(privateResult.to,waA);
 }finally{x.close()}
});
