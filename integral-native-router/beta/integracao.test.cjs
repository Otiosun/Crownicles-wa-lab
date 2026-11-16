'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const EventEmitter=require('node:events');
const {createBetaRuntime}=require('./integracao.cjs');
const waA='5511999000001@s.whatsapp.net',waB='5511999000002@s.whatsapp.net',owner='5511999000099@s.whatsapp.net',group='120363111111111111@g.us';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function dbModel(db,identity,transform=()=>({})) {return {findOrCreate:async({where,defaults})=>{const key=identity(where);if(!db.has(key))db.set(key,{...defaults,...transform(defaults)});return [db.get(key),true]}};}
function setup(dir){const sent=[],calls=[],users=new Map(),inv=new Map(),slots=new Map();let row=0;
 class Core extends EventEmitter{constructor(){super();this.ready=true;}send(name,data,uuid,id){calls.push({name,uuid,id,data});setImmediate(()=>this.emit('response',{context:{frontEndSubOrigin:id,keycloakId:uuid},packets:[{name:'RequirementEffectPacket',packet:{currentEffectId:'notStarted',remainingTime:0}}]}))}}
 const core=new Core();const send=async(jid,text)=>sent.push({jid,text});const rt=createBetaRuntime({dataDir:dir,ownerJids:[owner],core,send, presenter:{allowEquipActions:false,apply:()=>'*CROWNICLES ORIGINAL*\nUse /jogar',formatMenu:()=>'*MENU*'},Player:dbModel(users,w=>w.keycloakId,()=>({id:++row})),InventoryInfo:dbModel(inv,w=>w.playerId),InventorySlot:dbModel(slots,w=>`${w.playerId}:${w.itemCategory}:${w.slot}`),ItemCategory:{WEAPON:0,ARMOR:1,POTION:2,OBJECT:3}});
 return {rt,calls,sent,users,inv,slots};}
const m=(id,jid,text,chat=jid)=>({id,chatJid:chat,senderJid:jid,text});
test('cadastro -> /jogar -> Gateway original -> Core simulado -> resposta privada',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cw-beta-int-'));const {rt,calls,sent,users,inv,slots}=setup(dir);
 try{await rt.handle(m('1',waA,'/cadastro'));await rt.handle(m('2',waA,'/jogar'));for(let i=0;i<40&&sent.length<2;i++)await sleep(10);
 assert.equal(users.size,1);assert.equal(inv.size,1);assert.equal(slots.size,4);assert.equal(calls.length,1);assert.equal(calls[0].name,'CommandReportPacketReq');assert.equal(calls[0].uuid,rt.gateway.config.bindings[waA]);assert.equal(sent.at(-1).jid,waA);
 }finally{rt.close();fs.rmSync(dir,{recursive:true,force:true})}
});
test('grupo autorizado, privacidade e não interferência de dois jogadores',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cw-beta-int-'));const {rt,calls,sent}=setup(dir);
 try{await rt.handle(m('1',owner,'/ativar',group));await rt.handle(m('2',waA,'/cadastro',group));await rt.handle(m('3',waB,'/cadastro',group));
 await rt.handle(m('4',waA,'/perfil',group));await rt.handle(m('5',waB,'/perfil',group));for(let i=0;i<40&&calls.length<2;i++)await sleep(10);
 assert.equal(calls.length,2);for(let i=0;i<80&&sent.filter(d=>d.text.includes('CROWNICLES ORIGINAL')).length<2;i++)await sleep(10);assert.notEqual(calls[0].uuid,calls[1].uuid);assert(sent.filter(d=>d.text.includes('CROWNICLES ORIGINAL')).every(d=>[waA,waB].includes(d.jid)));
 assert.equal(rt.gateway.receive('4',waA,'/perfil'),false);
 }finally{rt.close();fs.rmSync(dir,{recursive:true,force:true})}
});
test('reinício preserva cadastro e grupos habilitados sem recriar o personagem',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cw-beta-int-'));const x=setup(dir);
 try{await x.rt.handle(m('1',owner,'/ativar',group));await x.rt.handle(m('2',waA,'/cadastro'));const uuid=x.rt.beta.player(waA).uuid;x.rt.close();
 const y=setup(dir);try{assert.equal(y.rt.gateway.config.bindings[waA],uuid);assert.equal(y.rt.beta.groupEnabled(group),true);await y.rt.handle(m('3',waA,'/perfil'));for(let i=0;i<80&&y.sent.filter(d=>d.text.includes('CROWNICLES ORIGINAL')).length<1;i++)await sleep(10);assert.equal(y.calls[0].uuid,uuid)}finally{y.rt.close()}
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
