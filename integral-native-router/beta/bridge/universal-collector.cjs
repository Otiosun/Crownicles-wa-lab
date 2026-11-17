'use strict';
/**
 * Protótipo NÃO conectado ao WhatsApp live. Motor de apresentação de coletores
 * originais Crownicles 6.2.0.b. Não executa mutações, não envia pacotes MQTT.
 * O executor de reações da ponte existente permanece responsável por identidade,
 * nonce, deduplicação, validade do menu e roteamento ao Core.
 * Tipos não explicitamente reconhecidos: fail-closed.
 */

const num=(value)=>Number.isSafeInteger(value)&&value>=0?value.toLocaleString('pt-BR'):null;
const clean=(value,max=60)=>typeof value==='string'?value.replace(/[\r\n\t*`_~<>@]/g,' ').replace(/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/gi,'').replace(/\s+/g,' ').trim().slice(0,max):'';
const safePositive=(value)=>Number.isSafeInteger(value)&&value>0;
const refuse='ReactionCollectorRefuseReaction';
const accept='ReactionCollectorAcceptReaction';

/** Each binary rule validates the actual fields of the authoritative Core payload. */
const binaryRules=Object.freeze({
 ReactionCollectorGoToPVEIslandData:{
  title:'✦ VIAGEM À ILHA PVE',
  validate:d=>safePositive(d.price)&&num(d.energy?.current)!==null&&num(d.energy?.max)!==null&&d.energy.current<=d.energy.max,
  accept:d=>`Confirmar viagem à ilha · custo informado: ${num(d.price)} (moeda definida pelo Core)`,
  story:d=>`Energia ${num(d.energy.current)}/${num(d.energy.max)}. A viagem pode alterar seus recursos; confira o custo e confirme antes de viajar.`
 },
 ReactionCollectorBuyHealData:{
  title:'✦ TRATAMENTO',
  validate:d=>safePositive(d.healPrice)&&num(d.playerMoney)!==null,
  accept:d=>`Comprar tratamento · ${num(d.healPrice)} moedas`,
  story:d=>`Saldo informado: ${num(d.playerMoney)} moedas. O Core decidirá se o tratamento é possível.`,
  allowed:d=>d.playerMoney>=d.healPrice
 },
 ReactionCollectorCartData:{
  title:'✦ TRANSPORTE',
  validate:d=>safePositive(d.price)&&d.displayedDestination&&typeof d.displayedDestination.isDisplayed==='boolean',
  accept:d=>`Aceitar transporte · custo informado: ${num(d.price)} (unidade a confirmar no Core)`,
  story:()=>`Você pode embarcar para outra região. A opção confirmada poderá cobrar recursos e mudar seu destino.`
 },
 ReactionCollectorGuildCreateData:{
  title:'✦ CRIAR GUILDA',
  validate:d=>clean(d.guildName,45).length>=1&&clean(d.guildName,45)===d.guildName.trim(),
  accept:d=>`Criar guilda ${clean(d.guildName,45)}`,
  story:()=>`Criar uma guilda muda seu vínculo social. O pacote não informa custos; nenhum preço deve ser presumido.`
 },
 ReactionCollectorGuildLeaveData:{
  title:'✦ SAIR DA GUILDA',
  validate:d=>clean(d.guildName,45).length>=1&&typeof d.isGuildDestroyed==='boolean',
  accept:d=>d.isGuildDestroyed?`Sair e DISSOLVER a guilda ${clean(d.guildName,45)}`:`Sair da guilda ${clean(d.guildName,45)}`,
  story:d=>d.isGuildDestroyed?'ATENÇÃO: esta saída pode destruir a guilda. A confirmação é irreversível.':'Sair altera sua associação. A liderança e os efeitos são definidos pelo Core.'
 }
});

function binary(kind,reactions,data){
 const rule=binaryRules[kind];if(!rule||!rule.validate(data))return null;
 if(reactions.length!==2||reactions.filter(r=>r?.type===accept).length!==1||reactions.filter(r=>r?.type===refuse).length!==1)return null;
 if(reactions.some(r=>!r.data||typeof r.data!=='object'||Array.isArray(r.data)||Object.keys(r.data).length!==0))return null;
 const options=reactions.map(reaction=>{
  if(reaction?.type===refuse)return {label:'Cancelar e permanecer',supported:true,requiresConfirmation:false};
  if(reaction?.type===accept&&(!rule.allowed||rule.allowed(data)))return {label:rule.accept(data),supported:true,requiresConfirmation:true};
  return {label:'Indisponível',supported:false,requiresConfirmation:false};
 });
 return {title:rule.title,story:rule.story(data),options};
}

function tokenMerchant(reactions,data){
 if(!safePositive(data.pricePerToken)||num(data.playerMoney)===null||num(data.playerTokens)===null||!Array.isArray(data.amounts)||data.amounts.length>50)return null;
 if(data.amounts.some(x=>!safePositive(x))||new Set(data.amounts).size!==data.amounts.length)return null;
 if(reactions.length!==data.amounts.length+1||reactions.filter(r=>r?.type===refuse).length!==1)return null;
 const observed=reactions.filter(r=>r?.type==='ReactionCollectorTokenMerchantBuyReaction').map(r=>r.data?.amount);
 if(observed.length!==data.amounts.length||new Set(observed).size!==data.amounts.length||observed.some(x=>!data.amounts.includes(x)))return null;
 const options=reactions.map(reaction=>{
  if(reaction?.type===refuse)return {label:'Não comprar tokens',supported:true,requiresConfirmation:false};
  if(reaction?.type!=='ReactionCollectorTokenMerchantBuyReaction')return {label:'Indisponível',supported:false,requiresConfirmation:false};
  const amount=reaction.data?.amount;
  if(!data.amounts.includes(amount))return {label:'Indisponível',supported:false,requiresConfirmation:false};
  const price=amount*data.pricePerToken;
  if(!Number.isSafeInteger(price)||price>data.playerMoney)return {label:'Indisponível',supported:false,requiresConfirmation:false};
  return {label:`Comprar ${num(amount)} token(s) por ${num(price)} moedas`,supported:true,requiresConfirmation:true};
 });
 return {title:'✦ MERCADOR DE TOKENS',story:`Seu saldo: ${num(data.playerMoney)} moedas · tokens atuais: ${num(data.playerTokens)}. O Core revalidará os limites e preços.`,options};
}

/** Deixe opções sem custo ou efeitos publicados BLOQUEADAS por padrão. */
function lottery(reactions,data){
 if(data==null||typeof data!=='object'||Array.isArray(data))return null;
 const expected=['ReactionCollectorLotteryEasyReaction','ReactionCollectorLotteryMediumReaction','ReactionCollectorLotteryHardReaction'];
 if(reactions.length!==3||expected.some(t=>reactions.filter(r=>r?.type===t).length!==1))return null;
 const labels={ReactionCollectorLotteryEasyReaction:'Desafio leve',ReactionCollectorLotteryMediumReaction:'Desafio médio',ReactionCollectorLotteryHardReaction:'Desafio difícil'};
 return {title:'✦ JOGO DOS CÁLICES',story:'As consequências e os custos das três escolhas ainda não foram verificados. Nenhuma opção será executada nesta versão.',options:reactions.map(r=>({label:labels[r?.type]||'Indisponível',supported:false,requiresConfirmation:false}))};
}

function compileCollector(packet){
 if(!packet||typeof packet!=='object'||!Array.isArray(packet.reactions)||packet.reactions.length===0||packet.reactions.length>100||!packet.data||typeof packet.data!=='object')return null;
 const kind=packet.data.type,data=packet.data.data;
 if(!data||typeof data!=='object'||Array.isArray(data))return null;
 let result;if(binaryRules[kind])result=binary(kind,packet.reactions,data);
 else if(kind==='ReactionCollectorTokenMerchantData')result=tokenMerchant(packet.reactions,data);
 else if(kind==='ReactionCollectorLotteryData')result=lottery(packet.reactions,data);
 if(!result||result.options.length!==packet.reactions.length)return null;
 // No callback ever returns input-defined index/identifier; the original
 // array position remains the only source of truth, as in the L11 Gateway.
 return Object.freeze({kind,title:result.title,story:result.story,options:result.options});
}
module.exports={compileCollector,binaryRules,clean};
