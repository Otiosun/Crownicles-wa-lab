'use strict';
// Regression of the *real* beta adapter, persistence store, W3 menu presenter,
// confirmation nonce and native reaction dispatch. No real game DB/WhatsApp used.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createBetaRuntime}=require('./integracao.cjs');
const {Presenter}=require('./bridge/presenter.cjs');
const P1='5511999000091@s.whatsapp.net',P2='5511999000092@s.whatsapp.net';
const NATIVE=['CommandSellPacketReq','ReactionCollectorReactPacket','CommandFightPacketReq','CommandPetFeedPacketReq','CommandDrinkPacketReq','CommandDailyBonusPacketReq','CommandClassesPacketReq','CommandJoinBoatPacketReq'];
const delay=()=>new Promise(resolve=>setTimeout(resolve,10));
async function until(fn){for(let i=0;i<60;i++){if(fn())return;await delay()}throw Error('TIMEOUT_WAITING_FOR_FLOW')}
function makeHarness(native={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'crown-beta-collector-'));
 const sent=[],calls=[],users=new Map(),infos=new Map(),slots=new Map();
 let nextPlayer=1,nextMenu=1;
 const model=(map,key)=>( {findOrCreate:async({where,defaults})=>{const id=key(where);if(!map.has(id))map.set(id,{...defaults,id:nextPlayer++});return [map.get(id),true]}} );
 const p=new Presenter(path.join(dir,'missing-lang'));p.models={weapons:{1:'Espada de teste'},potions:{5:'Poção de vida'},objects:{7:'Amuleto'},classes:{4:'Soldado'}};
 class Core extends EventEmitter{
  constructor(){super();this.ready=true}
  send(name,data,playerId,requestId){
   calls.push({name,data,playerId,requestId});
   if(name!=='ReactionCollectorReactPacket'){
    const menuId='menu-'+nextMenu++;
    setImmediate(()=>this.emit('response',{context:{frontEndSubOrigin:requestId,keycloakId:playerId},packets:[{name:'ReactionCollectorCreationPacket',packet:{id:menuId,endTime:Date.now()+100000,data:{type:native.kind||'ReactionCollectorSellData',data:native.data||{}},reactions:native.reactions||[
     {type:'ReactionCollectorSellItemReaction',data:{item:{category:0,id:1},slot:1,price:25}},
     {type:'ReactionCollectorRefuseReaction',data:{}}
    ]}}]}));
   }else if(name==='ReactionCollectorReactPacket'){
    setImmediate(()=>this.emit('response',{context:{frontEndSubOrigin:requestId,keycloakId:playerId},packets:[{name:'CommandSellCancelErrorPacket',packet:{}}]}));
   }
  }
 }
 const core=new Core();
 const rt=createBetaRuntime({dataDir:dir,ownerJids:[P1],core,presenter:p,send:async(jid,text)=>{sent.push({jid,text})},
  enabledPackets:new Set(NATIVE),
  Player:model(users,w=>w.keycloakId),InventoryInfo:model(infos,w=>w.playerId),InventorySlot:model(slots,w=>w.playerId+':'+w.itemCategory+':'+w.slot),
  ItemCategory:{WEAPON:0,ARMOR:1,POTION:2,OBJECT:3}});
 let message=0;
 const send=(player,text)=>rt.handle({id:'msg-'+(++message),chatJid:player,senderJid:player,text});
 const register=async player=>{await send(player,'/cadastro');assert.equal(rt.beta.player(player).state,'active')};
 const open=async(player,command='/vender')=>{await send(player,command);await until(()=>!!rt.store.getMenu(player));return rt.store.getMenu(player)};
 const close=()=>{rt.close();fs.rmSync(dir,{recursive:true,force:true})};
 return {dir,core,rt,sent,calls,send,register,open,close};
}

test('real Core collector rendered with sale amount, original indices and explicit preview',async()=>{
 const x=makeHarness();try{
  await x.register(P1);const menu=await x.open(P1);
  assert.equal(menu.type,'ReactionCollectorSellData');
  assert.equal(menu.options.length,2);
  assert.equal(menu.options[0].supported,true);
  assert.equal(menu.options[0].requiresConfirmation,true);
  assert.match(menu.options[0].label,/25 moedas/);
  assert.match(menu.options[1].label,/Cancelar venda/);
  await until(()=>x.sent.some(v=>v.text.includes('Vender Espada de teste')));
  const count=x.calls.length;
  await x.send(P1,'1');
  await until(()=>x.sent.some(v=>v.text.includes('REVISÃO DA DECISÃO')));
  assert.equal(x.calls.length,count,'preview must not dispatch a mutating action');
  assert.equal(x.rt.store.getMenu(P1).id,menu.id);
  assert.equal(x.rt.store.db.prepare('SELECT count(*) n FROM confirmations').get().n,1);
 }finally{x.close()}
});

test('confirmed native action is sent exactly once; wrong token, duplicates and replay cannot dispatch',async()=>{
 const x=makeHarness();try{
  await x.register(P1);await x.open(P1);await x.send(P1,'1');
  const preview=x.rt.store.db.prepare('SELECT token FROM confirmations WHERE wa=?').get(P1).token;
  await x.send(P1,'/confirmar 1 00000000');
  assert.equal(x.calls.length,1);
  await x.send(P1,'/confirmar 1 '+preview);
  await until(()=>x.calls.length===2);
  assert.equal(x.calls[1].name,'ReactionCollectorReactPacket');
  assert.equal(x.calls[1].data.reactionIndex,0);
  assert.equal(x.calls[1].data.keycloakId,x.rt.beta.player(P1).uuid);
  await x.send(P1,'/confirmar 1 '+preview);await delay();
  assert.equal(x.calls.length,2);
  assert.equal(x.rt.store.db.prepare('SELECT count(*) n FROM confirmations').get().n,0);
 }finally{x.close()}
});

test('confirmed sale preview is scoped to one WhatsApp identity and one menu snapshot',async()=>{
 const x=makeHarness();try{
  await x.register(P1);await x.register(P2);
  await x.open(P1);await x.open(P2);
  await x.send(P1,'1');const token=x.rt.store.db.prepare('SELECT token FROM confirmations WHERE wa=?').get(P1).token;
  const count=x.calls.length;
  await x.send(P2,'/confirmar 1 '+token);await delay();assert.equal(x.calls.length,count);
  // The Core may replace a collector after changing world state; the old
  // preview must never authorize the new collector, even with the same option.
  const original=x.rt.store.getMenu(P1);
  x.rt.store.saveMenu(P1,{...original,id:'menu-changed-by-core'});
  await x.send(P1,'/confirmar 1 '+token);await delay();assert.equal(x.calls.length,count);
 }finally{x.close()}
});

test('cancel option retains original Core index and does not use a purchase nonce',async()=>{
 const x=makeHarness();try{
  await x.register(P1);const menu=await x.open(P1);assert.equal(menu.options[1].requiresConfirmation,false);
  await x.send(P1,'2');await until(()=>x.calls.length===2);
  assert.equal(x.calls[1].name,'ReactionCollectorReactPacket');assert.equal(x.calls[1].data.reactionIndex,1);
  assert.equal(x.rt.store.db.prepare('SELECT count(*) n FROM confirmations').get().n,0);
 }finally{x.close()}
});

const FAMILIES=[
 {cmd:'/combate', packet:'CommandFightPacketReq', kind:'ReactionCollectorFightData',data:{},reactions:[{type:'ReactionCollectorAcceptReaction',data:{}},{type:'ReactionCollectorRefuseReaction',data:{}}]},
 {cmd:'/vender',packet:'CommandSellPacketReq',kind:'ReactionCollectorSellData',data:{},reactions:[{type:'ReactionCollectorSellItemReaction',data:{item:{category:0,id:1},slot:1,price:25}},{type:'ReactionCollectorRefuseReaction',data:{}}]},
 {cmd:'/alimentar',packet:'CommandPetFeedPacketReq',kind:'ReactionCollectorPetFeedWithoutGuildData',data:{price:40,food:'commonFood',pet:{nickname:'Lua'}},reactions:[{type:'ReactionCollectorAcceptReaction',data:{}},{type:'ReactionCollectorRefuseReaction',data:{}}]},
 {cmd:'/pocao',packet:'CommandDrinkPacketReq',kind:'ReactionCollectorDrinkData',data:{},reactions:[{type:'ReactionCollectorDrinkReaction',data:{potion:{id:5,itemCategory:2}}},{type:'ReactionCollectorRefuseReaction',data:{}}]},
 {cmd:'/diario',packet:'CommandDailyBonusPacketReq',kind:'ReactionCollectorDailyBonusData',data:{},reactions:[{type:'ReactionCollectorDailyBonusReaction',data:{object:{id:7,itemCategory:3}}},{type:'ReactionCollectorRefuseReaction',data:{}}]},
 {cmd:'/mudarclasse',packet:'CommandClassesPacketReq',kind:'ReactionCollectorChangeClassData',data:{cooldownSeconds:604800,classesDetails:[{id:4,health:88,attack:12,defense:10,speed:14}]},reactions:[{type:'ReactionCollectorChangeClassReaction',data:{classId:4}},{type:'ReactionCollectorRefuseReaction',data:{}}]},
 {cmd:'/embarcar',packet:'CommandJoinBoatPacketReq',kind:'ReactionCollectorJoinBoatData',data:{price:12,energy:{current:50,max:60}},reactions:[{type:'ReactionCollectorAcceptReaction',data:{}},{type:'ReactionCollectorRefuseReaction',data:{}}]}
];
for(const scenario of FAMILIES){
 test('beta E2E mocked native collector: '+scenario.cmd+' requires preview and one-time confirmation',async()=>{
  const x=makeHarness(scenario);try{
   await x.register(P1);const menu=await x.open(P1,scenario.cmd);
   assert.equal(x.calls[0].name,scenario.packet);
   assert.equal(menu.type,scenario.kind);
   assert.equal(menu.options.length,2);
   assert.equal(menu.options[0].supported,true,`First option unsupported: ${JSON.stringify(menu.options[0])}`);
   assert.equal(menu.options[0].requiresConfirmation,true);
   assert.equal(menu.options[1].supported,true);
   assert.equal(menu.options[1].requiresConfirmation,false);
   assert.equal(x.calls.length,1);
   await x.send(P1,'1');await until(()=>!!x.rt.store.db.prepare('SELECT token FROM confirmations WHERE wa=?').get(P1));
   assert.equal(x.calls.length,1,'preview must not mutate game');
   const token=x.rt.store.db.prepare('SELECT token FROM confirmations WHERE wa=?').get(P1).token;
   await x.send(P1,'/confirmar 1 '+token);await until(()=>x.calls.length===2);
   assert.equal(x.calls[1].name,'ReactionCollectorReactPacket');
   assert.equal(x.calls[1].data.reactionIndex,0);
   assert.equal(x.calls[1].data.keycloakId,x.rt.beta.player(P1).uuid);
   await x.send(P1,'/confirmar 1 '+token);await delay();
   assert.equal(x.calls.length,2);
  }finally{x.close()}
 });
}

test('another collector-opening command does not replace a still-active decision',async()=>{
 const x=makeHarness();try{
  await x.register(P1);const original=await x.open(P1,'/vender');
  await x.send(P1,'/combate');await delay();
  assert.equal(x.calls.length,1,'second menu opener must not reach Core');
  assert.deepEqual(x.rt.store.getMenu(P1),original);
  await until(()=>x.sent.some(x=>/decisão pendente/.test(x.text)));
 }finally{x.close()}
});
