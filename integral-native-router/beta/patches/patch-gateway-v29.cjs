'use strict';
/** Surgical, reversible V2.9 patch. No DB, player data, auth, RNG or game rule edits. */
const fs=require('node:fs');
const file=process.argv[2];
if(!file||!fs.statSync(file).isFile()||fs.lstatSync(file).isSymbolicLink())throw Error('GATEWAY_PATH_INVALIDO');
const original=fs.readFileSync(file,'utf8');
const importAnchor="const {resolveCommand:resolveLote11,makeNicknameMenu,authorizedNickname}=require('./lote11.cjs');\n";
const dispatchAnchor='  // Only Core handlers verified by the isolated beta may receive new native requests.\n';
const definitions=`// The original Core may have one live reaction collector per player.
// Keep an existing decision snapshot instead of opening a second menu over it.
// Read-only lookups are intentionally excluded.
const MENU_OPENERS_V29=new Set([
 'CommandFightPacketReq','CommandSellPacketReq','CommandPetFeedPacketReq',
 'CommandDrinkPacketReq','CommandDailyBonusPacketReq','CommandClassesPacketReq',
 'CommandJoinBoatPacketReq','CommandEquipPacketReq','CommandGardenPacketReq',
 'CommandDefensePacketReq','CommandPetExpeditionPacketReq'
]);
`;
const safety=`  // V29: never replace the pending collector/menu with a new opener.
  if(MENU_OPENERS_V29.has(action.name)){
   const active=this.store.getMenu(row.wa);
   if(active&&Number.isFinite(active.endTime)&&active.endTime>Date.now()){
    this.store.queue(row.wa,'Há uma decisão pendente. Envie /menu para consultá-la ou escolha a opção de cancelar.');
    this.store.mark(row.id,'done');continue;
   }
  }
`;
const count=(hay,needle)=>hay.split(needle).length-1;
if(count(original,'MENU_OPENERS_V29')!==0){
 if(count(original,'const MENU_OPENERS_V29=new Set(')===1&&count(original,'if(MENU_OPENERS_V29.has(action.name))')===1){
  console.log('PATCH_GATEWAY_V29=JA_APLICADO');process.exit(0);
 }
 throw Error('GATEWAY_V29_PARCIAL');
}
if(count(original,importAnchor)!==1||count(original,dispatchAnchor)!==1)throw Error('ANCORAS_GATEWAY_V28_DIVERGENTES');
const result=original.replace(importAnchor,importAnchor+definitions).replace(dispatchAnchor,safety+dispatchAnchor);
if(count(result,definitions)!==1||count(result,safety)!==1||
   result.replace(definitions,'').replace(safety,'')!==original)throw Error('ALTERACAO_FORA_DAS_ANCORAS');
fs.writeFileSync(file,result,{mode:0o600});
console.log('PATCH_GATEWAY_V29=CIRURGICO');
