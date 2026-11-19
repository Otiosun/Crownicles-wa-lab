'use strict';
/* Adaptador da entrada beta para a ponte Crownicles ORIGINAL (Store/Gateway).
 * Não cria sessão Baileys, inicializa Core, nem ativa produção. */
const {BetaEntrance,makeCoreRegistration} = require('./entrada.cjs');
const {Gateway} = require('./bridge/gateway.cjs');
const {Store} = require('./bridge/store.cjs');
const {renderHelp}=require('./feature-manifest.cjs');
const {ResponseContextIndex}=require('./response-context.cjs');
const {createContextDispatch}=require('./context-dispatch.cjs');
const path = require('node:path');

function createBetaRuntime({dataDir,ownerJids,core,presenter,send,Player,InventoryInfo,InventorySlot,ItemCategory,enabledPackets=null}) {
 if(!path.isAbsolute(dataDir))throw Error('DIRETORIO_BETA_ABSOLUTO_OBRIGATORIO');
 const store=new Store(path.join(dataDir,'gateway'));
 const verified=enabledPackets===null?null:new Set(enabledPackets);
 const canSendPacket=name=>verified===null||verified.has(name);
 const gateway=new Gateway({bindings:{},canSendPacket},store,presenter,core,send);
 let beta;
 const responseContexts=new ResponseContextIndex({groupEnabled:jid=>!!beta?.groupEnabled(jid)});
 const dispatchWithContext=createContextDispatch({index:responseContexts,receive:(id,jid,text)=>gateway.receive(id,jid,text)});
 const createPlayer=makeCoreRegistration({Player,InventoryInfo,InventorySlot,ItemCategory});
 beta=new BetaEntrance({
  dir:path.join(dataDir,'access'),ownerJids,createPlayer,send,
  getHelp:verified===null?undefined:()=>renderHelp(verified),
  dispatchGame:({id,playerJid,playerUUID,text,sourceChat})=>{
   if(!gateway.config.bindings[playerJid])gateway.config.bindings[playerJid]=playerUUID;
   if(gateway.config.bindings[playerJid]!==playerUUID)throw Error('JID_UUID_DIVERGENTE');
   // Sidecar records request -> player and source; native outbound remains private.
   return dispatchWithContext({id,playerJid,playerUUID,text,sourceChat});
  }
 });
 for(const p of beta.db.prepare("SELECT jid,uuid FROM players WHERE state='active'").all())
  gateway.config.bindings[p.jid]=p.uuid;
 // Load the complete verified roster before reconciling persisted identities.
 gateway.synchronizeBindings();
 const close=()=>{gateway.close();beta.close();store.close();};
 return {beta,gateway,store,responseContexts,handle:msg=>beta.handle(msg),close};
}
module.exports={createBetaRuntime};
