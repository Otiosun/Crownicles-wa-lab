'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const {NATIVE_READ_HANDLERS,NATIVE_MENU_HANDLERS,probeReadHandlers,probeMenuHandlers,renderHelp}=require('./feature-manifest.cjs');
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
 assert(text.includes('/grupo'));assert(text.includes('/cadastro'));
});
test('callback de ajuda preserva comandos da beta sem expor segredos',()=>{
 const text=renderHelp([]);
 assert.match(text,/ajuda/);assert.match(text,/menu/);
 assert(!text.includes('NOT_YET_VERIFIED'));assert(!text.includes('keycloakId'));
});
test('probe exige listener valido',()=>{
 assert.throws(()=>probeReadHandlers({dist:base,listener:{}}),/CORE_PROBE_INVALIDO/);
});
const MENU_EXPECTED={
 '/combate':'CommandFightPacketReq','/vender':'CommandSellPacketReq',
 '/alimentar':'CommandPetFeedPacketReq','/pocao':'CommandDrinkPacketReq',
 '/diario':'CommandDailyBonusPacketReq','/mudarclasse':'CommandClassesPacketReq',
 '/embarcar':'CommandJoinBoatPacketReq'
};
test('sete comandos de menu têm contratos reais e arquivos Core rastreáveis',()=>{
 assert.equal(Object.keys(NATIVE_MENU_HANDLERS).length,7);
 for(const [command,packet] of Object.entries(MENU_EXPECTED)){
  assert(NATIVE_MENU_HANDLERS[packet],command);
  assert.match(NATIVE_MENU_HANDLERS[packet],/^commands\/(?:player|pet)\/[A-Za-z]+Command\.js$/);
 }
});
for(const [command,packet] of Object.entries(MENU_EXPECTED))test('ajuda só libera '+command+' com handler registrado',()=>{
 const other=Object.values(MENU_EXPECTED).filter(p=>p!==packet);
 assert(!renderHelp(other).split('\n').includes(command));
 assert(renderHelp([packet]).split('\n').includes(command));
});
test('registro de menus exige listener com handler original',()=>{
 const seen=[];const prepared=new Set();
 const obj=probeMenuHandlers({dist:base,exists:f=>f.endsWith('/FightCommand.js'),
  load:f=>{seen.push(f);prepared.add('CommandFightPacketReq')},
  listener:{getListener:name=>prepared.has(name)?()=>{}:undefined}});
 assert.deepEqual(obj.available,['CommandFightPacketReq']);
 assert.equal(obj.unavailable.length,6);assert.equal(seen.length,1);
});
test('arquivo existente sem registro nunca é anunciado nem autorizado',()=>{
 const x=probeMenuHandlers({dist:base,exists:()=>true,load:()=>{},listener:{getListener:()=>undefined}});
 assert.equal(x.available.length,0);assert.equal(x.unavailable.length,7);
 assert(!renderHelp(x.available).split('\n').includes('/combate'));
});
test('import que falha não interrompe consultas antigas nem registra menu',()=>{
 const x=probeMenuHandlers({dist:base,exists:()=>true,load:()=>{throw Error('Core loader failed')},listener:{getListener:()=>undefined}});
 assert.equal(x.unavailable.length,7);
 assert(renderHelp(['CommandProfilePacketReq']).includes('/perfil'));
});
