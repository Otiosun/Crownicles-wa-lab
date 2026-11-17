'use strict';
/* Entrada da beta Crownicles (WhatsApp): cadastro explícito e permissão por grupo.
   Não inicializa Baileys, Core ou banco de produção por conta própria. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

function normalizeJid(value) {
  if (typeof value !== 'string') return null;
  const str = value.trim().toLowerCase().replace(/:\d+(?=@)/, '');
  if (/^\d{8,25}@(s\.whatsapp\.net|lid)$/.test(str)) return str;
  if (/^\d{8,25}(?:-\d{1,15})?@g\.us$/.test(str)) return str;
  return null;
}
function normalizeOwner(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (/^\d{8,25}$/.test(v)) return `${v}@s.whatsapp.net`;
  return normalizeJid(v);
}
const HELP = '*✦ BETA CROWNICLES*\n/cadastro — criar personagem\n/jogar — começar a jornada\n/aventura · /menu · /perfil · /inventario · /missoes\n\nEm grupos: somente grupos liberados pelo responsável. Comandos de dono: /ativar, /desativar e, no privado, /chavegrupo (caso o WhatsApp oculte o numero). A beta pode ser reiniciada.';
class BetaEntrance {
  constructor({ dir, ownerJids = [], createPlayer, dispatchGame, send, clock = Date.now }) {
    if (typeof dir !== 'string' || !path.isAbsolute(dir)) throw Error('DIRETORIO_BETA_ABSOLUTO_OBRIGATORIO');
    if (typeof createPlayer !== 'function' || typeof dispatchGame !== 'function' || typeof send !== 'function')
      throw Error('CALLBACKS_OBRIGATORIOS');
    if (!ownerJids.length || ownerJids.some(x=>!normalizeOwner(x))) throw Error('OWNER_WHATSAPP_OBRIGATORIO');
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path.join(dir, 'beta-access.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS players(jid TEXT PRIMARY KEY, uuid TEXT NOT NULL UNIQUE, state TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS groups(id TEXT PRIMARY KEY, enabled INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS seen(id TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS group_keys(digest TEXT PRIMARY KEY, action TEXT NOT NULL, expires INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS owner_aliases(jid TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS jid_aliases(alias_jid TEXT PRIMARY KEY, canonical_jid TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS admin_claims(id INTEGER PRIMARY KEY, private_digest TEXT NOT NULL UNIQUE, group_digest TEXT UNIQUE, stage TEXT NOT NULL, expires INTEGER NOT NULL, private_jid TEXT, group_jid TEXT);
    `);
    this.owners = new Set(ownerJids.map(normalizeOwner));
    this.createPlayer = createPlayer;
    this.dispatchGame = dispatchGame;
    this.send = send;
    this.clock = clock;
    this.busy = new Set();
    this.closed = false;
  }
  close() { if (!this.closed) {this.closed = true; this.db.close();} }
  groupEnabled(jid) { return this.db.prepare('SELECT enabled FROM groups WHERE id=?').get(jid)?.enabled === 1; }
  player(jid) { return this.db.prepare('SELECT * FROM players WHERE jid=?').get(jid) ?? null; }
  async handle({ id, chatJid, senderJid, text, fromMe = false }) {
    if (this.closed) throw Error('BETA_FECHADA');
    if (fromMe) return { handled: false, reason: 'from-me' };
    const chat = normalizeJid(chatJid), sender = normalizeJid(senderJid);
    if (!chat || !sender || typeof id !== 'string' || !id.trim() || id.length > 256 || typeof text !== 'string')
      return { handled: false, reason: 'invalid-context' };
    const isGroup = chat.endsWith('@g.us');
    // Check the transport sender BEFORE applying a trusted, previously proven alias.
    if (!isGroup && chat !== sender) return { handled:false, reason:'jid-mismatch' };
    const cmd = text.trim().toLowerCase().split(/\s+/)[0];
    if (!cmd || (!cmd.startsWith('/') && !/^\d{1,3}$/.test(cmd))) return { handled: false, reason: 'not-command' };
    const owner = this.owners.has(sender) || !!this.db.prepare('SELECT 1 FROM owner_aliases WHERE jid=?').get(sender);
    const alias = this.db.prepare('SELECT canonical_jid FROM jid_aliases WHERE alias_jid=?').get(sender)?.canonical_jid;
    const playerSender = alias || sender;
    const groupSwitch = cmd === '/ativar' || cmd === '/desativar';
    const claimCmd = cmd === '/vinculardono' || cmd === '/vinculargrupo';
    const control = groupSwitch || claimCmd || cmd === '/grupos' || cmd === '/chavegrupo';
    if (cmd === '/grupos' && !owner) return { handled:false, reason:'not-owner' };
    if (cmd === '/chavegrupo' && !owner) return { handled:false, reason:'not-owner' };
    if (isGroup && !this.groupEnabled(chat) && !control) return { handled:false, reason:'group-off' };
    // Uma mensagem nao pode reutilizar chave ou duplicar comandos.
    if (this.db.prepare('INSERT OR IGNORE INTO seen(id,created_at) VALUES(?,?)').run(chat+'|'+id, this.clock()).changes === 0)
      return { handled:false, reason:'duplicate' };
    const answer = async(value, to=chat) => { await this.send(to, value); return { handled:true, kind:'reply', to, text:value }; };
    // Claim A comes from the administrator's local Termux, not a phone-number guess.
    if (cmd === '/vinculardono') {
      if (isGroup) return {handled:false, reason:'claim-requires-private'};
      const code=String(text.trim().split(/\s+/)[1]||'').toUpperCase();
      if (!/^[A-F0-9]{24}$/.test(code)) return {handled:false,reason:'invalid-admin-claim'};
      const digest=crypto.createHash('sha256').update(code).digest('hex');
      const now=this.clock();
      const claim=this.db.prepare("SELECT id,stage,expires,private_jid FROM admin_claims WHERE private_digest=?").get(digest);
      if (!claim || claim.stage!=='issued' || claim.expires<now) return {handled:false,reason:'invalid-admin-claim'};
      const groupCode=crypto.randomBytes(12).toString('hex').toUpperCase();
      const groupDigest=crypto.createHash('sha256').update(groupCode).digest('hex');
      const updated=this.db.prepare("UPDATE admin_claims SET stage='private',private_jid=?,group_digest=? WHERE id=? AND stage='issued' AND expires>=?").run(sender,groupDigest,claim.id,now);
      if (updated.changes!==1) return {handled:false,reason:'claim-race'};
      this.db.prepare('INSERT OR IGNORE INTO owner_aliases(jid,created_at) VALUES(?,?)').run(sender,now);
      return answer('✅ Seu WhatsApp privado foi vinculado como proprietário.\nPara vincular sua identidade nos grupos, envie no grupo: */vinculargrupo '+groupCode+'*\nEsse código vale por 10 minutos e só pode ser usado uma vez. Assim seu personagem do privado será o mesmo no grupo.',chat);
    }
    if (cmd === '/vinculargrupo') {
      if (!isGroup) return {handled:false,reason:'claim-requires-group'};
      const code=String(text.trim().split(/\s+/)[1]||'').toUpperCase();
      if(!/^[A-F0-9]{24}$/.test(code))return {handled:false,reason:'invalid-group-claim'};
      const digest=crypto.createHash('sha256').update(code).digest('hex');
      const now=this.clock();
      const claim=this.db.prepare("SELECT id,private_jid FROM admin_claims WHERE group_digest=? AND stage='private' AND expires>=?").get(digest,now);
      if(!claim || !normalizeJid(claim.private_jid))return {handled:false,reason:'invalid-group-claim'};
      // Reject conflicting alias ownership, never overwrite a prior linked account.
      const existing=this.db.prepare('SELECT canonical_jid FROM jid_aliases WHERE alias_jid=?').get(sender);
      if(existing && existing.canonical_jid!==claim.private_jid)return {handled:false,reason:'alias-conflict'};
      this.db.exec('BEGIN IMMEDIATE');
      try {
        const consumed=this.db.prepare("UPDATE admin_claims SET stage='complete',group_jid=? WHERE id=? AND stage='private' AND expires>=?").run(sender,claim.id,now);
        if(consumed.changes!==1)throw Error('CLAIM_JA_CONSUMIDO');
        this.db.prepare('INSERT OR IGNORE INTO owner_aliases(jid,created_at) VALUES(?,?)').run(sender,now);
        this.db.prepare('INSERT OR IGNORE INTO jid_aliases(alias_jid,canonical_jid,created_at) VALUES(?,?,?)').run(sender,claim.private_jid,now);
        this.db.exec('COMMIT');
      }catch(e){this.db.exec('ROLLBACK');return {handled:false,reason:'claim-transaction-failed'}}
      return answer('✅ Identidades vinculadas com segurança. Seu personagem do privado agora é reconhecido nos grupos. Você pode usar /ativar e /desativar aqui sem código.');
    }
    if (cmd === '/chavegrupo') {
      if (isGroup) return answer('Solicite /chavegrupo no privado do Pinguino.');
      const action=text.trim().toLowerCase().split(/\s+/)[1]==='desativar' ? '/desativar' : '/ativar';
      const token=crypto.randomBytes(6).toString('hex').toUpperCase();
      const digest=crypto.createHash('sha256').update(token).digest('hex');
      const now=this.clock();
      this.db.prepare('DELETE FROM group_keys WHERE expires < ? OR used=1').run(now);
      this.db.prepare('INSERT INTO group_keys(digest,action,expires,used) VALUES(?,?,?,0)').run(digest,action,now+5*60000);
      return answer('🔐 Autorização temporária de grupo\nNo grupo escolhido, envie: *'+action+' '+token+'*\nCódigo de uso único, válido por 5 minutos. Não compartilhe em outros grupos.',sender);
    }
    if (groupSwitch) {
      if (!isGroup) return answer('Use este comando dentro do grupo que deseja configurar.');
      if (!owner) {
        const token=String(text.trim().split(/\s+/)[1]||'').toUpperCase();
        if (!/^[A-F0-9]{12}$/.test(token)) return {handled:false,reason:'not-owner'};
        const digest=crypto.createHash('sha256').update(token).digest('hex');
        const changed=this.db.prepare('UPDATE group_keys SET used=1 WHERE digest=? AND action=? AND used=0 AND expires>=?').run(digest,cmd,this.clock()).changes;
        if (changed!==1) return {handled:false,reason:'invalid-group-key'};
      }
      const enable = cmd === '/ativar' ? 1 : 0;
      this.db.prepare('INSERT INTO groups(id,enabled,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled,updated_at=excluded.updated_at').run(chat,enable,this.clock());
      return answer(enable ? '✅ Beta ativada neste grupo. Use /cadastro para criar seu personagem.' : '🔕 Beta desativada neste grupo.');
    }
    if (cmd === '/grupos') {
      if (isGroup) return answer('Consulte /grupos no privado.');
      const enabled = this.db.prepare('SELECT id FROM groups WHERE enabled=1 ORDER BY updated_at DESC').all();
      return answer(enabled.length ? '*Grupos ativos*\n'+enabled.map(x=>x.id).join('\n') : 'Nenhum grupo ativo. Envie /ativar dentro do grupo escolhido.');
    }
    if (cmd === '/cadastro') {
      if (this.busy.has(playerSender)) return answer('⏳ Seu cadastro já está sendo preparado.');
      this.busy.add(playerSender);
      try {
        let row = this.player(playerSender);
        if (row?.state === 'active') return answer('✅ Seu personagem já está cadastrado. Envie /jogar.', isGroup ? playerSender : chat);
        if (!row) {
          const uuid = crypto.randomUUID();
          this.db.prepare('INSERT INTO players(jid,uuid,state,created_at,updated_at) VALUES(?,?,?,?,?)').run(playerSender,uuid,'pending',this.clock(),this.clock());
          row = this.player(playerSender);
        }
        // createPlayer DEVE ser idempotente por UUID; o mesmo UUID será reutilizado após falha/reinício.
        await this.createPlayer(row.uuid, playerSender);
        this.db.prepare("UPDATE players SET state='active',updated_at=? WHERE jid=? AND uuid=?").run(this.clock(),playerSender,row.uuid);
        return answer('✅ Cadastro concluído! Seu personagem foi criado no Crownicles.\nEnvie /jogar para iniciar a aventura.\n\n*Beta de testes:* progresso pode ser reiniciado.', isGroup ? playerSender : chat);
      } catch (e) {
        return answer('⚠️ O cadastro ainda não terminou. Use /cadastro novamente quando o motor estiver disponível. Não criaremos outro personagem.', isGroup ? playerSender : chat);
      } finally { this.busy.delete(playerSender); }
    }
    // Help is public in enabled groups; gameplay and player details remain private.
    if (cmd === '/ajuda' || cmd === '/comandos') return answer(HELP, chat);
    const row = this.player(playerSender);
    if (!row || row.state !== 'active') return answer('Você precisa criar um personagem primeiro. Envie /cadastro.', isGroup ? playerSender : chat);
    const idForGateway = id;
    // Respostas de aventura e inventário são privadas nesta primeira integração.
    // Não roteá-las ao grupo usando estado global "último chat" (risco de vazamento sob concorrência).
    const ok = await this.dispatchGame({ id:idForGateway, playerJid:playerSender, playerUUID:row.uuid, text, replyJid:playerSender, sourceChat:chat });
    if (!ok) return answer('⏳ O motor não aceitou esse comando. Tente /menu ou /perfil.', isGroup ? playerSender : chat);
    return {handled:true, kind:'game', player:playerSender, replyJid:playerSender};
  }
}
function makeCoreRegistration({ Player, InventoryInfo, InventorySlot, ItemCategory }) {
  if (!Player || !InventoryInfo || !InventorySlot || !ItemCategory) throw Error('MODELOS_ORIGINAIS_OBRIGATORIOS');
  // A criação usa os MESMOS modelos e itens iniciais homologados nos laboratórios V3-V8.
  // Nenhuma fixture nextEvent=60/61: o próprio ReportCommand faz o início normal via /jogar.
  return async function createPlayer(uuid) {
    const [row] = await Player.findOrCreate({where:{keycloakId:uuid},defaults:{keycloakId:uuid}});
    await InventoryInfo.findOrCreate({where:{playerId:row.id},defaults:{playerId:row.id,weaponSlots:3}});
    for(const cat of [ItemCategory.WEAPON,ItemCategory.ARMOR,ItemCategory.POTION,ItemCategory.OBJECT])
      await InventorySlot.findOrCreate({where:{playerId:row.id,slot:0,itemCategory:cat},defaults:{playerId:row.id,slot:0,itemCategory:cat,itemId:0,itemLevel:0,itemEnchantmentId:null}});
    return row;
  };
}
module.exports = {BetaEntrance, normalizeJid, normalizeOwner, makeCoreRegistration, HELP};
