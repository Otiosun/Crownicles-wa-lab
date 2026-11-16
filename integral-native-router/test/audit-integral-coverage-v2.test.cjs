'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {census}=require('../tools/audit-integral-coverage.cjs');
test('coverage scanner distinguishes missing source from completed gameplay',()=>{const r=census('/nonexistent');assert.equal(r.status,'MISSING_ORIGINAL_SOURCE');assert.equal(r.present.commands,false)});
test('coverage scanner inventories decorators/collectors with limited reference status',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'crownicles-scanner-'));
 try{
  const fixture={
   'Core/src/commands/player/PingCommand.ts':'class Ping { @commandRequires(CommandPingPacketReq, { notBlocked:true }) }',
   'Core/src/commands/guild/OtherCommand.ts':'class Other { @commandRequires(CommandGuildInvitePacketReq, { notBlocked:true }) }',
   'Core/src/commands/admin/AdminCommand.ts':'class Admin { @commandRequires(CommandTestPacketReq,{}) }',
   'Lib/src/packets/commands/CommandPingPacket.ts':'export class CommandPingPacketReq extends CrowniclesPacket {}',
   'Lib/src/packets/interaction/ReactionCollectorGuildLeave.ts':'export class ReactionCollectorGuildLeaveData extends ReactionCollectorData {}',
   'Discord/src/commands/player/PingCommand.ts':'class Ping {}'
  };
  for(const [file,content]of Object.entries(fixture)){const f=path.join(dir,file);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,content);}
  const r=census(dir);assert.equal(r.status,'READ_ONLY');assert.equal(r.stats.decoratedReqCount,3);assert.equal(r.stats.nonAdminDecoratedReqCount,2);assert.equal(r.stats.nativeRouterDecoratedReqCount,1);assert.equal(r.stats.collectorTypeCount,1);assert.equal(r.stats.recognizedCollectorTypeCount,1);assert.equal(r.stats.discordCommandTsFiles,1);
  assert.ok(r.commands.find(x=>x.request==='CommandGuildInvitePacketReq'&&!x.nativeRouter));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
