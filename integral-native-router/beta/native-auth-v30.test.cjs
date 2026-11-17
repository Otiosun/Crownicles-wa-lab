'use strict';
/* Crownicles 6.2.0.b — tests run ONLY with fake Core and throwaway SQLite. */
const {test}=require('node:test'),a=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {EventEmitter}=require('node:events');
const {Store}=require('./bridge/store.cjs');
const {Gateway}=require('./bridge/gateway.cjs');
const {Presenter}=require('./bridge/presenter.cjs');
const {NATIVE_AUTH_HANDLERS,probeAuthHandlers,renderHelp}=require('./feature-manifest.cjs');
const wa1='5511987654321@s.whatsapp.net',wa2='5511987654322@s.whatsapp.net';
const uuid1='11111111-1111-4111-8111-111111111111',uuid2='22222222-2222-4222-8222-222222222222';
const opts=Object.keys(NATIVE_AUTH_HANDLERS);
const scenarios=[
 {command:'/renascer',req:'CommandRespawnPacketReq',type:'LocalNativeAuthorization'},
 {command:'/recompensaliga',req:'CommandLeagueRewardPacketReq',type:'LocalNativeAuthorization'},
 {command:'/diarioguilda',req:'CommandGuildDailyPacketReq',type:'LocalNativeAuthorization'},
 {command:'/renomearpet Eclipse',req:'CommandPetNickPacketReq',type:'LocalPetNickname'}
];
function harness(allowed=opts){
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'crown-v30-'));
 const store=new Store(home),sent=[],calls=[];
 class FakeCore extends EventEmitter {constructor(){super();this.ready=true}send(name,data,playerId,id){calls.push({name,data,playerId,id});setImmediate(()=>this.emit('response',{context:{frontEndSubOrigin:id,keycloakId:playerId},packets:[{name:'CommandRespawnErrorAlreadyAlive',packet:{}}]}))}}
 const core=new FakeCore();
 const presenter=new Presenter(path.join(home,'no-lang'));
 const gateway=new Gateway({bindings:{[wa1]:uuid1,[wa2]:uuid2},canSendPacket:name=>allowed.includes(name)},store,presenter,core,async(to,text)=>sent.push({to,text}));
 let inc=0;
 const receive=(jid,text)=>{gateway.receive('id-'+(++inc),jid,text);return store.getMenu(jid)};
 const close=()=>{gateway.close();store.close();fs.rmSync(home,{recursive:true,force:true})};
 return {store,core,gateway,calls,sent,receive,close};
}
for(const v of scenarios){
 test('original W3 authorization: '+v.command+' requires preview and single confirm',async()=>{
  const x=harness();try{
   const menu=x.receive(wa1,v.command);a.equal(menu?.type,v.type);a.equal(menu.options?.length,2);
   a.equal(menu.options[0].requiresConfirmation,true);a.equal(x.calls.length,0,'opening must not mutate');
   a.equal(menu.options[1].kind,'nativeCancel');
   x.receive(wa1,'1');const preview=x.store.db.prepare('SELECT token FROM confirmations WHERE wa=?').get(wa1);
   a.match(preview?.token||'',/^[A-F0-9]{8}$/);a.equal(x.calls.length,0,'preview must not mutate');
   x.receive(wa2,'/confirmar 1 '+preview.token);a.equal(x.calls.length,0,'other player cannot redeem token');
   x.receive(wa1,'/confirmar 1 00000000');a.equal(x.calls.length,0,'wrong token cannot redeem');
   x.receive(wa1,'/confirmar 1 '+preview.token);a.equal(x.calls.length,1);
   a.equal(x.calls[0].name,v.req);a.equal(x.calls[0].playerId,uuid1);
   if(v.req==='CommandPetNickPacketReq')a.deepEqual(x.calls[0].data,{keycloakId:uuid1,newNickname:'Eclipse'});
   else a.deepEqual(x.calls[0].data,{});
   x.receive(wa1,'/confirmar 1 '+preview.token);a.equal(x.calls.length,1,'replay must not mutate');
  }finally{x.close()}
 });
 test('cancel '+v.command+' without sending a Core request',()=>{
  const x=harness();try{const menu=x.receive(wa1,v.command);a.ok(menu);x.receive(wa1,'2');a.equal(x.calls.length,0);a.equal(x.store.getMenu(wa1),null)}finally{x.close()}
 });
 test('missing Core listener blocks '+v.command+' before presenting any menu',()=>{
  const x=harness([]);try{x.receive(wa1,v.command);a.equal(x.store.getMenu(wa1),null);a.equal(x.calls.length,0)}finally{x.close()}
 });
}
test('a second native authorization never replaces a pending menu',()=>{
 const x=harness();try{const aMenu=x.receive(wa1,'/recompensaliga');x.receive(wa1,'/renomearpet Eclipse');a.deepEqual(x.store.getMenu(wa1),aMenu);a.equal(x.calls.length,0)}finally{x.close()}
});
test('capability detection rejects missing listeners and renders only registered commands',()=>{
 const dist=path.join(os.tmpdir(),'crown-v30-compiled');let names=new Set(['CommandRespawnPacketReq','CommandPetNickPacketReq']);
 const probe=probeAuthHandlers({dist,listener:{getListener:p=>names.has(p)?()=>{}:undefined},exists:()=>false,load:()=>{throw Error('should not import') }});
 a.deepEqual(new Set(probe.available),names);a.equal(probe.unavailable.length,2);
 const help=renderHelp([...names]);a.match(help,/\/renascer/);a.match(help,/\/renomearpet NOME/);a.doesNotMatch(help,/\/diarioguilda/);a.doesNotMatch(help,/\/recompensaliga/);
});
test('daily cooldown uses Core timestamp when available; invalid times never invented',()=>{
 const {renderPacket}=require('./bridge/lote08.cjs');
 const now=Date.now();
 const text=renderPacket('CommandDailyBonusInCooldown',{lastDailyTimestamp:now-1800000,timeBetweenDailies:24});
 a.match(text,/Disponível a partir de/);a.match(text,/horário de Brasília/);
 const fallback=renderPacket('CommandDailyBonusInCooldown',{timeBetweenDailies:24});
 a.doesNotMatch(fallback,/Disponível a partir de/);
});
