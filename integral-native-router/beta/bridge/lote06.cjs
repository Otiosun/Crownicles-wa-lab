'use strict';
/**
 * Lote 06 — consultas e escolhas oficiais de Crownicles 6.2.0.b.
 * Uma camada de apresentação/transporte: nenhuma regra, moeda, RNG,
 * XP ou estado de jogo é calculado/escrito aqui.
 * Contratos conferidos em Lib/src/packets/commands e Core/src/commands/player
 * da tag imutável 6.2.0.b.
 */
const {safe}=require('./lote04.cjs');
const {rankingNavigation}=require('./lote07.cjs');
const cmd=(name,data={})=>({name,data});
const num=v=>Number.isFinite(v)?v.toLocaleString('pt-BR'):'—';
const valid=n=>Number.isFinite(n)&&n>=0;
const rankTypes={pontos:'Score',gloria:'Glory',guildas:'Guild'};
const rankTimes={geral:'AllTime',semanal:'Week'};

function resolveCommand(line){
 const words=String(line||'').trim().toLocaleLowerCase('pt-BR').split(/\s+/);
 const [name,...args]=words;
 if(['/raridade','/raridades','/chances'].includes(name))return args.length?null:cmd('CommandRarityPacketReq');
 if(['/bencao','/benção','/oraculo','/oráculo'].includes(name))return args.length?null:cmd('CommandBlessingPacketReq');
 if(['/jardim','/horta'].includes(name))return args.length?null:cmd('CommandGardenPacketReq');
 if(['/defesa','/defender'].includes(name))return args.length?null:cmd('CommandDefensePacketReq');
 if(['/ranking','/top'].includes(name)){
   if(args.length>3)return null;
   const type=args[0]||'pontos',time=args[1]||(type==='gloria'?'semanal':'geral'),rawPage=args[2]||'1';
   if(!Object.hasOwn(rankTypes,type)||!Object.hasOwn(rankTimes,time)||((type==='gloria'&&time!=='semanal')||(type==='guildas'&&time!=='geral'))||!/^[1-9][0-9]?$/.test(rawPage))return null;
   return cmd('CommandTopPacketReq',{dataType:rankTypes[type],timing:rankTimes[time],page:Number(rawPage)});
 }
 return null;
}

const rarityNames=['Básico','Comum','Incomum','Exótico','Raro','Especial','Épico','Lendário','Mítico'];
function rarityResult(p){
 if(!Array.isArray(p.rarities)||p.rarities.length!==rarityNames.length||p.rarities.some(v=>!valid(v)||v>100))return '*✦ RARIDADES*\nProbabilidades indisponíveis neste momento.';
 const lines=['*✦ RARIDADES*','Distribuição base informada pelo motor:'];
 for(let i=1;i<rarityNames.length;i++)lines.push(`${rarityNames[i]}: ${p.rarities[i].toLocaleString('pt-BR',{maximumFractionDigits:4})}%`);
 lines.push('','Probabilidades gerais de geração; não são garantia de resultado em cada evento.');
 return lines.join('\n');
}
const blessingNames=['Nenhuma bênção ativa','Fúria amplificada','Espólios de combate','Regeneração de energia','Bônus de moedas','Bônus de pontos','Afinidade com companheiros','Cura ampliada','Token de expedição','Missão diária'];
function hoursRemaining(ts){if(!Number.isFinite(ts)||ts<1e12)return null;return Math.max(0,Math.ceil((ts-Date.now())/60000));}
function blessingResult(p){
 const type=p.activeBlessingType;
 if(!Number.isInteger(type)||type<0||type>=blessingNames.length)return '*✦ BÊNÇÃO*\nO estado do oráculo não pôde ser interpretado.';
 const lines=['*✦ BÊNÇÃO DO ORÁCULO*',blessingNames[type]];
 if(type>0){const left=hoursRemaining(p.blessingEndAt);if(left!==null)lines.push(`Duração restante: ${num(left)} min`)}
 else if(valid(p.poolAmount)&&valid(p.poolThreshold)){
  lines.push(`Contribuições: ${num(p.poolAmount)} / ${num(p.poolThreshold)} moedas`);
  if(Number.isInteger(p.totalContributors)&&p.totalContributors>=0)lines.push(`Participantes: ${num(p.totalContributors)}`);
  const left=hoursRemaining(p.poolExpiresAt);if(left!==null)lines.push(`Prazo da arrecadação: ${num(left)} min`);
 }
 return lines.join('\n');
}
const types={CommandTopPacketResScore:'PONTOS',CommandTopPacketResGlory:'GLÓRIA',CommandTopPacketResGuild:'GUILDAS'};
function rankingResult(name,p){
 const kind=types[name];if(!kind)return null;
 const period=p.timing==='Week'?'SEMANA':p.timing==='AllTime'?'GERAL':'PERÍODO NÃO INFORMADO';
 const lines=[`*✦ RANKING · ${kind} · ${period}*`];
 if(!Array.isArray(p.elements))return lines.concat('Dados indisponíveis neste momento.').join('\n');
 for(const element of p.elements.slice(0,25)){
  if(!Number.isInteger(element?.rank)||element.rank<1)continue;
  // TopUtils expõe keycloakId em text para Score/Glory; nunca publicar o ID.
  // Para guildas, o mesmo campo contém o nome público da guilda.
  const label=kind==='GUILDAS'?(safe(element.text,72).replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,'').replace(/\b\d{10,}\b/g,'').trim()||'Guilda'):(element.sameContext===true?'Você':'Viajante');
  const primary=kind==='GUILDAS'?element.attributes?.[1]:element.attributes?.[2];
  const score=valid(primary)?` · ${kind==='GLÓRIA'?'glória':'pontos'}: ${num(primary)}`:'';
  const guildLevel=kind==='GUILDAS'&&valid(element.attributes?.[2])?` · nível ${num(element.attributes[2])}`:'';
  lines.push(`${element.rank}. ${label}${score}${guildLevel}`);
 }
 if(lines.length===1)lines.push('Nenhuma posição nesta página.');
 if(valid(p.pageNumber)&&valid(p.totalElements))lines.push('',`Página ${num(p.pageNumber)} · ${num(p.totalElements)} participantes no total`);
 if(Number.isInteger(p.contextRank)&&p.contextRank>0&&p.canBeRanked===true)lines.push(`Sua posição: ${num(p.contextRank)}º`);
 lines.push(...rankingNavigation(kind,p));
 lines.push('Modos: pontos (geral/semanal), glória (semanal), guildas (geral).');
 return lines.join('\n');
}
const personalities={
 knightStrategist:'Estratégica',knightEnduring:'Resistente',knightFiery:'Ofensiva',
 tankBulwark:'Bastião',tankRiposte:'Contra-ataque',
 paladinCrusader:'Cruzada',paladinJusticar:'Justa',
 gunnerStrategist:'Estratégica',gunnerBombardier:'Bombardeio',
 veteranStrategist:'Estratégica',veteranCharger:'Investida',
 mageOccultist:'Ocultista',magePyromancer:'Piromante',mageWarlock:'Bruxaria'
};
function defenseOption(r){
 if(r?.type==='ReactionCollectorRefuseReaction')return {label:'Manter a defesa atual',supported:true,requiresConfirmation:false};
 if(r?.type!=='ReactionCollectorDefensePersonalityReaction')return {label:'',supported:false,requiresConfirmation:false};
 const value=r?.data?.personality;
 if(value===undefined)return {label:'Defesa variável em cada combate',supported:true,requiresConfirmation:true};
 if(typeof value!=='string'||!Object.hasOwn(personalities,value))return {label:'',supported:false,requiresConfirmation:false};
 return {label:`Defesa ${personalities[value]}`,supported:true,requiresConfirmation:true};
}
function renderPacket(name,p){
 switch(name){
  case 'CommandRarityPacketRes':return rarityResult(p);
  case 'CommandBlessingPacketRes':return blessingResult(p);
  case 'RequirementOracleNotMetPacket':return '*✦ ORÁCULO*\nO oráculo só poderá ser consultado depois que você encontrar o altar durante sua jornada.';
  case 'CommandTopPacketResScore':case 'CommandTopPacketResGlory':case 'CommandTopPacketResGuild':return rankingResult(name,p);
  case 'CommandTopPlayersEmptyPacket':return '*✦ RANKING*\nAinda não há jogadores para este quadro.';
  case 'CommandTopGuildsEmptyPacket':return '*✦ RANKING DE GUILDAS*\nAinda não há guildas para este quadro.';
  case 'CommandGardenNoAccessRes':return ({noHome:'*✦ HORTA*\nVocê ainda não possui uma casa com horta.',noGarden:'*✦ HORTA*\nSua casa ainda não tem uma horta disponível.',noTalisman:'*✦ HORTA*\nVocê precisa estar em casa ou possuir o talismã necessário para acessar a horta à distância.'})[p.reason]||'*✦ HORTA*\nAcesso indisponível nas condições atuais.';
  case 'CommandGardenClosedRes':return '*✦ HORTA*\nVocê encerrou a consulta à horta.';
  case 'CommandDefenseNoChoicePacketRes':return '*✦ DEFESA*\nSua classe possui apenas uma forma de defesa automática.';
  case 'CommandDefenseCancelPacketRes':return '*✦ DEFESA*\nA alteração da defesa não foi realizada.';
  case 'CommandDefenseChangeSuccessPacketRes':return `*✦ DEFESA ATUALIZADA*\n${p.personality===undefined?'O motor escolherá uma defesa variável em cada combate.':Object.hasOwn(personalities,p.personality)?'Estratégia: '+personalities[p.personality]:'Estratégia salva pelo motor.'}`;
  default:return null;
 }
}
// Overlay editorial isolado: na fonte original pt/en, "município"/"municipality"
// aparece no rótulo do material de raridade 1. O enum canônico é COMMON = 1,
// UNCOMMON = 2, RARE = 3; nunca editar os IDs ou os JSON do upstream.
function editorialModels(models){
 const source=models&&typeof models==='object'?models:{};
 return {...source,materialRarityNames:{...(source.materialRarityNames||{}),'1':'Comum','2':'Incomum','3':'Raro'}};
}
module.exports={resolveCommand,renderPacket,defenseOption,editorialModels,rankTypes,rankTimes};
