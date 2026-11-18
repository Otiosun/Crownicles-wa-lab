'use strict';
// Real Store + Gateway + Presenter; FakeCore only. No WhatsApp, MariaDB, or player mutations.
const {test}=require('node:test'),a=require('node:assert/strict');
const {EventEmitter}=require('node:events'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Gateway}=require('./bridge/gateway.cjs'),{Store}=require('./bridge/store.cjs'),{Presenter}=require('./bridge/presenter.cjs');
const {renderHelp}=require('./feature-manifest.cjs'),native=require('./bridge/native-universal.cjs');
const WA1='5511999111222@s.whatsapp.net',WA2='5511999333444@s.whatsapp.net';
const P1='11111111-1111-4111-8111-111111111111',P2='22222222-2222-4222-8222-222222222222';
const packets=['ReactionCollectorReactPacket','CommandPetCaressPacketReq','CommandPetExpeditionResolvePacketReq','CommandGuildCreatePacketReq','CommandGuildDescriptionPacketReq','CommandGuildLeavePacketReq','CommandPetFreePacketReq'];
let seq=0;
function make(allow=new Set(packets)){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'crown-reviewed-')),store=new Store(dir),calls=[];
 const core=new EventEmitter();core.ready=true;core.send=(name,data,playerId,requestId)=>calls.push({name,data,playerId,requestId});
 const presenter=new Presenter(dir),canSendPacket=n=>allow.has(n);
 const gateway=new Gateway({bindings:{[WA1]:P1,[WA2]:P2},canSendPacket},store,presenter,core,async()=>{});
 const send=(text,wa=WA1)=>{gateway.receive('reviewed-'+(++seq),wa,text);return store.getMenu(wa)};
 const preview=(wa=WA1)=>{send('1',wa);return store.db.prepare('SELECT token FROM confirmations WHERE wa=?').get(wa)?.token};
 const end=()=>{gateway.close();store.close();fs.rmSync(dir,{recursive:true,force:true})};
 return {store,calls,core,gateway,presenter,send,preview,end};
}
const cases=[
 ['/acariciar','CommandPetCaressPacketReq',{}],
 ['/resgatarexpedicao','CommandPetExpeditionResolvePacketReq',{}],
 ['/criarguilda Aurora','CommandGuildCreatePacketReq',{keycloakId:P1,askedGuildName:'Aurora'}],
 ['/descricaoguilda Viajantes unidos','CommandGuildDescriptionPacketReq',{description:'Viajantes unidos'}],
 ['/sairdaguilda','CommandGuildLeavePacketReq',{}],
 ['/liberarpet','CommandPetFreePacketReq',{keycloakId:P1}]
];
for(const [cmd,packet,payload] of cases)test('verified original request needs preview+single nonce '+cmd,()=>{
 const h=make();try{
  const m=h.send(cmd);a.equal(m?.type,'LocalUniversalNativeAuthorization');a.equal(h.calls.length,0);
  a.equal(m.options[0].requiresConfirmation,true);a.equal(m.options[1].requiresConfirmation,false);
  const token=h.preview();a.match(token,/^[A-F0-9]{8}$/);a.equal(h.calls.length,0);
  h.send('/confirmar 1 00000000');a.equal(h.calls.length,0);
  h.send('/confirmar 1 '+token);a.equal(h.calls.length,1);
  a.equal(h.calls[0].name,packet);a.deepEqual(h.calls[0].data,payload);a.equal(h.calls[0].playerId,P1);
  h.send('/confirmar 1 '+token);a.equal(h.calls.length,1);
 }finally{h.end()}
});
test('no listener: no menu and no packet',()=>{const h=make(new Set());try{
 for(const [cmd] of cases){a.match(h.gateway.route({wa:WA1,text:cmd}).local,/não foi homologado/);a.equal(h.store.getMenu(WA1),null)}
 a.equal(h.calls.length,0);
}finally{h.end()}});
test('unsafe original requests remain disabled even if their listeners exist',()=>{
 const allowed=new Set([...packets,'CommandPetFreePacketReq','CommandPetTransferPacketReq','CommandUnlockPacketReq','CommandGuildKickPacketReq','CommandFriendlyFightPacketReq']);
 const h=make(allowed);try{
 for(const cmd of ['/transferirpet','/libertarjogador 17','/expulsarguilda 20','/amistoso 18']){
  a.match(h.gateway.route({wa:WA1,text:cmd}).local,/não foi homologado/);
 }
 a.equal(h.calls.length,0);
 }finally{h.end()}
});
test('cross-user nonce and local cancel are isolated',()=>{
 const h=make();try{
  h.send('/criarguilda Aurora');const token=h.preview();
  h.send('/confirmar 1 '+token,WA2);a.equal(h.calls.length,0);
  h.send('2');a.equal(h.store.getMenu(WA1),null);a.equal(h.calls.length,0);
 }finally{h.end()}
});
test('one pending local authorization cannot be displaced',()=>{
 const h=make();try{const first=h.send('/criarguilda Aurora');h.send('/sairdaguilda');a.deepEqual(h.store.getMenu(WA1),first);a.equal(h.calls.length,0)}finally{h.end()}
});
test('official guild destruction must require a second native confirmation',()=>{
 const h=make();try{
  h.send('/sairdaguilda');const token=h.preview();h.send('/confirmar 1 '+token);
  a.equal(h.calls.length,1);a.equal(h.calls[0].name,'CommandGuildLeavePacketReq');
  h.core.emit('response',{context:{frontEndSubOrigin:h.calls[0].requestId,keycloakId:P1},packets:[{name:'ReactionCollectorCreationPacket',packet:{
   id:'guild-leave-collector',endTime:Date.now()+60000,
   data:{type:'ReactionCollectorGuildLeaveData',data:{guildName:'Aurora',isGuildDestroyed:true,newChiefKeycloakId:''}},
   reactions:[{type:'ReactionCollectorAcceptReaction',data:{}},{type:'ReactionCollectorRefuseReaction',data:{}}]
  }}]});
  const m=h.store.getMenu(WA1);a.match(m.story,/DESTRÓI/);a.equal(m.options[0].requiresConfirmation,true);
  h.send('1');a.equal(h.calls.length,1);
  const second=h.store.db.prepare('SELECT token FROM confirmations WHERE wa=?').get(WA1)?.token;
  a.match(second,/^[A-F0-9]{8}$/);h.send('/confirmar 1 '+second);
  a.equal(h.calls[1]?.name,'ReactionCollectorReactPacket');a.equal(h.calls[1]?.data.reactionIndex,0);
 }finally{h.end()}
});
test('malformed original guild collector fails closed',()=>{
 const h=make();try{const m=h.presenter.menu({id:'bad',endTime:Date.now()+50000,data:{
 type:'ReactionCollectorGuildLeaveData',data:{guildName:'Aurora',isGuildDestroyed:'unknown',newChiefKeycloakId:''}},
 reactions:[{type:'ReactionCollectorAcceptReaction',data:{}},{type:'ReactionCollectorRefuseReaction',data:{}}]});
 a.equal(m.options.every(o=>o.supported===false),true);
 }finally{h.end()}
});
test('help derives reviewed commands from verified listener list, no false advertising',()=>{
 const txt=renderHelp(new Set(packets));a.match(txt,/\/criarguilda NOME/);a.match(txt,/\/liberarpet/);
 const h=make(new Set(['CommandGuildCreatePacketReq']));try{const out=h.gateway.route({wa:WA1,text:'/nativos'}).local;a.match(out,/\/criarguilda/);a.doesNotMatch(out,/\/sairdaguilda/)}finally{h.end()}
});
test('capability revoked between preview and confirmation stops dispatch',()=>{
 const allow=new Set(packets),h=make(allow);try{
  h.send('/criarguilda Aurora');const token=h.preview();allow.delete('CommandGuildCreatePacketReq');
  h.send('/confirmar 1 '+token);a.equal(h.calls.length,0);
 }finally{h.end()}
});
test('mission-only Core empty response never fabricates a reward',()=>{
 const h=make();try{h.send('/acariciar');const token=h.preview();h.send('/confirmar 1 '+token);
  const call=h.calls[0];h.core.emit('response',{context:{frontEndSubOrigin:call.requestId,keycloakId:P1},packets:[]});
  a.equal(h.store.db.prepare('SELECT done FROM requests WHERE id=?').get(call.requestId).done,1);
 }finally{h.end()}
});
test('no lab override needed for audited commands but required for unreviewed',()=>{
 const env={CROWNICLES_WA_UNIVERSAL_COMMANDS:'off',CROWNICLES_WA_LAB_ISOLATED:'NOT'};
 a.equal(native.resolve('/criarguilda Aurora',P1,{env,canSendPacket:n=>n==='CommandGuildCreatePacketReq'}).universalIntent.key,'guildCreate');
 a.match(native.resolve('/transferirpet',P1,{env,canSendPacket:()=>true}).local,/não foi homologado/);
});

test('Core confirms pet identity and exact price before irreversible release',()=>{
 const h=make();try{
  h.send('/liberarpet');const token=h.preview();h.send('/confirmar 1 '+token);
  a.equal(h.calls.length,1);a.equal(h.calls[0].name,'CommandPetFreePacketReq');
  const call=h.calls[0];
  h.core.emit('response',{context:{frontEndSubOrigin:call.requestId,keycloakId:P1},packets:[{name:'ReactionCollectorCreationPacket',packet:{
   id:'petfree-native',endTime:Date.now()+60000,data:{type:'ReactionCollectorPetFreeData',data:{petId:17,petSex:'f',petNickname:'Lua',freeCost:150}},
   reactions:[{type:'ReactionCollectorAcceptReaction',data:{}},{type:'ReactionCollectorRefuseReaction',data:{}}]
  }}]});
  const m=h.store.getMenu(WA1);a.match(m.story,/150 moedas/);a.match(m.story,/irreversível/);
  a.equal(m.options[0].requiresConfirmation,true);h.send('1');a.equal(h.calls.length,1);
  const second=h.store.db.prepare('SELECT token FROM confirmations WHERE wa=?').get(WA1)?.token;
  a.match(second,/^[A-F0-9]{8}$/);h.send('/confirmar 1 '+second);
  a.equal(h.calls[1]?.name,'ReactionCollectorReactPacket');a.equal(h.calls[1]?.data.reactionIndex,0);
 }finally{h.end()}
});
test('invalid pet cost blocks all irreversible responses',()=>{
 const h=make();try{
  const m=h.presenter.menu({id:'invalid-cost',endTime:Date.now()+50000,data:{type:'ReactionCollectorPetFreeData',data:{petId:17,petSex:'f',freeCost:-1}},
   reactions:[{type:'ReactionCollectorAcceptReaction',data:{}},{type:'ReactionCollectorRefuseReaction',data:{}}]});
  a.equal(m.options.every(o=>o.supported===false),true);
 }finally{h.end()}
});
