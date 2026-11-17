'use strict';
/** Lote 09: ponte de combate e adaptador opt-in de equipamento do Crownicles 6.2.0.b.
 * Só Core decide luta, custo, resultado, elegibilidade e troca.
 * Troca de equipamento é DESABILITADA por padrão até E2E com Core/DB descartável.
 */
const {safe,itemName}=require('./lote04.cjs');
const {classLabel}=require('./lote05.cjs');
const {equipSummary}=require('./lote08.cjs');
const isInt=n=>Number.isSafeInteger(n)&&n>=0;
const nfmt=n=>Number.isFinite(n)?n.toLocaleString('pt-BR',{maximumFractionDigits:2}):'—';
const categories=['Armas','Armaduras','Poções','Objetos'];
const fightAliases=new Set(['/combate','/lutar','/batalha']);
const EQUIP_LOCKED_DESCRIPTION='Alterações de equipamento estão bloqueadas nesta tela até o fluxo assíncrono ser homologado.';
const EQUIP_ENABLED_DESCRIPTION='A troca ou o depósito será executado pelo motor após prévia e confirmação.';
function equipLiveStory(categories,models){
 return equipSummary({categories},models).replace(EQUIP_LOCKED_DESCRIPTION,EQUIP_ENABLED_DESCRIPTION);
}

function resolveCommand(line){return fightAliases.has(String(line||'').trim().toLocaleLowerCase('pt-BR'))?{name:'CommandFightPacketReq',data:{}}:null}
function className(models,id){const raw=models?.classes?.[String(id)];const val=typeof raw==='string'?raw:raw?.name;return classLabel(id,safe(val||'Classe desconhecida',60))}
function fmtDay(epoch){if(!Number.isFinite(epoch)||epoch<946684800000||epoch>4102444800000)return null;return new Date(epoch).toLocaleDateString('pt-BR',{timeZone:'America/Maceio'});}
function fightHistory(p,models){
 if(!Array.isArray(p.history))return '*✦ HISTÓRICO DE COMBATES*\nNão foi possível consultar as lutas.';
 const rows=[`*✦ HISTÓRICO DE COMBATES*`,`${nfmt(p.history.length)} combate(s) registrado(s).`];
 const outcome=new Map([[0,'Derrota'],[0.5,'Empate'],[1,'Vitória']]);
 for(let i=0;i<Math.min(p.history.length,12);i++){
  const f=p.history[i];if(!f||typeof f!=='object')continue;
  const guard=f.kingGuard&&typeof f.kingGuard==='object';const date=fmtDay(f.date);
  const parts=[`${i+1}. ${outcome.get(f.result)||'Resultado registrado'}`];
  if(guard)parts.push(`contra guarda real${isInt(f.kingGuard.level)?` (nível ${f.kingGuard.level})`:''}`);
  else parts.push(f.initiator===true?'como atacante':'na defesa');
  if(date)parts.push(`em ${date}`);
  const ownClass=f.classes?.me;if(isInt(ownClass))parts.push(`sua classe: ${className(models,ownClass)}`);
  const glory=f.glory?.change?.me;if(Number.isFinite(glory))parts.push(`glória ${glory>=0?'+':''}${nfmt(glory)}`);
  rows.push(parts.join(' · '));
 }
 if(!p.history.length)rows.push('Nenhum combate registrado.');
 if(p.history.length>12)rows.push(`Outros ${nfmt(p.history.length-12)} combate(s) não exibidos.`);
 return rows.join('\n');
}
function numberLine(label,val){return Number.isFinite(val)?`${label}: ${nfmt(val)}`:null}
function ownFightMember(p,playerId){if(typeof playerId!=='string'||!playerId)return null;if(p.player1?.keycloakId===playerId)return {player:p.player1,initiator:true};if(p.player2?.keycloakId===playerId)return {player:p.player2,initiator:false};return null}
function renderPacket(name,p,models,playerId){
 switch(name){
  case 'CommandFightHistoryPacketRes':return fightHistory(p,models);
  case 'CommandFightNotEnoughEnergyPacketRes':return '*✦ COMBATE INDISPONÍVEL*\nVocê precisa recuperar energia antes de lutar.';
  case 'CommandFightOpponentsNotFoundPacket':return '*✦ COMBATE INDISPONÍVEL*\nO motor não encontrou um adversário válido.';
  case 'CommandFightRefusePacketRes':return '*✦ COMBATE RECUSADO*\nNenhuma luta foi iniciada.';
  case 'BuggedFightPacket':return '*✦ COMBATE INTERROMPIDO*\nO motor interrompeu a luta por uma inconsistência. Consulte /perfil antes de continuar.';
  case 'AIFightActionChoosePacket':return null; // Não emitir cronômetro assíncrono sem a ação correspondente.
  case 'CommandFightIntroduceFightersPacket':return ['*⚔️ COMBATE INICIADO*',p.friendly===true?'Confronto amistoso.':'O confronto começou.',Array.isArray(p.fightInitiatorActions)?`Ações do atacante: ${p.fightInitiatorActions.length}`:null].filter(Boolean).join('\n');
  case 'CommandFightStatusPacket':return ['*⚔️ COMBATE EM ANDAMENTO*',isInt(p.numberOfTurn)?`Turno ${nfmt(p.numberOfTurn)}${isInt(p.maxNumberOfTurn)?` de ${nfmt(p.maxNumberOfTurn)}`:''}`:null,Number.isFinite(p.activeFighter?.stats?.breath)?`Fôlego de quem age: ${nfmt(p.activeFighter.stats.breath)}/${nfmt(p.activeFighter.stats.maxBreath)}`:null].filter(Boolean).join('\n');
  case 'CommandFightEndOfFightPacket':{
   let outcome='Combate encerrado.';
   if(p.draw===true)outcome='O confronto terminou empatado.';
   else if(typeof playerId==='string'&&playerId){if(p.winner?.keycloakId===playerId)outcome='Você venceu o confronto.';else if(p.looser?.keycloakId===playerId)outcome='Você foi derrotado.'}
   return ['*✦ FIM DO COMBATE*',outcome,isInt(p.turns)?`Turnos: ${nfmt(p.turns)}`:null].filter(Boolean).join('\n');
  }
  case 'FightRewardPacket':{
   const own=ownFightMember(p,playerId);
   const parts=['*✦ RESULTADO DO COMBATE*'];
   if(own){
    if(p.draw===true)parts.push('Empate.');
    else if(p.winnerKeycloakId===playerId)parts.push('Vitória.');
    else if(typeof p.winnerKeycloakId==='string')parts.push('Derrota.');
    if(Number.isFinite(own.player.oldGlory)&&Number.isFinite(own.player.newGlory))parts.push(`Sua glória: ${nfmt(own.player.oldGlory)} → ${nfmt(own.player.newGlory)}`);
    if(own.initiator){if(Number.isFinite(p.points))parts.push(`Pontos recebidos: ${nfmt(p.points)}`);if(Number.isFinite(p.money))parts.push(`Moedas recebidas: ${nfmt(p.money)}`)}
    if(p.petLoveChange?.keycloakId===playerId&&Number.isFinite(p.petLoveChange.loveChange))parts.push(`Afinidade do companheiro: ${p.petLoveChange.loveChange>=0?'+':''}${nfmt(p.petLoveChange.loveChange)}`);
   }else parts.push('O motor concluiu a luta. Consulte /perfil para conferir a progressão.');
   return parts.join('\n');
  }
  case 'KingGuardFightRewardPacket':return ['*✦ GUARDA REAL*',p.draw===true?'Empate.':p.won===true?'Você venceu o guarda.':'O guarda venceu o confronto.',numberLine('Pontos recebidos',p.points),numberLine('Moedas recebidas',p.money)].filter(Boolean).join('\n');
  case 'CommandEquipActionRes':return p.success===true?'*✦ EQUIPAMENTO ATUALIZADO*\nO motor confirmou a alteração.':'*✦ ALTERAÇÃO NÃO REALIZADA*\nO motor recusou a troca ou o depósito. Consulte os itens antes de tentar novamente.';
  default:return null;
 }
}
function contentItem(models,cat,id){if(!isInt(cat)||cat>3||!isInt(id)||id===0)return null;const v=itemName(models,cat,id);return v?safe(v,70):null}
function validCategories(data){return Array.isArray(data?.categories)&&data.categories.length<=4&&data.categories.every(c=>isInt(c?.category)&&c.category<=3&&Array.isArray(c.reserveItems)&&c.reserveItems.length<=200)}
function equipOptions(cats,models){const out=[];const seen=new Set();
 for(const c of cats){
  const cat=c.category;if(!isInt(cat)||cat>3)continue;
  for(const x of c.reserveItems.slice(0,20)){
   const slot=x?.slot,id=x?.details?.id,name=contentItem(models,cat,id);
   if(!isInt(slot)||slot===0||!name)continue;
   const key=`e-${cat}-${slot}`;if(seen.has(key))continue;seen.add(key);
   out.push({label:`Equipar ${name} · ${categories[cat]} · reserva ${slot}`,supported:true,requiresConfirmation:true,kind:'equipAction',equip:{action:'equip',itemCategory:cat,slot,id}});
  }
  if(c.canDeposit===true){const id=c.equippedItem?.details?.id,name=contentItem(models,cat,id);if(name)out.push({label:`Guardar ${name} · ${categories[cat]} · na reserva`,supported:true,requiresConfirmation:true,kind:'equipAction',equip:{action:'deposit',itemCategory:cat,slot:0,id}})}
 }
 return out.slice(0,60);
}
function enrichEquipMenu(menu,corePacket,models,enabled){
 if(enabled!==true||menu?.type!=='ReactionCollectorEquipData'||!validCategories(corePacket?.data?.data))return menu;
 const close=corePacket.reactions?.findIndex(r=>r?.type==='ReactionCollectorEquipCloseReaction');
 if(!isInt(close)||close<0||menu.options?.[close]?.supported!==true)return menu;
 menu.equipCloseIndex=close;
 menu.equipSnapshot={categories:corePacket.data.data.categories};
 menu.options.push(...equipOptions(menu.equipSnapshot.categories,models));
 menu.story=equipLiveStory(menu.equipSnapshot.categories,models);
 return menu;
}
function verifyEquipIntent(menu,choice){
 if(menu?.type!=='ReactionCollectorEquipData'||!isInt(menu.equipCloseIndex)||choice?.kind!=='equipAction')return false;
 const e=choice.equip;if(!e||!['equip','deposit'].includes(e.action)||!isInt(e.itemCategory)||e.itemCategory>3||!isInt(e.slot)||!isInt(e.id)||e.id===0)return false;
 const cats=menu.equipSnapshot?.categories;if(!Array.isArray(cats))return false;
 const cat=cats.find(x=>x.category===e.itemCategory);if(!cat)return false;
 if(e.action==='equip')return e.slot>0&&cat.reserveItems.some(x=>x.slot===e.slot&&x.details?.id===e.id);
 return e.slot===0&&cat.canDeposit===true&&cat.equippedItem?.details?.id===e.id;
}
function refreshEquipMenu(menu,result,models){
 if(!menu||menu.type!=='ReactionCollectorEquipData'||!isInt(menu.equipCloseIndex))return null;
 if(Date.now()>=menu.endTime)return null;
 const next={...menu,options:menu.options.slice(0,menu.equipCloseIndex+1)};
 // Não repete ação potencialmente aplicada se Core retornar erro ou payload incompleto.
 if(result.success!==true||!validCategories({categories:result.categories})){
  next.story='Não foi possível confirmar a atualização do equipamento. Feche a tela e consulte /inventario antes de tentar novamente.';
  delete next.equipSnapshot;
  return next;
 }
 next.equipSnapshot={categories:result.categories};
 // Rebuild the visible story from the same authoritative Core snapshot as the options.
 // Keeping menu.story from the pre-action snapshot lied about the equipped item.
 next.story=equipLiveStory(result.categories,models);
 next.options.push(...equipOptions(result.categories,models));
 return next;
}
function slotSummary(slots){
 const parts=[];for(const [key,label] of [['weapons','armas'],['armors','proteções'],['potions','poções'],['objects','objetos']]){const n=slots?.[key];if(isInt(n))parts.push(`${label}: ${n}`)}
 return parts.length?'Espaços · '+parts.join(' · '):'Espaços: não informados';
}
module.exports={resolveCommand,renderPacket,slotSummary,fightHistory,enrichEquipMenu,verifyEquipIntent,refreshEquipMenu,validCategories,equipOptions};
