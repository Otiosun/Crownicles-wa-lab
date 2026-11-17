'use strict';
/**
 * Adaptador de notificações de jogo do Crownicles 6.2.0.b.
 * Fonte: Lib/src/packets/events/MissionsCompletedPacket.ts, tipos CompletedMission;
 * Lib/src/packets/smallEvents/SmallEventAdvanceTimePacket.ts (amount em minutos).
 * Não concede moedas, não avança relógios e não inventa o conteúdo de eventos.
 */
const {missName}=require('./lote02.cjs');
const numeric=(v)=>typeof v==='number'&&Number.isFinite(v)?v:null;
const fmt=v=>numeric(v)===null?'—':Math.trunc(v).toLocaleString('pt-BR');
const typeLabels={campaign:'Campanha',daily:'Diária',sideMission:'Secundária'};
function renderMissionCompleted(packet,models){
 if(!packet||!Array.isArray(packet.missions)||packet.missions.length===0)return null;
 const ms=packet.missions;
 const parts=[`*✦ ${ms.length===1?'MISSÃO CONCLUÍDA':'MISSÕES CONCLUÍDAS'}*`];
 const totals={points:0,xp:0,money:0,gems:0};
 for(const m of ms){
  const kind=typeLabels[m.missionType]||'Missão';
  const title=missName(models,m);
  parts.push(`✓ ${kind} · ${title}`);
  for(const [field,src] of [['points','pointsToWin'],['xp','xpToWin'],['money','moneyToWin'],['gems','gemsToWin']]){
   const value=numeric(m[src]);if(value!==null && value>=0)totals[field]+=value;
  }
 }
 const rewards=[['Pontos',totals.points],['XP',totals.xp],['Moedas',totals.money],['Gemas',totals.gems]]
  .filter(([,v])=>v>0).map(([k,v])=>`${k}: +${fmt(v)}`);
 if(rewards.length)parts.push('', '*Recompensas recebidas*',rewards.join(' · '));
 else parts.push('','Nenhuma recompensa numérica informada pelo motor.');
 if(packet.nextCampaignMission){parts.push('',`Próxima missão da campanha: ${missName(models,packet.nextCampaignMission)}`)}
 if(Array.isArray(packet.discoveredRecipes)&&packet.discoveredRecipes.length){
  parts.push('',`Receitas desbloqueadas: ${packet.discoveredRecipes.length}`);
  // O backend traz IDs e níveis; a UI não imprime IDs ou inventa nomes.
  // A apresentação detalhada das receitas depende do catálogo validado.
 }
 return parts.join('\n');
}
function renderTimeAdvance(packet){
 const minutes=numeric(packet?.amount);
 if(minutes===null||!Number.isInteger(minutes)||minutes<=0)return '*✦ ACONTECIMENTO NA ESTRADA*\nO tempo da viagem foi alterado. Consulte /mapa para ver seu destino.';
 return `*✦ ACONTECIMENTO NA ESTRADA*\nVocê ganhou *${fmt(minutes)} ${minutes===1?'minuto':'minutos'}* na jornada.\n\nO Crownicles já aplicou esse avanço ao tempo de viagem.`;
}
module.exports={renderMissionCompleted,renderTimeAdvance};
