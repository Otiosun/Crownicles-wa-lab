'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const {NATIVE_READ_HANDLERS,probeReadHandlers,renderHelp}=require('./feature-manifest.cjs');
const base=path.join(__dirname,'fake-compiled-Core');
test('mapa so usa caminhos do Core original e sem path traversal',()=>{
 assert(Object.keys(NATIVE_READ_HANDLERS).length>=16);
 for(const [name,rel] of Object.entries(NATIVE_READ_HANDLERS)){
  assert.match(name,/^Command[A-Za-z]+PacketReq$/);
  assert.match(rel,/^commands\/(?:pet|guild|player)\/[A-Za-z]+Command\.js$/);
 }
});
test('carrega somente handlers existentes e efetivamente registrados',()=>{
 const loaded=[];let registered=false;
 const result=probeReadHandlers({dist:base,exists:f=>f.endsWith('PetCommand.js'),load:f=>{loaded.push(f);registered=true},listener:{getListener:name=>name==='CommandPetPacketReq'&&registered?()=>{}:undefined}});
 assert.deepEqual(result.available,['CommandPetPacketReq']);
 assert(loaded.length===1);assert(result.unavailable.includes('CommandEquipPacketReq'));
});
test('handler original ja registrado nao e importado uma segunda vez',()=>{
 let calls=0;const x=probeReadHandlers({dist:base,exists:()=>true,load:()=>calls++,listener:{getListener:n=>n==='CommandPetPacketReq'?()=>{}:undefined}});
 assert.deepEqual(x.available,['CommandPetPacketReq']);assert.equal(calls,15);
});
test('handler com require que explode nao expande permissoes',()=>{
 const x=probeReadHandlers({dist:base,exists:()=>true,load:()=>{throw Error('LOADER_ERROR')},listener:{getListener:()=>undefined}});
 assert.deepEqual(x.available,[]);
});
test('menu publica apenas contratos realmente registrados',()=>{
 const text=renderHelp(['CommandReportPacketReq','CommandProfilePacketReq','CommandInventoryPacketReq','CommandMissionsPacketReq','CommandPetPacketReq']);
 for(const cmd of ['/jogar','/perfil','/inventario','/missoes','/pet'])assert(text.includes(cmd));
 for(const cmd of ['/ranking','/jardim','/equipamentos','/renascer'])assert(!text.includes(cmd));
 assert(!text.includes('/grupo'));
});
test('callback de ajuda preserva comandos da beta sem expor segredos',()=>{
 const text=renderHelp([]);
 assert.match(text,/ajuda/);assert.match(text,/menu/);
 assert(!text.includes('NOT_YET_VERIFIED'));assert(!text.includes('keycloakId'));
});
test('probe exige listener valido',()=>{
 assert.throws(()=>probeReadHandlers({dist:base,listener:{}}),/CORE_PROBE_INVALIDO/);
});
