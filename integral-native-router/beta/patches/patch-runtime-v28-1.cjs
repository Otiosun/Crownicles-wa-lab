'use strict';
/** V2.8.1 surgical patch of a V2.7 runtime. No database or session is opened.
 * Unlike the original V2.8 installer, this accepts harmless baseline code
 * differences, but it only changes three EXACT, unique V2.7 expressions.
 */
const fs=require('node:fs');
const path=require('node:path');
const file=process.argv[2];
if(!file || !path.isAbsolute(file) || path.basename(file)!=='runtime.cjs'){
 console.error('ERRO=CAMINHO_RUNTIME_INVALIDO');process.exit(2);
}
const before=fs.readFileSync(file,'utf8');
const required=[
 "const compiledPaths=",
 "const {groupIdentityDisposition}=require('./group-identity-policy.cjs');",
 "const {probeReadHandlers}=require('./feature-manifest.cjs');",
 "status('BETA_LEITURAS_NATIVAS',nativeRead.available.length);",
 "status('BETA_LEITURAS_PENDENTES',nativeRead.unavailable.length);",
 'enabledPackets:coreBoot.enabledPackets',
 "CORE_ORIGINAL",
 "BETA_GRUPOS"
];
for(const str of required){if(!before.includes(str)){
 console.error('ERRO=BASE_V27_NAO_RECONHECIDA');process.exit(2);
}}
if(before.includes('probeMenuHandlers') || before.includes('BETA_MENUS_NATIVOS')){
 console.error('ERRO=PATCH_V28_PARCIAL_OU_PREEXISTENTE');process.exit(2);
}
function replaceOnce(src,oldText,newText,label){
 const parts=src.split(oldText);
 if(parts.length!==2){console.error('ERRO=ANCORA_V27_DIVERGENTE_'+label);process.exit(2)}
 return parts.join(newText);
}
const oldImport="const {probeReadHandlers}=require('./feature-manifest.cjs');";
const newImport="const {probeReadHandlers,probeMenuHandlers}=require('./feature-manifest.cjs');";
const oldStanza=[
 ' const nativeRead=probeReadHandlers({dist,listener:gameInstance.packetListener});',
 ' const enabledPackets=new Set([...Object.keys(compiledPaths),...nativeRead.available]);',
 " status('BETA_LEITURAS_NATIVAS',nativeRead.available.length);",
 " status('BETA_LEITURAS_PENDENTES',nativeRead.unavailable.length);"
].join('\n');
const newStanza=[
 ' const nativeRead=probeReadHandlers({dist,listener:gameInstance.packetListener});',
 ' const nativeMenus=probeMenuHandlers({dist,listener:gameInstance.packetListener});',
 ' const enabledPackets=new Set([...Object.keys(compiledPaths),...nativeRead.available,...nativeMenus.available]);',
 " status('BETA_LEITURAS_NATIVAS',nativeRead.available.length);",
 " status('BETA_LEITURAS_PENDENTES',nativeRead.unavailable.length);",
 " status('BETA_MENUS_NATIVOS',nativeMenus.available.length);",
 " status('BETA_MENUS_PENDENTES',nativeMenus.unavailable.length);"
].join('\n');
let after=replaceOnce(before,oldImport,newImport,'IMPORT');
after=replaceOnce(after,oldStanza,newStanza,'REGISTRO');
// Internal proof of exactly reversible modifications, leaving all other bytes
// unchanged. This is a source patch, not the replacement of an unknown runtime.
let original=replaceOnce(after,newStanza,oldStanza,'REVERSE_REGISTRO');
original=replaceOnce(original,newImport,oldImport,'REVERSE_IMPORT');
if(original!==before){console.error('ERRO=ALTERACAO_FORA_DAS_ANCORAS');process.exit(3)}
fs.writeFileSync(file,after,{mode:0o600});
console.log('PATCH_RUNTIME_V28_1=EXATO');
