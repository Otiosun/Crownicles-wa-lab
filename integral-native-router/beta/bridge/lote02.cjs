'use strict';
/**
 * Integração incremental de seis contratos OFICIAIS de Crownicles 6.2.0.b.
 * Esta camada não acessa DB, não executa compras/alterações, não faz rede.
 * Os requests são entregues exclusivamente ao Core existente pelo Gateway.
 * Nenhuma função recebe um keycloakId da mensagem do usuário: a identidade
 * sempre vem do vínculo autorizado já existente.
 */
const {classLabel}=require('./lote05.cjs');
const aliases = new Map([
  ['/missoes', 'missions'], ['/missões', 'missions'],
  ['/pet','pet'], ['/mascote','pet'],
  ['/guilda','guild'], ['/gremio','guild'], ['/grêmio','guild'],
  ['/classes','classes'],
  ['/historico','history'], ['/histórico','history'], ['/combates','history'],
  ['/mapa','map'],
]);
const simple = (name,data={})=>({name,data});
function resolveCommand(line,playerId){
  const operation=aliases.get(String(line).trim().toLocaleLowerCase('pt-BR'));
  if(!operation) return null;
  if(typeof playerId!=='string'||!playerId.trim())throw Error('ID interno de jogador inválido');
  const asked={askedPlayer:{keycloakId:playerId}};
  switch(operation){
    case 'missions':return simple('CommandMissionsPacketReq',asked);
    case 'pet':return simple('CommandPetPacketReq',asked);
    case 'guild':return simple('CommandGuildPacketReq',asked);
    case 'classes':return simple('CommandClassesInfoPacketReq');
    case 'history':return simple('CommandFightHistoryPacketReq');
    case 'map':return simple('CommandMapPacketReq',{language:'pt'});
    default:return null;
  }
}
const fmt=n=>Number.isFinite(n)?new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(n):'—';
// Elimina controle e sintaxe de formatação de texto fornecido por usuários;
// NÃO mostra UUID, LIDs ou nomes de pacote no WhatsApp.
const safe=(v,max=160)=>String(v??'').replace(/[\x00-\x1f\x7f]/g,' ').replace(/[*_~`]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
function label(models,group,id,alt='Não identificado'){
 const candidate=models?.[group]?.[String(id)];
 return safe(typeof candidate==='string'?candidate:candidate?.name??alt,120)||alt;
}
function missName(models,mission){
  const total=Number(mission.missionObjective), key=String(mission.missionId??'');
  const suffix=total===1?'_one':'_other';
  if (key==='commandReport') return 'Realizar uma aventura';
  if (key==='commandMission') return 'Consultar suas missões';
  const template=models?.missions?.[key+suffix]??models?.missions?.[key];
  if(typeof template!=='string')return 'Missão em andamento';
  // Renderização defensiva: não aplicar interpolação de i18next genérica;
  // texto que demanda variáveis adicionais será mostrado sem inventá-las.
  const rendered=template.replace(/\{\{count\}\}/g,fmt(total))
    .replace(/\{\{[^}]+\}\}/g,'')
    .replace(/\{(?:emote|command):[^}]+\}/g,'')
    .replace(/\$t\([^)]*\)/g,'');
  return safe(rendered,140)||'Missão em andamento';
}
const missionKind={campaign:'Campanha',daily:'Diária',sideMission:'Secundária'};
function missions(packet,models){
 if(!Array.isArray(packet.missions))return '*✦ MISSÕES*\nNão foi possível carregar os objetivos.';
 const total=packet.missions.length;
 const rows=packet.missions.slice(0,18).map((m,i)=>{
   const kind=missionKind[m.missionType]||'Missão';
   const goal=Number.isFinite(m.missionObjective)?m.missionObjective:0;
   const done=Number.isFinite(m.numberDone)?m.numberDone:0;
   const name=missName(models,m);
   return `${i+1}. ${kind} · ${name}\n   ${fmt(done)}/${fmt(goal)}`;
 });
 return ['*✦ MISSÕES*',`${fmt(total)} objetivo(s) registrado(s).`,
   Number.isFinite(packet.campaignProgression)&&Number.isFinite(packet.maxCampaignNumber)
   ?`Campanha: ${fmt(packet.campaignProgression)}/${fmt(packet.maxCampaignNumber)}`:null,
   '', ...(rows.length?rows:['Nenhuma missão ativa.']),
   total>rows.length?`\nMais ${fmt(total-rows.length)} objetivo(s) não exibido(s) nesta página.`:null
 ].filter(x=>x!==null).join('\n');
}
function pet(packet,models){
 const p=packet.pet;
 if(!p||typeof p!=='object')return '*✦ COMPANHEIRO*\nNenhuma mascote encontrada.';
 const sex=String(p.sex??'').toLowerCase();
 const key=`${p.typeId}_${/^(f|female)$/.test(sex)?'female':'male'}`;
 const species=label(models,'pets',key,'Espécie não identificada');
 const title=safe(p.nickname,55)||species;
 const rows=['*✦ COMPANHEIRO*',`${title} · ${species}`,'',
   `Raridade: ${fmt(p.rarity)}`,`Afinidade: ${fmt(p.loveLevel)}`,`Força: ${fmt(p.force)}`];
 if(packet.expeditionInProgress&&Number.isFinite(packet.expeditionInProgress.endTime)) {
   const end=Number(packet.expeditionInProgress.endTime);
   const time=end<1e11?end*1000:end;
   const min=Math.max(0,Math.ceil((time-Date.now())/60000));
   rows.push('',`Expedição: ${fmt(min)} min restantes (estimativa)`);
 }
 return rows.join('\n');
}
function guild(packet){
 if(packet.foundGuild!==true||!packet.data)return '*✦ GUILDA*\nVocê não participa de uma guilda.';
 const d=packet.data;
 const rows=['*✦ GUILDA*',safe(d.name,70)||'Guilda sem nome',
   safe(d.description,180)||null,'',
   `Nível: ${fmt(d.level)}`,
   d.experience?`Experiência: ${fmt(d.experience.value)}/${fmt(d.experience.max)}`:null,
   `Integrantes: ${Array.isArray(d.members)?fmt(d.members.length):'—'}`,
   Number.isFinite(d.rank?.rank)&&d.rank?.unranked===false?`Posição: ${fmt(d.rank.rank)}º`:null];
 return rows.filter(x=>x!==null).join('\n');
}
function classes(packet,models){
 const cs=packet.data?.classesStats;
 if(!Array.isArray(cs))return '*✦ CLASSES*\nInformações indisponíveis neste momento.';
 if(!cs.length)return '*✦ CLASSES*\nNenhuma classe disponível nas condições atuais.';
 const rows=cs.slice(0,30).map(c=>{
   const name=classLabel(c.id,label(models,'classes',c.id,'Classe não identificada'));
   const st=c.stats||{};
   const info=[['ATQ',st.attack],['DEF',st.defense],['VEL',st.speed],['VID',st.health]].filter(([,v])=>Number.isFinite(v)).map(([a,b])=>`${a} ${fmt(b)}`).join(' · ');
   return `${safe(name,65)}${info?`\n   ${info}`:''}`;
 });
 return ['*✦ CLASSES*',`${fmt(cs.length)} classe(s) oferecida(s) pelo motor.`,...rows].join('\n');
}
const results=new Map([[0,'Derrota'],[0.5,'Empate'],[1,'Vitória']]);
function history(packet){
 const list=packet.history;
 if(!Array.isArray(list))return '*✦ HISTÓRICO DE COMBATES*\nHistórico indisponível.';
 const last=list.slice(0,10);
 const rows=last.map((fight,i)=>{
  const r=results.get(fight.result)||'Resultado registrado';
  const change=fight.glory?.change?.me;
  const glory=Number.isFinite(change)?` · Glória ${change>=0?'+':''}${fmt(change)}`:'';
  return `${i+1}. ${r}${glory}`;
 });
 return ['*✦ HISTÓRICO DE COMBATES*',`${fmt(list.length)} luta(s) no histórico.`, '',...(rows.length?rows:['Nenhum combate registrado.'])].join('\n');
}
function map(packet,models){
 if(!Number.isInteger(packet.mapId))return '*✦ MAPA*\nLocalização indisponível.';
 const name=label(models,'map_locations',packet.mapId,'Localização não identificada');
 const mode=packet.hasArrived?'Você chegou ao destino.':'Você está a caminho.';
 return ['*✦ MAPA*',name,'',mode].join('\n');
}
function renderPacket(name,packet,models){
 switch(name){
  case 'CommandMissionsPacketRes': return missions(packet,models);
  case 'CommandMissionPlayerNotFoundPacket':return '*✦ MISSÕES*\nPersonagem ainda não iniciado. Envie /jogar para começar sua aventura.';
  case 'CommandPetPacketRes':return pet(packet,models);
  case 'CommandPetPetNotFound':return '*✦ COMPANHEIRO*\nVocê ainda não possui mascote.';
  case 'CommandGuildPacketRes':return guild(packet);
  case 'CommandClassesInfoPacketRes':return classes(packet,models);
  case 'CommandFightHistoryPacketRes':return history(packet);
  case 'CommandMapDisplayRes':return map(packet,models);
  default:return null;
 }
}
module.exports={resolveCommand,renderPacket,missName};
