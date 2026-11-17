'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {ResponseContextIndex}=require('./response-context.cjs');
const U1='11111111-1111-4111-8111-111111111111',U2='22222222-2222-4222-8222-222222222222';
const P1='5511999000001@s.whatsapp.net',P2='5511999000002@s.whatsapp.net';
const G1='120363111111111111@g.us',G2='120363222222222222@g.us';
const t=(id,uuid=U1,privateJid=P1,sourceChat=G1,visibility='private')=>({requestId:id,playerUUID:uuid,privateJid,sourceChat,visibility});
test('um comando privado enviado em grupo nunca vira resposta publica',()=>{
 const x=new ResponseContextIndex({groupEnabled:()=>true});
 assert.deepEqual(x.register(t('a')),{ok:true,duplicate:false,groupEligible:false});
 assert.deepEqual(x.resolve({requestId:'a',playerUUID:U1}),{to:P1,visibility:'private'});
});
test('grupo publico depende de classificacao explicita E ativacao',()=>{
 let active=true;const x=new ResponseContextIndex({groupEnabled:()=>active});
 x.register(t('a',U1,P1,G1,'group-info'));
 assert.equal(x.resolve({requestId:'a',playerUUID:U1}).to,G1);
 active=false;
 assert.equal(x.resolve({requestId:'a',playerUUID:U1}).to,P1);
 active=true;
 x.register(t('b',U1,P1,G2,'group-info'));
 assert.equal(x.resolve({requestId:'b',playerUUID:U1}).to,G2);
});
test('grupo desligado na criacao nao ganha visibilidade por ativacao tardia',()=>{
 let active=false;const x=new ResponseContextIndex({groupEnabled:()=>active});
 x.register(t('a',U1,P1,G1,'group-info'));
 active=true;
 assert.equal(x.resolve({requestId:'a',playerUUID:U1}).to,P1);
});
test('mesmo ID de mensagem de dois jogadores nunca cruza a resposta',()=>{
 const x=new ResponseContextIndex({groupEnabled:()=>true});
 x.register(t('same',U1,P1,G1,'group-info'));
 x.register(t('same',U2,P2,G2,'private'));
 assert.equal(x.resolve({requestId:'same',playerUUID:U1}).to,G1);
 assert.equal(x.resolve({requestId:'same',playerUUID:U2}).to,P2);
 assert.equal(x.resolve({requestId:'same',playerUUID:'33333333-3333-4333-8333-333333333333'}),null);
});
test('replay identico nao altera contexto e colisao entre chats bloqueia',()=>{
 const x=new ResponseContextIndex({groupEnabled:()=>true});
 assert.equal(x.register(t('a')).ok,true);
 assert.deepEqual(x.register(t('a')),{ok:true,duplicate:true});
 assert.equal(x.register(t('a',U1,P1,G2)).reason,'context-conflict');
 assert.equal(x.resolve({requestId:'a',playerUUID:U1}).to,P1);
});
test('nao confia em contexto invalido, falsos grupos ou outro remetente privado',()=>{
 const x=new ResponseContextIndex({groupEnabled:()=>true});
 assert.equal(x.register(t('a',U1,P1,P2)).reason,'invalid-context');
 assert.equal(x.register(t('a',U1,G1,G1)).reason,'invalid-context');
 assert.equal(x.register(t('a',U1,P1,G1,'public')).reason,'invalid-context');
 assert.equal(x.register(t('a','not-a-uuid',P1,G1)).reason,'invalid-context');
 assert.equal(x.size,0);
});
test('TTL expira e limpeza nao reinterpreta respostas antigas',()=>{
 let now=100000;const x=new ResponseContextIndex({clock:()=>now,ttlMs:1000,groupEnabled:()=>true});
 x.register(t('a',U1,P1,G1,'group-info'));
 now+=1000;
 assert.equal(x.resolve({requestId:'a',playerUUID:U1}),null);
 assert.equal(x.size,0);
});
test('capacidade limitada descarta antigos antes de ampliar memoria',()=>{
 const x=new ResponseContextIndex({maxEntries:2});
 x.register(t('a'));x.register(t('b'));x.register(t('c'));
 assert.equal(x.size,2);
 assert.equal(x.resolve({requestId:'a',playerUUID:U1}),null);
 assert.equal(x.resolve({requestId:'b',playerUUID:U1}).to,P1);
});
test('conclusao remove somente a requisicao correta',()=>{
 const x=new ResponseContextIndex();x.register(t('a'));x.register(t('b'));
 assert.equal(x.finish({requestId:'a',playerUUID:U1}),true);
 assert.equal(x.resolve({requestId:'a',playerUUID:U1}),null);
 assert.equal(x.resolve({requestId:'b',playerUUID:U1}).to,P1);
});
test('falha na consulta de grupo cai para privado',()=>{
 const x=new ResponseContextIndex({groupEnabled:()=>{throw Error('offline')}});
 x.register(t('a',U1,P1,G1,'group-info'));
 assert.equal(x.resolve({requestId:'a',playerUUID:U1}).to,P1);
});
test('200 respostas reordenadas em dois grupos nao trocam destinatarios',()=>{
 const x=new ResponseContextIndex({maxEntries:300,groupEnabled:()=>true});
 const records=[];
 for(let i=0;i<200;i++){
  const playerUUID='11111111-1111-4111-8111-'+i.toString(16).padStart(12,'0');
  const sourceChat=i%2?G1:G2, privateJid=i%2?P1:P2;
  const visibility=i%5===0?'group-info':'private';
  const requestId='msg-'+(i%7);
  const expected=visibility==='group-info'?sourceChat:privateJid;
  const record={requestId,playerUUID,privateJid,sourceChat,visibility,expected};
  assert.equal(x.register(record).ok,true);
  records.push(record);
 }
 for(const r of records.reverse()){
  const output=x.resolve(r);
  assert.equal(output.to,r.expected);
  assert.equal(x.finish(r),true);
 }
 assert.equal(x.size,0);
});
