'use strict';
/* Strict, reviewable patch against V2.3/V2.4 beta. Only code, never SQLite/auth. */
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(process.argv[2]||'.');
function edit(file,mutate){
 const full=path.join(base,file);
 if(!fs.statSync(full).isFile())throw Error('ARQUIVO_INVALIDO_'+file);
 const old=fs.readFileSync(full,'utf8');
 const changed=mutate(old);
 if(typeof changed!=='string'||!changed.startsWith("'use strict';"))throw Error('SAIDA_INVALIDA_'+file);
 if(old!==changed)fs.writeFileSync(full,changed,{mode:0o600});
 console.log('PATCH_'+file.replace(/[^a-zA-Z0-9]+/g,'_')+'='+(old===changed?'JA_APLICADO':'OK'));
}
function once(src,old,replacement,label){
 if(src.includes(replacement))return src;
 const pieces=src.split(old);
 if(pieces.length!==2)throw Error('CONTRATO_ALTERADO_'+label);
 return pieces.join(replacement);
}
edit('entrada.cjs',src=>{
 if(!src.includes('CREATE TABLE IF NOT EXISTS admin_claims'))throw Error('ENTRADA_ANTIGA');
 src=once(src,
  'constructor({ dir, ownerJids = [], createPlayer, dispatchGame, send, clock = Date.now })',
  'constructor({ dir, ownerJids = [], createPlayer, dispatchGame, send, clock = Date.now, getHelp = null })','entrada_ctor');
 src=once(src,'    this.send = send;',
  "    this.getHelp = typeof getHelp === 'function' ? getHelp : () => HELP;\n    this.send = send;",'entrada_help_provider');
 src=once(src,"if (cmd === '/ajuda' || cmd === '/comandos') return answer(HELP, chat);",
  "if (cmd === '/ajuda' || cmd === '/comandos') return answer(this.getHelp(), chat);",'entrada_help_route');
 return src;
});
edit('integracao.cjs',src=>{
 src=once(src,"const {Store} = require('./bridge/store.cjs');",
  "const {Store} = require('./bridge/store.cjs');\nconst {renderHelp}=require('./feature-manifest.cjs');",'integracao_require');
 src=once(src,
  'function createBetaRuntime({dataDir,ownerJids,core,presenter,send,Player,InventoryInfo,InventorySlot,ItemCategory})',
  'function createBetaRuntime({dataDir,ownerJids,core,presenter,send,Player,InventoryInfo,InventorySlot,ItemCategory,enabledPackets=null})','integracao_ctor');
 src=once(src,' const gateway=new Gateway({bindings:{}},store,presenter,core,send);',
  ' const verified=enabledPackets===null?null:new Set(enabledPackets);\n const canSendPacket=name=>verified===null||verified.has(name);\n const gateway=new Gateway({bindings:{},canSendPacket},store,presenter,core,send);','integracao_gateway');
 src=once(src,"  dir:path.join(dataDir,'access'),ownerJids,createPlayer,send,",
  "  dir:path.join(dataDir,'access'),ownerJids,createPlayer,send,\n  getHelp:verified===null?undefined:()=>renderHelp(verified),",'integracao_beta');
 src=once(src,' const close=()=>{beta.close();store.close();};',
  ' const close=()=>{gateway.close();beta.close();store.close();};','integracao_close');
 return src;
});
edit('bridge/gateway.cjs',src=>{
 src=once(src,"this.core.on('ready',()=>this.work());this.core.on('response',r=>this.onCore(r));}",
  "this.closed=false;this.onReady=()=>this.work();this.onResponse=r=>this.onCore(r);this.core.on('ready',this.onReady);this.core.on('response',this.onResponse);}",'gateway_listener');
 src=once(src,' receive(id,wa,text){if(!Object.hasOwn(this.config.bindings,wa))return false;',
  " close(){if(this.closed)return;this.closed=true;this.core.off?.('ready',this.onReady);this.core.off?.('response',this.onResponse);}\n receive(id,wa,text){if(this.closed||!Object.hasOwn(this.config.bindings,wa))return false;",'gateway_close');
 src=once(src,' work(){if(this.working||!this.core.ready)return;',
  ' work(){if(this.closed||this.working||!this.core.ready)return;','gateway_work');
 src=once(src,' onCore(response){const sub=response.context?.frontEndSubOrigin;',
  ' onCore(response){if(this.closed)return;const sub=response.context?.frontEndSubOrigin;','gateway_core_response');
 src=once(src,' async flush(){if(this.flushing)return;',
  ' async flush(){if(this.closed||this.flushing)return;','gateway_flush');
 src=once(src,'while((row=this.store.nextOut())){try{await this.sender(row.wa,row.text);this.store.sent(row.id)}catch(e){this.store.failed(row.id,e.retryable!==false);',
  'while((row=this.store.nextOut())){try{await this.sender(row.wa,row.text);if(this.closed)return;this.store.sent(row.id)}catch(e){if(this.closed)return;this.store.failed(row.id,e.retryable!==false);','gateway_flush_after_close');
 src=once(src,' maintenance(){const timed=this.store.expireRequests(45000);',
  ' maintenance(){if(this.closed)return;const timed=this.store.expireRequests(45000);','gateway_maintenance');
 const old="  if(action.local){this.store.queue(row.wa,action.local);this.store.mark(row.id,'done');continue}";
 const extra="\n  // Only Core handlers verified by the isolated beta may receive new native requests.\n  if(action.name && typeof this.config.canSendPacket==='function' && !this.config.canSendPacket(action.name)){\n   this.store.queue(row.wa,'Este recurso do Crownicles ainda não foi habilitado nesta beta. Consulte /ajuda.');\n   this.store.mark(row.id,'done');continue;\n  }";
 if(!src.includes(extra))src=once(src,old,old+extra,'gateway_packet_gate');
 return src;
});
edit('runtime.cjs',src=>{
 if(!src.includes('const compiledPaths='))throw Error('RUNTIME_DESCONHECIDO');
 src=once(src,"const {normalizeJid}=require('./entrada.cjs');",
  "const {normalizeJid}=require('./entrada.cjs');\nconst {probeReadHandlers}=require('./feature-manifest.cjs');",'runtime_import');
 const old=" for(const [packet,rel] of Object.entries(compiledPaths)){\n  require(path.join(dist,rel));if(typeof gameInstance.packetListener.getListener(packet)!=='function')throw Error('HANDLER_CROWNICLES_AUSENTE_'+packet)\n }";
 const newPart="\n const nativeRead=probeReadHandlers({dist,listener:gameInstance.packetListener});\n const enabledPackets=new Set([...Object.keys(compiledPaths),...nativeRead.available]);\n status('BETA_LEITURAS_NATIVAS',nativeRead.available.length);\n status('BETA_LEITURAS_PENDENTES',nativeRead.unavailable.length);";
 if(!src.includes(newPart))src=once(src,old,old+newPart,'runtime_discover');
 src=once(src,'return {bootstrap,shim,models:gameInstance.gameDatabase.sequelize.models};',
  'return {bootstrap,shim,models:gameInstance.gameDatabase.sequelize.models,enabledPackets};','runtime_return');
 src=once(src,'InventorySlot:coreBoot.models.InventorySlot,ItemCategory});',
  'InventorySlot:coreBoot.models.InventorySlot,ItemCategory,enabledPackets:coreBoot.enabledPackets});','runtime_bind');
 src=once(src,"const {resolveIncomingSender}=require('./group-sender.cjs');",
  "const {resolveIncomingSender}=require('./group-sender.cjs');\nconst {groupIdentityDisposition}=require('./group-identity-policy.cjs');",'runtime_lid_require');
 const start=src.indexOf('// Unknown LID cannot be silently equated');
 if(start>=0){
  const end=src.indexOf('const result=await bridgeRuntime.handle',start);
  if(end<0||end-start>1600)throw Error('BLOCO_LID_DESCONHECIDO');
  const newBlock=`// Public info needs no PN. Verified LIDs reach the normal game handler.
     // Owner challenges still require exact owner alias or one-use token.
     if(isGroup&&resolved.mode==='lid-unresolved'){
      const verifiedAlias=!!bridgeRuntime.beta.db.prepare('SELECT 1 FROM jid_aliases WHERE alias_jid=?').get(sender);
      const policy=groupIdentityDisposition({command:cmd,verifiedAlias});
      if(policy==='private-only'){
       if(cmd.startsWith('/')||/^\\d{1,3}$/.test(cmd)){
        status('GRUPO_IDENTIDADE','LID_SEM_PN');
        await socketClient.sendMessage(chat,{text:'Para evitar criar um personagem duplicado, use os comandos do jogo no privado do bot enquanto seu numero nao estiver disponivel neste grupo.'});
       }
       continue;
      }
     }
     `;
  src=src.slice(0,start)+newBlock+src.slice(end);
 }else if(!src.includes("const policy=groupIdentityDisposition"))throw Error('BLOCO_LID_AUSENTE');
 const admin="if(isGroup&&adminCmd){status('GRUPO_COMANDO_RESULTADO',result?.handled===true?'OK':(result?.reason||'NAO_TRATADO'))}";
 const feedback="\n     if(isGroup&&resolved.mode==='lid-unresolved'&&adminCmd&&result?.reason==='not-owner'){\n      status('GRUPO_AUTORIZACAO','CHAVE_NECESSARIA');\n      await socketClient.sendMessage(chat,{text:'Para ativar ou desativar, solicite /chavegrupo no privado e envie o comando com codigo neste grupo.'});\n     }";
 if(!src.includes(feedback))src=once(src,admin,admin+feedback,'runtime_owner_feedback');
 return src;
});
console.log('V27_CODIGO_PREPARADO=SIM');
