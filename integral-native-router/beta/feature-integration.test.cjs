'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createBetaRuntime}=require('./integracao.cjs');
const P1='5511999000001@s.whatsapp.net',P2='5511999000002@s.whatsapp.net';
const GROUP='120363111111111111@g.us',OWNER='5511999000099@s.whatsapp.net';
const BASE=['CommandReportPacketReq','CommandProfilePacketReq','CommandInventoryPacketReq','CommandMissionsPacketReq','ReactionCollectorReactPacket'];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function fixture(extra=[],reply=true){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cw-beta-v27-'));
 const sent=[],calls=[],users=new Map(),inventory=new Map(),slots=new Map();let seq=0;
 const make=(map,key,decorate=()=>({}))=>({findOrCreate:async({where,defaults})=>{const k=key(where);if(!map.has(k))map.set(k,{...defaults,...decorate()});return [map.get(k),true]}});
 class FakeCore extends EventEmitter{
  constructor(){super();this.ready=true;}
  send(name,data,uuid,id){calls.push({name,data,uuid,id});if(reply)setImmediate(()=>this.emit('response',{context:{frontEndSubOrigin:id,keycloakId:uuid},packets:[{name:'RequirementEffectPacket',packet:{currentEffectId:'notStarted',remainingTime:0}}]}));}
 }
 const core=new FakeCore();
 const rt=createBetaRuntime({dataDir:dir,ownerJids:[OWNER],core,send:async(jid,text)=>sent.push({jid,text}),
  enabledPackets:new Set([...BASE,...extra]),
  presenter:{apply:()=>'*SAIDA CORE*',formatMenu:()=>'*MENU*',allowEquipActions:false},
  Player:make(users,w=>w.keycloakId,()=>({id:++seq})),InventoryInfo:make(inventory,w=>w.playerId),InventorySlot:make(slots,w=>`${w.playerId}:${w.itemCategory}:${w.slot}`),ItemCategory:{WEAPON:0,ARMOR:1,POTION:2,OBJECT:3}});
 const send=(id,sender,text,chat=sender)=>rt.handle({id,chatJid:chat,senderJid:sender,text});
 return {dir,rt,core,send,sent,calls,users,close(){rt.close();fs.rmSync(dir,{recursive:true,force:true})}};
}
async function until(condition){for(let i=0;i<35;i++){if(condition())return;await sleep(10)}throw Error('TIMEOUT_TESTE')}
test('comandos adicionais reutilizam Gateway e pacote nativo sem recriar regras',async()=>{
 const x=fixture(['CommandPetPacketReq']);try{
  await x.send('cad-1',P1,'/cadastro');await x.send('pet-1',P1,'/pet');
  await until(()=>x.calls.length>0);
  assert.equal(x.calls.length,1);assert.equal(x.calls[0].name,'CommandPetPacketReq');
  assert.equal(x.calls[0].uuid,x.rt.beta.player(P1).uuid);
  await until(()=>x.sent.some(m=>m.text==='*SAIDA CORE*'));
  assert(x.sent.filter(m=>m.text==='*SAIDA CORE*').every(m=>m.jid===P1));
 }finally{x.close()}
});
test('rota que existe na ponte mas nao foi registrada nao dispara Core',async()=>{
 const x=fixture([]);try{
  await x.send('cad-2',P1,'/cadastro');await x.send('deny-1',P1,'/pet');
  await until(()=>x.sent.some(m=>m.text.includes('ainda não foi habilitado')));
  assert.equal(x.calls.length,0);
  assert.equal(x.rt.gateway.store.getMenu(P1),null);
 }finally{x.close()}
});
test('ajuda real nao anuncia comandos bloqueados no Core',async()=>{
 const x=fixture(['CommandMapPacketReq','CommandPetPacketReq']);try{
  await x.send('on',OWNER,'/ativar',GROUP);
  const result=await x.send('help-group',P1,'/ajuda',GROUP);
  assert.equal(result.to,GROUP);assert(result.text.includes('/mapa'));assert(result.text.includes('/pet'));
  assert(!result.text.includes('/ranking'));assert(!result.text.includes('/equipamentos'));assert(!result.text.includes('/combate'));
  const pv=await x.send('help-pv',P1,'/comandos');assert.equal(pv.to,P1);
  assert.equal(x.users.size,0);
 }finally{x.close()}
});
test('negacao de combate nao consome dinheiro, nao cria pedido MQTT, nem altera menu',async()=>{
 const x=fixture([]);try{
  await x.send('cad-3',P1,'/cadastro');await x.send('fight-1',P1,'/combate');
  await until(()=>x.sent.some(m=>m.text.includes('ainda não foi habilitado')));
  assert.equal(x.calls.length,0);assert.equal(x.rt.store.getMenu(P1),null);
 }finally{x.close()}
});
test('duas contas em dois grupos mantem Core e saida privada separados',async()=>{
 const x=fixture(['CommandPetPacketReq']);const G2='120363222222222222@g.us';try{
  await x.send('g1',OWNER,'/ativar',GROUP);await x.send('g2',OWNER,'/ativar',G2);
  await x.send('a',P1,'/cadastro',GROUP);await x.send('b',P2,'/cadastro',G2);
  await x.send('pa',P1,'/pet',GROUP);await x.send('pb',P2,'/pet',G2);
  await until(()=>x.calls.length===2);
  await until(()=>x.sent.filter(m=>m.text==='*SAIDA CORE*').length===2);
  assert.notEqual(x.calls[0].uuid,x.calls[1].uuid);
  assert.deepEqual(new Set(x.sent.filter(m=>m.text==='*SAIDA CORE*').map(m=>m.jid)),new Set([P1,P2]));
 }finally{x.close()}
});
test('mesmo wamid de grupo nao reexecuta uma rota da ponte',async()=>{
 const x=fixture(['CommandPetPacketReq']);try{
  await x.send('cad-r',P1,'/cadastro');await x.send('pet-r',P1,'/pet');
  await x.send('pet-r',P1,'/pet');await until(()=>x.calls.length===1);
  assert.equal(x.calls.length,1);
 }finally{x.close()}
});

for(const [command,packet] of Object.entries({
 '/combate':'CommandFightPacketReq','/vender':'CommandSellPacketReq',
 '/alimentar':'CommandPetFeedPacketReq','/pocao':'CommandDrinkPacketReq',
 '/diario':'CommandDailyBonusPacketReq','/mudarclasse':'CommandClassesPacketReq',
 '/embarcar':'CommandJoinBoatPacketReq'
}))test('menu nativo V28 '+command+' usa o único gateway persistente',async()=>{
 const x=fixture([packet]);try{
  await x.send('c-'+packet,P1,'/cadastro');
  await x.send('req-'+packet,P1,command);
  await until(()=>x.calls.length===1);
  assert.equal(x.calls[0].name,packet);
  assert.equal(x.calls[0].uuid,x.rt.beta.player(P1).uuid);
  await until(()=>x.sent.some(y=>y.text==='*SAIDA CORE*'));
  assert(x.sent.filter(y=>y.text==='*SAIDA CORE*').every(y=>y.jid===P1));
  assert.equal(x.calls.length,1); // mere opening doesn't issue a collector reaction
 }finally{x.close()}
});
test('sete novos menus permanecem bloqueados no Gateway se Core não os registrou',async()=>{
 const x=fixture([]);try{
  await x.send('cad-menu-block',P1,'/cadastro');
  for(const [i,command] of ['/combate','/vender','/alimentar','/pocao','/diario','/mudarclasse','/embarcar'].entries()){
   await x.send('block-'+i,P1,command);
  }
  await until(()=>x.sent.filter(y=>y.text.includes('ainda não foi habilitado')).length>=7);
  assert.equal(x.calls.length,0);
 }finally{x.close()}
});
test('ajuda no grupo lista menus registrados mas nunca muda personagem ou economia',async()=>{
 const x=fixture(['CommandFightPacketReq','CommandSellPacketReq']);try{
  await x.send('act-g',OWNER,'/ativar',GROUP);
  const r=await x.send('helpg',P2,'/ajuda',GROUP);
  assert.equal(r.to,GROUP);assert(r.text.includes('/combate'));assert(r.text.includes('/vender'));
  assert(!r.text.includes('/diario'));assert(r.text.includes('/cadastro'));
  assert.equal(x.calls.length,0);assert.equal(x.users.size,0);
 }finally{x.close()}
});
