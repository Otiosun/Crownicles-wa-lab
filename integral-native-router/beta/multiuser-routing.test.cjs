'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{EventEmitter}=require('node:events');
const {Store}=require('./bridge/store.cjs'),{Gateway}=require('./bridge/gateway.cjs'),{Presenter}=require('./bridge/presenter.cjs');
const A='5511999100001@s.whatsapp.net',B='5511999100002@s.whatsapp.net',PA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',PB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function harness(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'crown-multi-')),store=new Store(dir),sent=[],calls=[];
 const core=new EventEmitter();core.ready=true;core.send=(name,data,id,req)=>calls.push({name,data,id,req});
 const gateway=new Gateway({bindings:{[A]:PA,[B]:PB},canSendPacket:n=>['CommandPetTransferPacketReq','ReactionCollectorReactPacket'].includes(n)},store,new Presenter(dir),core,async(wa,text)=>sent.push({wa,text}));
 let seq=0;const send=(wa,text)=>gateway.receive('multi-'+(++seq),wa,text);
 const snapshot=()=>store.db.prepare('SELECT wa,text FROM outbox ORDER BY id').all();
 const close=()=>{gateway.close();store.close();fs.rmSync(dir,{recursive:true,force:true})};
 return {gateway,store,core,calls,sent,send,snapshot,close};
}
function open(h,wa){
 h.send(wa,'/transferirpet');h.send(wa,'1');
 const t=h.store.db.prepare('SELECT token FROM confirmations WHERE wa=?').get(wa).token;
 h.send(wa,'/confirmar 1 '+t);return h.calls.at(-1);
}
function respond(h,call,packet,identity=call.id){
 h.core.emit('response',{context:{frontEndSubOrigin:call.req,keycloakId:identity},packets:[{name:packet,packet:{}}]});
}
test('inverted Core reply order never mixes two player chats',()=>{
 const h=harness();try{
  const x=open(h,A),y=open(h,B);a.equal(h.calls.length,2);
  respond(h,y,'CommandPetTransferNoPetErrorPacket');respond(h,x,'CommandPetTransferFeistyErrorPacket');
  const records=h.snapshot();
  a(records.some(x=>x.wa===A&&/arisco/i.test(x.text)));
  a(records.some(x=>x.wa===B&&/não tem companheiro/i.test(x.text)));
  a(!records.some(x=>x.wa===A&&/não tem companheiro/i.test(x.text)));
  a(!records.some(x=>x.wa===B&&/arisco/i.test(x.text)));
 }finally{h.close()}
});
test('wrong response identity cannot complete another player request',()=>{
 const h=harness();try{
  const x=open(h,A),y=open(h,B);
  respond(h,x,'CommandPetTransferNoPetErrorPacket',PB);a.equal(h.store.getRequest(x.req).done,0);
  respond(h,y,'CommandPetTransferNoPetErrorPacket');a.equal(h.store.getRequest(y.req).done,1);
  a.equal(h.store.getRequest(x.req).done,0);
  respond(h,x,'CommandPetTransferFeistyErrorPacket');a.equal(h.store.getRequest(x.req).done,1);
 }finally{h.close()}
});
test('duplicate and late packets cannot open stale menus or produce extra text',()=>{
 const h=harness();try{
  const x=open(h,A);respond(h,x,'CommandPetTransferNoPetErrorPacket');
  const count=h.snapshot().length;
  respond(h,x,'CommandPetTransferNoPetErrorPacket');respond(h,x,'CommandPetTransferFeistyErrorPacket');
  a.equal(h.snapshot().length,count);
 }finally{h.close()}
});
test('a fake Core reply cannot be routed without request origin',()=>{
 const h=harness();try{
  h.core.emit('response',{context:{frontEndSubOrigin:'unknown',keycloakId:PA},packets:[{name:'CommandPetTransferNoPetErrorPacket',packet:{}}]});
  a.equal(h.snapshot().length,0);
 }finally{h.close()}
});
