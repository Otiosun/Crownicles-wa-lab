'use strict';
/** Request-scoped sidecar: preserve the native Core gateway's private delivery.
 * This does not send WhatsApp messages, change the original Core, or authorize
 * group visibility. It records requests for a later audited outgoing bridge.
 */
function createContextDispatch({index,receive}){
  if(!index||typeof index.register!=='function'||typeof index.finish!=='function'||typeof receive!=='function')
    throw TypeError('CONTEXT_DISPATCH_INVALIDO');
  return function dispatch({id,playerJid,playerUUID,sourceChat,text}={}){
    const origin=typeof sourceChat==='string'&&sourceChat.endsWith('@g.us')?sourceChat:playerJid;
    const record={requestId:id,playerUUID,privateJid:playerJid,sourceChat:origin,visibility:'private'};
    const check=index.register(record);
    if(!check?.ok)throw Error('CONTEXTO_REJEITADO');
    if(check.duplicate)return true;
    const cleanup=()=>index.finish(record);
    try{
      const result=receive(id,playerJid,text);
      if(result&&typeof result.then==='function')return result.then(ok=>{if(!ok)cleanup();return ok},err=>{cleanup();throw err});
      if(!result)cleanup();
      return result;
    }catch(err){cleanup();throw err;}
  };
}
module.exports={createContextDispatch};
