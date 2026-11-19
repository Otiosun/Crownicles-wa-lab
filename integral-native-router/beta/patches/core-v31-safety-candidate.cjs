'use strict';
// CANDIDATE ONLY. DO NOT apply to current player data or installed Termux runtime.
// Pure exact-source transformations, pinned Git blobs. Caller must compile and run real Core tests.
const crypto=require('node:crypto');
const BLOBS={
  "Core/src/commands/guild/GuildElderRemoveCommand.ts": "f51df8d073435b81bda907f0c9b77739b27969b3",
  "Core/src/commands/guild/GuildElderCommand.ts": "ebfdeb5207743045034265ad5d9b3b115a37210f",
  "Core/src/commands/guild/GuildKickCommand.ts": "ac358242cfdc8f7c24b1f81a929784d2167333c7",
  "Core/src/core/utils/MissionManagerShopItems.ts": "d9343f143139c4d2f837aa937deb221ff490eecf"
};
function once(s,a,b){if(s.split(a).length!==2)throw Error("CANDIDATE_ANCHOR:"+a.slice(0,100));return s.replace(a,b)}
function demote(s){
 s=once(s,"expectedGuildId: number\n): Promise<string | null>","expectedGuildId: number,\n\texpectedElderId: number\n): Promise<string | null>");
 s=once(s,"\tif (!guild.elderId) {\n\t\treturn null;\n\t}","\tif (guild.elderId !== expectedElderId) {\n\t\treturn null;\n\t}");
 s=once(s,"async function acceptGuildElderRemove(player: Player, response: CrowniclesPacket[]): Promise<void>","async function acceptGuildElderRemove(player: Player, response: CrowniclesPacket[], expectedGuildId: number, expectedElderId: number): Promise<void>");
 s=once(s,"if (freshChief.guildId === null)","if (freshChief.guildId !== expectedGuildId)");
 s=once(s,"\t\t\t\tguildSnapshot.id\n\t\t\t)","\t\t\t\texpectedGuildId, expectedElderId\n\t\t\t)");
 s=once(s,"function endCallback(player: Player, demotedElder: Player): EndCallback","function endCallback(player: Player, demotedElder: Player, expectedGuildId: number): EndCallback");
 s=once(s,"await acceptGuildElderRemove(player, response);","await acceptGuildElderRemove(player, response, expectedGuildId, demotedElder.id);");
 s=once(s,"endCallback(player, demotedElder)","endCallback(player, demotedElder, guild.id)");
 return s;
}
function promote(s){
 s=once(s,"async function acceptGuildElder(player: Player, promotedPlayer: Player, response: CrowniclesPacket[]): Promise<void>","async function acceptGuildElder(player: Player, promotedPlayer: Player, response: CrowniclesPacket[], expectedGuildId: number): Promise<void>");
 s=once(s,"\tif (!await isEligible(freshChief, freshPromoted, response)) {","\tif (freshChief.guildId !== expectedGuildId) {\n\t\tresponse.push(makePacket(CommandGuildElderSameGuildPacketRes, {}));\n\t\treturn;\n\t}\n\tif (!await isEligible(freshChief, freshPromoted, response)) {");
 s=once(s,"\t\t\t\tguildSnapshot.id\n\t\t\t)","\t\t\t\texpectedGuildId\n\t\t\t)");
 // Capture guild id when the original collector is constructed, never the current role at accept.
 s=once(s,"const guildName = (await Guilds.getById(player.guildId))!.name;","const guild = (await Guilds.getById(player.guildId))!;\n\t\tconst guildName = guild.name;\n\t\tconst expectedGuildId = guild.id;");
 s=once(s,"await acceptGuildElder(player, promotedPlayer!, response);","await acceptGuildElder(player, promotedPlayer!, response, expectedGuildId);");
 return s;
}
function kick(s){
 s=once(s,"async function acceptGuildKick(player: Player, kickedPlayer: Player, response: CrowniclesPacket[]): Promise<void>","async function acceptGuildKick(player: Player, kickedPlayer: Player, response: CrowniclesPacket[], expectedGuildId: number): Promise<void>");
 s=once(s,"\t// Re-run the eligibility checks against the freshly read rows","\tif (freshChief.guildId !== expectedGuildId) {\n\t\tresponse.push(makePacket(CommandGuildKickPacketRes, { foundPlayer: true, sameGuild: false, himself: false }));\n\t\treturn;\n\t}\n\t// Re-run the eligibility checks against the freshly read rows");
 s=once(s,"\t\t\t\tguildSnapshot.id\n\t\t\t)","\t\t\t\texpectedGuildId\n\t\t\t)");
 s=once(s,"await acceptGuildKick(player, validKickedPlayer, response);","await acceptGuildKick(player, validKickedPlayer, response, guild.id);");
 // Original early negative branch had blocked the target before confirming the guild still exists.
 s=once(s,"if (!guild) {\n\t\t\treturn;\n\t\t}\n\n\t\t// Send collector","if (!guild) {\n\t\t\tBlockingUtils.unblockPlayer(validKickedPlayer.keycloakId, BlockingConstants.REASONS.GUILD_KICK);\n\t\t\treturn;\n\t\t}\n\n\t\t// Send collector");
 return s;
}
function mission(s){
 s=once(s,"CommandShopClosed, ShopItem","CommandShopClosed, CommandShopNotEnoughCurrency, ShopItem");
 s=once(s,'import { PlayerBadgesManager } from "../database/game/models/PlayerBadges";','import { PlayerBadgesManager } from "../database/game/models/PlayerBadges";\nimport { ShopCurrency } from "../../../../Lib/src/constants/ShopConstants";\nimport { getCurrentTransaction } from "../../../../Lib/src/locks/CLSNamespace";\nimport { withLockedPlayerAndMissions } from "./withLockedPlayerAndMissions";');
 const from=s.indexOf("function getEndCallbackSkipMissionShopItem("),to=s.indexOf("\n/**\n * Creates the skip mission shop item configuration.",from);
 if(from<0||to<0)throw Error("CANDIDATE_SKIP_BOUNDARY");
 const body=`function getEndCallbackSkipMissionShopItem(player: Player, missionList: MissionSlot[], quotedPrice: number): (collector: ReactionCollectorInstance, response: CrowniclesPacket[]) => Promise<void> {
	const expectedMissions = missionList.map(mission => JSON.stringify(MissionsController.prepareMissionSlot(mission)));
	return async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]) => {
		try {
			const firstReaction = collector.getFirstReaction();
			if (!firstReaction || firstReaction.reaction.type !== ReactionCollectorSkipMissionShopItemReaction.name) {
				response.push(makePacket(CommandShopClosed, {}));
				return;
			}
			const missionIndex = (firstReaction.reaction.data as ReactionCollectorSkipMissionShopItemReaction).missionIndex;
			const selected = missionList[missionIndex];
			if (!Number.isSafeInteger(missionIndex) || !selected || !Number.isSafeInteger(quotedPrice) || quotedPrice < 0) {
				response.push(makePacket(CommandShopClosed, {}));
				return;
			}

			// Keep the original price formula and mission generator; reject stale quotes
			// and snapshots BEFORE any mutation. Reuse the established player/mission locks.
			const committed = await withLockedPlayerAndMissions(player.id, async lockedPlayer => {
				const transaction = getCurrentTransaction();
				if (!transaction) {
					throw new Error("skip mission requires active player/mission transaction");
				}
				const info = await PlayerMissionsInfo.findByPk(lockedPlayer.id, { transaction, rejectOnEmpty: true });
				const price = info.missionSkipsUsedThisWeek;
				if (price !== quotedPrice) {
					return [makePacket(CommandShopClosed, {})];
				}
				if (info.gems < price) {
					return [makePacket(CommandShopNotEnoughCurrency, { missingCurrency: price - info.gems, currency: ShopCurrency.GEM })];
				}
				const mission = await MissionSlot.findByPk(selected.id, { transaction, lock: transaction.LOCK.UPDATE });
				if (!mission || mission.playerId !== lockedPlayer.id || mission.isCampaign() || mission.hasExpired() || mission.isCompleted()
					|| JSON.stringify(MissionsController.prepareMissionSlot(mission)) !== expectedMissions[missionIndex]) {
					return [makePacket(CommandShopClosed, {})];
				}

				const pending: CrowniclesPacket[] = [];
				const oldMission = MissionsController.prepareMissionSlot(mission);
				await mission.destroy();
				const newMission = await MissionsController.addRandomMissionToPlayer(lockedPlayer, MissionsController.getRandomDifficulty(lockedPlayer), mission.missionId);
				pending.push(makePacket(CommandMissionShopSkipMissionResult, {
					oldMission,
					newMission: MissionsController.prepareMissionSlot(newMission)
				}));

				// Save the counter before nested mission updates can re-read it.
				info.missionSkipsUsedThisWeek += 1;
				await info.save();
				if (price > 0) {
					await info.spendGems(price, pending, NumberChangeReason.MISSION_SHOP);
				}
				await MissionsController.update(lockedPlayer, pending, { missionId: "replaceMission" });
				return pending;
			});
			// Publish successful game packets only after the enclosing transaction commits.
			response.push(...committed);
		}
		finally {
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.SKIP_MISSION);
		}
	};
}
`;
 s=s.slice(0,from)+body+s.slice(to);
 s=once(s,"ReactionCollectorSkipMissionShopItemCloseReaction,\n\t","");
 s=once(s,"getEndCallbackSkipMissionShopItem(player, allMissions)","getEndCallbackSkipMissionShopItem(player, allMissions, missionSkipsUsedThisWeek)");
 return s;
}
const TRANSFORMS=[demote,promote,kick,mission];
function buildCandidate(sources){const result={};for(const [i,path] of Object.keys(BLOBS).entries()){const s=sources[path];if(typeof s!=='string')throw Error('MISSING_PINNED_SOURCE_'+path);const hash=crypto.createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');if(hash!==BLOBS[path])throw Error('UPSTREAM_BLOB_MISMATCH_'+path);result[path]=TRANSFORMS[i](s);}return result;}
module.exports={BLOBS,buildCandidate};
