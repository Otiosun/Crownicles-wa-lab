'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {EventEmitter}=require('node:events'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Gateway}=require('./bridge/gateway.cjs'),{Store}=require('./bridge/store.cjs'),{Presenter}=require('./bridge/presenter.cjs');
const P='11111111-1111-4111-8111-111111111111',Q='22222222-2222-4222-8222-222222222222',R='44444444-4444-4444-8444-444444444444';
const A='5511999000111@s.whatsapp.net',B='5511999000222@s.whatsapp.net',C='5511999000333@lid';
let n=0;
function make(bindings={[A]:P,[B]:Q},allowed=true){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'crown-social-code-')),store=new Store(dir),core=new EventEmitter(),calls=[];core.ready=true;
 core.send=(name,data,id,requestId)=>calls.push({name,data,id,requestId});
 const gateway=new Gateway({bindings:{...bindings},canSendPacket:()=>allowed},store,new Presenter(dir),core,async()=>{});
 const send=(wa,text)=>gateway.receive('sc-'+(++n),wa,text);
 const out=wa=>store.db.prepare('SELECT text FROM outbox WHERE wa=? ORDER BY id').all(wa).map(x=>x.text).join('\n');
 const token=wa=>store.db.prepare('SELECT token FROM confirmations WHERE wa=?').get(wa)?.token;
 const issue=()=>{send(B,'/meucodigo');const match=out(B).match(/\b[A-F0-9]{16}\b/);a(match,'missing social code');return match[0]};
 const close=()=>{gateway.close();store.close();fs.rmSync(dir,{recursive:true,force:true})};
 return {store,core,gateway,calls,send,out,token,issue,close};
}
test('target obtains one-use private code without Core request',()=>{const h=make();try{const c=h.issue();a.match(c,/^[A-F0-9]{16}$/);a.equal(h.calls.length,0);a.equal(h.store.findRecipientCode(c).player_id,Q)}finally{h.close()}});
test('guild invite only after local preview + confirmation',()=>{const h=make();try{const c=h.issue();h.send(A,'/convidarguilda '+c);a.equal(h.store.getMenu(A).type,'LocalSocialNativeAuthorization');h.send(A,'1');const t=h.token(A);a.match(t,/^[A-F0-9]{8}$/);h.send(A,'/confirmar 1 '+t);a.equal(h.calls.length,1);a.equal(h.calls[0].name,'CommandGuildInvitePacketReq');a.deepEqual(h.calls[0].data,{invitedPlayerKeycloakId:Q});a.equal(h.store.findRecipientCode(c),null)}finally{h.close()}});
test('pet sale preserves Core price and target UUID',()=>{const h=make();try{const c=h.issue();h.send(A,'/oferecerpet '+c+' 125');h.send(A,'1');h.send(A,'/confirmar 1 '+h.token(A));a.deepEqual(h.calls[0].data,{price:125,askedPlayer:{keycloakId:Q}});a.equal(h.calls[0].id,P)}finally{h.close()}});
test('code is single-use even with two simultaneous requesters',()=>{const h=make({[A]:P,[B]:Q,[C]:R});try{const c=h.issue();h.send(A,'/convidarguilda '+c);h.send(C,'/convidarguilda '+c);h.send(A,'1');h.send(C,'1');const ta=h.token(A),tc=h.token(C);h.send(A,'/confirmar 1 '+ta);h.send(C,'/confirmar 1 '+tc);a.equal(h.calls.length,1)}finally{h.close()}});
test('regenerated code revokes old pending authorization',()=>{const h=make();try{const c=h.issue();h.send(A,'/convidarguilda '+c);h.send(A,'1');const t=h.token(A);h.send(B,'/meucodigo');h.send(A,'/confirmar 1 '+t);a.equal(h.calls.length,0)}finally{h.close()}});
test('rebound target UUID blocks the original social request',()=>{const h=make();try{const c=h.issue();h.send(A,'/convidarguilda '+c);h.send(A,'1');const t=h.token(A);h.gateway.config.bindings[B]=R;h.send(A,'/confirmar 1 '+t);a.equal(h.calls.length,0)}finally{h.close()}});
test('unknown code never reaches Core',()=>{const h=make();try{h.send(A,'/convidarguilda 0000000000000000');a.equal(h.calls.length,0);a.match(h.out(A),/inválido/)}finally{h.close()}});
test('unregistered native handler blocks social menu',()=>{const h=make(undefined,false);try{const c=h.issue();h.send(A,'/convidarguilda '+c);a.equal(h.store.getMenu(A),null);a.equal(h.calls.length,0)}finally{h.close()}});
test('cancellation never consumes shared code',()=>{const h=make();try{const c=h.issue();h.send(A,'/convidarguilda '+c);h.send(A,'2');a.equal(h.calls.length,0);a(h.store.findRecipientCode(c));a.equal(h.store.getMenu(A),null)}finally{h.close()}});
