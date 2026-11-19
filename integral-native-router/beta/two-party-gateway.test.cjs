'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {EventEmitter}=require('node:events'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Gateway}=require('./bridge/gateway.cjs'),{Store}=require('./bridge/store.cjs'),{Presenter}=require('./bridge/presenter.cjs');
const P='11111111-1111-4111-8111-111111111111',Q='22222222-2222-4222-8222-222222222222',R='44444444-4444-4444-8444-444444444444';
const A='5511999000111@s.whatsapp.net',B='5511999000222@s.whatsapp.net',C='5511999000333@lid',ID='33333333-3333-4333-8333-333333333333';
const accept={type:'ReactionCollectorAcceptReaction',data:{}},refuse={type:'ReactionCollectorRefuseReaction',data:{}};
const pet={typeId:12,nickname:'Lua',rarity:2,sex:'f',loveLevel:1,force:1,feedDelay:0};
let seq=0;
function make(bindings={[A]:P,[B]:Q}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'crown-multi-social-')),store=new Store(dir),calls=[],core=new EventEmitter();core.ready=true;
 core.send=(name,data,id,requestId)=>calls.push({name,data,id,requestId});
 const gw=new Gateway({bindings:{...bindings},canSendPacket:()=>true},store,new Presenter(dir),core,async()=>{});
 const send=(jid,text)=>gw.receive('social-'+(++seq),jid,text);
 const begin=(jid=A)=>{send(jid,'/perfil');return calls.at(-1).requestId};
 const beginSocial=(sale=false)=>{
  send(B,'/meucodigo');
  const code=out(B).match(/\b[A-F0-9]{16}\b/g).at(-1);
  send(A,(sale?'/oferecerpet ':'/convidarguilda ')+code+(sale?' 125':''));
  send(A,'1');send(A,'/confirmar 1 '+token(A));
  return calls.at(-1).requestId;
 };
 const offer=(req,type,data,reactions=[accept,refuse])=>core.emit('response',{context:{frontEndSubOrigin:req,keycloakId:P},packets:[{name:'ReactionCollectorCreationPacket',packet:{id:ID,endTime:Date.now()+60000,data:{type,data},reactions}}]});
 const out=jid=>store.db.prepare('SELECT text FROM outbox WHERE wa=? ORDER BY id').all(jid).map(x=>x.text).join('\n');
 const token=jid=>store.db.prepare('SELECT token FROM confirmations WHERE wa=?').get(jid)?.token;
 const close=()=>{gw.close();store.close();fs.rmSync(dir,{recursive:true,force:true})};
 return {gw,core,store,calls,send,begin,beginSocial,offer,out,token,close};
}
const invite={guildName:'Estrelas',invitedPlayerKeycloakId:Q},sale={sellerKeycloakId:P,buyerKeycloakId:Q,price:125,pet};
test('Core invitation is private to invited player',()=>{const h=make();try{const req=h.beginSocial();h.offer(req,'ReactionCollectorGuildInviteData',invite);a.equal(h.store.getMenu(A),null);a.equal(h.store.getMenu(B)?.restrictedToPlayerId,Q);a.match(h.out(B),/CONVITE PARA GUILDA/);a.doesNotMatch(h.out(A),/Aceitar convite/)}finally{h.close()}});
test('invited uses own one-use token and actual Core reaction',()=>{const h=make();try{const req=h.beginSocial();h.offer(req,'ReactionCollectorGuildInviteData',invite);h.send(B,'1');const t=h.token(B);a.match(t,/^[A-F0-9]{8}$/);a.equal(h.calls.length,1);h.send(B,'/confirmar 1 '+t);a.equal(h.calls[1].name,'ReactionCollectorReactPacket');a.equal(h.calls[1].id,Q);a.equal(h.calls[1].data.reactionIndex,0);h.send(B,'/confirmar 1 '+t);a.equal(h.calls.length,2)}finally{h.close()}});
test('invitee may refuse at original index without confirmation',()=>{const h=make();try{const req=h.beginSocial();h.offer(req,'ReactionCollectorGuildInviteData',invite);h.send(B,'2');a.equal(h.calls[1].name,'ReactionCollectorReactPacket');a.equal(h.calls[1].id,Q);a.equal(h.calls[1].data.reactionIndex,1)}finally{h.close()}});
test('named pet sale displays buyer exact original price and name',()=>{const h=make();try{const req=h.beginSocial(true);h.offer(req,'ReactionCollectorPetSellData',sale);a.match(h.out(B),/125 moedas/);a.match(h.out(B),/Lua/);a.doesNotMatch(h.out(A),/Aceitar compra/)}finally{h.close()}});
test('unregistered buyer gets no offer',()=>{const h=make();try{const req=h.beginSocial(true);delete h.gw.config.bindings[B];h.offer(req,'ReactionCollectorPetSellData',sale);a.equal(h.store.getMenu(B),null);a.match(h.out(A),/INDISPONÍVEL/)}finally{h.close()}});
test('unaddressed pet sale never broadcasts',()=>{const h=make();try{const req=h.beginSocial(true);h.offer(req,'ReactionCollectorPetSellData',{sellerKeycloakId:P,price:125,pet});a.equal(h.store.getMenu(B),null);a.match(h.out(A),/INDISPONÍVEL/)}finally{h.close()}});
test('multiple target aliases are not guessed',()=>{const h=make();try{const req=h.beginSocial();h.gw.config.bindings[C]=Q;h.offer(req,'ReactionCollectorGuildInviteData',invite);a.equal(h.store.getMenu(B),null);a.equal(h.store.getMenu(C),null)}finally{h.close()}});
test('existing target menu is not replaced by an invite',()=>{const h=make();try{const req=h.beginSocial();h.store.saveMenu(B,{id:ID,endTime:Date.now()+80000,type:'old',title:'Original',story:'',options:[]});h.offer(req,'ReactionCollectorGuildInviteData',invite);a.equal(h.store.getMenu(B).title,'Original');a.match(h.out(A),/INDISPONÍVEL/)}finally{h.close()}});
test('busy recipient awaiting Core is not interrupted',()=>{const h=make();try{const req=h.beginSocial();h.begin(B);h.offer(req,'ReactionCollectorGuildInviteData',invite);a.equal(h.store.getMenu(B),null);a.match(h.out(A),/INDISPONÍVEL/)}finally{h.close()}});
test('UUID change prevents viewing or acting on pending invitation',()=>{const h=make();try{const req=h.beginSocial();h.offer(req,'ReactionCollectorGuildInviteData',invite);h.gw.config.bindings[B]=R;h.send(B,'/menu');a.match(h.out(B),/Não há nenhuma decisão ativa/);h.send(B,'1');a.equal(h.calls.length,1)}finally{h.close()}});
test('wrong Core source identity cannot route a collector',()=>{const h=make();try{const req=h.beginSocial();h.core.emit('response',{context:{frontEndSubOrigin:req,keycloakId:Q},packets:[{name:'ReactionCollectorCreationPacket',packet:{id:ID,endTime:Date.now()+60000,data:{type:'ReactionCollectorGuildInviteData',data:invite},reactions:[accept,refuse]}}]});a.equal(h.store.getMenu(B),null)}finally{h.close()}});
test('duplicate Core message cannot reissue offer',()=>{const h=make();try{const req=h.beginSocial();h.offer(req,'ReactionCollectorGuildInviteData',invite);const n=h.store.db.prepare('SELECT COUNT(*) n FROM outbox WHERE wa=?').get(B).n;h.offer(req,'ReactionCollectorGuildInviteData',invite);a.equal(h.store.db.prepare('SELECT COUNT(*) n FROM outbox WHERE wa=?').get(B).n,n)}finally{h.close()}});

test('unsolicited invitation in a profile response cannot reach another player',()=>{const h=make();try{const req=h.begin();h.offer(req,'ReactionCollectorGuildInviteData',invite);a.equal(h.store.getMenu(B),null);a.match(h.out(A),/INDISPONÍVEL/);a.doesNotMatch(h.out(B),/CONVITE PARA GUILDA/)}finally{h.close()}});
test('Core cannot substitute another registered recipient after consent',()=>{const h=make({[A]:P,[B]:Q,[C]:R});try{const req=h.beginSocial();h.offer(req,'ReactionCollectorGuildInviteData',{...invite,invitedPlayerKeycloakId:R});a.equal(h.store.getMenu(C),null);a.equal(h.store.getMenu(B),null);a.match(h.out(A),/INDISPONÍVEL/)}finally{h.close()}});
test('Core cannot change authorized sale price',()=>{const h=make();try{const req=h.beginSocial(true);h.offer(req,'ReactionCollectorPetSellData',{...sale,price:126});a.equal(h.store.getMenu(B),null);a.match(h.out(A),/INDISPONÍVEL/)}finally{h.close()}});
test('Core cannot swap authorized guild invitation into sale',()=>{const h=make();try{const req=h.beginSocial();h.offer(req,'ReactionCollectorPetSellData',sale);a.equal(h.store.getMenu(B),null);a.match(h.out(A),/INDISPONÍVEL/)}finally{h.close()}});
test('two collectors in same response never produce a social menu',()=>{const h=make();try{const req=h.beginSocial();const entry={name:'ReactionCollectorCreationPacket',packet:{id:ID,endTime:Date.now()+60000,data:{type:'ReactionCollectorGuildInviteData',data:invite},reactions:[accept,refuse]}};h.core.emit('response',{context:{frontEndSubOrigin:req,keycloakId:P},packets:[entry,entry]});a.equal(h.store.getMenu(A),null);a.equal(h.store.getMenu(B),null);a.match(h.out(A),/INDISPONÍVEL/)}finally{h.close()}});
test('recipient change observed then restored still invalidates pending proposal',()=>{const h=make();try{const req=h.beginSocial();h.gw.config.bindings[B]=R;h.gw.synchronizeBindings();h.gw.config.bindings[B]=Q;h.gw.synchronizeBindings();h.offer(req,'ReactionCollectorGuildInviteData',invite);a.equal(h.store.getMenu(B),null);a.match(h.out(A),/INDISPONÍVEL/)}finally{h.close()}});
test('unexpected ordinary collector cannot replace initiator menu after social confirmation',()=>{const h=make();try{const req=h.beginSocial();h.offer(req,'ReactionCollectorUnknownData',{});a.equal(h.store.getMenu(A),null);a.equal(h.store.getMenu(B),null);a.match(h.out(A),/INDISPONÍVEL/)}finally{h.close()}});
