'use strict';
/* Request-scoped routing metadata for the Crownicles native gateway.
 * Safety: no global last-chat, never infer public visibility from a group ID.
 * The current native gameplay gateway stays private until it explicitly opts in.
 */
const {normalizeJid}=require('./entrada.cjs');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USER=/@(lid|s\.whatsapp\.net)$/;
const GROUP=/@g\.us$/;
class ResponseContextIndex {
  constructor({clock=Date.now,groupEnabled=()=>false,maxEntries=4096,ttlMs=10*60*1000}={}) {
    if(typeof clock!=='function'||typeof groupEnabled!=='function'||!Number.isSafeInteger(maxEntries)||maxEntries<1||maxEntries>100000||
       !Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>3600000)throw TypeError('CONTEXTO_OPCOES_INVALIDAS');
    this.clock=clock;
    this.groupEnabled=groupEnabled;
    this.maxEntries=maxEntries;
    this.ttlMs=ttlMs;
    this.pending=new Map();
  }
  key(id,uuid) {
    if(typeof id!=='string'||!id.trim()||id.length>256||typeof uuid!=='string'||!UUID.test(uuid))return null;
    return uuid.toLowerCase()+'|'+id;
  }
  groupAllowed(chat) {
    try{return this.groupEnabled(chat)===true;}catch{return false;}
  }
  register({requestId,playerUUID,privateJid,sourceChat,visibility='private'}={}) {
    const key=this.key(requestId,playerUUID);
    const privateChat=normalizeJid(privateJid),origin=normalizeJid(sourceChat);
    if(!key||!privateChat||!USER.test(privateChat)||!origin||
       (visibility!=='private'&&visibility!=='group-info')||
       (!GROUP.test(origin)&&origin!==privateChat))return {ok:false,reason:'invalid-context'};
    const now=this.clock();
    if(!Number.isSafeInteger(now))return {ok:false,reason:'invalid-time'};
    this.cleanup(now);
    const existing=this.pending.get(key);
    if(existing){
      const identical=existing.privateChat===privateChat&&existing.origin===origin&&existing.visibility===visibility;
      return identical?{ok:true,duplicate:true}:{ok:false,reason:'context-conflict'};
    }
    while(this.pending.size>=this.maxEntries)this.pending.delete(this.pending.keys().next().value);
    const mayPublish=visibility==='group-info'&&GROUP.test(origin)&&this.groupAllowed(origin);
    this.pending.set(key,{privateChat,origin,visibility,mayPublish,expires:now+this.ttlMs});
    return {ok:true,duplicate:false,groupEligible:mayPublish};
  }
  resolve({requestId,playerUUID}={}) {
    const key=this.key(requestId,playerUUID);
    if(!key)return null;
    const record=this.pending.get(key);
    if(!record)return null;
    const now=this.clock();
    if(!Number.isSafeInteger(now)||now>=record.expires){this.pending.delete(key);return null;}
    const isPublic=record.mayPublish&&this.groupAllowed(record.origin);
    return Object.freeze({to:isPublic?record.origin:record.privateChat,visibility:isPublic?'group':'private'});
  }
  finish({requestId,playerUUID}={}) {
    const key=this.key(requestId,playerUUID);
    return key?this.pending.delete(key):false;
  }
  cleanup(now=this.clock()) {
    if(!Number.isSafeInteger(now))return 0;
    let removed=0;
    for(const [key,entry] of this.pending){
      if(now>=entry.expires){this.pending.delete(key);removed++;}
    }
    return removed;
  }
  get size(){return this.pending.size;}
}
module.exports={ResponseContextIndex};
