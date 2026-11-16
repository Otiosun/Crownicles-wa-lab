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
const HELP = '*✦ BETA CROWNICLES*\n/cadastro — criar personagem\n/jogar — começar a jornada\n/aventura · /menu · /perfil · /inventario · /missoes\n\nEm grupos: somente grupos liberados pelo responsável. A beta pode ser reiniciada.';
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
    if (!isGroup && chat !== sender) return { handled:false, reason:'jid-mismatch' };
    const cmd = text.trim().toLowerCase().split(/\s+/)[0];
    if (!cmd || (!cmd.startsWith('/') && !/^\d{1,3}$/.test(cmd))) return { handled: false, reason: 'not-command' };
    const owner = this.owners.has(sender);
    const control = ['/ativar','/desativar','/grupos'].includes(cmd);
    if (control && !owner) return { handled:false, reason:'not-owner' };
    if (isGroup && !this.groupEnabled(chat) && !control) return { handled:false, reason:'group-off' };
    // A mesma chave de mensagem recebida duas vezes nunca deve executar ações duas vezes.
    if (this.db.prepare('INSERT OR IGNORE INTO seen(id,created_at) VALUES(?,?)').run(chat+'|'+id, this.clock()).changes === 0)
      return { handled:false, reason:'duplicate' };
    const answer = async(value, to=chat) => { await this.send(to, value); return { handled:true, kind:'reply', to, text:value }; };
    if (cmd === '/ativar' || cmd === '/desativar') {
      if (!isGroup) return answer('Use este comando dentro do grupo que deseja configurar.');
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
      if (this.busy.has(sender)) return answer('⏳ Seu cadastro já está sendo preparado.');
      this.busy.add(sender);
      try {
        let row = this.player(sender);
        if (row?.state === 'active') return answer('✅ Seu personagem já está cadastrado. Envie /jogar.', isGroup ? sender : chat);
        if (!row) {
          const uuid = crypto.randomUUID();
          this.db.prepare('INSERT INTO players(jid,uuid,state,created_at,updated_at) VALUES(?,?,?,?,?)').run(sender,uuid,'pending',this.clock(),this.clock());
          row = this.player(sender);
        }
        // createPlayer DEVE ser idempotente por UUID; o mesmo UUID será reutilizado após falha/reinício.
        await this.createPlayer(row.uuid, sender);
        this.db.prepare("UPDATE players SET state='active',updated_at=? WHERE jid=? AND uuid=?").run(this.clock(),sender,row.uuid);
        return answer('✅ Cadastro concluído! Seu personagem foi criado no Crownicles.\nEnvie /jogar para iniciar a aventura.\n\n*Beta de testes:* progresso pode ser reiniciado.', isGroup ? sender : chat);
      } catch (e) {
        return answer('⚠️ O cadastro ainda não terminou. Use /cadastro novamente quando o motor estiver disponível. Não criaremos outro personagem.', isGroup ? sender : chat);
      } finally { this.busy.delete(sender); }
    }
    if (cmd === '/ajuda' || cmd === '/comandos') return answer(HELP, isGroup ? sender : chat);
    const row = this.player(sender);
    if (!row || row.state !== 'active') return answer('Você precisa criar um personagem primeiro. Envie /cadastro.', isGroup ? sender : chat);
    const idForGateway = id;
    // Respostas de aventura e inventário são privadas nesta primeira integração.
    // Não roteá-las ao grupo usando estado global "último chat" (risco de vazamento sob concorrência).
    const ok = await this.dispatchGame({ id:idForGateway, playerJid:sender, playerUUID:row.uuid, text, replyJid:sender, sourceChat:chat });
    if (!ok) return answer('⏳ O motor não aceitou esse comando. Tente /menu ou /perfil.', isGroup ? sender : chat);
    return {handled:true, kind:'game', player:sender, replyJid:sender};
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
