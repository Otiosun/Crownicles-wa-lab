'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {BetaEntrance}=require('./entrada.cjs');
const {issue}=require('./admin-link.cjs');
const PRIVATE='123456789012345@lid';
const PN='5511888881234@s.whatsapp.net';
const EXTRA='5521999995678@s.whatsapp.net';
const GROUP='120363111111111111@g.us';
function setup({clock=Date.now}={}){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'crownicles-owner-v23-'));
 const dir=path.join(base,'access');
 const sent=[],events=[],players=[];
 const newBeta=()=>new BetaEntrance({dir,ownerJids:['5579999999999'],send:async(jid,text)=>{sent.push({jid,text})},createPlayer:async()=>{},dispatchGame:async e=>{events.push(e);return true},clock});
 const beta=newBeta();
 const message=(id,sender,text,group=null)=>({id,chatJid:group||sender,senderJid:sender,text});
 return {base,dir,beta,newBeta,sent,events,message,done(){try{beta.close()}catch{}fs.rmSync(base,{recursive:true,force:true})}};
}
function countPlayer(db){return db.prepare('SELECT COUNT(*) n FROM players').get().n}
async function bind(x){
 const code=issue(x.base);
 assert.match(code,/^[0-9A-F]{24}$/);
 const step1=await x.beta.handle(x.message('private-link',PRIVATE,'/vinculardono '+code));
 assert.equal(step1.handled,true);
 const token=/\/vinculargrupo ([0-9A-F]{24})/.exec(step1.text)?.[1];
 assert(token);
 const step2=await x.beta.handle(x.message('group-link',PN,'/vinculargrupo '+token,GROUP));
 assert.equal(step2.handled,true);
 return {token,step1,step2};
}
test('chave local emitida em banco real, sem mostrar identificadores',()=>{const x=setup();try{const code=issue(x.base);assert.match(code,/^[A-F0-9]{24}$/);assert.equal(x.beta.db.prepare('SELECT private_digest FROM admin_claims').get().private_digest,crypto.createHash('sha256').update(code).digest('hex'));}finally{x.done()}});
test('mensagem sem chave nao vincula nem autoriza o dono',async()=>{const x=setup();try{assert.equal((await x.beta.handle(x.message('a',PRIVATE,'/chavegrupo'))).reason,'not-owner');assert.equal((await x.beta.handle(x.message('b',PRIVATE,'/vinculardono ABC'))).reason,'invalid-admin-claim');assert.equal((await x.beta.handle(x.message('c',PN,'/vinculargrupo ABC',GROUP))).reason,'invalid-group-claim');}finally{x.done()}});
test('vinculacao prova posse Termux + privado + grupo, sem criar personagem',async()=>{const x=setup();try{const {step1,step2}=await bind(x);assert.equal(step1.to,PRIVATE);assert.equal(step2.to,GROUP);assert.equal(countPlayer(x.beta.db),0);const own=x.beta.db.prepare('SELECT jid FROM owner_aliases').all();assert.equal(own.length,2);assert.equal(x.beta.db.prepare('SELECT canonical_jid FROM jid_aliases WHERE alias_jid=?').get(PN).canonical_jid,PRIVATE);const r=await x.beta.handle(x.message('activate',PN,'/ativar',GROUP));assert.equal(r.handled,true);assert.equal(x.beta.groupEnabled(GROUP),true);const r2=await x.beta.handle(x.message('key',PRIVATE,'/chavegrupo'));assert.equal(r2.handled,true);}finally{x.done()}});
test('personagem original do privado e usado no grupo apos vinculo, sem apagar registro antigo',async()=>{const x=setup();try{await x.beta.handle(x.message('signupLid',PRIVATE,'/cadastro'));await x.beta.handle(x.message('signupPn',PN,'/cadastro',GROUP));assert.equal(countPlayer(x.beta.db),1);await bind(x);await x.beta.handle(x.message('activateBefore',PN,'/ativar',GROUP));await x.beta.handle(x.message('signupPnafter',PN,'/cadastro',GROUP));assert.equal(countPlayer(x.beta.db),1);await x.beta.handle(x.message('go1',PN,'/jogar',GROUP));const uuid=x.beta.player(PRIVATE).uuid;assert.equal(x.events.at(-1).playerUUID,uuid);assert.equal(x.events.at(-1).playerJid,PRIVATE);assert.equal(x.events.at(-1).replyJid,PRIVATE);}finally{x.done()}});
test('personagem grupo preexistente e PRESERVADO mas respostas passam pelo personagem do privado',async()=>{const x=setup();try{await x.beta.handle(x.message('p1',PRIVATE,'/cadastro'));await bind(x);x.beta.db.prepare('INSERT INTO players(jid,uuid,state,created_at,updated_at) VALUES(?,?,?,?,?)').run(PN,crypto.randomUUID(),'active',Date.now(),Date.now());assert.equal(countPlayer(x.beta.db),2);await x.beta.handle(x.message('activate2',PN,'/ativar',GROUP));const original=x.beta.player(PRIVATE).uuid,other=x.beta.player(PN).uuid;await x.beta.handle(x.message('p2',PN,'/jogar',GROUP));assert.equal(x.events.at(-1).playerUUID,original);assert.equal(x.beta.player(PN).uuid,other);assert.equal(countPlayer(x.beta.db),2);}finally{x.done()}});
test('vincular grupo exige prova do PV, e token nao pode ser reutilizado',async()=>{const x=setup();try{const code=issue(x.base);const p=await x.beta.handle(x.message('p1',PRIVATE,'/vinculardono '+code));const token=/\/vinculargrupo ([A-F0-9]{24})/.exec(p.text)[1];const g=await x.beta.handle(x.message('g1',PN,'/vinculargrupo '+token,GROUP));assert.equal(g.handled,true);const replay=await x.beta.handle(x.message('g2',EXTRA,'/vinculargrupo '+token,GROUP));assert.equal(replay.reason,'invalid-group-claim');assert.equal(x.beta.db.prepare('SELECT 1 FROM owner_aliases WHERE jid=?').get(EXTRA),undefined);}finally{x.done()}});
test('chave expirada nao pode elevar privilegio',async()=>{let fakeNow=100000;const x=setup({clock:()=>fakeNow});try{const code=issue(x.base,()=>fakeNow);fakeNow+=600001;const r=await x.beta.handle(x.message('a',PRIVATE,'/vinculardono '+code));assert.equal(r.reason,'invalid-admin-claim');}finally{x.done()}});
test('grupo exige chave mesmo que outro participante seja admin do WhatsApp',async()=>{const x=setup();try{const code=issue(x.base);const r=await x.beta.handle(x.message('x',EXTRA,'/ativar',GROUP));assert.equal(r.reason,'not-owner');assert.equal(x.beta.groupEnabled(GROUP),false);const p=await x.beta.handle(x.message('y',EXTRA,'/vinculardono '+code,GROUP));assert.equal(p.reason,'claim-requires-private');}finally{x.done()}});
test('vinculo persiste apos reinicializacao sem alterar banco de jogo',async()=>{const x=setup();try{await bind(x);x.beta.close();const b=x.newBeta();const r=await b.handle(x.message('later',PN,'/ativar',GROUP));assert.equal(r.handled,true);b.close();}finally{x.done()}});
test('nao aceita reivindicar mesma identidade grupo para privado diferente',async()=>{const x=setup();try{await bind(x);const code=issue(x.base);const pv=await x.beta.handle(x.message('pNew',EXTRA,'/vinculardono '+code));const token=/\/vinculargrupo ([A-F0-9]{24})/.exec(pv.text)[1];const result=await x.beta.handle(x.message('gNew',PN,'/vinculargrupo '+token,GROUP));assert.equal(result.reason,'alias-conflict');assert.equal(x.beta.db.prepare('SELECT canonical_jid FROM jid_aliases WHERE alias_jid=?').get(PN).canonical_jid,PRIVATE);}finally{x.done()}});
