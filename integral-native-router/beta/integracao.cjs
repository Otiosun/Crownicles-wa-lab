'use strict';
/* Adaptador da entrada beta para a ponte Crownicles ORIGINAL (Store/Gateway).
 * Não cria sessão Baileys, inicializa Core, nem ativa produção. */
const {BetaEntrance,makeCoreRegistration} = require('./entrada.cjs');
const {Gateway} = require('./bridge/gateway.cjs');
const {Store} = require('./bridge/store.cjs');
const path = require('node:path');

function createBetaRuntime({dataDir,ownerJids,core,presenter,send,Player,InventoryInfo,InventorySlot,ItemCategory}) {
 if(!path.isAbsolute(dataDir))throw Error('DIRETORIO_BETA_ABSOLUTO_OBRIGATORIO');
 const store=new Store(path.join(dataDir,'gateway'));
 const gateway=new Gateway({bindings:{}},store,presenter,core,send);
 const createPlayer=makeCoreRegistration({Player,InventoryInfo,InventorySlot,ItemCategory});
 const beta=new BetaEntrance({
  dir:path.join(dataDir,'access'),ownerJids,createPlayer,send,
  dispatchGame:({id,playerJid,playerUUID,text})=>{
   if(!gateway.config.bindings[playerJid])gateway.config.bindings[playerJid]=playerUUID;
   if(gateway.config.bindings[playerJid]!==playerUUID)throw Error('JID_UUID_DIVERGENTE');
   return gateway.receive(id,playerJid,text);
  }
 });
 for(const p of beta.db.prepare("SELECT jid,uuid FROM players WHERE state='active'").all())
  gateway.config.bindings[p.jid]=p.uuid;
 const close=()=>{beta.close();store.close();};
 return {beta,gateway,store,handle:msg=>beta.handle(msg),close};
}
module.exports={createBetaRuntime};
