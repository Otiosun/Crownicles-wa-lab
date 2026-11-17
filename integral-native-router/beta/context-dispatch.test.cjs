'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict');
const {createContextDispatch}=require('./context-dispatch.cjs');
const U='11111111-1111-4111-8111-111111111111', P='5511999000001@s.whatsapp.net';
const G='120363111111111111@g.us';
function setup(receive=()=>true){
 const events=[],entries=new Map();let received=0;
 const index={register(r){events.push(['register',r]); const key=r.playerUUID+'|'+r.requestId; const before=entries.get(key);if(before)return before.privateJid===r.privateJid&&before.sourceChat===r.sourceChat?{ok:true,duplicate:true}:{ok:false};entries.set(key,r);return {ok:true,duplicate:false}},finish(r){events.push(['finish',r]);return entries.delete(r.playerUUID+'|'+r.requestId)}};
 const dispatch=createContextDispatch({index,receive:(...args)=>{received++;return receive(...args)}});
 return {index,events,entries,dispatch,get count(){return received}};
}
const msg=(id='msg',sourceChat=G)=>({id,playerUUID:U,playerJid:P,text:'/jogar',sourceChat});
test('envia ao gateway original uma unica vez e mantem resposta privada',()=>{
 const s=setup();assert.equal(s.dispatch(msg()),true);assert.equal(s.count,1);
 assert.equal(s.events[0][1].privateJid,P);assert.equal(s.events[0][1].sourceChat,G);
 assert.equal(s.events[0][1].visibility,'private');assert.equal(s.entries.size,1);
});
test('duplicata identica nao volta a acionar o Core',()=>{
 const s=setup();s.dispatch(msg());assert.equal(s.dispatch(msg()),true);assert.equal(s.count,1);
});
test('colisao entre chats nao redireciona nem executa novo comando',()=>{
 const s=setup();s.dispatch(msg());assert.throws(()=>s.dispatch(msg('msg','120363222222222222@g.us')),/CONTEXTO_REJEITADO/);assert.equal(s.count,1);
});
test('pedido privado por alias mantem JID canonico como endereco de resposta',()=>{
 const s=setup();assert.equal(s.dispatch(msg('a','5511999000009@s.whatsapp.net')),true);
 assert.equal(s.events[0][1].sourceChat,P);assert.equal(s.events[0][1].privateJid,P);
});
test('falha de encaminhamento sincrona limpa registro',()=>{
 const s=setup(()=>false);assert.equal(s.dispatch(msg()),false);assert.equal(s.entries.size,0);assert.equal(s.events.at(-1)[0],'finish');
});
test('falha de encaminhamento assincrona limpa registro',async()=>{
 const s=setup(async()=>false);assert.equal(await s.dispatch(msg()),false);assert.equal(s.entries.size,0);
});
test('excecao da ponte nao deixa contexto pendurado',()=>{
 const s=setup(()=>{throw Error('core offline')});assert.throws(()=>s.dispatch(msg()),/core offline/);assert.equal(s.entries.size,0);
});
test('rejeicao da promessa nao deixa contexto pendurado',async()=>{
 const s=setup(async()=>{throw Error('mqtt offline')});await assert.rejects(s.dispatch(msg()),/mqtt offline/);assert.equal(s.entries.size,0);
});
test('nao aceita indice sem contrato ou ponte nao funcional',()=>{
 assert.throws(()=>createContextDispatch({}),/CONTEXT_DISPATCH_INVALIDO/);
 assert.throws(()=>createContextDispatch({index:{register(){},finish(){}},receive:null}),/CONTEXT_DISPATCH_INVALIDO/);
});
