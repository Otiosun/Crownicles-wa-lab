/**
 * CANDIDATE integration tests, not yet executed against live MariaDB.
 * Copy only into a disposable pinned upstream checkout using stage-core-v31.
 * Use original collector controller and compiled Core modules; deterministic
 * replacement generator in the mission tests, real Sequelize SQL/CLS/locks.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ModelStatic } from "sequelize";
import { CoreTestEnvironment, loadProductionModule, pinInertDailyMission, setupCoreForTests } from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { Guild as GuildType } from "../../src/core/database/game/models/Guild";
import type { MissionSlot as MissionSlotType } from "../../src/core/database/game/models/MissionSlot";
import type { PlayerMissionsInfo as InfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";
import type { CrowniclesPacket, PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import type { ReactionCollectorCreationPacket, ReactionCollectorReactPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";

type RemoveModule = typeof import("../../src/commands/guild/GuildElderRemoveCommand");
type ShopModule = typeof import("../../src/core/utils/MissionManagerShopItems");
type MissionsModule = typeof import("../../src/core/missions/MissionsController");
type CollectorModule = typeof import("../../src/core/utils/ReactionsCollector");

describe("V31 candidate: original collector identities and quoted mission transaction", () => {
 let env: CoreTestEnvironment;
 let Player: ModelStatic<PlayerType>;
 let Guild: ModelStatic<GuildType>;
 let Slot: ModelStatic<MissionSlotType>;
 let Info: ModelStatic<InfoType>;
 let remove: RemoveModule;
 let shop: ShopModule;
 let missions: MissionsModule;
 let collectors: CollectorModule;
 let sequence=0;
 const opened: Array<{ packet:ReactionCollectorCreationPacket; keycloakId:string }> = [];
 const has=(response:CrowniclesPacket[],name:string)=>response.some(p=>p.constructor.name===name);
 const context=(player:PlayerType)=>({ keycloakId:player.keycloakId } as PacketContext);

 beforeAll(async()=>{
  // Explicit opt-in; no default test database or production credentials.
  if(process.env.CROWNICLES_V31_DB_LAB!=="ISOLATED"||process.env.TEST_DB_HOST!=="127.0.0.1"||!process.env.TEST_DB_PORT||!process.env.TEST_DB_ROOT_PASSWORD||!process.env.TEST_DB_PASSWORD)throw Error("Disposable local MariaDB fixture required");
  env=await setupCoreForTests("v31_safety");
  const models=env.crownicles.gameDatabase.sequelize.models;
  Player=models.Player as ModelStatic<PlayerType>;
  Guild=models.Guild as ModelStatic<GuildType>;
  Slot=models.MissionSlot as ModelStatic<MissionSlotType>;
  Info=models.PlayerMissionsInfo as ModelStatic<InfoType>;
  remove=loadProductionModule<RemoveModule>("commands/guild/GuildElderRemoveCommand");
  shop=loadProductionModule<ShopModule>("core/utils/MissionManagerShopItems");
  missions=loadProductionModule<MissionsModule>("core/missions/MissionsController");
  collectors=loadProductionModule<CollectorModule>("core/utils/ReactionsCollector");
  await pinInertDailyMission(env);
 });
 afterEach(async()=>{
  vi.restoreAllMocks();
  // Close collectors even if an assertion failed; no delayed callback after teardown.
  for(const {packet,keycloakId} of opened.splice(0)){
   const reactionIndex=packet.reactions.findIndex(r=>["ReactionCollectorRefuseReaction","ReactionCollectorSkipMissionShopItemCloseReaction"].includes(r.type));
   if(reactionIndex>=0)await collectors.ReactionCollectorController.reactPacket([],{
    id:packet.id,keycloakId,reactionIndex
   } as ReactionCollectorReactPacket);
  }
 });
 afterAll(async()=>{await env?.teardown()});

 function collect(response:CrowniclesPacket[],player:PlayerType):ReactionCollectorCreationPacket{
  const p=response.find(r=>r.constructor.name==="ReactionCollectorCreationPacket") as ReactionCollectorCreationPacket;
  expect(p).toBeDefined();
  opened.push({packet:p,keycloakId:player.keycloakId});
  return p;
 }
 async function react(p:ReactionCollectorCreationPacket,player:PlayerType,type:string){
  const reactionIndex=p.reactions.findIndex(r=>r.type===type);
  expect(reactionIndex).toBeGreaterThanOrEqual(0);
  const out:CrowniclesPacket[]=[];
  await collectors.ReactionCollectorController.reactPacket(out,{id:p.id,keycloakId:player.keycloakId,reactionIndex} as ReactionCollectorReactPacket);
  return out;
 }
 async function seedGuild(){
  const n=++sequence;
  const chief=await Player.create({keycloakId:"v31-chief-"+n,level:100});
  const old=await Player.create({keycloakId:"v31-elder-"+n,level:100});
  const next=await Player.create({keycloakId:"v31-next-"+n,level:100});
  const guild=await Guild.create({name:"V31Lab"+n,chiefId:chief.id,elderId:old.id});
  await Player.update({guildId:guild.id},{where:{id:[chief.id,old.id,next.id]}});
  await chief.reload();
  return {chief,old,next,guild};
 }
 async function openRemove(chief:PlayerType){
  const out:CrowniclesPacket[]=[];
  await new remove.default().execute(out,chief,{},context(chief));
  return collect(out,chief);
 }
 it("removes the exact originally displayed elder",async()=>{
  const {chief,old,guild}=await seedGuild();
  const p=await openRemove(chief);
  const out=await react(p,chief,"ReactionCollectorAcceptReaction");
  expect(has(out,"CommandGuildElderRemoveAcceptPacketRes")).toBe(true);
  expect(out.find(r=>r.constructor.name==="CommandGuildElderRemoveAcceptPacketRes")).toMatchObject({demotedKeycloakId:old.keycloakId});
  expect((await Guild.findByPk(guild.id))!.elderId).toBeNull();
 });
 it("refuses stale elder selection after a concurrent assignment",async()=>{
  const {chief,next,guild}=await seedGuild();const p=await openRemove(chief);
  await Guild.update({elderId:next.id},{where:{id:guild.id}});
  const out=await react(p,chief,"ReactionCollectorAcceptReaction");
  expect(has(out,"CommandGuildElderRemoveAcceptPacketRes")).toBe(false);
  expect((await Guild.findByPk(guild.id))!.elderId).toBe(next.id);
 });
 it("refuses action after authority changes",async()=>{
  const {chief,old,next,guild}=await seedGuild();const p=await openRemove(chief);
  await Guild.update({chiefId:next.id},{where:{id:guild.id}});
  const out=await react(p,chief,"ReactionCollectorAcceptReaction");
  expect(has(out,"CommandGuildElderRemoveAcceptPacketRes")).toBe(false);
  expect((await Guild.findByPk(guild.id))!.elderId).toBe(old.id);
 });
 async function seedMission(price=2){
  const player=await Player.create({keycloakId:"v31-mission-"+(++sequence),level:10});
  await Info.create({playerId:player.id,gems:10,missionSkipsUsedThisWeek:price});
  const old=await Slot.create({
   playerId:player.id,missionId:"commandReport",missionVariant:0,missionObjective:100,numberDone:2,
   expiresAt:new Date(Date.now()+3600000),gemsToWin:0,pointsToWin:0,xpToWin:0,moneyToWin:0
  });
  return {player,old};
 }
 function inertReplacement(fault=false){
  return vi.spyOn(missions.MissionsController,"addRandomMissionToPlayer").mockImplementation(async(player)=>{
   const row=await Slot.create({
    playerId:player.id,missionId:"travelHours",missionVariant:0,missionObjective:100000,numberDone:0,
    expiresAt:new Date(Date.now()+3600000),gemsToWin:0,pointsToWin:0,xpToWin:0,moneyToWin:0
   });
   if(fault)throw Error("V31_TEST_GENERATOR_FAULT");
   return row;
  });
 }
 async function openSkip(player:PlayerType,price:number){
  const out:CrowniclesPacket[]=[];
  const item=shop.getMissionSkipShopItem(price);
  expect(item.price).toBe(price);
  expect(await item.buyCallback(out,player.id,context(player),1)).toBe(false);
  return collect(out,player);
 }
 async function snapshot(player:PlayerType){
  const info=(await Info.findByPk(player.id))!;
  const slots=await Slot.findAll({where:{playerId:player.id},order:[["id","ASC"]]});
  return {gems:info.gems,skips:info.missionSkipsUsedThisWeek,slots:slots.map(s=>[s.id,s.missionId,s.numberDone])};
 }
 const skipType="ReactionCollectorSkipMissionShopItemReaction";
 it("replaces and debits the original quote under the actual ORM transaction",async()=>{
  const {player,old}=await seedMission();inertReplacement();
  const p=await openSkip(player,2);
  const out=await react(p,player,skipType);
  expect(has(out,"CommandMissionShopSkipMissionResult")).toBe(true);
  expect(await Slot.findByPk(old.id)).toBeNull();
  const after=await snapshot(player);
  expect(after.gems).toBe(8);expect(after.skips).toBe(3);
  expect(after.slots.some(s=>s[1]==="travelHours")).toBe(true);
 });
 it("rejects stale quote and changed balance before mutation",async()=>{
  const {player}=await seedMission();const generator=inertReplacement();
  const p=await openSkip(player,2);await Info.update({missionSkipsUsedThisWeek:3},{where:{playerId:player.id}});
  const first=await snapshot(player);const r=await react(p,player,skipType);
  expect(has(r,"CommandMissionShopSkipMissionResult")).toBe(false);expect(await snapshot(player)).toEqual(first);
  const p2=await openSkip(player,3);await Info.update({gems:1},{where:{playerId:player.id}});
  const second=await snapshot(player);await react(p2,player,skipType);
  expect(await snapshot(player)).toEqual(second);expect(generator).not.toHaveBeenCalled();
 });
 it("rejects changed mission snapshot without removing it",async()=>{
  const {player,old}=await seedMission();const generator=inertReplacement();
  const p=await openSkip(player,2);await Slot.update({numberDone:3},{where:{id:old.id}});
  const before=await snapshot(player);const out=await react(p,player,skipType);
  expect(await snapshot(player)).toEqual(before);expect(has(out,"CommandMissionShopSkipMissionResult")).toBe(false);
  expect(generator).not.toHaveBeenCalled();
 });
 it("rolls back real SQL delete and insert if generation throws",async()=>{
  const {player}=await seedMission();inertReplacement(true);const p=await openSkip(player,2);const before=await snapshot(player);
  await expect(react(p,player,skipType)).rejects.toThrow("V31_TEST_GENERATOR_FAULT");
  expect(await snapshot(player)).toEqual(before);
 });
 it("serializes simultaneous quotes without double charge",async()=>{
  const {player}=await seedMission();inertReplacement();
  const p1=await openSkip(player,2),p2=await openSkip(player,2);
  const replies=await Promise.all([react(p1,player,skipType),react(p2,player,skipType)]);
  expect(replies.filter(r=>has(r,"CommandMissionShopSkipMissionResult"))).toHaveLength(1);
  const after=await snapshot(player);expect(after.gems).toBe(8);expect(after.skips).toBe(3);
 });
});
