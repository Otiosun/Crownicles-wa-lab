'use strict';
// In Node22+ this suite uses real disposable SQLite, real Node crypto, FakeCore only.
const {test}=require('node:test'),a=require('node:assert/strict'),{EventEmitter}=require('node:events'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Gateway}=require('./bridge/gateway.cjs'),{Store}=require('./bridge/store.cjs'),{Presenter}=require('./bridge/presenter.cjs'),T=require('./bridge/reviewed-target-collectors.cjs');
const P='11111111-1111-4111-8111-111111111111',Q='22222222-2222-4222-8222-222222222222',R='33333333-3333-4333-8333-333333333333',A='5511999000111@s.whatsapp.net',B='5511999000222@s.whatsapp.net',C='5511999000333@s.whatsapp.net',ID='44444444-4444-4444-8444-444444444444',ID2='55555555-5555-4555-8555-555555555555';
const RC='ReactionCollector',rx=(type,data={})=>({type:RC+type+'Reaction',data}),accept=rx('Accept'),refuse=rx('Refuse'),packet=(kind,data,reactions=[accept,refuse],id=ID)=>({id,endTime:Date.now()+60000,data:{type:RC+kind+'Data',data},reactions});
let seq=0;
function make(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'crown-targets-')),store=new Store(dir),calls=[],core=new EventEmitter(),allowed=new Set(['ReactionCollectorReactPacket','CommandGuildElderPacketReq','CommandGuildKickPacketReq','CommandUnlockPacketReq','CommandGuildPacketReq','CommandProfilePacketReq','CommandReportPacketReq']);
 core.ready=true;core.send=(name,data,playerId,requestId)=>calls.push({name,data,playerId,requestId});
 const gw=new Gateway({bindings:{[A]:P,[B]:Q,[C]:R},canSendPacket:n=>allowed.has(n)},store,new Presenter(dir),core,async()=>{});
 const send=(text,wa=A)=>gw.receive('target-'+(++seq),wa,text);
 const token=(wa=A)=>store.db.prepare('SELECT token FROM confirmations WHERE wa=?').get(wa)?.token;
 const submit=(index=1,wa=A)=>{send(String(index),wa);const t=token(wa);a.ok(t);send('/confirmar '+index+' '+t,wa);return t};
 const coreReply=(entries,req=calls.at(-1),playerId=req.playerId)=>core.emit('response',{context:{frontEndSubOrigin:req.requestId,keycloakId:playerId},packets:entries});
 const collector=(p,req)=>coreReply([{name:'ReactionCollectorCreationPacket',packet:p}],req);
 const out=(wa=A)=>store.db.prepare('SELECT text FROM outbox WHERE wa=? ORDER BY id').all(wa).map(x=>x.text).join('\n');
 const close=()=>{gw.close();store.close();fs.rmSync(dir,{recursive:true,force:true})};
 return {gw,store,core,calls,allowed,send,token,submit,coreReply,collector,out,close,ref:T.reference(store.origin,Q)};
}
function start(h,k='kick'){h.send(T.DEFS[k].verb+' '+h.ref);a.ok(h.store.getMenu(A)?.type==='LocalVerifiedTargetAuthorization');h.submit();return h.calls[0]}
test('new verified ref is distinct from consent token and stays in private outbox',()=>{const h=make();try{h.send('/minharef',B);a.ok(h.out(B).includes(h.ref)&&!h.out(A).includes(h.ref)&&!h.out(B).includes(Q)&&!h.calls.length)}finally{h.close()}});
for(const key of ['promote','kick','unlock'])test('two distinct confirmations and exact native reaction for '+key,()=>{const h=make();try{
 const def=T.DEFS[key],initial=start(h,key);a.ok(initial.name===def.request&&h.calls.length===1&&JSON.stringify(initial.data)===JSON.stringify(key==='promote'?{askedPlayerKeycloakId:Q}:{askedPlayer:{keycloakId:Q}}));
 h.collector(packet(def.kind.slice(RC.length,-4),{...(key==='unlock'?{}:{guildName:'Aurora'}),[def.field]:Q},[refuse,accept]),initial);
 const m=h.store.getMenu(A);a.ok(m.options[0].supported&&!m.options[0].requiresConfirmation&&m.options[1].requiresConfirmation&&m.restrictedToPlayerId===P&&h.out(A).includes(h.ref));h.send('2');a.ok(h.calls.length===1);const nonce=h.token();h.send('/confirmar 2 '+nonce,B);a.ok(h.calls.length===1);h.send('/confirmar 2 '+nonce);a.ok(h.calls.length===2&&h.calls[1].name==='ReactionCollectorReactPacket'&&h.calls[1].data.reactionIndex===1&&h.calls[1].data.id===ID&&h.calls[1].data.keycloakId===P);
 h.send('/confirmar 2 '+nonce);a.ok(h.calls.length===2);
 }finally{h.close()}});
test('wrong Core target only allows cancellation at original index',()=>{const h=make();try{const initial=start(h);h.collector(packet('GuildKick',{guildName:'Aurora',kickedKeycloakId:R}),initial);const m=h.store.getMenu(A);a.ok(!m.options[0].supported&&m.options[1].supported);h.send('1');a.ok(h.calls.length===1);h.send('2');a.ok(h.calls.length===2&&h.calls[1].data.reactionIndex===1)}finally{h.close()}});
test('unprompted target collector cannot authorize even with a valid binding',()=>{const h=make();try{h.send('/perfil');h.collector(packet('GuildKick',{guildName:'Aurora',kickedKeycloakId:Q}));a.ok(!h.store.getMenu(A).options[0].supported);h.send('1');a.ok(h.calls.length===1)}finally{h.close()}});
test('listener revocation between preview and native confirmation prevents second send',()=>{const h=make();try{const initial=start(h);h.collector(packet('GuildKick',{guildName:'Aurora',kickedKeycloakId:Q}),initial);h.send('1');const token=h.token();h.allowed.delete('CommandGuildKickPacketReq');h.send('/confirmar 1 '+token);a.ok(h.calls.length===1)}finally{h.close()}});
test('rebound target invalidates second confirmation',()=>{const h=make();try{const initial=start(h);h.collector(packet('GuildKick',{guildName:'Aurora',kickedKeycloakId:Q}),initial);h.send('1');const token=h.token();h.gw.config.bindings[B]=R;h.send('/confirmar 1 '+token);a.ok(h.calls.length===1)}finally{h.close()}});
test('rebound actor discards late response before any menu delivery',()=>{const h=make();try{const initial=start(h);h.gw.config.bindings[A]=R;h.collector(packet('GuildKick',{guildName:'Aurora',kickedKeycloakId:Q}),initial);a.ok(!h.store.getMenu(A)&&h.store.getRequest(initial.requestId).done)}finally{h.close()}});
test('two target collectors in same reply cannot open authorized accept',()=>{const h=make();try{const initial=start(h);const p=packet('GuildKick',{guildName:'Aurora',kickedKeycloakId:Q});h.coreReply([{name:'ReactionCollectorCreationPacket',packet:p},{name:'ReactionCollectorCreationPacket',packet:{...p,id:ID2}}],initial);a.ok(!h.store.getMenu(A).options[0].supported)}finally{h.close()}});
test('mismatched target result warns instead of confirming intended action',()=>{const h=make();try{const initial=start(h);h.collector(packet('GuildKick',{guildName:'Aurora',kickedKeycloakId:Q}),initial);h.submit();h.coreReply([{name:'CommandGuildKickAcceptPacketRes',packet:{guildName:'Aurora',kickedKeycloakId:R}}]);a.ok(h.out().includes('RESULTADO DIVERGENTE')&&!h.out().includes(R))}finally{h.close()}});
test('guild snapshot shows role, rank, reference only for this actor',()=>{const h=make();try{h.send('/guilda');h.coreReply([{name:'CommandGuildPacketRes',packet:{foundGuild:true,askedPlayerKeycloakId:P,data:{name:'Aurora',chiefId:1,elderId:2,members:[{id:1,keycloakId:P,rank:5},{id:2,keycloakId:Q,rank:12}]}}}]);a.ok(h.out().includes('Ancião · rank 12 · '+h.ref)&&!h.out().includes(Q))}finally{h.close()}});
test('poor event permits only one coin after nonce and result does not claim transfer',()=>{const h=make();try{h.send('/aventura');h.collector(packet('InteractOtherPlayersPoor',{keycloakId:Q,rank:0}));h.submit();a.ok(h.calls[1].data.reactionIndex===0);h.coreReply([{name:'SmallEventInteractOtherPlayersAcceptToGivePoorPacket',packet:{}}]);a.ok(h.out().includes('não confirma a transferência'))}finally{h.close()}});
test('shop quote follows exact request to native skip listing; only close can dispatch',()=>{const h=make();try{
 h.send('/aventura');h.collector(packet('Shop',{currency:'gem',availableCurrency:10,additionalShopData:{}},[rx('ShopItem',{shopCategoryId:'services',shopItemId:13,price:2,amount:1}),rx('ShopClose')]));
 const first=h.store.getMenu(A);a.ok(first.options[0].skipQuote.price===2);h.submit();const mis={missionId:'commandReport',missionObjective:5,missionVariant:0,numberDone:2,missionType:'sideMission'};
 h.collector(packet('SkipMissionShopItem',{},[rx('SkipMissionShopItem',{missionIndex:0,mission:mis}),rx('SkipMissionShopItemClose')],ID2));
 const second=h.store.getMenu(A);a.ok(second.story.includes('Cotação da loja anterior: 2')&&!second.options[0].supported&&second.options[1].supported);h.send('1');a.ok(h.calls.length===2);h.send('2');a.ok(h.calls.length===3&&h.calls[2].data.id===ID2&&h.calls[2].data.reactionIndex===1);
 }finally{h.close()}});
test('unquoted skip menu cannot borrow price from previous user or old request',()=>{const h=make();try{h.send('/aventura');const mis={missionId:'commandReport',missionObjective:5,missionVariant:0,numberDone:2,missionType:'sideMission'};h.collector(packet('SkipMissionShopItem',{},[rx('SkipMissionShopItem',{missionIndex:0,mission:mis}),rx('SkipMissionShopItemClose')]));a.ok(h.store.getMenu(A).story.includes('Não há cotação')&&!h.store.getMenu(A).options[0].supported)}finally{h.close()}});
