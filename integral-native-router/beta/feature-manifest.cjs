'use strict';
/* Crownicles 6.2.0.b — additive, guarded registration of native command handlers.
 * Every path is from the pinned Core tree. No reimplementation of RPG rules.
 * This loader does not send a packet, start jobs, or change player state.
 */
const fs=require('node:fs');
const path=require('node:path');
const NATIVE_READ_HANDLERS=Object.freeze({
 CommandPetPacketReq:'commands/pet/PetCommand.js',
 CommandGuildPacketReq:'commands/guild/GuildCommand.js',
 CommandClassesInfoPacketReq:'commands/player/ClassesInfoCommand.js',
 CommandFightHistoryPacketReq:'commands/player/FightHistoryCommand.js',
 CommandMapPacketReq:'commands/player/MapCommand.js',
 CommandRarityPacketReq:'commands/player/RarityCommand.js',
 CommandTopPacketReq:'commands/player/TopCommand.js',
 CommandGuildStoragePacketReq:'commands/guild/GuildStorageCommand.js',
 CommandEquipPacketReq:'commands/player/EquipCommand.js',
 CommandUpdatePacketReq:'commands/player/UpdateCommand.js',
 CommandGuildShelterPacketReq:'commands/guild/GuildShelterCommand.js',
 CommandPetExpeditionPacketReq:'commands/pet/PetExpeditionCommand.js',
 CommandPingPacketReq:'commands/player/PingCommand.js',
 CommandGardenPacketReq:'commands/player/GardenCommand.js',
 CommandBlessingPacketReq:'commands/player/BlessingCommand.js',
 CommandDefensePacketReq:'commands/player/DefenseCommand.js'
});
// These original requests only open Crownicles collectors/menus. No custom RPG
// rules or automatic confirmation. Mutating decisions still use the W3 nonce.
const NATIVE_MENU_HANDLERS=Object.freeze({
 CommandFightPacketReq:'commands/player/FightCommand.js',
 CommandSellPacketReq:'commands/player/SellCommand.js',
 CommandPetFeedPacketReq:'commands/pet/PetFeedCommand.js',
 CommandDrinkPacketReq:'commands/player/DrinkCommand.js',
 CommandDailyBonusPacketReq:'commands/player/DailyBonusCommand.js',
 CommandClassesPacketReq:'commands/player/ClassesCommand.js',
 CommandJoinBoatPacketReq:'commands/player/JoinBoatCommand.js'
});
// W3/L10+L11 originally implemented these actions with an explicit local
// authorization menu, nonce-bound preview and Core-side validation. The initial
// WhatsApp command MUST NOT submit the native request; only confirmation does.
const NATIVE_AUTH_HANDLERS=Object.freeze({
 CommandRespawnPacketReq:'commands/player/RespawnCommand.js',
 CommandLeagueRewardPacketReq:'commands/player/LeagueRewardCommand.js',
 CommandGuildDailyPacketReq:'commands/guild/GuildDailyCommand.js',
 CommandPetNickPacketReq:'commands/pet/PetNickCommand.js'
});
// Original Core 6.2.0.b commands not yet fully exposed in live WhatsApp.
// This table ONLY loads the official handlers. Risky request routing remains
// blocked by the Gateway until the existing W3 semantics pass separate QA.
const NATIVE_EXPANSION_HANDLERS=Object.freeze({
 CommandFriendlyFightPacketReq:'commands/player/FriendlyFightCommand.js',
 CommandUnlockPacketReq:'commands/player/UnlockCommand.js',
 CommandGuildCreatePacketReq:'commands/guild/GuildCreateCommand.js',
 CommandGuildDescriptionPacketReq:'commands/guild/GuildDescriptionCommand.js',
 CommandGuildElderPacketReq:'commands/guild/GuildElderCommand.js',
 CommandGuildElderRemovePacketReq:'commands/guild/GuildElderRemoveCommand.js',
 CommandGuildInvitePacketReq:'commands/guild/GuildInviteCommand.js',
 CommandGuildKickPacketReq:'commands/guild/GuildKickCommand.js',
 CommandGuildLeavePacketReq:'commands/guild/GuildLeaveCommand.js',
 CommandPetCaressPacketReq:'commands/pet/PetCaressCommand.js',
 CommandPetFreePacketReq:'commands/pet/PetFreeCommand.js',
 CommandPetSellPacketReq:'commands/pet/PetSellCommand.js',
 CommandPetTransferPacketReq:'commands/pet/PetTransferCommand.js'
});
const HELP_GROUPS=Object.freeze([
 {title:'Sua aventura',entries:[['/jogar · /aventura','CommandReportPacketReq'],['/menu','local'],['/cadastro','local'],['/perfil','CommandProfilePacketReq'],['/inventario','CommandInventoryPacketReq'],['/missoes','CommandMissionsPacketReq']]},
 {title:'Personagem e mundo',entries:[['/pet','CommandPetPacketReq'],['/classes','CommandClassesInfoPacketReq'],['/mapa','CommandMapPacketReq'],['/historico','CommandFightHistoryPacketReq'],['/raridades','CommandRarityPacketReq'],['/ranking','CommandTopPacketReq'],['/versao','CommandUpdatePacketReq']]},
 {title:'Guildas e atividades',entries:[['/guilda','CommandGuildPacketReq'],['/despensa','CommandGuildStoragePacketReq'],['/abrigo','CommandGuildShelterPacketReq'],['/expedicao','CommandPetExpeditionPacketReq'],['/equipamentos','CommandEquipPacketReq'],['/jardim','CommandGardenPacketReq'],['/bencao','CommandBlessingPacketReq'],['/defesa','CommandDefensePacketReq'],['/ping','CommandPingPacketReq']]},
 {title:'Escolhas e encontros',entries:[
  ['/combate','CommandFightPacketReq'],['/vender','CommandSellPacketReq'],
  ['/alimentar','CommandPetFeedPacketReq'],['/pocao','CommandDrinkPacketReq'],
  ['/diario','CommandDailyBonusPacketReq'],['/mudarclasse','CommandClassesPacketReq'],
  ['/embarcar','CommandJoinBoatPacketReq'],
  ['/renascer','CommandRespawnPacketReq'],['/recompensaliga','CommandLeagueRewardPacketReq'],
  ['/diarioguilda','CommandGuildDailyPacketReq'],['/renomearpet NOME','CommandPetNickPacketReq']
 ]}
]);
function probeReadHandlers({dist,listener,load=require,exists=fs.existsSync}={}){
 if(typeof dist!=='string'||!path.isAbsolute(dist)||!listener||typeof listener.getListener!=='function'||typeof load!=='function'||typeof exists!=='function')throw TypeError('CORE_PROBE_INVALIDO');
 const available=[],unavailable=[];
 for(const [packet,rel] of Object.entries(NATIVE_READ_HANDLERS)){
  const file=path.join(dist,rel);
  let ok=false;
  try{
   // The original Core may have registered some handlers during its bootstrap.
   // In that case, do not import the same module unnecessarily.
   if(typeof listener.getListener(packet)==='function')ok=true;
   else if(exists(file)){
    load(file);
    ok=typeof listener.getListener(packet)==='function';
   }
  }catch{} // Missing optional handler never prevents the baseline beta from starting.
  (ok?available:unavailable).push(packet);
 }
 return Object.freeze({available:Object.freeze(available),unavailable:Object.freeze(unavailable)});
}
function probeMenuHandlers(options={}){
 return probeHandlerTable(NATIVE_MENU_HANDLERS,options);
}
function probeAuthHandlers(options={}){
 return probeHandlerTable(NATIVE_AUTH_HANDLERS,options);
}
function probeExpansionHandlers(options={}){
 return probeHandlerTable(NATIVE_EXPANSION_HANDLERS,options);
}
function probeHandlerTable(table,{dist,listener,load=require,exists=fs.existsSync}={}){
 if(typeof dist!=='string'||!path.isAbsolute(dist)||!listener||typeof listener.getListener!=='function'||typeof load!=='function'||typeof exists!=='function')throw TypeError('CORE_PROBE_INVALIDO');
 const available=[],unavailable=[];
 for(const [packet,rel] of Object.entries(table)){
  const file=path.join(dist,rel);
  let ok=false;
  try{
   // Match Core packet registration, not presence of a JS file alone.
   if(typeof listener.getListener(packet)==='function')ok=true;
   else if(exists(file)){
    load(file);
    ok=typeof listener.getListener(packet)==='function';
   }
  }catch{ok=false}
  (ok?available:unavailable).push(packet);
 }
 return Object.freeze({available:Object.freeze(available),unavailable:Object.freeze(unavailable)});
}
function renderHelp(available){
// Kept separate from menus that don't mutate until collector confirmation.

 const enabled=new Set(available||[]);
 let lines=['*✦ CROWNICLES — COMANDOS*',''];
 for(const section of HELP_GROUPS){
  const commands=section.entries.filter(([,packet])=>packet==='local'||enabled.has(packet)).map(([command])=>command);
  if(commands.length){lines.push('*'+section.title+'*',...commands,'');}
 }
 lines.push('*No grupo*','/ajuda · /comandos','/ativar · /desativar (responsável, no grupo)','/grupo · /regras','',
 'Abertura de menus não executa compras ou escolhas. Para decidir, use /menu e responda com o número indicado. Custos e efeitos exigem prévia e confirmação.',
 'Seu progresso e as respostas da aventura chegam no privado. Outros sistemas são liberados após validação no Core.');
 return lines.join('\n');
}
module.exports={NATIVE_READ_HANDLERS,NATIVE_MENU_HANDLERS,NATIVE_AUTH_HANDLERS,NATIVE_EXPANSION_HANDLERS,HELP_GROUPS,probeReadHandlers,probeMenuHandlers,probeAuthHandlers,probeExpansionHandlers,renderHelp};
