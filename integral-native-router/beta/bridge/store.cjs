'use strict';
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const {recipientCodeHash}=require('./social-intents.cjs');
class Store{
 constructor(dir){fs.mkdirSync(dir,{recursive:true,mode:0o700});this.db=new DatabaseSync(path.join(dir,'gateway.sqlite'));
 this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS inbound (id TEXT PRIMARY KEY,wa TEXT NOT NULL,text TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',request_id TEXT,created INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS ix_inbound_wa_status ON inbound(wa,status);
 CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY,inbound_id TEXT NOT NULL,wa TEXT NOT NULL,player_id TEXT NOT NULL,created INTEGER NOT NULL,done INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS seen_responses (request_id TEXT NOT NULL,digest TEXT NOT NULL,PRIMARY KEY(request_id,digest));
 CREATE TABLE IF NOT EXISTS menus (wa TEXT PRIMARY KEY,menu_json TEXT NOT NULL,updated INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS confirmations (wa TEXT PRIMARY KEY,menu_id TEXT NOT NULL,option_index INTEGER NOT NULL,menu_hash TEXT NOT NULL,token TEXT NOT NULL,created INTEGER NOT NULL,expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS outbox (id INTEGER PRIMARY KEY AUTOINCREMENT,wa TEXT NOT NULL,text TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',tries INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS social_codes (digest TEXT PRIMARY KEY,wa TEXT NOT NULL,player_id TEXT NOT NULL,expires_at INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0);
 CREATE INDEX IF NOT EXISTS social_codes_player ON social_codes(player_id);
 `);
 const o=this.db.prepare("SELECT value FROM settings WHERE key='origin'").get();
 this.origin=o?.value||('crownicles-wa-v1-'+crypto.randomUUID());
 if(!o)this.db.prepare("INSERT INTO settings(key,value) VALUES ('origin',?)").run(this.origin);
 // Nonces de confirmação não sobrevivem a reinícios: o jogador precisa pedir nova prévia.
 this.db.prepare('DELETE FROM confirmations').run();
 // Processed commands are never auto-reissued after process restart; only not-yet-sent commands are recoverable.
 this.db.prepare("UPDATE inbound SET status='pending' WHERE status='processing'").run();
 }
 transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const v=fn();this.db.exec('COMMIT');return v}catch(e){this.db.exec('ROLLBACK');throw e}}
 close(){this.db.close()}
 receive(id,wa,text){return this.db.prepare('INSERT OR IGNORE INTO inbound(id,wa,text,status,created) VALUES (?,?,?,\'pending\',?)').run(id,wa,text,Date.now()).changes===1}
 next(){return this.db.prepare(`SELECT * FROM inbound i WHERE i.status='pending' AND NOT EXISTS (SELECT 1 FROM inbound a WHERE a.wa=i.wa AND a.status='awaiting') ORDER BY i.created,i.rowid LIMIT 1`).get()}
 mark(id,status){this.db.prepare('UPDATE inbound SET status=? WHERE id=?').run(status,id)}
 startRequest(inboundId,wa,playerId,requestId){this.db.exec('BEGIN IMMEDIATE');try{this.db.prepare('INSERT INTO requests(id,inbound_id,wa,player_id,created) VALUES (?,?,?,?,?)').run(requestId,inboundId,wa,playerId,Date.now());this.db.prepare("UPDATE inbound SET status='awaiting',request_id=? WHERE id=?").run(requestId,inboundId);this.db.exec('COMMIT')}catch(e){this.db.exec('ROLLBACK');throw e}}
 getRequest(id){return this.db.prepare('SELECT * FROM requests WHERE id=?').get(id)}
 hasPendingRequest(wa){return Boolean(this.db.prepare("SELECT 1 FROM inbound WHERE wa=? AND status='awaiting' LIMIT 1").get(wa))}
 issueRecipientCode(wa,playerId){
  if(!/^\d{8,25}@(s\.whatsapp\.net|lid)$/.test(wa)||!(/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i).test(playerId))throw Error('SOCIAL_CODIGO_IDENTIDADE_INVALIDA');
  const code=crypto.randomBytes(8).toString('hex').toUpperCase(),digest=recipientCodeHash(code),expiresAt=Date.now()+10*60*1000;
  this.transaction(()=>{
   this.db.prepare('DELETE FROM social_codes WHERE player_id=? OR wa=? OR expires_at<=?').run(playerId,wa,Date.now());
   this.db.prepare('INSERT INTO social_codes(digest,wa,player_id,expires_at,used) VALUES (?,?,?,?,0)').run(digest,wa,playerId,expiresAt);
  });
  return {code,expiresAt};
 }
 findRecipientCode(code){
  const digest=recipientCodeHash(String(code||'').toUpperCase());
  if(!digest)return null;
  return this.db.prepare('SELECT * FROM social_codes WHERE digest=? AND expires_at>? AND used=0').get(digest,Date.now())||null;
 }
 acceptResponse(id,digest){return this.db.prepare('INSERT OR IGNORE INTO seen_responses(request_id,digest) VALUES (?,?)').run(id,digest).changes===1}
 completeRequest(id){const q=this.getRequest(id);if(!q)return;this.db.prepare('UPDATE requests SET done=1 WHERE id=?').run(id);this.mark(q.inbound_id,'done')}
 expireRequests(maxAgeMs){const expiry=Date.now()-maxAgeMs;const rows=this.db.prepare('SELECT * FROM requests WHERE done=0 AND created<?').all(expiry);for(const r of rows)this.completeRequest(r.id);return rows}
 saveMenu(wa,menu){this.db.prepare('DELETE FROM confirmations WHERE wa=?').run(wa);this.db.prepare('INSERT INTO menus(wa,menu_json,updated) VALUES(?,?,?) ON CONFLICT(wa) DO UPDATE SET menu_json=excluded.menu_json,updated=excluded.updated').run(wa,JSON.stringify(menu),Date.now())}
 getMenu(wa){const row=this.db.prepare('SELECT menu_json FROM menus WHERE wa=?').get(wa);if(!row)return null;try{return JSON.parse(row.menu_json)}catch{return null}}
 clearMenu(wa,id){if(id){const m=this.getMenu(wa);if(!m||m.id!==id)return;}this.db.prepare('DELETE FROM confirmations WHERE wa=?').run(wa);this.db.prepare('DELETE FROM menus WHERE wa=?').run(wa)}
 // O snapshot é a fonte de verdade: token sozinho nunca autoriza nada.
 menuDigest(menu){return crypto.createHash('sha256').update(JSON.stringify(menu)).digest('hex')}
 previewMatches(wa,menu,index,token){
  const p=this.db.prepare('SELECT * FROM confirmations WHERE wa=?').get(wa);
  if(!p||!menu||!Number.isInteger(index)||!Number.isFinite(menu.endTime))return false;
  const saved=this.getMenu(wa);if(!saved)return false;
  const now=Date.now();return p.menu_id===menu.id&&saved.id===menu.id&&p.option_index===index&&
    p.token===String(token||'').toUpperCase()&&p.expires_at>now&&menu.endTime>now&&saved.endTime>now&&
    p.menu_hash===this.menuDigest(menu)&&p.menu_hash===this.menuDigest(saved)&&
    saved.options?.[index]?.supported===true&&saved.options?.[index]?.requiresConfirmation===true;
 }
 createPreview(wa,menu,index){
  const current=this.getMenu(wa);const now=Date.now();
  if(!current||!menu||current.id!==menu.id||this.menuDigest(current)!==this.menuDigest(menu)||
    !Number.isInteger(index)||current.options?.[index]?.supported!==true||
    current.options?.[index]?.requiresConfirmation!==true||!Number.isFinite(current.endTime)||current.endTime<=now)throw Error('PREVIA_INVALIDA');
  const token=crypto.randomBytes(4).toString('hex').toUpperCase();
  const expiry=Math.min(current.endTime,now+90000);
  this.db.prepare('INSERT INTO confirmations(wa,menu_id,option_index,menu_hash,token,created,expires_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(wa) DO UPDATE SET menu_id=excluded.menu_id,option_index=excluded.option_index,menu_hash=excluded.menu_hash,token=excluded.token,created=excluded.created,expires_at=excluded.expires_at').run(wa,current.id,index,this.menuDigest(current),token,now,expiry);
  return {token,expiresAt:expiry};
 }
 startConfirmedRequest(inboundId,wa,playerId,requestId,menu,index,token,consent=null){
  // A confirmação é de uso único e sua emissão ao Core não pode ocorrer antes do commit.
  this.transaction(()=>{
   if(!this.previewMatches(wa,menu,index,token))throw Error('CONFIRMACAO_EXPIRADA');
   if(consent){
    if(!/^[0-9a-f]{64}$/.test(consent.digest||'')||typeof consent.wa!=='string'||typeof consent.playerId!=='string')throw Error('CONSENTIMENTO_INVALIDO');
    const used=this.db.prepare('UPDATE social_codes SET used=1 WHERE digest=? AND wa=? AND player_id=? AND expires_at>? AND used=0').run(consent.digest,consent.wa,consent.playerId,Date.now());
    if(used.changes!==1)throw Error('CODIGO_SOCIAL_EXPIRADO');
   }
   this.db.prepare('INSERT INTO requests(id,inbound_id,wa,player_id,created) VALUES (?,?,?,?,?)').run(requestId,inboundId,wa,playerId,Date.now());
   this.db.prepare("UPDATE inbound SET status='awaiting',request_id=? WHERE id=? AND wa=?").run(requestId,inboundId,wa);
   this.db.prepare('DELETE FROM confirmations WHERE wa=?').run(wa);
   this.db.prepare('DELETE FROM menus WHERE wa=?').run(wa);
  });
 }
 queue(wa,text){for(const body of splitText(text)){this.db.prepare('INSERT INTO outbox(wa,text,created) VALUES (?,?,?)').run(wa,body,Date.now())}}
 nextOut(){return this.db.prepare("SELECT * FROM outbox WHERE status='pending' AND next_attempt<=? ORDER BY id LIMIT 1").get(Date.now())}
 sent(id){this.db.prepare("UPDATE outbox SET status='sent' WHERE id=?").run(id)}
 failed(id,retry){if(!retry){this.db.prepare("UPDATE outbox SET status='failed',tries=tries+1 WHERE id=?").run(id);return}
 const row=this.db.prepare('SELECT tries FROM outbox WHERE id=?').get(id);const tries=(row?.tries||0)+1;if(tries>=5){this.failed(id,false);return}
 this.db.prepare("UPDATE outbox SET tries=?,next_attempt=? WHERE id=?").run(tries,Date.now()+Math.min(300000,10000*2**tries),id)}
 stats(){return {pendingInbound:this.db.prepare("SELECT COUNT(*) n FROM inbound WHERE status IN ('pending','awaiting')").get().n,pendingOutbound:this.db.prepare("SELECT COUNT(*) n FROM outbox WHERE status='pending'").get().n}}
 }
function splitText(s){let t=String(s||'');const out=[];while(t.length>3500){let i=t.lastIndexOf('\n',3500);if(i<1700)i=t.lastIndexOf(' ',3500);if(i<1700)i=3500;out.push(t.slice(0,i).trim());t=t.slice(i).trim()}if(t.trim())out.push(t.trim());return out}
module.exports={Store,splitText};
