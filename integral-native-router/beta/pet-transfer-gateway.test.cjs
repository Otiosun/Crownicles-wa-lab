'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {EventEmitter}=require('node:events'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('./bridge/store.cjs'),{Gateway}=require('./bridge/gateway.cjs'),{Presenter}=require('./bridge/presenter.cjs');
const P='11111111-1111-4111-8111-111111111111',Q='22222222-2222-4222-8222-222222222222',WA='5511999000111@s.whatsapp.net',WB='5511999000222@s.whatsapp.net';
const pet=(typeId,nickname)=>({typeId,nickname,rarity:1,sex:'f',loveLevel:1,force:1,feedDelay:0});
const r=(type,data={})=>({type,data});const DEPOSIT='ReactionCollectorPetTransferDepositReaction',SWITCH='ReactionCollectorPetTransferSwitchReaction',WITHDRAW='ReactionCollectorPetTransferWithdrawReaction',REFUSE='ReactionCollectorRefuseReaction';
function harness(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'crown-transfer-')),store=new Store(dir),calls=[];
 const core=new EventEmitter();core.ready=true;core.send=(name,data,id,req)=>calls.push({name,data,id,req});
 let seq=0;
 const gw=new Gateway({bindings:{[WA]:P,[WB]:Q},canSendPacket:n=>['ReactionCollectorReactPacket','CommandPetTransferPacketReq'].includes(n)},store,new Presenter(dir),core,async()=>{});
 const send=(text,wa=WA)=>{gw.receive('t-'+(++seq),wa,text);return store.getMenu(wa)};
 const token=(wa=WA)=>store.db.prepare('SELECT token FROM confirmations WHERE wa=?').get(wa)?.token;
 const close=()=>{gw.close();store.close();fs.rmSync(dir,{recursive:true,force:true})};
 return {gw,store,calls,core,send,token,close};
}
function incoming(h,req,own,shelter,reactions){
 h.core.emit('response',{context:{frontEndSubOrigin:req,keycloakId:P},packets:[{name:'ReactionCollectorCreationPacket',packet:{id:'transfer-native-1',endTime:Date.now()+120000,data:{type:'ReactionCollectorPetTransferData',data:{...(own?{ownPet:own}:{}),shelterPets:shelter}},reactions}}]});
}
function open(h){
 h.send('/transferirpet');a.equal(h.calls.length,0);
 const m=h.store.getMenu(WA);a.equal(m.type,'LocalUniversalNativeAuthorization');
 h.send('1');const t=h.token();a.match(t,/^[A-F0-9]{8}$/);
 a.equal(h.calls.length,0);h.send('/confirmar 1 '+t);
 a.equal(h.calls.length,1);a.equal(h.calls[0].name,'CommandPetTransferPacketReq');
 return h.calls[0].req;
}
test('original shelter switch target/index preserved and needs a second nonce',()=>{
 const h=harness();try{
  const req=open(h);
  incoming(h,req,pet(1,'Lua'),[{petEntityId:61,pet:pet(6,'Sol')},{petEntityId:62,pet:pet(7,'Água')}],[r(DEPOSIT),r(SWITCH,{petEntityId:62}),r(SWITCH,{petEntityId:61}),r(REFUSE)]);
  const m=h.store.getMenu(WA);a.equal(m.type,'ReactionCollectorPetTransferData');a.match(m.options[1].label,/Lua.*Água/);a.match(m.options[2].label,/Lua.*Sol/);
  h.send('2');a.equal(h.calls.length,1);const t=h.token();a.match(t,/^[A-F0-9]{8}$/);
  h.send('/confirmar 2 '+t);a.equal(h.calls[1].name,'ReactionCollectorReactPacket');a.equal(h.calls[1].data.reactionIndex,1);a.equal(h.calls[1].id,P);
  h.send('/confirmar 2 '+t);a.equal(h.calls.length,2);
 }finally{h.close()}
});
test('shelter withdrawal selects exact original petEntityId index',()=>{
 const h=harness();try{
  const req=open(h);incoming(h,req,undefined,[{petEntityId:61,pet:pet(6,'Sol')}],[r(WITHDRAW,{petEntityId:61}),r(REFUSE)]);
  const m=h.store.getMenu(WA);a.match(m.options[0].label,/Sol/);
  h.send('1');const t=h.token();h.send('/confirmar 1 '+t);
  a.equal(h.calls[1].name,'ReactionCollectorReactPacket');a.equal(h.calls[1].data.reactionIndex,0);
 }finally{h.close()}
});
test('malformed shelter collector never submits a reaction',()=>{
 const h=harness();try{
  const req=open(h);incoming(h,req,pet(1,'Lua'),[{petEntityId:61,pet:pet(6,'Sol')}],[r(SWITCH,{petEntityId:99}),r(REFUSE)]);
  const m=h.store.getMenu(WA);a(m.options.every(x=>!x.supported));h.send('1');a.equal(h.calls.length,1);
 }finally{h.close()}
});
test('other registered player cannot consume original transfer snapshot',()=>{
 const h=harness();try{
  const req=open(h);incoming(h,req,pet(1,'Lua'),[],[r(DEPOSIT),r(REFUSE)]);
  h.send('1');const t=h.token();h.send('/confirmar 1 '+t,WB);a.equal(h.calls.length,1);
  h.send('/confirmar 1 '+t);a.equal(h.calls.length,2);a.equal(h.calls[1].id,P);
 }finally{h.close()}
});
