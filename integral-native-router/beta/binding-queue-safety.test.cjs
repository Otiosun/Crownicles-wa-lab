'use strict';
// Real SQLite integration. Fake Core and transport; no WhatsApp or game data.
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{EventEmitter}=require('node:events');
const {Store}=require('./bridge/store.cjs'),{Gateway}=require('./bridge/gateway.cjs'),{Presenter}=require('./bridge/presenter.cjs');
const A='5511999000111@s.whatsapp.net',B='5511999000222@s.whatsapp.net',C='5511999000333@s.whatsapp.net';
const P='11111111-1111-4111-8111-111111111111',Q='22222222-2222-4222-8222-222222222222',R='33333333-3333-4333-8333-333333333333',M='44444444-4444-4444-8444-444444444444',N='55555555-5555-4555-8555-555555555555';
function menu(id=M,label='Opção original',confirmation=false){return {id,type:'ReactionCollectorFightData',title:'Combate',story:'',endTime:Date.now()+90000,options:[{label,supported:true,requiresConfirmation:confirmation}]}};
function create(dir,bindings={[A]:P,[B]:Q},sender=async()=>{},ready=false){
 const store=new Store(dir),core=new EventEmitter(),calls=[];
 core.ready=ready;core.send=(name,data,playerId,requestId)=>calls.push({name,data,playerId,requestId});
 const gw=new Gateway({bindings:{...bindings},canSendPacket:()=>true},store,new Presenter(dir),core,sender);
 let seq=0;
 const receive=(wa,text,id='m'+(++seq))=>gw.receive(id,wa,text);
 const wake=()=>{core.ready=true;core.emit('ready')};
 const close=()=>{gw.close();store.close()};
 return {store,core,calls,gw,receive,wake,close};
}
async function isolated(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'crown-binding-'));try{await fn(dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}
const status=(s,id)=>s.db.prepare('SELECT status FROM inbound WHERE id=?').get(id)?.status;
const pending=(s,wa)=>s.db.prepare("SELECT * FROM outbox WHERE wa=? AND status='pending' ORDER BY id").all(wa);
const allOut=(s,wa)=>s.db.prepare("SELECT * FROM outbox WHERE wa=? ORDER BY id").all(wa);
const response=(h,req,packets=[])=>h.core.emit('response',{context:{frontEndSubOrigin:req.requestId,keycloakId:req.playerId},packets});
test('offline command cannot migrate to another character sharing same address',()=>isolated(async dir=>{
 const h=create(dir);try{
  h.receive(A,'/perfil','old');h.receive(B,'/perfil','independent');
  h.gw.config.bindings[A]=R;h.wake();
  a.equal(status(h.store,'old'),'done');a.equal(h.calls.length,1);a.equal(h.calls[0].playerId,Q);
  h.receive(A,'/perfil','new');a.equal(h.calls.length,2);a.equal(h.calls[1].playerId,R);
 }finally{h.close()}
}));
test('legacy state without ownership snapshot is quarantined, historical events retained',()=>isolated(async dir=>{
 const old=new Store(dir);old.receive('old',A,'/perfil');old.saveMenu(A,menu(M,'Dado antigo',true));old.createPreview(A,old.getMenu(A),0);
 old.queue(A,'INFORMACAO PRIVADA ANTIGA');old.queue(A,'HISTORICO');old.sent(2);const code=old.issueRecipientCode(A,P).code;old.close();
 const seen=[],h=create(dir,{[A]:R},async(to,text)=>seen.push([to,text]));
 try{
  await h.gw.flush();
  a.equal(seen.length,0);a.equal(status(h.store,'old'),'done');a.equal(h.store.getMenu(A),null);
  a.equal(h.store.findRecipientCode(code),null);a.equal(allOut(h.store,A)[0].status,'quarantined');a.equal(allOut(h.store,A)[1].status,'sent');
  a.equal(h.store.bindingSnapshot(A).player_id,R);h.wake();a.equal(h.calls.length,0);
 }finally{h.close()}
}));
test('same verified binding survives restart without erasing unrelated queued state',()=>isolated(async dir=>{
 let h=create(dir);h.receive(A,'/perfil','old');h.store.saveMenu(B,menu());h.store.queue(B,'RELATORIO DE B');h.close();
 const seen=[];h=create(dir,{[A]:P,[B]:Q},async(to,text)=>seen.push([to,text]));
 try{a.ok(h.store.getMenu(B));a.equal(status(h.store,'old'),'pending');await h.gw.flush();a.deepEqual(seen,[[B,'RELATORIO DE B']]);h.wake();a.equal(h.calls.length,1);a.equal(h.calls[0].playerId,P)}finally{h.close()}
}));
test('revoked address cannot receive private queued replies; restore never resurrects them',()=>isolated(async dir=>{
 const seen=[],h=create(dir,{[A]:P,[B]:Q},async(to,text)=>seen.push([to,text]));try{
  h.store.queue(A,'SECRETO A');h.store.queue(B,'OK B');delete h.gw.config.bindings[A];
  await h.gw.flush();a.deepEqual(seen,[[B,'OK B']]);a.equal(allOut(h.store,A)[0].status,'quarantined');a.equal(h.store.bindingSnapshot(A).player_id,null);
  h.gw.config.bindings[A]=P;h.gw.synchronizeBindings();await h.gw.flush();a.deepEqual(seen,[[B,'OK B']]);
 }finally{h.close()}
}));
test('observed A to R to A invalidates old menu, codes and queued numeric decisions',()=>isolated(async dir=>{
 const h=create(dir);try{
  const code=h.store.issueRecipientCode(A,P).code;h.store.saveMenu(A,menu(M,'Opção antiga',true));h.store.createPreview(A,h.store.getMenu(A),0);h.receive(A,'1','old');
  h.gw.config.bindings[A]=R;h.gw.synchronizeBindings();h.gw.config.bindings[A]=P;h.gw.synchronizeBindings();
  a.equal(h.store.getMenu(A),null);a.equal(h.store.findRecipientCode(code),null);a.equal(status(h.store,'old'),'done');h.wake();a.equal(h.calls.length,0);
 }finally{h.close()}
}));
test('late reply for revoked player cannot open menu after reassignment',()=>isolated(async dir=>{
 const h=create(dir,undefined,async()=>{},true);try{
  h.receive(A,'/perfil','old');const req=h.calls[0];h.gw.config.bindings[A]=R;
  response(h,req,[{name:'ReactionCollectorCreationPacket',packet:{id:M,endTime:Date.now()+90000,data:{type:'ReactionCollectorFoo',data:{}},reactions:[]}}]);
  a.equal(h.store.getMenu(A),null);a.equal(h.store.getRequest(req.requestId).done,1);a.deepEqual(pending(h.store,A),[]);
  h.receive(A,'/perfil','new');a.equal(h.calls[1].playerId,R);
 }finally{h.close()}
}));
test('timeout maintenance does not revive state or send old notice to reassigned address',()=>isolated(async dir=>{
 const h=create(dir,undefined,async()=>{},true);try{
  h.receive(A,'/perfil','old');h.store.db.prepare('UPDATE requests SET created=0').run();h.gw.config.bindings[A]=R;h.gw.maintenance();
  a.equal(h.store.getRequest(h.calls[0].requestId).done,1);a.equal(h.store.getMenu(A),null);a.equal(allOut(h.store,A).length,0);
 }finally{h.close()}
}));
test('outbox acknowledgement cannot mark a quarantined row as sent or retry it',()=>isolated(async dir=>{
 let release,entered;const started=new Promise(r=>entered=r);
 const h=create(dir,{[A]:P},()=>{entered();return new Promise(r=>release=r)});try{
  h.store.queue(A,'antes da alteração');const id=allOut(h.store,A)[0].id;const sending=h.gw.flush();await started;
  h.gw.config.bindings[A]=R;h.gw.synchronizeBindings();release();await sending;
  h.store.failed(id,true);a.equal(allOut(h.store,A)[0].status,'quarantined');a.equal(pending(h.store,A).length,0);
 }finally{h.close()}
}));
test('restart with uncertain request quarantines its old outbound menu; neutral recovery remains',()=>isolated(async dir=>{
 let h=create(dir,undefined,async()=>{},true);h.receive(A,'/perfil','old');h.store.queue(A,'MENU OBSOLETO');h.store.queue(B,'RELATORIO B');h.close();
 const sent=[];h=create(dir,undefined,async(to,text)=>sent.push([to,text]));
 try{await h.gw.flush();a.ok(sent.some(([to,t])=>to===A&&t.includes('SESSÃO RETOMADA')));a.ok(sent.some(([to,t])=>to===B&&t==='RELATORIO B'));a.ok(!sent.some(([,t])=>t==='MENU OBSOLETO'));a.equal(allOut(h.store,A)[0].status,'quarantined')}finally{h.close()}
}));
test('numeric input received without menu cannot select a menu opened afterward',()=>isolated(async dir=>{
 const h=create(dir);try{h.receive(A,'1','old');h.store.saveMenu(A,menu());h.wake();a.equal(h.calls.length,0);a.equal(status(h.store,'old'),'done');a.ok(allOut(h.store,A).some(r=>r.text.includes('menu anterior')))}finally{h.close()}
}));
test('numeric input received for original menu cannot select replacement even with same index',()=>isolated(async dir=>{
 const h=create(dir);try{h.store.saveMenu(A,menu(M));h.receive(A,'1','old');h.store.saveMenu(A,menu(N,'Opção diferente'));h.wake();a.equal(h.calls.length,0);a.equal(h.store.getMenu(A).id,N);h.receive(A,'1','new');a.equal(h.calls.length,1);a.equal(h.calls[0].data.id,N)}finally{h.close()}
}));
test('same menu id with changed content also invalidates delayed input',()=>isolated(async dir=>{
 const h=create(dir);try{const old=menu();h.store.saveMenu(A,old);h.receive(A,'1','old');h.store.saveMenu(A,{...old,options:[{...old.options[0],label:'Outra ação'}]});h.wake();a.equal(h.calls.length,0)}finally{h.close()}
}));
test('numeric input for unchanged active menu still dispatches its actual reaction',()=>isolated(async dir=>{
 const h=create(dir);try{h.store.saveMenu(A,menu());h.receive(A,'1','choice');h.wake();a.equal(h.calls.length,1);a.equal(h.calls[0].name,'ReactionCollectorReactPacket');a.equal(h.calls[0].data.id,M);a.equal(h.calls[0].playerId,P)}finally{h.close()}
}));
test('delayed decision arriving while first request in flight cannot select its new collector',()=>isolated(async dir=>{
 const h=create(dir,undefined,async()=>{},true);try{
  h.receive(A,'/perfil','first');h.receive(A,'1','queued');a.equal(status(h.store,'queued'),'pending');
  h.store.saveMenu(A,menu(N));response(h,h.calls[0],[{name:'CommandPetTransferNoPetErrorPacket',packet:{}}]);
  a.equal(h.calls.length,1);a.equal(status(h.store,'queued'),'done');a.equal(h.store.getMenu(A).id,N);
 }finally{h.close()}
}));
test('confirmation still bound to exact menu digest across queue delays',()=>isolated(async dir=>{
 const h=create(dir);try{
  h.store.saveMenu(A,menu(M,'Comprar',true));const pv=h.store.createPreview(A,h.store.getMenu(A),0);
  h.receive(A,'/confirmar 1 '+pv.token,'old');h.store.saveMenu(A,menu(N,'Vender',true));
  h.wake();a.equal(h.calls.length,0);a.equal(status(h.store,'old'),'done');
 }finally{h.close()}
}));
test('Core disconnect during queue drain leaves unsent independent command recoverable',()=>isolated(async dir=>{
 const h=create(dir);try{
  h.receive(A,'/perfil','a');h.receive(B,'/perfil','b');const send=h.core.send;h.core.send=(...args)=>{send(...args);h.core.ready=false};
  h.wake();a.equal(h.calls.length,1);a.equal(status(h.store,'b'),'pending');h.core.send=send;h.wake();a.equal(h.calls.length,2);a.equal(h.calls[1].playerId,Q);
 }finally{h.close()}
}));
