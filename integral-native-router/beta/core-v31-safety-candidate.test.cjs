'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {BLOBS,buildCandidate}=require('./patches/core-v31-safety-candidate.cjs');
test('candidate covers four pinned original source blobs',()=>{a.equal(Object.keys(BLOBS).length,4);for(const h of Object.values(BLOBS))a.match(h,/^[a-f0-9]{40}$/);});
test('candidate refuses missing source before transforming',()=>a.throws(()=>buildCandidate({}),/MISSING_PINNED_SOURCE_/));
test('candidate refuses altered upstream source',()=>a.throws(()=>buildCandidate({[Object.keys(BLOBS)[0]]:'not upstream'}),/UPSTREAM_BLOB_MISMATCH_/));
test('exact pinned staging sources retain authorization and guard mission mutations',{skip:!process.env.CROWNICLES_UPSTREAM_SRC},()=>{
 const sources=Object.fromEntries(Object.keys(BLOBS).map(p=>[p,fs.readFileSync(path.join(process.env.CROWNICLES_UPSTREAM_SRC,p),'utf8')]));
 const result=buildCandidate(sources);
 for(const [p,s] of Object.entries(sources)){a.notEqual(result[p],s);a.equal(fs.readFileSync(path.join(process.env.CROWNICLES_UPSTREAM_SRC,p),'utf8'),s);}
 const demote=result['Core/src/commands/guild/GuildElderRemoveCommand.ts'];
 a.match(demote,/guild.elderId !== expectedElderId/);
 a.match(demote,/endCallback\(player, demotedElder, guild.id\)/);
 for(const verb of ['Elder','Kick'])a.match(result['Core/src/commands/guild/Guild'+verb+'Command.ts'],/freshChief.guildId !== expectedGuildId/);
 const m=result['Core/src/core/utils/MissionManagerShopItems.ts'];
 for(const guard of ['price !== quotedPrice','info.gems < price','mission.playerId !== lockedPlayer.id','mission.isCompleted()','expectedMissions[missionIndex]'])a.ok(m.indexOf(guard)>=0&&m.indexOf(guard)<m.indexOf('await mission.destroy()'));
 a.match(m,/response.push\(\.\.\.committed\)/);a.match(m,/withLockedPlayerAndMissions\(player.id/);
 a.match(m,/getEndCallbackSkipMissionShopItem\(player, allMissions, missionSkipsUsedThisWeek\)/);
});
