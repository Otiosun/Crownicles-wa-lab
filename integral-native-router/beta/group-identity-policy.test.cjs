'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {groupIdentityDisposition:check}=require('./group-identity-policy.cjs');
for(const cmd of ['/ajuda','/comandos','/grupo','/regras']){
  test('LID desconhecido consulta informacao publica '+cmd,()=>{
    assert.equal(check({command:cmd}), 'public-info');
    assert.equal(check({command:cmd.toUpperCase()}), 'public-info');
  });
}
for(const cmd of ['/ativar','/desativar','/vinculargrupo']){
  test('controle exige validacao de proprietario no handler '+cmd,()=>{
    assert.equal(check({command:cmd}), 'owner-challenge');
    assert.equal(check({command:cmd,verifiedAlias:true}), 'owner-challenge');
  });
}
for(const cmd of ['/cadastro','/jogar','/perfil','/inventario','/aventura','1','/grupos','/chavegrupo','/vinculardono','/cmdinventado','/ajuda-extra']){
  test('LID desconhecido nao executa jogos ou vinculos sem prova '+cmd,()=>{
    assert.equal(check({command:cmd}), 'private-only');
    assert.equal(check({command:cmd,verifiedAlias:true}), 'verified-sender');
  });
}
test('nao aceita objetos ou valores implicitos como comandos',()=>{
  for(const value of [null,undefined,{},[],123,0]) assert.equal(check({command:value}), 'private-only');
});
test('uma verdade nao-booleana nao prova vinculo',()=>{
  assert.equal(check({command:'/jogar', verifiedAlias:'true'}),'private-only');
  assert.equal(check({command:'/jogar', verifiedAlias:1}),'private-only');
});
