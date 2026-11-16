#!/usr/bin/env node
'use strict';
/**
 * Read-only Crownicles original/WhatsApp bridge coverage census.
 * No credentials, database, sockets, network, writes or user data.
 * Counts references as references, NOT runnable features.
 */
const fs=require('node:fs'),path=require('node:path');
const {NATIVE}=require('../src/native-universal.cjs');
const {knownKinds}=require('../src/universal-collector-v3.cjs');
const ROOT=process.argv[2]||path.join(process.env.HOME||'', 'crownicles-whatsapp-lab','crownicles-dev');
function walk(dir){if(!fs.existsSync(dir))return [];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(d=>{const p=path.join(dir,d.name);if(d.isDirectory())return ['node_modules','.git','dist','coverage','build'].includes(d.name)?[]:walk(p);return d.isFile()&&p.endsWith('.ts')?[p]:[];});}
function extract(text,re){return [...text.matchAll(re)].map(x=>x[1]);}
function census(coreRoot,bridgeRoot=path.resolve(__dirname,'..')){
 const roots={commands:path.join(coreRoot,'Core/src/commands'),lib:path.join(coreRoot,'Lib/src/packets/commands'),collectors:path.join(coreRoot,'Lib/src/packets/interaction'),discord:path.join(coreRoot,'Discord/src/commands')};
 const present=Object.fromEntries(Object.entries(roots).map(([k,p])=>[k,fs.existsSync(p)]));
 if(!present.commands||!present.lib||!present.collectors)return {status:'MISSING_ORIGINAL_SOURCE',present};
 const bridgeFiles=fs.readdirSync(path.join(bridgeRoot,'src')).filter(n=>n.endsWith('.cjs'));
 const legacy=bridgeFiles.filter(n=>!['native-universal.cjs','universal-collector-v3.cjs'].includes(n)).map(n=>fs.readFileSync(path.join(bridgeRoot,'src',n),'utf8')).join('\n');
 const nativeReq=new Set(Object.values(NATIVE).map(x=>x.request));
 const coreFiles=walk(roots.commands),collectorFiles=walk(roots.collectors),libFiles=walk(roots.lib),discordFiles=walk(roots.discord);
 const commands=[];for(const f of coreFiles){const src=fs.readFileSync(f,'utf8');for(const name of extract(src,/@commandRequires\s*\(\s*(Command\w+PacketReq)/g))commands.push({request:name,handler:path.relative(coreRoot,f).replaceAll(path.sep,'/'),family:f.includes('/commands/admin/')?'admin':f.split('/commands/')[1]?.split('/')[0]||'misc',nativeRouter:nativeReq.has(name),legacyReference:legacy.includes(name)});}
 const collectors=[];for(const f of collectorFiles){const src=fs.readFileSync(f,'utf8');for(const name of extract(src,/export\s+class\s+(ReactionCollector\w+Data)\s+extends\s+ReactionCollectorData/g))collectors.push({type:name,source:path.relative(coreRoot,f).replaceAll(path.sep,'/'),inKnownRenderer:knownKinds.has(name),legacyReference:legacy.includes(name)});}
 const classes=[];for(const f of libFiles){const src=fs.readFileSync(f,'utf8');for(const name of extract(src,/export\s+class\s+(Command\w+PacketReq)\s+extends\s+CrowniclesPacket/g))classes.push(name);}
 const stats={commandFileCount:coreFiles.length,decoratedReqCount:new Set(commands.map(x=>x.request)).size,nonAdminDecoratedReqCount:new Set(commands.filter(x=>x.family!=='admin').map(x=>x.request)).size,nativeRouterDecoratedReqCount:new Set(commands.filter(x=>x.nativeRouter).map(x=>x.request)).size,legacyReferencedDecoratedReqCount:new Set(commands.filter(x=>x.legacyReference).map(x=>x.request)).size,collectorTypeCount:new Set(collectors.map(x=>x.type)).size,recognizedCollectorTypeCount:new Set(collectors.filter(x=>x.inKnownRenderer).map(x=>x.type)).size,libReqCount:new Set(classes).size,discordCommandTsFiles:discordFiles.length};
 const warnings=['Native and legacy references do not prove real operation, output rendering, Core persistence, MQTT, Baileys or website coverage.','Collector knownKinds only means listed in the renderers. A supported option may still be intentionally blocked.','No production actions are invoked.'];
 return {status:'READ_ONLY',sourceRoot:coreRoot,sourcePresent:present,stats,commands,collectors,packetRequests:[...new Set(classes)].sort(),warnings};
}
if(require.main===module){const r=census(ROOT);console.log('CROWNICLES_COBERTURA_V2='+r.status);if(r.stats){for(const [k,v]of Object.entries(r.stats))console.log(k+'='+v);console.log('UNMENTIONED_NATIVE_REQUESTS='+JSON.stringify(r.commands.filter(x=>x.family!=='admin'&&!x.nativeRouter&&!x.legacyReference).map(x=>x.request)));}else console.log('SOURCE_PRESENT='+JSON.stringify(r.present));console.log('READ_ONLY=TRUE');process.exitCode=r.status==='READ_ONLY'?0:1;}
module.exports={walk,extract,census};
