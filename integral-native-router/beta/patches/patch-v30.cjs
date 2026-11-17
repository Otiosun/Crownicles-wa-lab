'use strict';
/** Crownicles Beta V3.0: restore 4 original native authorizations from W3.
 * Pure textual, surgical patch. Caller must run it on a disposable stage.
 * Never reads or changes a player, game database, auth, Baileys, RNG or Core source.
 */
const fs=require('node:fs'),path=require('node:path');
const base=path.resolve(process.argv[2]||'.');
function addOnce(text,needle,addition,key){
 if(text.includes(addition))return text;
 if(text.split(needle).length!==2)throw Error('CONTRATO_V29_DIVERGENTE_'+key);
 return text.replace(needle,needle+addition);
}
function edit(rel,fn){
 const file=path.join(base,rel);
 if(!fs.statSync(file).isFile()||fs.lstatSync(file).isSymbolicLink())throw Error('ARQUIVO_INVALIDO_'+rel);
 const original=fs.readFileSync(file,'utf8'),next=fn(original);
 if(!next.startsWith("'use strict';"))throw Error('SAIDA_INVALIDA_'+rel);
 if(original!==next){fs.writeFileSync(file,next,{mode:0o600});console.log('PATCH_V30_'+rel.replace(/\W/g,'_')+'=CIRURGICO')}
 else console.log('PATCH_V30_'+rel.replace(/\W/g,'_')+'=JA_APLICADO');
}
edit('feature-manifest.cjs',s=>{
 const anchor='const HELP_GROUPS=Object.freeze([';
 const intro=`// W3/L10+L11 originally implemented these actions with an explicit local
// authorization menu, nonce-bound preview and Core-side validation. The initial
// WhatsApp command MUST NOT submit the native request; only confirmation does.
const NATIVE_AUTH_HANDLERS=Object.freeze({
 CommandRespawnPacketReq:'commands/player/RespawnCommand.js',
 CommandLeagueRewardPacketReq:'commands/player/LeagueRewardCommand.js',
 CommandGuildDailyPacketReq:'commands/guild/GuildDailyCommand.js',
 CommandPetNickPacketReq:'commands/pet/PetNickCommand.js'
});
`;
 if(!s.includes(intro)){if(s.split(anchor).length!==2)throw Error('MANIFEST_SECOES');s=s.replace(anchor,intro+anchor)}
 const old="  ['/embarcar','CommandJoinBoatPacketReq']\n ]}";
 const extra=",\n  ['/renascer','CommandRespawnPacketReq'],['/recompensaliga','CommandLeagueRewardPacketReq'],\n  ['/diarioguilda','CommandGuildDailyPacketReq'],['/renomearpet NOME','CommandPetNickPacketReq']";
 if(!s.includes(extra)){if(s.split(old).length!==2)throw Error('MANIFEST_AJUDA');s=s.replace(old,"  ['/embarcar','CommandJoinBoatPacketReq']"+extra+"\n ]}")}
 s=addOnce(s,'function renderHelp(available){',"\n// Kept separate from menus that don't mutate until collector confirmation.\n",'MANIFEST_RENDER');
 const probeAnchor='function probeMenuHandlers(options={}){\n return probeHandlerTable(NATIVE_MENU_HANDLERS,options);\n}\n';
 s=addOnce(s,probeAnchor,"function probeAuthHandlers(options={}){\n return probeHandlerTable(NATIVE_AUTH_HANDLERS,options);\n}\n",'MANIFEST_PROBE');
 const exp='module.exports={NATIVE_READ_HANDLERS,NATIVE_MENU_HANDLERS,HELP_GROUPS,probeReadHandlers,probeMenuHandlers,renderHelp};';
 const expNew='module.exports={NATIVE_READ_HANDLERS,NATIVE_MENU_HANDLERS,NATIVE_AUTH_HANDLERS,HELP_GROUPS,probeReadHandlers,probeMenuHandlers,probeAuthHandlers,renderHelp};';
 if(!s.includes(expNew)){if(s.split(exp).length!==2)throw Error('MANIFEST_EXPORTS');s=s.replace(exp,expNew)}
 return s;
});
edit('runtime.cjs',s=>{
 const req="const {probeReadHandlers,probeMenuHandlers}=require('./feature-manifest.cjs');";
 const reqNew="const {probeReadHandlers,probeMenuHandlers,probeAuthHandlers}=require('./feature-manifest.cjs');";
 if(!s.includes(reqNew)){if(s.split(req).length!==2)throw Error('RUNTIME_IMPORT');s=s.replace(req,reqNew)}
 const anchor=" const nativeMenus=probeMenuHandlers({dist,listener:gameInstance.packetListener});\n";
 const plus=" const nativeAuth=probeAuthHandlers({dist,listener:gameInstance.packetListener});\n";
 s=addOnce(s,anchor,plus,'RUNTIME_PROBE');
 const old=" const enabledPackets=new Set([...Object.keys(compiledPaths),...nativeRead.available,...nativeMenus.available]);";
 const nw=" const enabledPackets=new Set([...Object.keys(compiledPaths),...nativeRead.available,...nativeMenus.available,...nativeAuth.available]);";
 if(!s.includes(nw)){if(s.split(old).length!==2)throw Error('RUNTIME_CAPABILITIES');s=s.replace(old,nw)}
 const log=" status('BETA_MENUS_PENDENTES',nativeMenus.unavailable.length);\n";
 const plusLog=" status('BETA_AUTORIZACOES_NATIVAS',nativeAuth.available.length);\n status('BETA_AUTORIZACOES_PENDENTES',nativeAuth.unavailable.length);\n";
 s=addOnce(s,log,plusLog,'RUNTIME_STATUS');
 return s;
});
edit('bridge/gateway.cjs',s=>{
 // Reuse existing L10/L11 authorization contracts: never invent a payload.
 // A prompt is not shown if Core lacks a registered handler.
 const oldA="if(!menu)return {local:'Nome inválido. Nenhuma alteração foi enviada.'};this.store.saveMenu(row.wa,menu);";
 const newA="if(!menu)return {local:'Nome inválido. Nenhuma alteração foi enviada.'};const candidate=authorizedNickname(menu,menu.options?.[0],id);if(!candidate||(typeof this.config.canSendPacket==='function'&&!this.config.canSendPacket(candidate.name)))return {local:'O motor ainda não habilitou a alteração de apelido. Nenhuma mudança foi enviada.'};this.store.saveMenu(row.wa,menu);";
 if(!s.includes(newA)){if(s.split(oldA).length!==2)throw Error('GATEWAY_APELIDO');s=s.replace(oldA,newA)}
 const oldB="if(!menu)return {local:'A autorização não está disponível.'};this.store.saveMenu(row.wa,menu);";
 const newB="if(!menu)return {local:'A autorização não está disponível.'};const candidate=authorizedNativeCommand(menu,menu.options?.[0]);if(!candidate||(typeof this.config.canSendPacket==='function'&&!this.config.canSendPacket(candidate.name)))return {local:'O motor ainda não habilitou esta ação. Nenhuma solicitação foi enviada.'};this.store.saveMenu(row.wa,menu);";
 if(!s.includes(newB)){if(s.split(oldB).length!==2)throw Error('GATEWAY_AUTORIZACAO');s=s.replace(oldB,newB)}
 return s;
});
edit('bridge/lote08.cjs',s=>{
 const old="case 'CommandDailyBonusInCooldown':return '*✦ BÔNUS DIÁRIO*\\nA recarga ainda não terminou. O motor definirá quando estará disponível.';";
 const nw=`case 'CommandDailyBonusInCooldown':{
  // Original Core sends milliseconds since epoch and a duration in hours.
  // Never guess a date if either value is missing or malformed.
  const start=p?.lastDailyTimestamp,hours=p?.timeBetweenDailies;
  const finish=Number.isFinite(start)&&start>1e12&&Number.isFinite(hours)&&hours>=0&&hours<=168?start+hours*3600000:NaN;
  const when=Number.isFinite(finish)&&finish>Date.now()&&finish<Date.now()+8*86400000?new Date(finish).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'';
  return '*✦ BÔNUS DIÁRIO*\\nA recarga ainda não terminou.'+(when?'\\nDisponível a partir de '+when+' (horário de Brasília).':'');
 }`;
 if(!s.includes(nw)){if(s.split(old).length!==2)throw Error('LOTE08_COOLDOWN');s=s.replace(old,nw)}
 return s;
});
console.log('V30_CODIGO_PREPARADO=SIM');
