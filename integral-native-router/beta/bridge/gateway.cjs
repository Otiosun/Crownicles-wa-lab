'use strict';
const crypto=require('node:crypto');
const nativeUniversal=require('./native-universal.cjs');
const twoParty=require('./two-party-collector.cjs');
const social=require('./social-intents.cjs');
const targets=require('./reviewed-target-collectors.cjs');
const skip=require('./reviewed-mission-skip.cjs');
const {resolveCommand:resolveLote06}=require('./lote06.cjs');
const {resolveCommand:resolveLote07}=require('./lote07.cjs');
const {resolveCommand:resolveLote08}=require('./lote08.cjs');
const {resolveCommand:resolveLote09,verifyEquipIntent,refreshEquipMenu}=require('./lote09.cjs');
const {resolveCommand:resolveLote10,makeMenu:makeNativeAuthMenu,authorizedCommand:authorizedNativeCommand}=require('./lote10.cjs');
const {resolveCommand:resolveLote11,makeNicknameMenu,authorizedNickname}=require('./lote11.cjs');
// The original Core may have one live reaction collector per player.
// Keep an existing decision snapshot instead of opening a second menu over it.
// Read-only lookups are intentionally excluded.
const MENU_OPENERS_V29=new Set([
 'CommandFightPacketReq','CommandSellPacketReq','CommandPetFeedPacketReq',
 'CommandDrinkPacketReq','CommandDailyBonusPacketReq','CommandClassesPacketReq',
 'CommandJoinBoatPacketReq','CommandEquipPacketReq','CommandGardenPacketReq',
 'CommandDefensePacketReq','CommandPetExpeditionPacketReq'
]);
class Gateway{
 constructor(config,store,presenter,core,sender){this.config=config;this.store=store;this.presenter=presenter;this.core=core;this.sender=sender;this.working=false;this.flushing=false;this.enableEquipActions=process.env.CROWNICLES_WA_EQUIP_ACTIONS==='enabled';this.presenter.allowEquipActions=this.enableEquipActions;this.pendingEquip=new Map();this.pendingNative=new Map();this.pendingTarget=new Map();this.pendingSkip=new Map();this.closed=false;this.onReady=()=>this.work();this.onResponse=r=>this.onCore(r);this.core.on('ready',this.onReady);this.core.on('response',this.onResponse);}
 close(){if(this.closed)return;this.closed=true;this.core.off?.('ready',this.onReady);this.core.off?.('response',this.onResponse);}
 receive(id,wa,text){if(this.closed||!Object.hasOwn(this.config.bindings,wa))return false;const inserted=this.store.receive(id,wa,text);if(inserted)this.work();return inserted}
 targetContext(){return {origin:this.store.origin,bindings:this.config.bindings,canSendPacket:this.config.canSendPacket};}
 route(row){const line=row.text.trim().toLowerCase();const id=this.config.bindings[row.wa];const novo=require('./lote02.cjs').resolveCommand(line,id);if(novo)return novo;const next=resolveLote06(line)||resolveLote07(line)||resolveLote08(line)||resolveLote09(line)||resolveLote10(line)||resolveLote11(row.text.trim());if(next?.petNickname){const active=this.store.getMenu(row.wa);if(active&&Date.now()<active.endTime)return {local:'Há uma decisão pendente. Envie /menu antes de renomear seu companheiro.'};const menu=makeNicknameMenu(next.petNickname);if(!menu)return {local:'Nome inválido. Nenhuma alteração foi enviada.'};const candidate=authorizedNickname(menu,menu.options?.[0],id);if(!candidate||(typeof this.config.canSendPacket==='function'&&!this.config.canSendPacket(candidate.name)))return {local:'O motor ainda não habilitou a alteração de apelido. Nenhuma mudança foi enviada.'};this.store.saveMenu(row.wa,menu);return {local:this.presenter.formatMenu(menu)}}if(next?.localAuthorization){const active=this.store.getMenu(row.wa);if(active&&Date.now()<active.endTime)return {local:'Há uma decisão pendente. Envie /menu antes de abrir outra autorização.'};const menu=makeNativeAuthMenu(next.localAuthorization);if(!menu)return {local:'A autorização não está disponível.'};const candidate=authorizedNativeCommand(menu,menu.options?.[0]);if(!candidate||(typeof this.config.canSendPacket==='function'&&!this.config.canSendPacket(candidate.name)))return {local:'O motor ainda não habilitou esta ação. Nenhuma solicitação foi enviada.'};this.store.saveMenu(row.wa,menu);return {local:this.presenter.formatMenu(menu)}}if(next){if(next.guardMenu){const m=this.store.getMenu(row.wa);if(m&&Date.now()<m.endTime)return {local:'Há uma decisão pendente. Envie /menu antes de abrir os serviços da cidade.'};}return next;}if(line==='/sistemas'||line==='/nativos')return {local:nativeUniversal.help(this.config.canSendPacket)};
 const identified=targets.parse(row.text.trim(),id,row.wa,this.targetContext());
 if(identified){
  if(identified.local)return identified;
  const active=this.store.getMenu(row.wa);
  if(active&&Date.now()<active.endTime)return {local:'Há uma decisão pendente. Consulte /menu antes de solicitar outra ação.'};
  const menu=targets.makeMenu(identified.proof,id,row.wa,this.targetContext());
  if(!menu)return {local:'Não foi possível verificar a referência. Nada foi enviado ao motor.'};
  this.store.saveMenu(row.wa,menu);return {local:this.presenter.formatMenu(menu)};
 }
 const shared=social.parse(row.text.trim());
 if(shared){
  if(shared.error)return {local:shared.error};
  if(shared.codeRequest){
   const issued=this.store.issueRecipientCode(row.wa,id);
   return {local:'*✦ SEU CÓDIGO DE PARTICIPAÇÃO*\nCompartilhe com quem poderá lhe enviar um convite de guilda ou uma oferta de pet. Código: *'+issued.code+'*\nVálido por 10 minutos, para um único pedido confirmado. Você ainda decidirá se aceita a proposta no privado.'};
  }
  const active=this.store.getMenu(row.wa);
  if(active&&Date.now()<active.endTime)return {local:'Há uma decisão pendente. Consulte /menu antes de preparar outra proposta.'};
  const found=this.store.findRecipientCode(shared.code);
  if(!found||twoParty.recipientJid(this.config.bindings,found.player_id)!==found.wa)return {local:'Código inválido, expirado ou sem identidade verificada. Nenhum pedido foi enviado.'};
  const menu=social.makeMenu(shared,found,id);
  if(!menu||typeof this.config.canSendPacket!=='function'||this.config.canSendPacket(menu.socialRequest.name)!==true)return {local:'Este pedido ainda não está disponível no Core ou não foi validado. Nenhuma proposta foi enviada.'};
  this.store.saveMenu(row.wa,menu);return {local:this.presenter.formatMenu(menu)};
 }
 const universal=nativeUniversal.resolve(row.text.trim(),id,{canSendPacket:this.config.canSendPacket});
 if(universal?.universalIntent){
  const active=this.store.getMenu(row.wa);
  if(active&&Date.now()<active.endTime)return {local:'Há uma decisão pendente. Use /menu antes de iniciar outra ação.'};
  const menu=nativeUniversal.makeMenu(universal.universalIntent,id);
  if(!menu)return {local:'Não foi possível preparar a ação com segurança. Nada foi enviado.'};
  this.store.saveMenu(row.wa,menu);
  return {local:this.presenter.formatMenu(menu)};
 }
 if(universal)return universal;
 if(line==='/perfil')return {name:'CommandProfilePacketReq',data:{askedPlayer:{keycloakId:id}}};
 if(line==='/inventario'||line==='/inv')return {name:'CommandInventoryPacketReq',data:{askedPlayer:{keycloakId:id}}};
 if(['/aventura','/relatorio','/jogar','/iniciar','/inicio','/início','/comecar','/começar'].includes(line)){const m=this.store.getMenu(row.wa);if(m&&Date.now()<m.endTime)return {local:'Há uma decisão pendente. Envie /menu para consultá-la.'};return {name:'CommandReportPacketReq',data:{}}}
 if(line==='/menu'){const m=this.store.getMenu(row.wa);return {local:m&&Date.now()<m.endTime&&(!m.restrictedToPlayerId||m.restrictedToPlayerId===id)?this.presenter.formatMenu(m):'Não há nenhuma decisão ativa.'}}
 if(line==='/ajuda'||line==='/comandos')return {local:'*✦ COMANDOS*\n/jogar · /aventura · /perfil · /inventario\n/missoes · /pet · /guilda · /classes\n/historico · /mapa\n/raridades · /bencao · /ranking\n/jardim · /defesa\n/vender · /alimentar · /despensa\n/expedicao · /pocao · /diario\n/equipamentos · /combate\n/versao · /renascer · /recompensaliga\n/diarioguilda\n/mudarclasse · /abrigo · /embarcar\n/renomearpet NOME · /cidade\n/menu · /ajuda · /comandos\n\nPara consultar decisões ativas, use /menu. Envie o número indicado para escolher. Para gastos e decisões irreversíveis, peça a prévia pelo número e siga o código de confirmação indicado.'};
 const confirm=line.match(/^\/confirmar\s+([1-9][0-9]{0,2})\s+([a-f0-9]{8})$/);
 if(confirm||/^[0-9]{1,3}$/.test(line)){
  const m=this.store.getMenu(row.wa);
  if(!m||Date.now()>=m.endTime||m.restrictedToPlayerId&&m.restrictedToPlayerId!==id)return {local:'Não há uma escolha ativa. Consulte /aventura quando estiver disponível.'};
  const number=Number(confirm?confirm[1]:line),index=number-1,choice=m.options?.[index];
  if(!choice)return {local:'Opção inválida. Envie /menu para consultar as escolhas.'};
  if(choice.supported!==true)return {local:'⚠️ Essa decisão ainda não possui uma apresentação segura. Nada foi enviado ao motor.'};
  if(['LocalNativeAuthorization','LocalPetNickname','LocalUniversalNativeAuthorization','LocalSocialNativeAuthorization','LocalVerifiedTargetAuthorization'].includes(m.type)&&choice.kind==='nativeCancel'&&!confirm){this.store.clearMenu(row.wa,m.id);return {local:'Autorização cancelada. Nada foi enviado ao motor.'};}
  if(m.type==='LocalNativeAuthorization'&&choice.kind!=='nativeAuth')return {local:'Opção não autorizada. Consulte /menu.'};
  if(m.type==='LocalUniversalNativeAuthorization'&&!['universalNative','nativeCancel'].includes(choice.kind))return {local:'Opção não autorizada. Consulte /menu.'};
  if(m.type==='LocalSocialNativeAuthorization'&&!['socialNative','nativeCancel'].includes(choice.kind))return {local:'Opção não autorizada. Consulte /menu.'};
  if(m.type==='LocalVerifiedTargetAuthorization'&&(choice.kind!=='targetRequest'||!targets.bindingProof(m.targetProof,id,row.wa,this.targetContext())))return {local:'A referência ou a autorização do Core mudou. Nenhum pedido foi enviado.'};
  if(!targets.authorizeReaction(m,choice,id,row.wa,this.targetContext())||!skip.authorizeReaction(m,choice,id))return {local:'A escolha não corresponde ao contrato de segurança revisado. Nada foi enviado.'};
  if(choice.skipQuote!==undefined&&(m.type!==skip.SHOP||!skip.validQuote(choice.skipQuote,id)||choice.requiresConfirmation!==true))return {local:'Cotação inválida. Nenhum pedido foi enviado.'};
  if(choice.requiresConfirmation===true&&!confirm){
   const preview=this.store.createPreview(row.wa,m,index);
   return {local:`*✦ REVISÃO DA DECISÃO*\n${choice.label}\n\n*Nada foi executado.*\nPara autorizar apenas esta decisão, envie exatamente:\n*/confirmar ${number} ${preview.token}*\n\nEste código vale até ${new Date(preview.expiresAt).toLocaleTimeString('pt-BR')} e não pode ser reutilizado.`};
  }
  if(choice.requiresConfirmation!==true&&confirm)return {local:'Esta opção não exige confirmação. Envie apenas o número indicado.'};
  if(confirm){
   if(!this.store.previewMatches(row.wa,m,index,confirm[2]))return {local:'Confirmação não corresponde a uma prévia válida. Envie novamente o número da opção para gerar um novo código.'};
   if(choice.kind==='targetRequest'){
    const native=targets.authorize(m,choice,id,row.wa,this.targetContext());
    if(!native)return {local:'O destinatário ou a capacidade do Core não corresponde mais à solicitação.'};
    return {name:native.name,data:native.data,confirmPreview:{menu:m,index,token:confirm[2]},targetPending:{stage:'request',proof:native.proof}};
   }
   if(choice.kind==='universalNative'){
    const native=nativeUniversal.authorized(m,choice,id,{canSendPacket:this.config.canSendPacket});
    if(!native)return {local:'A autorização nativa expirou ou foi invalidada. Nenhuma ação foi enviada.'};
    return {...native,confirmPreview:{menu:m,index,token:confirm[2]},nativePending:{request:native.name}};
   }
   if(choice.kind==='socialNative'){
    const native=social.authorized(m,choice,id);
    if(!native||typeof this.config.canSendPacket!=='function'||this.config.canSendPacket(native.name)!==true)return {local:'Pedido social expirado ou indisponível. Nenhum pedido foi enviado.'};
    return {...native,confirmPreview:{menu:m,index,token:confirm[2]},socialConsent:native.consent};
   }
   if(choice.kind==='nativeAuth'){const native=authorizedNativeCommand(m,choice);if(!native)return {local:'Autorização não reconhecida. Nenhuma ação foi enviada ao motor.'};return {...native,confirmPreview:{menu:m,index,token:confirm[2]}};}
   if(choice.kind==='petNickname'){const native=authorizedNickname(m,choice,id);if(!native)return {local:'O apelido não corresponde à autorização. Nenhum pedido foi enviado.'};return {...native,confirmPreview:{menu:m,index,token:confirm[2]}};}
   if(choice.kind==='equipAction'){
    if(!this.enableEquipActions||!verifyEquipIntent(m,choice))return {local:'A troca de equipamento não está liberada nesta instalação. Nenhuma alteração foi feita.'};
    const {action,itemCategory,slot}=choice.equip;return {name:'CommandEquipActionReq',data:{action,itemCategory,slot},confirmPreview:{menu:m,index,token:confirm[2]},equipPending:{menu:m}};
   }
   return {name:'ReactionCollectorReactPacket',data:{id:m.id,keycloakId:id,reactionIndex:index},confirmPreview:{menu:m,index,token:confirm[2]},...(targets.kinds.has(m.type)&&m.targetProof?{targetPending:{stage:'react',proof:m.targetProof}}:{}),...(choice.skipQuote?{skipPending:choice.skipQuote}:{})};
  }
  return {name:'ReactionCollectorReactPacket',data:{id:m.id,keycloakId:id,reactionIndex:index},consumeMenu:m.id};
 }
 if(/^\/(?:ranking|top)(?:\s|$)/.test(line))return {local:'*✦ RANKING*\nUso: /ranking pontos geral 1\nModos: pontos geral ou semanal; gloria semanal; guildas geral. Página: 1 a 99.'};
 if(line.startsWith('/confirmar'))return {local:'Confirmação inválida ou sem código. Envie primeiro o número da escolha e use /confirmar N CÓDIGO exatamente como na prévia.'};
 if(line.startsWith('/'))return {local:'Esse comando ainda não está disponível pelo WhatsApp. Consulte /comandos.'};return {ignore:true};}
 work(){if(this.closed||this.working||!this.core.ready)return;this.working=true;try{let row;while((row=this.store.next())){
  this.store.mark(row.id,'processing');let action;
  try{action=this.route(row)}catch(e){this.store.queue(row.wa,'A decisão não pôde ser preparada com segurança. Consulte /menu.');this.store.mark(row.id,'done');continue}
  if(action.ignore){this.store.mark(row.id,'done');continue}
  if(action.local){this.store.queue(row.wa,action.local);this.store.mark(row.id,'done');continue}
  // V29: never replace the pending collector/menu with a new opener.
  if(MENU_OPENERS_V29.has(action.name)){
   const active=this.store.getMenu(row.wa);
   if(active&&Number.isFinite(active.endTime)&&active.endTime>Date.now()){
    this.store.queue(row.wa,'Há uma decisão pendente. Envie /menu para consultá-la ou escolha a opção de cancelar.');
    this.store.mark(row.id,'done');continue;
   }
  }
  // Only Core handlers verified by the isolated beta may receive new native requests.
  if(action.name && typeof this.config.canSendPacket==='function' && !this.config.canSendPacket(action.name)){
   this.store.queue(row.wa,'Este recurso do Crownicles ainda não foi habilitado nesta beta. Consulte /ajuda.');
   this.store.mark(row.id,'done');continue;
  }
  const rid=crypto.randomUUID();const pid=this.config.bindings[row.wa];
  try{
   if(action.confirmPreview){
    const {menu,index,token}=action.confirmPreview;
    if(action.socialConsent&&twoParty.recipientJid(this.config.bindings,action.socialConsent.playerId)!==action.socialConsent.wa)throw Error('DESTINATARIO_MUDOU');
    this.store.startConfirmedRequest(row.id,row.wa,pid,rid,menu,index,token,action.socialConsent||null);
   }
   else{this.store.startRequest(row.id,row.wa,pid,rid);if(action.consumeMenu)this.store.clearMenu(row.wa,action.consumeMenu)}
  }catch(e){this.store.queue(row.wa,'A confirmação expirou ou foi substituída. Consulte /menu e solicite nova prévia.');this.store.mark(row.id,'done');continue}
  if(action.equipPending)this.pendingEquip.set(rid,{menu:action.equipPending.menu,wa:row.wa,playerId:pid});
  if(action.nativePending)this.pendingNative.set(rid,action.nativePending.request);
  if(action.targetPending)this.pendingTarget.set(rid,action.targetPending);
  if(action.skipPending)this.pendingSkip.set(rid,action.skipPending);
  try{this.core.send(action.name,action.data,pid,rid)}catch(e){this.pendingEquip.delete(rid);this.pendingNative.delete(rid);this.pendingTarget.delete(rid);this.pendingSkip.delete(rid);this.store.completeRequest(rid);this.store.queue(row.wa,'O motor está indisponível. Consulte /perfil antes de tentar novamente.')}
 }
 }finally{this.working=false;this.flush()}}
 onCore(response){if(this.closed)return;const sub=response.context?.frontEndSubOrigin;const req=sub&&this.store.getRequest(sub);
 // Ignore ALL late packets for completed requests. A different digest must
 // never reopen a menu or issue an extra message after an operation ends.
 if(!req||req.done||response.context?.keycloakId!==req.player_id)return;
 // Reject a late response after the verified conversation binding changed.
 if(this.config.bindings[req.wa]!==req.player_id){this.pendingEquip.delete(sub);this.pendingNative.delete(sub);this.pendingTarget.delete(sub);this.pendingSkip.delete(sub);this.store.completeRequest(sub);this.work();return;}
 const entries=Array.isArray(response.packets)?response.packets:[];
 if(!entries.length){
  // Official PetCaress command can return no packets even when mission logic ran.
  // An empty *reply* confirms handling, not a game reward. Never auto-repeat.
  if(this.pendingNative.get(sub)==='CommandPetCaressPacketReq'){
   this.store.transaction(()=>{this.store.acceptResponse(sub,'__EMPTY_CORE_REPLY__');this.store.completeRequest(sub);
    this.store.queue(req.wa,'*✦ COMPANHEIRO*\nO motor respondeu sem informar recompensas ou mudanças. Consulte /missoes para conferir o progresso; não reenvie automaticamente.');});
   this.pendingNative.delete(sub);this.work();this.flush();
  }
  return;
 }
 // O evento pode carregar uma identidade própria, além do contexto da requisição.
 // Uma notificação de outro jogador nunca pode ser exibida nesta conversa.
 const scoped=new Set(['MissionsCompletedPacket','MissionsExpiredPacket','PlayerLevelUpPacket','KingChallengeTierReachedPacket']);
 const safeEntries=entries.filter(e=>!scoped.has(e.name)||e.packet?.keycloakId===req.player_id);
 if(!safeEntries.length){this.store.completeRequest(sub);this.work();return;}
 const digest=crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex');
 const fresh=this.store.transaction(()=>{
   if(!this.store.acceptResponse(sub,digest))return false;
   // Two-party Core collectors are NEVER shown to the initiating player.
   // Deliver only to a uniquely verified invitee/buyer in the private chat.
   const otherEntries=[];const relayed=[];
   for(const entry of safeEntries){
    if(entry.name!=='ReactionCollectorCreationPacket'||!twoParty.supportedKinds.has(entry.packet?.data?.type)){otherEntries.push(entry);continue;}
    const decision=twoParty.plan({packet:entry.packet,actorId:req.player_id,actorWa:req.wa,bindings:this.config.bindings});
    if(!decision.handled){otherEntries.push(entry);continue}
    if(!decision.ok||typeof this.store.hasPendingRequest!=='function'||this.store.hasPendingRequest(decision.to)){
     relayed.push({blocked:true});continue;
    }
    const active=this.store.getMenu(decision.to);
    if(active&&Number.isFinite(active.endTime)&&active.endTime>Date.now()){relayed.push({blocked:true});continue;}
    this.store.saveMenu(decision.to,decision.menu);
    this.store.queue(decision.to,this.presenter.formatMenu(decision.menu));
    relayed.push({blocked:false,notice:decision.actorNotice});
   }
   const pendingTarget=this.pendingTarget.get(sub),pendingSkip=this.pendingSkip.get(sub);
   const creationCount=otherEntries.filter(e=>e.name==='ReactionCollectorCreationPacket').length;
   const targetContext=this.targetContext();
   const renderContext={targetContext,targetIntent:creationCount===1&&pendingTarget?.stage==='request'?pendingTarget.proof:null,targetResult:pendingTarget?.stage==='react'?pendingTarget.proof:null,skipQuote:creationCount===1?pendingSkip:null};
   let message=this.presenter.apply(otherEntries,req.wa,this.store,req.player_id,renderContext);
   for(const entry of otherEntries){if(entry.name==='CommandGuildPacketRes'){const roster=targets.roster(entry.packet,req.player_id,req.wa,targetContext);if(roster)message=[message,roster].filter(Boolean).join('\n\n');}}
   for(const result of relayed){message=[message,result.blocked?'*✦ PROPOSTA INDISPONÍVEL*\nNão foi possível verificar o destinatário ou entregar a proposta com segurança. Aguarde a expiração do pedido no Core. Nenhuma decisão foi enviada por esta conversa.':result.notice].filter(Boolean).join('\n\n')}
   const equipped=this.pendingEquip.get(sub);
   if(equipped){
    const result=safeEntries.find(e=>e.name==='CommandEquipActionRes')?.packet || {success:false};
    const refreshed=refreshEquipMenu(equipped.menu,result,this.presenter.models);
    if(refreshed){this.store.saveMenu(req.wa,refreshed);message=[message,this.presenter.formatMenu(refreshed)].filter(Boolean).join('\n\n')}
    else message=[message,'A sessão de equipamento terminou. Use /inventario para conferir o estado.'].filter(Boolean).join('\n\n');
   }
   if(message)this.store.queue(req.wa,message);
   if(!req.done)this.store.completeRequest(sub);
   return true;
 });
 if(fresh){this.pendingEquip.delete(sub);this.pendingNative.delete(sub);this.pendingTarget.delete(sub);this.pendingSkip.delete(sub);this.work();this.flush()}}
 async flush(){if(this.closed||this.flushing)return;this.flushing=true;try{let row;while((row=this.store.nextOut())){try{await this.sender(row.wa,row.text);if(this.closed)return;this.store.sent(row.id)}catch(e){if(this.closed)return;this.store.failed(row.id,e.retryable!==false);process.stderr.write('Falha de envio do canal: '+e.message+'\n');break}}}finally{this.flushing=false}}
 maintenance(){if(this.closed)return;const timed=this.store.expireRequests(45000);for(const r of timed){
  this.pendingNative.delete(r.id);this.pendingTarget.delete(r.id);this.pendingSkip.delete(r.id);const pending=this.pendingEquip.get(r.id);if(pending){this.pendingEquip.delete(r.id);const safeMenu=refreshEquipMenu(pending.menu,{success:false},this.presenter.models);if(safeMenu)this.store.saveMenu(r.wa,safeMenu);}
  this.store.queue(r.wa,'⏳ O motor não respondeu a tempo. Consulte /perfil antes de tentar novamente.');
 }this.work();this.flush()}
}
module.exports={Gateway};
