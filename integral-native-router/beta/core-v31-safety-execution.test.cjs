'use strict';
// Execute the surgically transformed, pinned TypeScript in Node + real SQLite.
// Deliberately fake ORM, game RNG and package/notification dependencies. This
// does NOT establish Sequelize/MariaDB integration or full TypeScript type checking.
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite'),{BLOBS,buildCandidate}=require('./patches/core-v31-safety-candidate.cjs');
const UP=process.env.CROWNICLES_UPSTREAM_SRC,TS=process.env.CROWNICLES_TYPESCRIPT_MODULE;
const enabled=Boolean(UP&&TS);
const opts={skip:!enabled};
let compiled;
function sources(){
 if(compiled)return compiled;
 const ts=require(TS),original=Object.fromEntries(Object.keys(BLOBS).map(p=>[p,fs.readFileSync(path.join(UP,p),'utf8')]));
 const candidate=buildCandidate(original);compiled={};
 for(const [p,s] of Object.entries(candidate)){
  const out=ts.transpileModule(s,{fileName:p,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,esModuleInterop:true}});
  const errs=(out.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  a.deepEqual(errs.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')),[],p);
  compiled[path.basename(p,'.ts')]=out.outputText;
 }
 return compiled;
}
function lab(){
 const db=new DatabaseSync(':memory:'),notices=[],unblocks=[],blocks=new Map(),fault={};
 db.exec("CREATE TABLE players(id INTEGER PRIMARY KEY,keycloakId TEXT,guildId INTEGER,level INTEGER); CREATE TABLE guilds(id INTEGER PRIMARY KEY,name TEXT,chiefId INTEGER,elderId INTEGER); CREATE TABLE info(playerId INTEGER PRIMARY KEY,gems INTEGER,missionSkipsUsedThisWeek INTEGER); CREATE TABLE slots(id INTEGER PRIMARY KEY,playerId INTEGER,missionId TEXT,missionVariant INTEGER,missionObjective INTEGER,numberDone INTEGER,expiresAt INTEGER); INSERT INTO guilds VALUES(10,'Aurora',1,2),(20,'Outra',1,3); INSERT INTO players VALUES(1,'chief',10,12),(2,'elder',10,12),(3,'target',10,12); INSERT INTO info VALUES(1,10,2); INSERT INTO slots VALUES(11,1,'commandReport',0,5,2,4102444800000),(12,1,'campaign',0,1,0,NULL)");
 const sql=(s,...params)=>db.prepare(s).run(...params),one=(s,...params)=>db.prepare(s).get(...params),all=(s,...params)=>db.prepare(s).all(...params);
 const player=i=>{const r=one('SELECT * FROM players WHERE id=?',i);return r?{...r,save:async function(){sql('UPDATE players SET guildId=? WHERE id=?',this.guildId,this.id)}}:null};
 const guild=i=>{if(i===null)return null;const r=one('SELECT * FROM guilds WHERE id=?',i);return r?{...r,save:async function(){sql('UPDATE guilds SET elderId=?,chiefId=? WHERE id=?',this.elderId,this.chiefId,this.id)}}:null};
 const slot=i=>{const r=one('SELECT * FROM slots WHERE id=?',i);return r?{...r,isCampaign(){return this.expiresAt===null},hasExpired(){return this.expiresAt!==null&&this.expiresAt<Date.now()},isCompleted(){return this.numberDone>=this.missionObjective},destroy:async function(){sql('DELETE FROM slots WHERE id=?',this.id)}}:null};
 const info=i=>{const r=one('SELECT * FROM info WHERE playerId=?',i);return r?{...r,save:async function(){sql('UPDATE info SET missionSkipsUsedThisWeek=? WHERE playerId=?',this.missionSkipsUsedThisWeek,this.playerId)},spendGems:async function(amount,response){sql('UPDATE info SET gems=gems-? WHERE playerId=?',amount,this.playerId);response.push({name:'GemDebit',amount});if(fault.debit)throw Error('LAB_DEBIT_FAILURE')}}:null};
 const state=()=>({info:one('SELECT * FROM info WHERE playerId=1'),slots:all('SELECT * FROM slots ORDER BY id'),guilds:all('SELECT * FROM guilds ORDER BY id'),players:all('SELECT * FROM players ORDER BY id')});
 let tx=false,queue=Promise.resolve();
 function transaction(fn){
  const job=queue.then(async()=>{db.exec('BEGIN IMMEDIATE');tx=true;try{const out=await fn();if(fault.commit)throw Error('LAB_COMMIT_FAILURE');db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}finally{tx=false;}});
  queue=job.catch(()=>{});return job;
 }
 class LockedRowNotFoundError extends Error{}
 const modelKey=(model,id)=>({model,id});
 const Player={lockKey:i=>modelKey(player,i)},Guild={lockKey:i=>modelKey(guild,i)};
 const Players={getById:async i=>player(i),getAskedPlayer:async x=>{const r=one('SELECT id FROM players WHERE keycloakId=?',x?.keycloakId||'');return r?player(r.id):null}};
 const Guilds={getById:async i=>guild(i)};
 const BlockingUtils={blockPlayer:(key,reason)=>{blocks.set(key,reason)},unblockPlayer:(key,reason)=>{unblocks.push([key,reason]);if(blocks.get(key)===reason)blocks.delete(key)},getPlayerBlockingReason:key=>blocks.has(key)?[blocks.get(key)]:[],isPlayerBlocked:key=>blocks.has(key)};
 const reasons={GUILD_ELDER:'elder',GUILD_ELDER_REMOVE:'remove',GUILD_KICK:'kick',SKIP_MISSION:'skip'};
 const constants={REASONS:reasons};
 const missions={prepareMissionSlot:m=>({missionId:m.missionId,missionObjective:m.missionObjective,missionVariant:m.missionVariant,numberDone:m.numberDone,missionType:m.isCampaign()?'campaign':'sideMission',expiresAt:m.expiresAt===null?undefined:new Date(m.expiresAt).toString()}),prepareMissionSlots:ms=>ms.map(m=>missions.prepareMissionSlot(m)),getRandomDifficulty:()=>1,addRandomMissionToPlayer:async(p,d,exception)=>{a.equal(tx,true);a.equal(exception,'commandReport');const r=sql("INSERT INTO slots(playerId,missionId,missionVariant,missionObjective,numberDone,expiresAt) VALUES(?,'newMission',0,4,0,4102444800000)",p.id);if(fault.generation)throw Error('LAB_GENERATOR_FAILURE');return slot(Number(r.lastInsertRowid));},update:async(p,response,what)=>{a.equal(tx,true);response.push({name:'MissionUpdate',missionId:what.missionId});if(fault.update)throw Error('LAB_MISSION_UPDATE_FAILURE')}};
 const names=new Map();
 function named(k){if(!names.has(k)){const f=class{constructor(...args){this.args=args}};Object.defineProperty(f,'name',{value:k});names.set(k,f)}return names.get(k)}
 const packetProxy=new Proxy({},{get:(_,k)=>named(k)});
 const makePacket=(cls,data)=>({name:cls.name,...data});
 class ReactionCollectorInstance{
  constructor(model,context,options,cb){this.model=model;this.context=context;this.options=options;this.cb=cb;}
  block(key,reason){BlockingUtils.blockPlayer(key,reason);return this}
  build(){return this}
  async finish(type,data={}){const response=[];this.response=response;await this.cb({getFirstReaction:()=>type?{reaction:{type,data}}:undefined},response);return response}
 }
 const mods={
  Player:{__esModule:true,default:Player,Player,Players},Guild:{Guild,Guilds},
  CrowniclesPacket:{makePacket},app:{crowniclesInstance:undefined},
  CommandUtils:{commandRequires:()=>()=>{},CommandUtils:{DISALLOWED_EFFECTS:{NOT_STARTED_OR_DEAD:[]},WHERE:{EVERYWHERE:[]}}},
  GuildConstants:{GuildConstants:{REQUIRED_LEVEL:1}},GuildRole:{GuildRole:{CHIEF:'chief'}},
  ReactionsCollector:{ReactionCollectorInstance},BlockingUtils:{BlockingUtils},BlockingConstants:{BlockingConstants:constants},
  PacketUtils:{PacketUtils:{sendNotifications:n=>notices.push(...n)}},
  withLockedEntities:{LockedRowNotFoundError,withLockedEntities:async(keys,fn)=>transaction(()=>{const rows=keys.map(k=>k.model(k.id));if(rows.some(x=>!x))throw new LockedRowNotFoundError();return fn(rows)})},
  Constants:{Constants:{MISSION_SHOP:{PRICES:{BADGE:1}}}},LogsConstants:{NumberChangeReason:{MISSION_SHOP:1},ShopItemType:{SKIP_MISSION:13,QUEST_MASTER_BADGE:18}},
  MissionsController:{MissionsController:missions},PlayerMissionsInfo:{__esModule:true,default:{findByPk:async(i)=>info(i)}},
  MissionSlot:{MissionSlot:{findByPk:async(i)=>slot(i)},MissionSlots:{getOfPlayer:async i=>all('SELECT id FROM slots WHERE playerId=? ORDER BY id',i).map(x=>slot(x.id))}},
  Badge:{Badge:{MISSION_COMPLETER:'quest'}},PlayerBadges:{PlayerBadgesManager:{hasBadge:async()=>false,addBadge:async()=>{}}},
  ShopConstants:{ShopCurrency:{GEM:'gem'}},CLSNamespace:{getCurrentTransaction:()=>tx?{LOCK:{UPDATE:'UPDATE'}}:undefined},
  withLockedPlayerAndMissions:{withLockedPlayerAndMissions:async(i,fn)=>transaction(()=>fn(player(i)))}
 };
 function load(name){const src=sources()[name],m={exports:{}};a.ok(src,name);new Function('require','module','exports',src)(p=>{const k=path.basename(p);if(Object.hasOwn(mods,k))return mods[k];if(/^(Command.*Packet|ReactionCollector.*|.*NotificationPacket)$/.test(k))return packetProxy;throw Error('UNMOCKED_IMPORT:'+p)},m,m.exports);return m.exports}
 const accept='ReactionCollectorAcceptReaction',skip='ReactionCollectorSkipMissionShopItemReaction';
 async function guildOpen(name,req={}){const res=[];await new (load(name).default)().execute(res,player(1),req,{});return res.find(v=>v instanceof ReactionCollectorInstance)}
 async function missionOpen(price=2){const res=[],item=load('MissionManagerShopItems').getMissionSkipShopItem(price);a.equal(item.price,price);a.equal(await item.buyCallback(res,1,{}),false);return res.find(v=>v instanceof ReactionCollectorInstance)}
 return {db,sql,state,notices,blocks,unblocks,fault,guildOpen,missionOpen,accept,skip,close:()=>db.close()};
}
function scenario(name,fn){test(name,opts,async()=>{const h=lab();try{await fn(h)}finally{h.close()}})}
test('all four pinned transformed Core files transpile with real TypeScript',opts,()=>a.equal(Object.keys(sources()).length,4));
scenario('demotion of original elder succeeds, not another player',async h=>{const c=await h.guildOpen('GuildElderRemoveCommand');a.ok(c);const r=await c.finish(h.accept);a.equal(h.state().guilds[0].elderId,null);a.ok(r.some(p=>p.name==='CommandGuildElderRemoveAcceptPacketRes'&&p.demotedKeycloakId==='elder'))});
scenario('an elder replaced while prompt open is never demoted',async h=>{const c=await h.guildOpen('GuildElderRemoveCommand');h.sql('UPDATE guilds SET elderId=3 WHERE id=10');const r=await c.finish(h.accept);a.equal(h.state().guilds[0].elderId,3);a.ok(!r.some(p=>p.name==='CommandGuildElderRemoveAcceptPacketRes'));a.equal(h.blocks.size,0)});
scenario('new guild after demotion prompt stays unchanged',async h=>{const c=await h.guildOpen('GuildElderRemoveCommand');h.sql('UPDATE players SET guildId=20 WHERE id=1');await c.finish(h.accept);a.equal(h.state().guilds[1].elderId,3);a.equal(h.state().guilds[0].elderId,2)});
scenario('original leader authority rechecked at demotion commit',async h=>{const c=await h.guildOpen('GuildElderRemoveCommand');h.sql('UPDATE guilds SET chiefId=3 WHERE id=10');await c.finish(h.accept);a.equal(h.state().guilds[0].elderId,2)});
scenario('promotion to chosen member preserves original behavior',async h=>{const c=await h.guildOpen('GuildElderCommand',{askedPlayerKeycloakId:'target'});a.ok(c);const r=await c.finish(h.accept);a.equal(h.state().guilds[0].elderId,3);a.ok(r.some(p=>p.name==='CommandGuildElderAcceptPacketRes'&&p.promotedKeycloakId==='target'))});
scenario('promotion cannot migrate to different guild while prompt open',async h=>{const c=await h.guildOpen('GuildElderCommand',{askedPlayerKeycloakId:'target'});h.sql('UPDATE players SET guildId=20 WHERE id IN (1,3)');h.sql('UPDATE guilds SET elderId=2 WHERE id=20');const r=await c.finish(h.accept);a.equal(h.state().guilds[1].elderId,2);a.ok(!r.some(p=>p.name==='CommandGuildElderAcceptPacketRes'))});
scenario('kick of original member succeeds, clears elder role where applicable',async h=>{const c=await h.guildOpen('GuildKickCommand',{askedPlayer:{keycloakId:'elder'}});a.ok(c);const r=await c.finish(h.accept);a.equal(h.state().players[1].guildId,null);a.equal(h.state().guilds[0].elderId,null);a.ok(r.some(p=>p.name==='CommandGuildKickAcceptPacketRes'&&p.kickedKeycloakId==='elder'));a.equal(h.blocks.size,0)});
scenario('kick from a newly joined guild cannot consume old authorization',async h=>{const c=await h.guildOpen('GuildKickCommand',{askedPlayer:{keycloakId:'target'}});h.sql('UPDATE players SET guildId=20 WHERE id IN (1,3)');const r=await c.finish(h.accept);a.equal(h.state().players[2].guildId,20);a.ok(!r.some(p=>p.name==='CommandGuildKickAcceptPacketRes'));a.equal(h.blocks.size,0)});
scenario('mission replacement uses quoted price, replacement and counter in same transaction',async h=>{const c=await h.missionOpen();a.ok(c);const r=await c.finish(h.skip,{missionIndex:0});const s=h.state();a.equal(s.info.gems,8);a.equal(s.info.missionSkipsUsedThisWeek,3);a.deepEqual(s.slots.map(m=>m.missionId),['campaign','newMission']);a.ok(r.some(p=>p.name==='CommandMissionShopSkipMissionResult'));a.ok(!h.blocks.size)});
scenario('first weekly replacement remains free',async h=>{h.sql('UPDATE info SET missionSkipsUsedThisWeek=0 WHERE playerId=1');const c=await h.missionOpen(0);const r=await c.finish(h.skip,{missionIndex:0});a.equal(h.state().info.gems,10);a.equal(h.state().info.missionSkipsUsedThisWeek,1);a.ok(!r.some(p=>p.name==='GemDebit'));});
scenario('stale quote, changed balance, changed mission or missing slot cannot mutate',async h=>{for(const [step,restore] of [
 [()=>h.sql('UPDATE info SET missionSkipsUsedThisWeek=3'),()=>h.sql('UPDATE info SET missionSkipsUsedThisWeek=2')],
 [()=>h.sql('UPDATE info SET gems=1'),()=>h.sql('UPDATE info SET gems=10')],
 [()=>h.sql('UPDATE slots SET numberDone=3 WHERE id=11'),()=>h.sql('UPDATE slots SET numberDone=2 WHERE id=11')],
 [()=>h.sql('UPDATE slots SET playerId=2 WHERE id=11'),()=>h.sql('UPDATE slots SET playerId=1 WHERE id=11')],
 [()=>h.sql('UPDATE slots SET expiresAt=1 WHERE id=11'),()=>h.sql('UPDATE slots SET expiresAt=4102444800000 WHERE id=11')],
 [()=>h.sql('DELETE FROM slots WHERE id=11'),()=>h.sql("INSERT INTO slots VALUES(11,1,'commandReport',0,5,2,4102444800000)")]
 ]){const c=await h.missionOpen();step();const before=h.state();const r=await c.finish(h.skip,{missionIndex:0});a.deepEqual(h.state(),before);a.ok(!r.some(p=>p.name==='CommandMissionShopSkipMissionResult'));a.equal(h.blocks.size,0);restore()}});
scenario('cancel, expiry, unknown type and invalid index never replace mission',async h=>{for(const [typ,idx] of [['ReactionCollectorSkipMissionShopItemCloseReaction',0],[null,0],['fake',0],[h.skip,99],[h.skip,-1],[h.skip,0.1]]){const c=await h.missionOpen(),before=h.state();await c.finish(typ,{missionIndex:idx});a.deepEqual(h.state(),before);a.equal(h.blocks.size,0)}});
scenario('generation, debit, mission update and commit faults rollback every mutation and publish no result',async h=>{for(const k of ['generation','debit','update','commit']){const c=await h.missionOpen(),before=h.state();h.fault[k]=true;await a.rejects(c.finish(h.skip,{missionIndex:0}),/LAB_.*_FAILURE/);delete h.fault[k];a.deepEqual(h.state(),before);a.deepEqual(c.response,[]);a.equal(h.blocks.size,0)}});
scenario('two identical outstanding quotes serialize; second cannot double-charge or overwrite new objective',async h=>{const c1=await h.missionOpen(),c2=await h.missionOpen();const replies=await Promise.all([c1.finish(h.skip,{missionIndex:0}),c2.finish(h.skip,{missionIndex:0})]);a.equal(replies.flat().filter(p=>p.name==='CommandMissionShopSkipMissionResult').length,1);a.equal(h.state().info.gems,8);a.equal(h.state().info.missionSkipsUsedThisWeek,3);a.equal(h.state().slots.length,2);});
