'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {EventEmitter}=require('node:events');
const U=require('../src/native-universal.cjs');
const {Store}=require('../src/store.cjs');
const {Gateway}=require('../src/gateway.cjs');
const {Presenter}=require('../src/presenter.cjs');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const WA='5511991111111',WB='5511992222222';let counter=0;
const gate={CROWNICLES_WA_UNIVERSAL_COMMANDS:'lab',CROWNICLES_WA_LAB_ISOLATED:'SIM_ISOLADO',WA_BAILEYS_SEND_MODE:'',CROWNICLES_WA_EQUIP_ACTIONS:''};
function lab({enabled=true,live=false}={}){
 const old={};for(const k of Object.keys(gate))old[k]=process.env[k];
 for(const [k,v]of Object.entries(gate))if(v==='')delete process.env[k];else process.env[k]=v;
 if(!enabled)delete process.env.CROWNICLES_WA_UNIVERSAL_COMMANDS;
 if(live)process.env.WA_BAILEYS_SEND_MODE='live';
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cw-universal-'));
 const lang=path.join(dir,'lang');fs.mkdirSync(lang);fs.writeFileSync(path.join(lang,'models.json'),'{}');fs.writeFileSync(path.join(lang,'events.json'),'{}');
 const store=new Store(path.join(dir,'sqlite'));
 class FakeCore extends EventEmitter{constructor(){super();this.ready=true;this.calls=[]}send(name,data,pid,rid){this.calls.push({name,data,pid,rid});}reply(index,packets){const c=this.calls[index];this.emit('response',{context:{frontEndOrigin:'lab',frontEndSubOrigin:c.rid,keycloakId:c.pid},packets})}}
 const core=new FakeCore(),presenter=new Presenter(lang),sent=[];
 const gateway=new Gateway({bindings:{[WA]:A,[WB]:B}},store,presenter,core,async(wa,text)=>sent.push({wa,text}));
 const input=(text,wa=WA,msgId='wa-'+(++counter))=>gateway.receive(msgId,wa,text);
 const out=(wa=WA)=>store.db.prepare('SELECT text FROM outbox WHERE wa=? ORDER BY id DESC LIMIT 1').get(wa)?.text||'';
 const token=(wa=WA)=>store.db.prepare('SELECT token FROM confirmations WHERE wa=?').get(wa)?.token;
 const close=async()=>{await new Promise(r=>setTimeout(r,50));store.close();fs.rmSync(dir,{recursive:true,force:true});for(const [k,v]of Object.entries(old))if(v===undefined)delete process.env[k];else process.env[k]=v};
 return {dir,store,core,gateway,presenter,input,out,token,close};
}
test('registry is fixed, no arbitrary input packet name/payload accepted',async()=>{
 assert.equal(U.NATIVE.ping.request,'CommandPingPacketReq');
 assert.deepEqual(Object.keys(U.NATIVE).sort(),['expeditionResolve','friendlyFight','guildCreate','guildDescription','guildElderRemove','guildKick','guildLeave','petCaress','petFree','petTransfer','ping','unlock']);
 assert.equal(U.resolve('/admin',A,{env:gate}),null);
 assert.equal(U.resolve('/nativo CommandTestPacketReq',A,{env:gate}),null);
 assert.equal(U.resolve('/acariciar',A,{env:{}}).name,undefined);
 assert.match(U.help(),/Core original/);
});
test('query /ping uses precise Core contract, has no confirmation or user input identity',async()=>{
 const r=U.resolve('/ping',A,{env:{},now:1555});assert.deepEqual(r,{name:'CommandPingPacketReq',data:{time:1555}});
 assert.equal(U.resolve('/ping 123',A,{env:{}}).name,undefined);
 assert.equal(U.resolve('/ping','other',{env:{}}),null);
});
test('read-only /ping passes through REAL Gateway with bound identity',async()=>{const t=lab({enabled:false});try{
 t.input('/ping');assert.equal(t.core.calls.length,1);assert.equal(t.core.calls[0].name,'CommandPingPacketReq');assert.equal(t.core.calls[0].pid,A);
 t.core.reply(0,[{name:'CommandPingPacketRes',packet:{clientTime:t.core.calls[0].data.time}}]);assert.match(t.out(),/MOTOR ATIVO/);
}finally{await t.close()}});
test('does not expose packet/UUID on WhatsApp response and rejects invalid ping timestamp',async()=>{
 assert.match(U.renderResponse('CommandPingPacketRes',{clientTime:99},{now:199}),/100 ms/);
 assert.doesNotMatch(U.renderResponse('CommandPingPacketRes',{clientTime:-123},{now:199}),/\-123/);
 assert.equal(U.renderResponse('CommandPetPetNotFound',{}),null);
});
test('sistemas menu does not dispatch a packet or claim production readiness',async()=>{const t=lab();try{
 t.input('/sistemas');assert.equal(t.core.calls.length,0);assert.match(t.out(),/alterações permanecem bloqueadas/i);
}finally{await t.close()}});
test('mutations are blocked on live, independently of other opt-in gates',async()=>{
 for(const env of [{},{...gate,WA_BAILEYS_SEND_MODE:'LIVE'},{...gate,CROWNICLES_WA_LAB_ISOLATED:''},{...gate,CROWNICLES_WA_EQUIP_ACTIONS:'enabled'}]){
   const r=U.resolve('/acariciar',A,{env});assert.ok(r.local);assert.equal(r.name,undefined);
 }
 const t=lab({live:true});try{t.input('/acariciar');assert.equal(t.core.calls.length,0);assert.match(t.out(),/não foi homologado/i);}finally{await t.close()}
});
test('generic pet caress preview then one-shot confirmation sends original packet',async()=>{const t=lab();try{
 t.input('/acariciar');assert.equal(t.core.calls.length,0);let m=t.store.getMenu(WA);assert.equal(m.type,'LocalUniversalNativeAuthorization');assert.equal(m.nativeIntent.key,'petCaress');
 t.input('1');assert.equal(t.core.calls.length,0);assert.match(t.out(),/Nada foi executado/);let k=t.token(WA);assert.match(k,/^[A-F0-9]{8}$/);
 t.input('/confirmar 1 '+k);assert.equal(t.core.calls.length,1);assert.deepEqual(t.core.calls[0].data,{});assert.equal(t.core.calls[0].name,'CommandPetCaressPacketReq');assert.equal(t.core.calls[0].pid,A);
 t.input('/confirmar 1 '+k);assert.equal(t.core.calls.length,1);
}finally{await t.close()}});
test('generic resolve expedition opens original no-argument request after nonce',async()=>{const t=lab();try{
 t.input('/resolverexpedicao');t.input('1');const k=t.token(WA);t.input('/confirmar 1 '+k);
 assert.equal(t.core.calls[0].name,'CommandPetExpeditionResolvePacketReq');assert.deepEqual(t.core.calls[0].data,{});
}finally{await t.close()}});
test('create guild only uses bound Player ID and name, refuses uncontrolled JSON',async()=>{const t=lab();try{
 t.input('/criarguilda Ventos da Aurora');assert.equal(t.core.calls.length,0);const m=t.store.getMenu(WA);
 assert.equal(m.nativeIntent.data.keycloakId,A);assert.equal(m.nativeIntent.data.askedGuildName,'Ventos da Aurora');
 t.input('1');let k=t.token(WA);t.input('/confirmar 1 '+k);assert.equal(t.core.calls.length,1);
 assert.equal(t.core.calls[0].name,'CommandGuildCreatePacketReq');assert.deepEqual(t.core.calls[0].data,{keycloakId:A,askedGuildName:'Ventos da Aurora'});
}finally{await t.close()}});
test('bad guild name and payload injection never go to Core',async()=>{const t=lab();try{
 for(const name of ['/criarguilda','/criarguilda x','/criarguilda X {"test":true}','/criarguilda <img>','/criarguilda Nome\n/confirmar 1 ABCDEF12']){
   t.input(name);assert.equal(t.core.calls.length,0);
 }
}finally{await t.close()}});
test('foreign player can neither authorize nor consume your nonce',async()=>{const t=lab();try{
 t.input('/acariciar');t.input('1');const k=t.token(WA);
 t.input('/confirmar 1 '+k,WB);assert.equal(t.core.calls.length,0);
 assert.equal(t.token(WA),k);t.input('/confirmar 1 '+k);assert.equal(t.core.calls.length,1);
}finally{await t.close()}});
test('nonce invalid/expired does not dispatch',async()=>{const t=lab();try{
 t.input('/acariciar');t.input('1');let k=t.token(WA);t.input('/confirmar 1 FFFFFFFF');assert.equal(t.core.calls.length,0);
 t.store.db.prepare('UPDATE confirmations SET expires_at=1').run();t.input('/confirmar 1 '+k);assert.equal(t.core.calls.length,0);
}finally{await t.close()}});
test('player cannot open new native mutation while menu pending',async()=>{const t=lab();try{
 t.input('/acariciar');const first=t.store.getMenu(WA).id;t.input('/criarguilda Nova Guilda');assert.equal(t.store.getMenu(WA).id,first);assert.equal(t.core.calls.length,0);
}finally{await t.close()}});
test('generic cancellation is free and makes no change',async()=>{const t=lab();try{
 t.input('/acariciar');t.input('2');assert.equal(t.core.calls.length,0);assert.equal(t.store.getMenu(WA),null);
}finally{await t.close()}});
test('menu intent modified inside SQLite is rejected even with valid token',async()=>{const t=lab();try{
 t.input('/criarguilda Nova Guilda');let m=t.store.getMenu(WA);const mutated={...m,nativeIntent:{...m.nativeIntent,data:{keycloakId:A,askedGuildName:'Outra Guilda'}}};
 t.store.saveMenu(WA,mutated);t.input('1');const k=t.token(WA);t.input('/confirmar 1 '+k);assert.equal(t.core.calls.length,0);
}finally{await t.close()}});
test('even direct authorize cannot work outside lab, or with different owner',async()=>{
 let m=U.makeMenu({key:'petCaress',data:{}},A);assert.ok(m);
 assert.equal(U.authorized(m,m.options[0],B,{env:gate}),null);
 assert.equal(U.authorized(m,m.options[0],A,{env:{}}),null);
 assert.equal(U.authorized(m,m.options[0],A,{env:gate}).name,'CommandPetCaressPacketReq');
});
test('PetCaress original may respond with zero packets; close request without claiming reward',async()=>{const t=lab();try{
 t.input('/acariciar');t.input('1');let k=t.token(WA);t.input('/confirmar 1 '+k);
 const req=t.store.getRequest(t.core.calls[0].rid);assert.equal(req.done,0);
 t.core.reply(0,[]);assert.equal(t.store.getRequest(req.id).done,1);
 assert.match(t.out(),/sem informar recompensas/i);
 assert.equal(t.core.calls.length,1);
 t.core.reply(0,[]);assert.equal(t.core.calls.length,1);
}finally{await t.close()}});
test('empty packets from other native actions never imply success',async()=>{const t=lab();try{
 t.input('/criarguilda Nova Guilda');t.input('1');let k=t.token(WA);t.input('/confirmar 1 '+k);
 const req=t.store.getRequest(t.core.calls[0].rid);
 t.core.reply(0,[]);assert.equal(t.store.getRequest(req.id).done,0);
 assert.doesNotMatch(t.out(),/GUILDA FUNDADA/);
}finally{await t.close()}});
test('official guild result variants are truthful and do not reveal IDs',async()=>{
 assert.match(U.renderResponse('CommandGuildCreatePacketRes',{foundGuild:false,missingMoney:200}),/200 moedas/);
 assert.match(U.renderResponse('CommandGuildCreatePacketRes',{foundGuild:false,guildNameIsAvailable:false}),/em uso/);
 assert.match(U.renderResponse('CommandGuildCreatePacketRes',{foundGuild:false,guildNameIsAcceptable:false}),/recusou/);
 assert.match(U.renderResponse('CommandGuildCreateAcceptPacketRes',{guildName:'Aurora'}),/Aurora/);
 assert.match(U.renderResponse('CommandGuildCreateRefusePacketRes',{}),/cancelada/);
 assert.doesNotMatch(U.renderResponse('CommandGuildCreateAcceptPacketRes',{guildName:'<script>ABC</script>'}),/script/);
});
test('official guild result goes through Presenter and original Gateway',async()=>{const t=lab();try{
 t.input('/criarguilda Aurora');t.input('1');const k=t.token(WA);t.input('/confirmar 1 '+k);
 t.core.reply(0,[{name:'CommandGuildCreatePacketRes',packet:{foundGuild:false,missingMoney:777}}]);
 assert.match(t.out(),/777 moedas/);assert.equal(t.store.getRequest(t.core.calls[0].rid).done,1);
}finally{await t.close()}});
