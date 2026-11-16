'use strict';
const fs=require('node:fs');const path=require('node:path');
const {renderPacket}=require('./lote02.cjs');
const {renderMissionCompleted,renderTimeAdvance}=require('./lote03.cjs');
const {classLabel,tokenBalance}=require('./lote05.cjs');
const {renderPacket:renderLote06,defenseOption,editorialModels}=require('./lote06.cjs');
const {renderPacket:renderLote07,sellOption,petFeedOption,feedStory,sellStory,gardenStory}=require('./lote07.cjs');
const {renderPacket:renderLote08,parseOption:optionLote08,story:storyLote08,titles:titlesLote08}=require('./lote08.cjs');
const {renderPacket:renderLote09,slotSummary,enrichEquipMenu}=require('./lote09.cjs');
const {renderPacket:renderLote10}=require('./lote10.cjs');
const {renderPacket:renderLote11,collectorOption:optionLote11,collectorStory:storyLote11}=require('./lote11.cjs');
const {cityOption,shopOption,encounterOption,additionalOption,notification}=require('./lote04.cjs');
const {compileCollector,isKnownKind}=require('./universal-collector-v3.cjs');
const {renderResponse:renderNativeResponse}=require('./native-universal.cjs');
const fx={none:'Normal',occupied:'Ocupado',sleeping:'Dormindo',drunk:'Embriagado',freezing:'Congelado',feetHurt:'Pés feridos',hurt:'Machucado',sick:'Doente',jailed:'Preso',injured:'Ferido',starving:'Faminto',confounded:'Confuso',scared:'Assustado',lost:'Perdido',dead:'Morto',notStarted:'Não iniciado'};
const clean=x=>String(x||'').replace(/\{emote:[^}]+\}/g,'').replace(/\{command:report\}/g,'/aventura').replace(/DraftBot/gi,'o reino').replace(/\$t\([^)]*\)/g,'').replace(/\s+/g,' ').trim();
const fmtCost=n=>Number.isFinite(n)?`${n.toLocaleString('pt-BR')} moedas`:'valor desconhecido';
const tleft=end=>Number.isFinite(end)?Math.max(0,Math.ceil((end-Date.now())/60000)):null;
class Presenter{
 constructor(langDir){this.universalLab=process.env.CROWNICLES_WA_UNIVERSAL_COLLECTORS==='lab'&&process.env.CROWNICLES_WA_LAB_ISOLATED==='SIM_ISOLADO'&&!String(process.env.WA_BAILEYS_SEND_MODE||'').trim();this.allowEquipActions=process.env.CROWNICLES_WA_EQUIP_ACTIONS==='enabled';this.langDir=langDir;this.events=this.load('events.json');this.models=editorialModels(this.load('models.json'))}
 load(name){try{return JSON.parse(fs.readFileSync(path.join(this.langDir,name),'utf8'))}catch{return {}}}
 name(k,id,def='Desconhecido'){const v=this.models[k]?.[String(id)];const raw=clean(typeof v==='string'?v:v?.name)||def;return k==='classes'?classLabel(id,raw):raw}
 menu(p){const kind=p.data?.type;const d=p.data?.data||{};
 if(this.universalLab){const compiled=compileCollector(p);if(compiled)return {id:p.id,endTime:p.endTime,type:compiled.kind,title:compiled.title,story:compiled.story,options:compiled.options};if(isKnownKind(kind))return {id:p.id,endTime:p.endTime,type:kind,title:'⚠️ DADOS INCONSISTENTES',story:'O menu recebido não passou na validação do contrato original. Nenhuma opção será enviada ao Core.',options:(Array.isArray(p.reactions)?p.reactions:[]).slice(0,100).map(()=>({label:'Indisponível: menu inválido',supported:false,requiresConfirmation:false}))};}
 let title='📜 ESCOLHA';let story='Uma decisão exige sua atenção.';
 const label=r=>{const v=r.data||{};if(kind==='ReactionCollectorBigEventData')return clean(this.events[String(d.eventId)]?.possibilities?.[v.name]?.text)|| (v.name==='end'?'Continuar':null);
 if(kind==='ReactionCollectorChooseDestinationData'){if(r.type==='ReactionCollectorChooseDestinationReaction'&&Number.isInteger(v.mapId))return 'Ir para '+this.name('map_locations',v.mapId,`local #${v.mapId}`)+(Number.isFinite(v.tripDuration)?` (${v.tripDuration} min)`:'');if(r.type==='ReactionCollectorStayInCityReaction')return 'Permanecer na cidade';return null}
 if(kind==='ReactionCollectorRecipeShopSmallEventData'){if(r.type==='ReactionCollectorRefuseReaction')return 'Recusar a oferta';if(r.type==='ReactionCollectorAcceptReaction'&&Number.isFinite(d.recipeCost)&&d.recipe?.recipeId)return 'Comprar por '+fmtCost(d.recipeCost);return null}
 if(kind==='ReactionCollectorCityData'){if(r.type==='ReactionCollectorExitCityReaction')return 'Sair da cidade e viajar';if(r.type==='ReactionCollectorRefuseReaction')return 'Permanecer na cidade';return null}
 if(r.type==='ReactionCollectorRefuseReaction')return 'Recusar e continuar';return null};
 if(kind==='ReactionCollectorBigEventData'){title=`📜 EVENTO ${d.eventId}`;story=clean(this.events[String(d.eventId)]?.text)||'Uma situação inesperada surge na jornada.'}
 else if(kind==='ReactionCollectorChooseDestinationData'){title='🗺️ ESCOLHA SEU DESTINO';story='Escolha um caminho ou permaneça na cidade.'}
 else if(kind==='ReactionCollectorCityData'){title=d.gardenOnly?'✦ HORTA':'✦ SERVIÇOS DA CIDADE';story=d.gardenOnly?gardenStory(d):'Escolha um dos serviços disponíveis na cidade.'}
 else if(kind==='ReactionCollectorRecipeShopSmallEventData'){title='🍲 OFERTA DE RECEITA';story=`Receita: ${clean(this.models.cooking?.recipes?.[String(d.recipe?.recipeId)])||String(d.recipe?.recipeId||'desconhecida')}\nPreço: ${fmtCost(d.recipeCost)}`}
 else{title='⚠️ ESCOLHA AINDA NÃO SUPORTADA';story='O motor apresentou uma decisão que a versão WhatsApp ainda não descreve por completo.'}
 if(Object.hasOwn(titlesLote08,kind)){title=titlesLote08[kind];story=storyLote08(kind,d,this.models)}
 if(kind==='ReactionCollectorDefensePersonalityData'){title='✦ SUA DEFESA';story='Escolha o comportamento usado pelo motor ao defender seu personagem em combates. A alteração exige confirmação.'}
 if(kind==='ReactionCollectorShopData'){title='✦ MERCADO';story='Selecione uma oferta. Compras exigem confirmação antes de ir ao motor.'}
 if(kind==='ReactionCollectorSellData'){title='✦ VENDA DE ITENS';story=sellStory()}
 if(['ReactionCollectorPetFeedWithGuildData','ReactionCollectorPetFeedWithoutGuildData'].includes(kind)){title='✦ ALIMENTAR COMPANHEIRO';story=feedStory(kind,d)}
 if(['ReactionCollectorBuyCategorySlotData','ReactionCollectorItemAcceptData','ReactionCollectorUseTokensData'].includes(kind)){title='✦ ESCOLHA DE ITEM';story='Selecione uma ação. Itens, custos e efeitos exigem confirmação explícita.'}
 if(kind==='ReactionCollectorPveFightData'){title='⚔️ CONFRONTO';const monster=d.monster||{};story=`Um inimigo de nível ${Number.isInteger(monster.level)?monster.level:'?'} bloqueia o caminho. Aceitar inicia um combate.`}
 if(kind==='ReactionCollectorFightData'){title='⚔️ DESAFIO';story='Você recebeu uma proposta de combate. Aceitar pode alterar sua progressão.'}
 if(kind==='ReactionCollectorFightChooseActionData'){title='⚔️ ESCOLHA DE COMBATE';story='Selecione uma ação de combate disponível no motor.'}
 if(kind==='ReactionCollectorChangeClassData'){title='✦ MUDAR DE CLASSE';story=storyLote11(kind,d)}
 if(kind==='ReactionCollectorJoinBoatData'){title='✦ EMBARQUE NA ILHA';story=storyLote11(kind,d)}
 const options=(p.reactions||[]).map((r,i)=>{
   let opt;
   if(['ReactionCollectorChangeClassData','ReactionCollectorJoinBoatData'].includes(kind))opt=optionLote11(kind,r,d,this.models);
   else if(Object.hasOwn(titlesLote08,kind))opt=optionLote08(kind,r,d,this.models);
   else if(kind==='ReactionCollectorCityData')opt=cityOption(r,d,this.models);
   else if(kind==='ReactionCollectorSellData')opt=sellOption(r,this.models);
   else if(['ReactionCollectorPetFeedWithGuildData','ReactionCollectorPetFeedWithoutGuildData'].includes(kind))opt=petFeedOption(kind,r,d);
   else if(kind==='ReactionCollectorDefensePersonalityData')opt=defenseOption(r);
   else if(kind==='ReactionCollectorShopData')opt=shopOption(r,d);
   else if(['ReactionCollectorPveFightData','ReactionCollectorFightData','ReactionCollectorFightChooseActionData'].includes(kind))opt=encounterOption(kind,r,d,this.models);
   else if(['ReactionCollectorBuyCategorySlotData','ReactionCollectorDailyBonusData','ReactionCollectorItemAcceptData','ReactionCollectorDrinkData','ReactionCollectorUseTokensData','ReactionCollectorEquipData'].includes(kind))opt=additionalOption(kind,r,d,this.models);
   else {const rendered=label(r);opt={label:rendered||'',supported:Boolean(rendered),requiresConfirmation:kind==='ReactionCollectorRecipeShopSmallEventData'&&r.type==='ReactionCollectorAcceptReaction'}}
   return {...opt,label:opt.label||`Opção ${i+1} indisponível`};
 });
 return enrichEquipMenu({id:p.id,endTime:p.endTime,type:kind,title,story,options},p,this.models,this.allowEquipActions);
 }
 formatMenu(m){const when=Number.isFinite(m.endTime)?new Date(m.endTime).toLocaleTimeString('pt-BR'):'?';const options=m.options||[];const shown=options.map((o,i)=>({o,i})).filter(x=>x.o.supported);const pending=options.length-shown.length;return [m.title.startsWith('*')?m.title:`*${m.title}*`,m.story,'',...shown.map(({o,i})=>`${i+1}. ${o.label}${o.requiresConfirmation?' [confirmação]':''}`),'',pending?`${pending} possibilidade${pending===1?'':'s'} adicional${pending===1?'':'is'} indisponível${pending===1?'':'eis'} nesta versão.`:'',`Responda com o número até ${when}.`,shown.some(x=>x.o.requiresConfirmation)?'Ações marcadas exigem prévia e um código único de confirmação.':'' ].filter(Boolean).join('\n')}
 formatProfile(p){const d=p.playerData;if(!d)return 'Perfil indisponível.';const eff=d.effect||{};const mm=eff.hasTimeDisplay&&Number.isFinite(eff.timeLeft)&&eff.timeLeft>0?` (${Math.ceil(eff.timeLeft/60000)} min restantes)` :'';
 return ['🧙 PERFIL DO VIAJANTE',`Nível ${d.level} • ${this.name('classes',d.classId,'Recruta')}`,`Vida: ${d.health?.value??'?'} / ${d.health?.max??'?'}`,`XP: ${d.experience?.value??'?'} / ${d.experience?.max??'?'}`,`Pontos: ${d.rank?.score??'?'}`,`Moedas: ${d.money??'?'}`,tokenBalance(d.tokens),`Estado: ${fx[eff.effect]||eff.effect||'Normal'}${mm}`,`Destino: ${this.name('map_locations',d.destinationId,'Local desconhecido')}`].filter(Boolean).join('\n')}
 formatInventory(p){if(!p.foundPlayer||!p.data)return 'Inventário indisponível.';
 const d=p.data;
 const out=['🎒 INVENTÁRIO',`Arma: ${this.name('weapons',d.weapon?.id,'—')}`,`Proteção: ${this.name('armors',d.armor?.id,'—')}`,`Poção: ${this.name('potions',d.potion?.id,'—')}`,`Objeto: ${this.name('objects',d.object?.id,'—')}`,slotSummary(d.slots),`Materiais: ${(d.materials||[]).reduce((sum,x)=>sum+(x.quantity||0),0)}`];
 const groups=[['Armas na reserva','backupWeapons','weapons'],['Proteções na reserva','backupArmors','armors'],['Poções na reserva','backupPotions','potions'],['Objetos na reserva','backupObjects','objects']];
 for(const [heading,key,group] of groups){const arr=Array.isArray(d[key])?d[key].filter(x=>Number.isInteger(x?.slot)&&x.slot>0&&Number.isInteger(x?.display?.id)&&x.display.id>0):[];
  if(!arr.length)continue;
  out.push('',`*${heading} (${arr.length})*`);
  for(const item of arr.slice(0,10)){
   const name=this.name(group,item.display.id,'Item não identificado');
   const upgrade=Number.isInteger(item.display.itemLevel)&&item.display.itemLevel>0?` · melhoria +${item.display.itemLevel}`:'';
   out.push(`Espaço ${item.slot}: ${name}${upgrade}`);
  }
  if(arr.length>10)out.push(`Outros ${arr.length-10} itens da reserva não exibidos.`);
 }
 if(d.plants?.plantSlots&&Array.isArray(d.plants.plantSlots))out.push('',`Plantas guardadas: ${d.plants.plantSlots.length}/${d.plants.maxPlantSlots??'?'}`);
 if(p.hasTalisman===true)out.push('Talismã de expedição: disponível');
 if(p.hasCloneTalisman===true)out.push('Talismã de clone: disponível');
 if(p.hasRemoteHarvestTalisman===true)out.push('Talismã de horta remota: disponível');
 return out.join('\n');}

 formatOutcome(p){const v=this.events[String(p.eventId)]?.possibilities?.[p.possibilityId]?.outcomes?.[String(p.outcomeId)];const narr=clean(v)||'O evento foi concluído.';const parts=[`✨ RESULTADO DO EVENTO ${p.eventId}`,narr,`Pontos: ${p.score??'?'} • XP: ${p.experience??'?'}`,`Moedas: ${p.money??'?'} • Tokens: ${p.tokens??'?'}`];if(p.effect?.name)parts.push('Estado: '+(fx[p.effect.name]||p.effect.name));if(p.health)parts.push(`Vida: ${p.health>0?'+':''}${p.health}`);return parts.join('\n')}
 apply(packets,wa,store,playerId){const out=[];const unknown=[];for(const e of packets){const n=e.name,p=e.packet||{};
 switch(n){
 case 'CommandProfilePacketRes':out.push(this.formatProfile(p));break;
 case 'CommandInventoryPacketRes':out.push(this.formatInventory(p));break;
 case 'CommandProfilePlayerNotFound':out.push('Seu personagem ainda não iniciou a jornada.');break;
 case 'ReactionCollectorCreationPacket':{if(!p.id||!Number.isFinite(p.endTime)||!Array.isArray(p.reactions)){out.push('O menu chegou incompleto; nenhuma decisão será enviada.');break}const m=this.menu(p);store.saveMenu(wa,m);out.push(this.formatMenu(m));break}
 case 'ReactionCollectorStopPacket':store.clearMenu(wa,p.id);break;
 case 'ReactionCollectorEnded':store.clearMenu(wa,p.id);out.push('⌛ A escolha expirou.');break;
 case 'CommandReportBigEventResultRes':out.push(this.formatOutcome(p));break;
 case 'CommandReportTravelSummaryRes':{
 const dest=this.name('map_locations',p.endMap?.id,'Destino');const origin=this.name('map_locations',p.startMap?.id,'Origem');
 const status=p.isInCity?`*✦ NA CIDADE · ${dest}*`:`*✦ EM VIAGEM · ${dest}*`;
 const lines=[status,p.isInCity?'Você está na cidade.':`Trajeto: ${origin} → ${dest}`];
 if(!p.isInCity&&Number.isFinite(p.arriveTime)&&p.arriveTime>1000000000000){const time=Math.max(0,Math.ceil((p.arriveTime-Date.now())/60000));lines.push(`Chegada prevista: ${time} min restantes`)}
 if(p.effect&&Number.isFinite(p.effectEndTime)&&p.effectEndTime>1000000000000){const mins=tleft(p.effectEndTime);lines.push(`Estado: ${fx[p.effect]||p.effect} · ${mins} min restantes`)}
 if(p.points?.show===true&&Number.isFinite(p.points.cumulated))lines.push(`Pontos obtidos durante o percurso: ${p.points.cumulated.toLocaleString('pt-BR')}`);
 if(p.energy?.show===true&&Number.isFinite(p.energy.current)&&Number.isFinite(p.energy.max))lines.push(`Energia: ${p.energy.current}/${p.energy.max}`);
 if(p.tokens&&Number.isFinite(p.tokens.cost))lines.push(`Custo de acelerar pelo motor: ${p.tokens.cost} tokens${p.tokens.canAfford===false?' · saldo insuficiente':''}. Recurso ainda indisponível nesta ponte.`);
 out.push(lines.join('\n'));break} 
 case 'MissionsCompletedPacket':{const msg=renderMissionCompleted(p,this.models);if(msg)out.push(msg);break;}
 case 'SmallEventAdvanceTimePacket':{const msg=renderTimeAdvance(p);if(msg)out.push(msg);break;}
 case 'CommandReportStayInCity':out.push('🏙️ Você permaneceu na cidade. Use /aventura para consultar serviços.');break;
 case 'CommandReportChooseDestinationRes':out.push(`🚶 Viagem iniciada para ${this.name('map_locations',p.mapId,`local #${p.mapId}`)}${Number.isFinite(p.tripDuration)?` • ${p.tripDuration} min`:''}.`);break;
 case 'BlockedPacket':out.push('⏳ Outra interação está pendente no motor.');break;
 case 'ErrorInternalPacket':out.push('Erro interno do motor. Consulte o log local, sem compartilhar segredos.');break;
 case 'RequirementEffectPacket':out.push('Seu estado atual impede essa ação.');break;
 case 'RequirementLevelPacket':out.push(`Nível necessário: ${p.requiredLevel??'?'}.`);break;
 case 'RequirementGuildNeededPacket':out.push('*✦ GUILDA NECESSÁRIA*\nVocê precisa pertencer a uma guilda para usar este recurso. Nenhuma ação foi executada.');break;
 case 'RequirementGuildRolePacket':out.push('*✦ PERMISSÃO DA GUILDA*\nSua função atual na guilda não permite essa ação. Nenhuma alteração foi realizada.');break;
 case 'RequirementWherePacket':out.push('*✦ LOCAL INADEQUADO*\nEsta ação não está disponível na sua região atual. Nenhuma alteração foi realizada.');break;
 case 'RequirementRightPacket':out.push('*✦ ACESSO RESTRITO*\nVocê não possui permissão para usar esta função.');break;
 case 'AIFightActionChoosePacket':break; // Cronômetro interno do combate, não é mensagem de ação para o jogador.
 case 'SmallEventRecipeShopRefusedPacket':out.push('Você recusou a oferta.');break;
 case 'SmallEventRecipeShopAcceptedPacket':out.push('✅ Receita comprada no motor.');break;
 default:{const result=renderNativeResponse(n,p) || renderLote11(n,p,this.models) || renderLote10(n,p) || renderLote09(n,p,this.models,playerId) || renderLote08(n,p,this.models) || renderLote07(n,p,this.models) || renderLote06(n,p) || renderPacket(n,p,this.models) || notification(n,p,this.models);if(result)out.push(result);else unknown.push(n);break;}
 }
 }
 if(unknown.length){process.stderr.write('CROWNICLES_RETORNO_PENDENTE tipo='+[...new Set(unknown)].join(',').slice(0,400)+'\n');out.push('Parte desta resposta do jogo ainda não possui apresentação completa no WhatsApp. Consulte /perfil antes de repetir uma ação com custos.');}
 return out.filter(Boolean).join('\n\n');
 }
}
module.exports={Presenter};
