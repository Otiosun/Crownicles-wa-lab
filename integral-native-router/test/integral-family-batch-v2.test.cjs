'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {EventEmitter}=require('node:events');
const U=require('../src/native-universal.cjs');
const C=require('../src/universal-collector-v3.cjs');
const {Presenter}=require('../src/presenter.cjs');
const {Store}=require('../src/store.cjs');
const {Gateway}=require('../src/gateway.cjs');
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const labFlags={CROWNICLES_WA_UNIVERSAL_COMMANDS:'lab',CROWNICLES_WA_LAB_ISOLATED:'SIM_ISOLADO',CROWNICLES_WA_UNIVERSAL_COLLECTORS:'lab',WA_BAILEYS_SEND_MODE:'',CROWNICLES_WA_EQUIP_ACTIONS:''};
const AType='ReactionCollectorAcceptReaction',RType='ReactionCollectorRefuseReaction';
const pair=(reverse=false)=>reverse?[{type:RType,data:{}},{type:AType,data:{}}]:[{type:AType,data:{}},{type:RType,data:{}}];
const menu=(type,data,reactions=pair())=>({id:'real-'+Math.random().toString(36).slice(2),endTime:Date.now()+60000,data:{type,data},reactions});
const candidates=[
 ['/descricaoguilda Guilda dos Viajantes','CommandGuildDescriptionPacketReq',{description:'Guilda dos Viajantes'}],
 ['/sairdaguilda','CommandGuildLeavePacketReq',{}],
 ['/removeranciao','CommandGuildElderRemovePacketReq',{}],
 ['/expulsarguilda 42','CommandGuildKickPacketReq',{askedPlayer:{rank:42}}],
 ['/liberarpet','CommandPetFreePacketReq',{keycloakId:A}],
 ['/transferirpet','CommandPetTransferPacketReq',{}],
 ['/amistoso 111','CommandFriendlyFightPacketReq',{askedPlayer:{rank:111}}],
 ['/libertarjogador 10','CommandUnlockPacketReq',{askedPlayer:{rank:10}}]
];
function inLab(fn){const keys=Object.keys(labFlags),old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));for(const [k,v]of Object.entries(labFlags)){if(v==='')delete process.env[k];else process.env[k]=v;}try{return fn();}finally{for(const [k,v]of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}}
function newLab(){
 const keys=Object.keys(labFlags),old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));for(const [k,v]of Object.entries(labFlags)){if(v==='')delete process.env[k];else process.env[k]=v;}
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cw-full-family-'));
 const lang=path.join(dir,'lang');fs.mkdirSync(lang);fs.writeFileSync(path.join(lang,'models.json'),'{}');fs.writeFileSync(path.join(lang,'events.json'),'{}');
 const store=new Store(path.join(dir,'db'));
 class Core extends EventEmitter{constructor(){super();this.ready=true;this.calls=[];}send(name,data,pid,rid){this.calls.push({name,data,pid,rid})}reply(i,packets){const c=this.calls[i];this.emit('response',{context:{frontEndOrigin:'lab',frontEndSubOrigin:c.rid,keycloakId:c.pid},packets})}}
 const core=new Core(),presenter=new Presenter(lang);const gw=new Gateway({bindings:{5511991111111:A,5511992222222:B}},store,presenter,core,async()=>{});let seq=0;
 const send=(text,wa='5511991111111')=>gw.receive('message-'+(++seq),wa,text);
 const out=()=>store.db.prepare('SELECT text FROM outbox ORDER BY id DESC LIMIT 1').get()?.text||'';
 const nonce=()=>store.db.prepare('SELECT token FROM confirmations WHERE wa=?').get('5511991111111')?.token;
 const close=async()=>{await new Promise(r=>setTimeout(r,35));store.close();fs.rmSync(dir,{recursive:true,force:true});for(const [k,v]of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}};
 return {send,store,core,gw,presenter,out,nonce,close};
}

test('registry contains exactly 12 contracts; no arbitrary packet dispatch',()=>{
 assert.equal(Object.keys(U.NATIVE).length,12);
 assert.equal(U.resolve('/nativo CommandGuildKickPacketReq',A,{env:labFlags}),null);
 assert.equal(U.resolve('/admin',A,{env:labFlags}),null);
});
for(const [cmd,packet,payload] of candidates){
 test(`native family ${cmd} uses the exact official payload under lab gates`,()=>{
  const resolved=U.resolve(cmd,A,{env:labFlags});assert.equal(resolved.universalIntent.key?U.NATIVE[resolved.universalIntent.key].request:null,packet);
  assert.deepEqual(resolved.universalIntent.data,payload);
  const m=U.makeMenu(resolved.universalIntent,A);assert.ok(m);assert.deepEqual(U.authorized(m,m.options[0],A,{env:labFlags}),{name:packet,data:payload});
  assert.equal(U.authorized(m,m.options[0],B,{env:labFlags}),null);
  assert.equal(U.resolve(cmd,A,{env:{}}).name,undefined);
 });
}
test('invalid ranks, injection, multiline and weak guild descriptions never reach core',()=>{
 for(const raw of ['/expulsarguilda 0','/expulsarguilda -1','/expulsarguilda 100001','/amistoso 4.4','/libertarjogador 1e3','/descricaoguilda x','/descricaoguilda A\n/admin','/descricaoguilda <script>','/transferirpet {"x":1}','/sairdaguilda sim']){
  const r=U.resolve(raw,A,{env:labFlags});assert.equal(r.name,undefined);assert.equal(r.universalIntent,undefined);assert.ok(r.local);
 }
});
test('no user can inject self keycloakId or other UUID for freeing a pet',()=>{
 const a=U.resolve('/liberarpet',A,{env:labFlags});assert.deepEqual(a.universalIntent.data,{keycloakId:A});
 assert.equal(U.resolve(`/liberarpet ${B}`,A,{env:labFlags}).universalIntent,undefined);
 const m=U.makeMenu({key:'petFree',data:{keycloakId:B}},A);assert.equal(m,null);
});
test('tampering stored rank/description/self data is refused at authorization',()=>{
 for(const [cmd,edit] of [['/libertarjogador 22',d=>{d.askedPlayer.rank=23;}],['/descricaoguilda Minha guilda',d=>{d.description+='!';}],['/liberarpet',d=>{d.keycloakId=B;}]]){
  const m=U.makeMenu(U.resolve(cmd,A,{env:labFlags}).universalIntent,A);const clone=JSON.parse(JSON.stringify(m));edit(clone.nativeIntent.data);
  assert.equal(U.authorized(clone,clone.options[0],A,{env:labFlags}),null);
 }
});
test('manual packet intents with extra fields and forged requests are rejected',()=>{
 for(const x of [{key:'guildKick',data:{askedPlayer:{rank:2},isAdmin:true}},{key:'friendlyFight',data:{askedPlayer:{rank:2,keycloakId:B}}},{key:'petTransfer',data:{free:true}}])assert.equal(U.makeMenu(x,A),null);
});
const collectors=[
 ['ReactionCollectorGuildCreateData',{guildName:'Aurora'}],
 ['ReactionCollectorGuildDescriptionData',{description:'Guilda de aventureiros'}],
 ['ReactionCollectorGuildLeaveData',{guildName:'Aurora',newChiefKeycloakId:'',isGuildDestroyed:true}],
 ['ReactionCollectorGuildElderRemoveData',{guildName:'Aurora',demotedKeycloakId:B}],
 ['ReactionCollectorGuildKickData',{guildName:'Aurora',kickedKeycloakId:B}],
 ['ReactionCollectorUnlockData',{unlockedKeycloakId:B}],
 ['ReactionCollectorPetFreeData',{petId:4,petSex:'m',petNickname:'Lobo',freeCost:500}],
 ['ReactionCollectorPetFreeShelterConfirmData',{petEntityId:23,petId:4,petSex:'f',isFromShelter:true,freeCost:50}]
];
for(const [type,data] of collectors){
 test(`original collector ${type}: correct 2-choice order, accept requires nonce`,()=>{
  for(const rev of [false,true]){const m=C.compileCollector(menu(type,data,pair(rev)));assert.ok(m,type);assert.equal(m.options.length,2);const index=rev?1:0;const identityBlocked=['ReactionCollectorGuildElderRemoveData','ReactionCollectorGuildKickData','ReactionCollectorUnlockData'].includes(type);assert.equal(m.options[index].supported,!identityBlocked);assert.equal(m.options[index].requiresConfirmation,!identityBlocked);assert.equal(m.options[1-index].requiresConfirmation,false);}
 });
}
test('guild destruction displays risk prominently and no player UUID',()=>{
 const m=C.compileCollector(menu('ReactionCollectorGuildLeaveData',{guildName:'Minha Guilda',newChiefKeycloakId:'',isGuildDestroyed:true}));
 assert.match(m.story,/DESTRÓI/);assert.match(m.options[0].label,/DESTRUIÇÃO/);
 const p=C.compileCollector(menu('ReactionCollectorGuildElderRemoveData',{guildName:'Minha Guilda',demotedKeycloakId:B}));assert.doesNotMatch(p.story,new RegExp(B));
});
test('malformed collector schemas are rejected with no options',()=>{
 for(const [kind,data] of collectors){
  const variants=[menu(kind,data,[{type:AType,data:{}}]),menu(kind,data,[{type:AType,data:{x:1}},{type:RType,data:{}}]),menu(kind,data,[{type:AType,data:{}},{type:AType,data:{}}])];
  for(const v of variants)assert.equal(C.compileCollector(v),null,kind);
 }
 assert.equal(C.compileCollector(menu('ReactionCollectorGuildLeaveData',{guildName:'Aurora',isGuildDestroyed:'true',newChiefKeycloakId:''})),null);
 assert.equal(C.compileCollector(menu('ReactionCollectorUnlockData',{unlockedKeycloakId:'untrusted'})),null);
 assert.equal(C.compileCollector(menu('ReactionCollectorPetFreeData',{petId:3,petSex:'M',freeCost:500})),null);
});
test('official guild leave initial action followed by original destruction collector and TWO separate nonces',async()=>{const t=newLab();try{
 t.send('/sairdaguilda');assert.equal(t.core.calls.length,0);assert.match(t.out(),/DESTRUIR/);
 t.send('1');const first=t.nonce();assert.match(first,/^[A-F0-9]{8}$/);
 t.send('/confirmar 1 '+first);assert.equal(t.core.calls.length,1);assert.equal(t.core.calls[0].name,'CommandGuildLeavePacketReq');
 t.core.reply(0,[{name:'ReactionCollectorCreationPacket',packet:menu('ReactionCollectorGuildLeaveData',{guildName:'Aurora',newChiefKeycloakId:'',isGuildDestroyed:true})}]);
 assert.equal(t.store.getMenu('5511991111111').type,'ReactionCollectorGuildLeaveData');assert.match(t.out(),/DESTRÓI/);
 t.send('1');assert.equal(t.core.calls.length,1);const second=t.nonce();assert.match(second,/^[A-F0-9]{8}$/);assert.notEqual(second,first);
 t.send('/confirmar 1 '+second);assert.equal(t.core.calls.length,2);assert.equal(t.core.calls[1].name,'ReactionCollectorReactPacket');assert.equal(t.core.calls[1].data.reactionIndex,0);
 t.send('/confirmar 1 '+second);assert.equal(t.core.calls.length,2);
 t.core.reply(1,[{name:'CommandGuildLeaveAcceptPacketRes',packet:{guildName:'Aurora',isGuildDestroyed:true}}]);assert.ok(t.store.db.prepare('SELECT text FROM outbox').all().some(x=>/destruição da guilda/i.test(x.text)));
}finally{await t.close()}});
test('official collector cancel closes menu and sends one refusal, without acceptance',async()=>{const t=newLab();try{
 t.send('/sairdaguilda');t.send('1');t.send('/confirmar 1 '+t.nonce());
 t.core.reply(0,[{name:'ReactionCollectorCreationPacket',packet:menu('ReactionCollectorGuildLeaveData',{guildName:'Aurora',newChiefKeycloakId:'',isGuildDestroyed:true})}]);
 t.send('2');assert.equal(t.core.calls.length,2);assert.equal(t.core.calls[1].name,'ReactionCollectorReactPacket');assert.equal(t.core.calls[1].data.reactionIndex,1);
 t.core.reply(1,[{name:'CommandGuildLeaveRefusePacketRes',packet:{}}]);assert.match(t.out(),/permanecer na guilda/);
}finally{await t.close()}});
test('malformed official collector opens no actionable choice',async()=>{const t=newLab();try{
 t.send('/sairdaguilda');t.send('1');t.send('/confirmar 1 '+t.nonce());
 t.core.reply(0,[{name:'ReactionCollectorCreationPacket',packet:menu('ReactionCollectorGuildLeaveData',{guildName:'Aurora',newChiefKeycloakId:B,isGuildDestroyed:'false'})}]);
 assert.match(t.out(),/DADOS INCONSISTENTES/);t.send('1');assert.equal(t.core.calls.length,1);
}finally{await t.close()}});
test('renderer reports exact original outcomes without fabricating rewards',()=>{
 const p=new Presenter('/nonexistent');
 const out=(name,data)=>p.apply([{name,packet:data}], '5511991111111',{queue(){},saveMenu(){},clearMenu(){}},A);
 assert.match(out('CommandGuildDescriptionInvalidPacket',{min:2,max:140}),/140 caracteres/);
 assert.match(out('CommandGuildElderRemoveAcceptPacketRes',{demotedKeycloakId:B,guildName:'Aurora'}),/removeu o ancião|remoção do ancião/i);
 assert.doesNotMatch(out('CommandGuildElderRemoveAcceptPacketRes',{demotedKeycloakId:B,guildName:'Aurora'}),new RegExp(B));
 assert.match(out('CommandPetFreePacketRes',{foundPet:false}),/Nenhum companheiro/);
 assert.match(out('CommandUnlockNotEnoughMoney',{money:2}),/Moedas insuficientes/);
 assert.match(out('CommandFriendlyFightErrorPacketRes',{error:'selfFight'}),/si mesmo/);
 assert.match(out('CommandPetExpeditionResolvePacketRes',{success:true,rewards:{money:100,experience:25},partialSuccess:false}),/100/);
});
