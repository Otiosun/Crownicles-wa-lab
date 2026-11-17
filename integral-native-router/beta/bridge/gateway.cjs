'use strict';
const crypto=require('node:crypto');
const nativeUniversal=require('./native-universal.cjs');
const {resolveCommand:resolveLote06}=require('./lote06.cjs');
const {resolveCommand:resolveLote07}=require('./lote07.cjs');
const {resolveCommand:resolveLote08}=require('./lote08.cjs');
const {resolveCommand:resolveLote09,verifyEquipIntent,refreshEquipMenu}=require('./lote09.cjs');
const {resolveCommand:resolveLote10,makeMenu:makeNativeAuthMenu,authorizedCommand:authorizedNativeCommand}=require('./lote10.cjs');
const {resolveCommand:resolveLote11,makeNicknameMenu,authorizedNickname}=require('./lote11.cjs');
class Gateway{
 constructor(config,store,presenter,core,sender){this.config=config;this.store=store;this.presenter=presenter;this.core=core;this.sender=sender;this.working=false;this.flushing=false;this.enableEquipActions=process.env.CROWNICLES_WA_EQUIP_ACTIONS==='enabled';this.presenter.allowEquipActions=this.enableEquipActions;this.pendingEquip=new Map();this.pendingNative=new Map();this.closed=false;this.onReady=()=>this.work();this.onResponse=r=>this.onCore(r);this.core.on('ready',this.onReady);this.core.on('response',this.onResponse);}
 close(){if(this.closed)return;this.closed=true;this.core.off?.('ready',this.onReady);this.core.off?.('response',this.onResponse);}
 receive(id,wa,text){if(this.closed||!Object.hasOwn(this.config.bindings,wa))return false;const inserted=this.store.receive(id,wa,text);if(inserted)this.work();return inserted}
 route(row){const line=row.text.trim().toLowerCase();const id=this.config.bindings[row.wa];const novo=require('./lote02.cjs').resolveCommand(line,id);if(novo)return novo;const next=resolveLote06(line)||resolveLote07(line)||resolveLote08(line)||resolveLote09(line)||resolveLote10(line)||resolveLote11(row.text.trim());if(next?.petNickname){const active=this.store.getMenu(row.wa);if(active&&Date.now()<active.endTime)return {local:'Há uma decisão pendente. Envie /menu antes de renomear seu companheiro.'};const menu=makeNicknameMenu(next.petNickname);if(!menu)return {local:'Nome inválido. Nenhuma alteração foi enviada.'};this.store.saveMenu(row.wa,menu);return {local:this.presenter.formatMenu(menu)}}if(next?.localAuthorization){const active=this.store.getMenu(row.wa);if(active&&Date.now()<active.endTime)return {local:'Há uma decisão pendente. Envie /menu antes de abrir outra autorização.'};const menu=makeNativeAuthMenu(next.localAuthorization);if(!menu)return {local:'A autorização não está disponível.'};this.store.saveMenu(row.wa,menu);return {local:this.presenter.formatMenu(menu)}}if(next){if(next.guardMenu){const m=this.store.getMenu(row.wa);if(m&&Date.now()<m.endTime)return {local:'Há uma decisão pendente. Envie /menu antes de abrir os serviços da cidade.'};}return next;}if(line==='/sistemas'||line==='/nativos')return {local:nativeUniversal.help()};
 const universal=nativeUniversal.resolve(row.text.trim(),id);
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
 if(line==='/menu'){const m=this.store.getMenu(row.wa);return {local:m&&Date.now()<m.endTime?this.presenter.formatMenu(m):'Não há nenhuma decisão ativa.'}}
 if(line==='/ajuda'||line==='/comandos')return {local:'*✦ COMANDOS*\n/jogar · /aventura · /perfil · /inventario\n/missoes · /pet · /guilda · /classes\n/historico · /mapa\n/raridades · /bencao · /ranking\n/jardim · /defesa\n/vender · /alimentar · /despensa\n/expedicao · /pocao · /diario\n/equipamentos · /combate\n/versao · /renascer · /recompensaliga\n/diarioguilda\n/mudarclasse · /abrigo · /embarcar\n/renomearpet NOME · /cidade\n/menu · /ajuda · /comandos\n\nPara consultar decisões ativas, use /menu. Envie o número indicado para escolher. Para gastos e decisões irreversíveis, peça a prévia pelo número e siga o código de confirmação indicado.'};
 const confirm=line.match(/^\/confirmar\s+([1-9][0-9]{0,2})\s+([a-f0-9]{8})$/);
 if(confirm||/^[0-9]{1,3}$/.test(line)){
  const m=this.store.getMenu(row.wa);
  if(!m||Date.now()>=m.endTime)return {local:'Não há uma escolha ativa. Consulte /aventura quando estiver disponível.'};
  const number=Number(confirm?confirm[1]:line),index=number-1,choice=m.options?.[index];
  if(!choice)return {local:'Opção inválida. Envie /menu para consultar as escolhas.'};
  if(choice.supported!==true)return {local:'⚠️ Essa decisão ainda não possui uma apresentação segura. Nada foi enviado ao motor.'};
  if(['LocalNativeAuthorization','LocalPetNickname','LocalUniversalNativeAuthorization'].includes(m.type)&&choice.kind==='nativeCancel'&&!confirm){this.store.clearMenu(row.wa,m.id);return {local:'Autorização cancelada. Nada foi enviado ao motor.'};}
  if(m.type==='LocalNativeAuthorization'&&choice.kind!=='nativeAuth')return {local:'Opção não autorizada. Consulte /menu.'};
  if(m.type==='LocalUniversalNativeAuthorization'&&!['universalNative','nativeCancel'].includes(choice.kind))return {local:'Opção não autorizada. Consulte /menu.'};
  if(choice.requiresConfirmation===true&&!confirm){
   const preview=this.store.createPreview(row.wa,m,index);
   return {local:`*✦ REVISÃO DA DECISÃO*\n${choice.label}\n\n*Nada foi executado.*\nPara autorizar apenas esta decisão, envie exatamente:\n*/confirmar ${number} ${preview.token}*\n\nEste código vale até ${new Date(preview.expiresAt).toLocaleTimeString('pt-BR')} e não pode ser reutilizado.`};
  }
  if(choice.requiresConfirmation!==true&&confirm)return {local:'Esta opção não exige confirmação. Envie apenas o número indicado.'};
  if(confirm){
   if(!this.store.previewMatches(row.wa,m,index,confirm[2]))return {local:'Confirmação não corresponde a uma prévia válida. Envie novamente o número da opção para gerar um novo código.'};
   if(choice.kind==='universalNative'){
    const native=nativeUniversal.authorized(m,choice,id);
    if(!native)return {local:'A autorização nativa expirou ou foi invalidada. Nenhuma ação foi enviada.'};
    return {...native,confirmPreview:{menu:m,index,token:confirm[2]},nativePending:{request:native.name}};
   }
   if(choice.kind==='nativeAuth'){const native=authorizedNativeCommand(m,choice);if(!native)return {local:'Autorização não reconhecida. Nenhuma ação foi enviada ao motor.'};return {...native,confirmPreview:{menu:m,index,token:confirm[2]}};}
   if(choice.kind==='petNickname'){const native=authorizedNickname(m,choice,id);if(!native)return {local:'O apelido não corresponde à autorização. Nenhum pedido foi enviado.'};return {...native,confirmPreview:{menu:m,index,token:confirm[2]}};}
   if(choice.kind==='equipAction'){
    if(!this.enableEquipActions||!verifyEquipIntent(m,choice))return {local:'A troca de equipamento não está liberada nesta instalação. Nenhuma alteração foi feita.'};
    const {action,itemCategory,slot}=choice.equip;return {name:'CommandEquipActionReq',data:{action,itemCategory,slot},confirmPreview:{menu:m,index,token:confirm[2]},equipPending:{menu:m}};
   }
   return {name:'ReactionCollectorReactPacket',data:{id:m.id,keycloakId:id,reactionIndex:index},confirmPreview:{menu:m,index,token:confirm[2]}};
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
  // Only Core handlers verified by the isolated beta may receive new native requests.
  if(action.name && typeof this.config.canSendPacket==='function' && !this.config.canSendPacket(action.name)){
   this.store.queue(row.wa,'Este recurso do Crownicles ainda não foi habilitado nesta beta. Consulte /ajuda.');
   this.store.mark(row.id,'done');continue;
  }
  const rid=crypto.randomUUID();const pid=this.config.bindings[row.wa];
  try{
   if(action.confirmPreview){const {menu,index,token}=action.confirmPreview;this.store.startConfirmedRequest(row.id,row.wa,pid,rid,menu,index,token)}
   else{this.store.startRequest(row.id,row.wa,pid,rid);if(action.consumeMenu)this.store.clearMenu(row.wa,action.consumeMenu)}
  }catch(e){this.store.queue(row.wa,'A confirmação expirou ou foi substituída. Consulte /menu e solicite nova prévia.');this.store.mark(row.id,'done');continue}
  if(action.equipPending)this.pendingEquip.set(rid,{menu:action.equipPending.menu,wa:row.wa,playerId:pid});
  if(action.nativePending)this.pendingNative.set(rid,action.nativePending.request);
  try{this.core.send(action.name,action.data,pid,rid)}catch(e){this.pendingEquip.delete(rid);this.pendingNative.delete(rid);this.store.completeRequest(rid);this.store.queue(row.wa,'O motor está indisponível. Consulte /perfil antes de tentar novamente.')}
 }
 }finally{this.working=false;this.flush()}}
 onCore(response){if(this.closed)return;const sub=response.context?.frontEndSubOrigin;const req=sub&&this.store.getRequest(sub);
 // Ignore ALL late packets for completed requests. A different digest must
 // never reopen a menu or issue an extra message after an operation ends.
 if(!req||req.done||response.context?.keycloakId!==req.player_id)return;
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
   let message=this.presenter.apply(safeEntries,req.wa,this.store,req.player_id);
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
 if(fresh){this.pendingEquip.delete(sub);this.pendingNative.delete(sub);this.work();this.flush()}}
 async flush(){if(this.closed||this.flushing)return;this.flushing=true;try{let row;while((row=this.store.nextOut())){try{await this.sender(row.wa,row.text);if(this.closed)return;this.store.sent(row.id)}catch(e){if(this.closed)return;this.store.failed(row.id,e.retryable!==false);process.stderr.write('Falha de envio do canal: '+e.message+'\n');break}}}finally{this.flushing=false}}
 maintenance(){if(this.closed)return;const timed=this.store.expireRequests(45000);for(const r of timed){
  this.pendingNative.delete(r.id);const pending=this.pendingEquip.get(r.id);if(pending){this.pendingEquip.delete(r.id);const safeMenu=refreshEquipMenu(pending.menu,{success:false},this.presenter.models);if(safeMenu)this.store.saveMenu(r.wa,safeMenu);}
  this.store.queue(r.wa,'⏳ O motor não respondeu a tempo. Consulte /perfil antes de tentar novamente.');
 }this.work();this.flush()}
}
module.exports={Gateway};
