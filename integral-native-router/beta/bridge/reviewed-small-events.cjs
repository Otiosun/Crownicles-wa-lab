'use strict';
// Pinned Crownicles 6.2.0.b: original small-event packet contracts + PT-BR presentation.
// No roll, reward, player update or reaction-index substitution occurs here.
const RC='ReactionCollector',A=RC+'AcceptReaction',R=RC+'RefuseReaction';
const K={goblets:RC+'GobletsGameData',lottery:RC+'LotteryData',altar:RC+'AltarData',witch:RC+'WitchData',food:RC+'PetFoodSmallEventData',badPet:RC+'BadPetSmallEventData',limoges:RC+'LimogesData'};
const kinds=new Set(Object.values(K));
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),own=(x,k)=>Object.hasOwn(x,k),exact=(x,keys)=>obj(x)&&Object.keys(x).length===keys.length&&keys.every(k=>own(x,k));
const allowedKeys=(x,required,opt)=>obj(x)&&required.every(k=>own(x,k))&&Object.keys(x).every(k=>required.includes(k)||opt.includes(k));
const integer=x=>Number.isSafeInteger(x)&&x>=0,pos=x=>integer(x)&&x>0,signed=x=>Number.isSafeInteger(x),sex=x=>x==='m'||x==='f',bool=x=>typeof x==='boolean';
const safe=x=>typeof x==='string'?x.replace(/[\x00-\x1f\x7f<>*_~\x60@]/g,' ').replace(/\b[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\b/gi,'').replace(/\s+/g,' ').trim().slice(0,100):'';
const fmt=x=>x.toLocaleString('pt-BR'),option=(label,requiresConfirmation=true)=>({label,supported:true,requiresConfirmation});
const goblets={Metal:{id:'metal',strategy:'classic',label:'Cálice de metal · escolha clássica'},Biggest:{id:'biggest',strategy:'safe',label:'Cálice maior · penalidade certa, mas reduzida'},Sparkling:{id:'sparkling',strategy:'risky',label:'Cálice brilhante · chance de item raro e risco de penalidade'},Cracked:{id:'cracked',strategy:'gambler',label:'Cálice rachado · boa chance de sair ileso, penalidade muito maior se falhar'}};
const gobletById=Object.fromEntries(Object.values(goblets).map(g=>[g.id,g]));
const lottery={Easy:'Fácil · sem custo de participação',Medium:'Médio · perde tempo de viagem, mesmo se ganhar',Hard:'Difícil · perde tempo e pode perder 175 moedas'};
const levels={easy:'Fácil',medium:'Médio',hard:'Difícil'},rewardTypes={money:'moedas',xp:'XP',points:'pontos',guildXp:'XP de guilda'};
const witch={bat:'Adicionar um morcego',beer:'Adicionar cerveja',bigWait:'Deixar a poção descansar por bastante tempo',bigWarm:'Ferver a poção por bastante tempo',blood:'Adicionar sangue',book:'Recitar um encantamento do grimório',bone:'Adicionar um osso',cobweb:'Adicionar uma teia de aranha',cool:'Deixar a poção esfriar',chicken:'Adicionar frango',crystalBall:'Recitar uma fórmula mágica',distiller:'Destilar a poção',eye:'Adicionar um olho',frog:'Adicionar uma rã',greenApple:'Adicionar uma maçã verde',heart:'Adicionar um coração',mushroom:'Adicionar um cogumelo',nothing:'Não fazer nada',package:'Adicionar um ingrediente misterioso',rat:'Adicionar um rato',redApple:'Adicionar uma maçã vermelha',rose:'Adicionar uma rosa',scorpion:'Adicionar um escorpião',smallWait:'Deixar a poção descansar um pouco',smallWarm:'Aquecer um pouco o caldeirão',snake:'Adicionar uma cobra',spider:'Adicionar uma aranha',stir:'Mexer a poção',teeth:'Adicionar um dente',testTube:'Adicionar o conteúdo de um tubo de ensaio',turtle:'Adicionar uma tartaruga',wand:'Lançar um feitiço',wiltedRose:'Adicionar uma rosa murcha',worm:'Adicionar uma minhoca',feather:'Adicionar uma pena de fênix',bubble:'Soprar bolhas de sabão',honey:'Adicionar mel',iceCrystal:'Adicionar um cristal de gelo',sing:'Cantar uma melodia',dragonScale:'Adicionar uma escama de dragão',windEssence:'Adicionar uma essência de vento'};
const food={badSmell:'Um odor desagradável chama a atenção do seu companheiro.',vegetarian:'Um cheiro de vegetais frescos chama a atenção do seu companheiro.',meat:'O cheiro de carne chega ao seu companheiro.',goodSmell:'Um aroma convidativo de comida atrai seu companheiro.',soup:'O aroma de uma sopa quente atrai seu companheiro.'};
const foodNames={badSmell:'Comida com mau cheiro',vegetarian:'Alimento vegetal',meat:'Carne',goodSmell:'Comida de aroma agradável',soup:'Sopa'};
const foodActions={Investigate:'Investigar pessoalmente · custa 5 min',SendPet:'Enviar seu companheiro para investigar',Continue:'Continuar o caminho'};
const foodOutcomes={found_by_player:'Você encontrou comida.',found_by_pet:'Seu companheiro encontrou comida.',found_anyway:'Vocês encontraram comida mesmo seguindo caminho.',nothing:'Vocês seguiram caminho sem encontrar comida.',pet_failed:'Seu companheiro não encontrou comida.',player_failed:'Sua investigação não encontrou comida.'};
const badActions={intimidate:'Pedir ao companheiro que intimide o anão',plead:'Tentar argumentar com o anão',giveMeat:'Oferecer carne ao anão · pode consumir ração da guilda',giveVeg:'Oferecer vegetais ao anão · pode consumir ração da guilda',flee:'Fugir com o companheiro',hide:'Esconder o companheiro',wait:'Esperar a raiva do anão passar',protect:'Proteger o companheiro',distract:'Distrair o anão',calm:'Acalmar o companheiro',imposer:'Deixar o companheiro enfrentar o anão',energize:'Incentivar o companheiro a manter-se firme'};
const badFoodResults={giveMeatNoFood:'Não havia carne disponível.',giveMeatLikes:'Seu companheiro gosta de carne e sentiu ciúmes da oferta.',giveMeatDislikes:'Carne não faz parte da dieta do seu companheiro.',giveVegNoFood:'Não havia vegetais disponíveis.',giveVegLikes:'Seu companheiro gosta de vegetais e sentiu ciúmes da oferta.',giveVegDislikes:'Vegetais não fazem parte da dieta do seu companheiro.'};
const questions={journeyInvitation:'Se o destino permitisse, você viajaria um dia para essa cidade suspensa entre a luz e o caulim?',seenBetterCity:'Você já percorreu as ruas de uma cidade mais magnífica do que essa?',enameledJewel:'Você gostaria de ver as joias esmaltadas pelos ourives dessa cidade?',believeExaggerated:'Você acha que essas descrições extravagantes são apenas exageros de um contador de histórias?',carryPorcelain:'Você trataria a porcelana sagrada da cidade com a reverência que ela merece?',tooTiredToDream:'Você está cansado demais para sonhar com uma visita a essa cidade magnífica?',promiseSouvenir:'Você elogiaria essa maravilha diante da corte e dos grandes homens do reino?',callItMyth:'Você acha que essa cidade maravilhosa é apenas uma lenda embelezada por trovadores?',followWhispers:'Você gostaria de seguir os sussurros que o levariam até essa cidade encantada?',dismissFountains:'Você acha que esses relatos maravilhosos são superestimados?'};
const blessings=['','Fúria amplificada','Espólios de combate','Regeneração de energia','Bônus de moedas','Bônus de pontos','Afinidade de companheiros','Efeito de cura','Token de expedição','Missões diárias'];
const effects={none:'Normal',occupied:'Ocupado',sleeping:'Dormindo',drunk:'Embriagado',freezing:'Congelado',feetHurt:'Pés feridos',hurt:'Machucado',sick:'Doente',jailed:'Preso',injured:'Ferido',starving:'Faminto',confounded:'Confuso',scared:'Assustado',lost:'Perdido',fished:'Pescando',dead:'Morto',notStarted:'Não iniciado'};
const groups=['weapons','armors','potions','objects'];
function localized(models,group,id,fallback){const g=models?.[group],v=obj(g)&&own(g,String(id))?g[String(id)]:null;return safe(typeof v==='string'?v:v?.name_one||v?.name)||fallback;}
const petLabel=(d,m)=>safe(d.petNickname)||localized(m,'pets',d.petId+'_'+(d.sex==='m'?'male':'female'),'Seu companheiro');
const emptyTypes=(rx,expected)=>rx.length===expected.length&&rx.every(x=>expected.includes(x.type)&&exact(x.data,[]))&&new Set(rx.map(x=>x.type)).size===rx.length;
const ids=(rx,type,dict,min,max)=>rx.length>=min&&rx.length<=max&&rx.every(x=>x.type===type&&exact(x.data,['id'])&&typeof x.data.id==='string'&&own(dict,x.data.id))&&new Set(rx.map(x=>x.data.id)).size===rx.length;
const pool=(amount,threshold)=>integer(amount)&&pos(threshold)&&amount<=threshold;
function menu(p,models){
 const kind=p?.data?.type,d=p?.data?.data,rx=p?.reactions;
 if(!kinds.has(kind)||!obj(d)||!Array.isArray(rx)||!rx.length||rx.length>10||!rx.every(x=>obj(x)&&typeof x.type==='string'&&obj(x.data)))return null;
 if(kind===K.goblets){const index=Object.fromEntries(Object.entries(goblets).map(([k,v])=>[RC+'GobletsGame'+k+'Reaction',v]));if(!exact(d,[])||rx.length!==4||new Set(rx.map(x=>x.type)).size!==4||!rx.every(x=>own(index,x.type)&&exact(x.data,['id','strategy'])&&x.data.id===index[x.type].id&&x.data.strategy===index[x.type].strategy))return null;
 return {title:'✦ OS QUATRO CÁLICES',story:'Um estranho apresenta quatro cálices encantados. Cada um oferece riscos diferentes. Não responder também pode causar perda de vida.',options:rx.map(x=>option(index[x.type].label))};
 }
 if(kind===K.lottery){const index=Object.fromEntries(Object.entries(lottery).map(([k,v])=>[RC+'Lottery'+k+'Reaction',v]));if(!exact(d,[])||!emptyTypes(rx,Object.keys(index)))return null;
 return {title:'✦ LOTERIA DO VIAJANTE',story:'Um homem convida você a participar de um jogo de sorte com recompensas do reino. Escolha o risco que aceita. Tudo é resolvido pelo Core.',options:rx.map(x=>option(index[x.type]))};
 }
 if(kind===K.altar){const C=RC+'AltarContributeReaction';if(!exact(d,['poolAmount','poolThreshold'])||!pool(d.poolAmount,d.poolThreshold)||rx.length>5||rx.filter(x=>x.type===R).length!==1||!rx.every(x=>x.type===R?exact(x.data,[]):x.type===C&&exact(x.data,['amount'])&&pos(x.data.amount)&&x.data.amount<=d.poolThreshold-d.poolAmount)||new Set(rx.filter(x=>x.type===C).map(x=>x.data.amount)).size!==rx.length-1)return null;
 return {title:'✦ ALTAR DO ORÁCULO',story:'Contribuição coletiva: '+fmt(d.poolAmount)+'/'+fmt(d.poolThreshold)+' moedas.\nCompletar o altar pode ativar uma bênção para o reino. O saldo, os bônus e a contribuição são calculados pelo Core.',options:rx.map(x=>x.type===R?option('Não contribuir',false):option('Contribuir com '+fmt(x.data.amount)+' moedas'))};
 }
 if(kind===K.witch){if(!exact(d,[])||!ids(rx,RC+'WitchReaction',witch,3,4))return null;
 return {title:'✦ O CALDEIRÃO DA BRUXA',story:'Você encontra uma bruxa preparando uma poção em uma cabana. A mistura não parece sair como planejado. Ela pede sua ajuda; as consequências podem incluir poções ou alterações no personagem.',options:rx.map(x=>option(witch[x.data.id]))};
 }
 if(kind===K.food){const idx=Object.fromEntries(Object.entries(foodActions).map(([k,v])=>[RC+'PetFood'+k+'Reaction',v]));if(!exact(d,['foodType','petSex'])||typeof d.foodType!=='string'||!own(food,d.foodType)||!sex(d.petSex)||!emptyTypes(rx,Object.keys(idx)))return null;
 return {title:'✦ CHEIRO NA ESTRADA',story:food[d.foodType]+'\nA escolha pode afetar a afinidade do companheiro.',options:rx.map(x=>option(idx[x.type]))};
 }
 if(kind===K.badPet){if(!allowedKeys(d,['petId','sex'],['petNickname'])||!integer(d.petId)||!sex(d.sex)||(d.petNickname!==undefined&&typeof d.petNickname!=='string')||!ids(rx,RC+'BadPetReaction',badActions,1,12))return null;
 return {title:'✦ O ANÃO E SEU COMPANHEIRO',story:petLabel(d,models)+' despertou a ira de um anão. Escolha como agir. Esperar o prazo acabar também tem consequência para a afinidade.',options:rx.map(x=>option(badActions[x.data.id]))};
 }
 if(kind===K.limoges){if(!exact(d,['questionId'])||typeof d.questionId!=='string'||!own(questions,d.questionId)||!emptyTypes(rx,[A,R]))return null;
 return {title:'✦ A CIDADE DAS MARAVILHAS',story:'Um viajante descreve uma cidade magnífica, famosa por suas porcelanas e joias. Ele faz uma pergunta:\n\n'+questions[d.questionId],options:rx.map(x=>option(x.type===A?'Sim':'Não'))};
 }
 return null;
}
const incomplete=title=>'*✦ '+title+'*\nResultado incompleto. Consulte /perfil antes de repetir uma ação.';
const has=(d,k)=>typeof k==='string'&&own(d,k);
function result(n,p,models){
 if(n==='SmallEventGobletsGamePacket'){const bad=incomplete('CÁLICES');if(!obj(p)||!integer(p.value)||!['life','time','nothing','end','item'].includes(p.malus))return bad;
 if(p.malus==='end'){return p.goblet===''&&p.strategy==='classic'?'*✦ CÁLICES*\nTempo esgotado. Vida perdida: '+fmt(p.value)+'.':bad;}
 if(!has(gobletById,p.goblet)||gobletById[p.goblet].strategy!==p.strategy)return bad;
 if(p.malus==='item'){if(p.strategy!=='risky'||!integer(p.itemId)||!integer(p.itemCategory)||p.itemCategory>3)return bad;return '*✦ CÁLICE PREMIADO*\nItem encontrado: '+localized(models,groups[p.itemCategory],p.itemId,'Item #'+p.itemId)+'. Consulte a entrega ou escolha de inventário.';}
 if(p.malus==='nothing')return '*✦ CÁLICES*\nVocê saiu ileso.';
 return '*✦ CÁLICES*\n'+(p.malus==='life'?'Vida perdida: ':'Tempo perdido: ')+fmt(p.value)+(p.malus==='time'?' min.':'.');
 }
 if(n==='SmallEventLotteryNoAnswerPacket')return '*✦ LOTERIA*\nVocê não respondeu a tempo. Nenhuma aposta foi escolhida.';
 if(n==='SmallEventLotteryPoorPacket')return '*✦ LOTERIA*\nVocê não possui moedas suficientes para a modalidade difícil.';
 if(n==='SmallEventLotteryWinPacket'||n==='SmallEventLotteryLosePacket'){const win=n.endsWith('WinPacket'),bad=incomplete('LOTERIA');if(!obj(p)||!has(levels,p.level)||!integer(p.lostTime)||(win?(!integer(p.winAmount)||!has(rewardTypes,p.winReward)):!integer(p.moneyLost)))return bad;
 return '*✦ LOTERIA · '+(win?'VITÓRIA':'DERROTA')+'*\nModalidade: '+levels[p.level]+'\n'+(win?'Recompensa: '+fmt(p.winAmount)+' '+rewardTypes[p.winReward]:'Moedas perdidas: '+fmt(p.moneyLost))+'\nTempo perdido: '+fmt(p.lostTime)+' min.';
 }
 if(n==='SmallEventAltarFirstEncounterPacket')return '*✦ ALTAR DO ORÁCULO*\nVocê encontrou o oráculo pela primeira vez. Ele apresenta os mistérios do altar.';
 if(n==='SmallEventAltarContributedPacket'||n==='SmallEventAltarNoContributionPacket'){const bad=incomplete('ALTAR');if(!obj(p)||!integer(p.amount)||!pool(p.newPoolAmount,p.poolThreshold))return bad;const progress='Contribuição coletiva: '+fmt(p.newPoolAmount)+'/'+fmt(p.poolThreshold)+' moedas.';
 if(n.endsWith('NoContributionPacket'))return bool(p.hasEnoughMoney)?'*✦ ALTAR*\n'+(p.hasEnoughMoney?'Nenhuma contribuição realizada.':'Saldo insuficiente para contribuir com '+fmt(p.amount)+' moedas.')+'\n'+progress:bad;
 if(!pos(p.amount)||!bool(p.blessingTriggered)||!integer(p.blessingType)||p.blessingType>9||p.blessingTriggered!==(p.blessingType!==0)||!integer(p.bonusGems)||!bool(p.bonusItemGiven)||!bool(p.badgeAwarded))return bad;
 return ['*✦ CONTRIBUIÇÃO REALIZADA*',fmt(p.amount)+' moedas.',progress,p.blessingTriggered?'Bênção ativada: '+blessings[p.blessingType]+'.':'',p.bonusGems?'Gemas recebidas: '+fmt(p.bonusGems)+'.':'',p.bonusItemGiven?'Item bônus concedido pelo Core; confira a entrega ou escolha de inventário.':'',p.badgeAwarded?'Insígnia de Patrono do Oráculo concedida.':''].filter(Boolean).join('\n');
 }
 if(n==='SmallEventWitchResultPacket'){const bad=incomplete('BRUXA');if(!obj(p)||!has(witch,p.ingredientId)||!bool(p.isIngredient)||!integer(p.outcome)||p.outcome>3||(p.forceEffect!==undefined&&!bool(p.forceEffect)))return bad;
 const applied=p.forceEffect===true||p.outcome===1;if(applied&&(!has(effects,p.effectId)||(p.effectId==='occupied'&&!integer(p.timeLost))))return bad;
 if(p.outcome===2&&!integer(p.lifeLoss))return bad;
 const lines=['*✦ O CALDEIRÃO DA BRUXA*','Escolha resolvida: '+witch[p.ingredientId]+'.',p.outcome===0?'Uma poção foi encontrada; confira a entrega ou escolha de inventário.':p.outcome===1?'A mistura provocou uma alteração.':p.outcome===2?'Vida perdida: '+fmt(p.lifeLoss)+'.':'Nenhum prêmio principal.'];
 if(applied)lines.push('Estado: '+effects[p.effectId]+(p.effectId==='occupied'?' · '+fmt(p.timeLost)+' min.':'.'));
 if(p.discoveredRecipe!==undefined){const r=p.discoveredRecipe;if(!obj(r)||typeof r.recipeId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(r.recipeId)||!integer(r.level))return bad;const recipes=models?.cooking?.recipes;const v=obj(recipes)&&own(recipes,r.recipeId)?recipes[r.recipeId]:null;lines.push('Receita descoberta: '+(safe(typeof v==='string'?v:v?.name)||'receita de culinária')+' · nível '+r.level+'.');}return lines.join('\n');
 }
 if(n==='SmallEventPetFoodPacket'){const bad=incomplete('COMPANHEIRO');if(!obj(p)||!has(foodOutcomes,p.outcome)||!has(foodNames,p.foodType)||!sex(p.petSex)||!signed(p.loveChange)||(p.timeLost!==undefined&&!integer(p.timeLost)))return bad;
 return ['*✦ COMPANHEIRO*',foodOutcomes[p.outcome],p.outcome.startsWith('found_')?'Alimento: '+foodNames[p.foodType]+'.':'','Variação de afinidade: '+(p.loveChange>0?'+':'')+fmt(p.loveChange)+'.',p.timeLost?'Tempo perdido: '+fmt(p.timeLost)+' min.':''].filter(Boolean).join('\n');
 }
 if(n==='SmallEventBadPetPacket'){const bad=incomplete('COMPANHEIRO');if(!obj(p)||!integer(p.petId)||!sex(p.sex)||!integer(p.loveLost)||(!has(badActions,p.interactionType)&&!has(badFoodResults,p.interactionType)))return bad;
 return '*✦ O ANÃO E SEU COMPANHEIRO*\n'+petLabel(p,models)+'\n'+(has(badFoodResults,p.interactionType)?badFoodResults[p.interactionType]:'Ação resolvida: '+badActions[p.interactionType]+'.')+'\nPerda de afinidade informada: '+fmt(p.loveLost)+'.';
 }
 if(n==='SmallEventLimogesPacket'){const bad=incomplete('CIDADE DAS MARAVILHAS');if(!obj(p)||!has(questions,p.questionId)||!bool(p.shouldHaveAccepted)||!bool(p.isSuccess))return bad;
 if(p.isSuccess){if(!obj(p.reward)||!integer(p.reward.experience)||!integer(p.reward.score)||p.penalty!==undefined)return bad;return '*✦ CIDADE DAS MARAVILHAS*\nO viajante ficou satisfeito.\nXP: +'+fmt(p.reward.experience)+' · Pontos: +'+fmt(p.reward.score)+'.';}
 const penalties={health:'Vida perdida',money:'Moedas perdidas',time:'Tempo perdido'};if(!obj(p.penalty)||!has(penalties,p.penalty.type)||!integer(p.penalty.amount)||p.reward!==undefined)return bad;return '*✦ CIDADE DAS MARAVILHAS*\nO encontro terminou mal.\n'+penalties[p.penalty.type]+': '+fmt(p.penalty.amount)+(p.penalty.type==='time'?' min.':'.');
 }
 return null;
}
module.exports={K,kinds,menu,result};
