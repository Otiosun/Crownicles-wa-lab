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
const HELP_GROUPS=Object.freeze([
 {title:'Sua aventura',entries:[['/jogar · /aventura','CommandReportPacketReq'],['/menu','local'],['/perfil','CommandProfilePacketReq'],['/inventario','CommandInventoryPacketReq'],['/missoes','CommandMissionsPacketReq']]},
 {title:'Personagem e mundo',entries:[['/pet','CommandPetPacketReq'],['/classes','CommandClassesInfoPacketReq'],['/mapa','CommandMapPacketReq'],['/historico','CommandFightHistoryPacketReq'],['/raridades','CommandRarityPacketReq'],['/ranking','CommandTopPacketReq'],['/versao','CommandUpdatePacketReq']]},
 {title:'Guildas e atividades',entries:[['/guilda','CommandGuildPacketReq'],['/despensa','CommandGuildStoragePacketReq'],['/abrigo','CommandGuildShelterPacketReq'],['/expedicao','CommandPetExpeditionPacketReq'],['/equipamentos','CommandEquipPacketReq'],['/jardim','CommandGardenPacketReq'],['/bencao','CommandBlessingPacketReq'],['/defesa','CommandDefensePacketReq'],['/ping','CommandPingPacketReq']]}
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
function renderHelp(available){
 const enabled=new Set(available||[]);
 let lines=['*✦ CROWNICLES — COMANDOS*',''];
 for(const section of HELP_GROUPS){
  const commands=section.entries.filter(([,packet])=>packet==='local'||enabled.has(packet)).map(([command])=>command);
  if(commands.length){lines.push('*'+section.title+'*',...commands,'');}
 }
 lines.push('*No grupo*','/ajuda · /comandos','/ativar · /desativar (responsável, no grupo)','',
 'Para decisões, use /menu e responda com o número indicado. Ações com custos exigem confirmação quando disponível.',
 'Seu progresso e as respostas da aventura chegam no privado. Outros sistemas são liberados após validação no Core.');
 return lines.join('\n');
}
module.exports={NATIVE_READ_HANDLERS,HELP_GROUPS,probeReadHandlers,renderHelp};
