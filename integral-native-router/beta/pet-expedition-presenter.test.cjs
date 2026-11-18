'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Presenter}=require('./bridge/presenter.cjs');
const pet={petTypeId:9,petSex:'m',petNickname:'Aurora'};
const ex={id:'exp-1001',mapLocationId:3,locationType:'cave',durationMinutes:180,displayDurationMinutes:180,riskRate:38,difficulty:22,foodCost:4,rewardIndex:3};
const r=(type,data={})=>({type,data});
const make=(kind,data,reactions)=>({id:'bc10',endTime:Date.now()+120000,data:{type:kind,data},reactions});
const choice=()=>make('ReactionCollectorPetExpeditionChoiceData',{pet,hasGuild:false,expeditions:[ex]},[r('ReactionCollectorPetExpeditionSelectReaction',{expedition:ex}),r('ReactionCollectorPetExpeditionCancelReaction')]);
function presenter(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'crown-exp-presentation-'));return {p:new Presenter(dir),close:()=>fs.rmSync(dir,{force:true,recursive:true})}}
test('WhatsApp normal Presenter renders official pet expedition choice with confirmation',()=>{const {p,close}=presenter();try{const m=p.menu(choice());a.equal(m.type,'ReactionCollectorPetExpeditionChoiceData');a.match(m.story,/Aurora/);a.match(m.options[0].label,/Cavernas/);a.equal(m.options[0].requiresConfirmation,true);a.equal(m.options[1].requiresConfirmation,true)}finally{close()}});
test('mismatched Core reward snapshot never bypasses strict compiler',()=>{const {p,close}=presenter();try{const packet=choice();packet.reactions[0].data.expedition={...ex,foodCost:400};const m=p.menu(packet);a.match(m.title,/DADOS INCONSISTENTES/);a.equal(m.options.every(o=>o.supported===false),true)}finally{close()}});
test('active expedition has a safe close and a guarded recall',()=>{const {p,close}=presenter();try{const m=p.menu(make('ReactionCollectorPetExpeditionData',{pet,mapLocationId:3,locationType:'cave',riskRate:33,returnTime:Date.now()+3600000},[r('ReactionCollectorPetExpeditionRecallReaction'),r('ReactionCollectorPetExpeditionCloseReaction')]));a.match(m.story,/Aurora/);a.equal(m.options[0].requiresConfirmation,true);a.equal(m.options[1].requiresConfirmation,false)}finally{close()}});
test('completed expedition claim remains a confirmed Core reaction',()=>{const {p,close}=presenter();try{const m=p.menu(make('ReactionCollectorPetExpeditionFinishedData',{pet,mapLocationId:3,locationType:'cave',riskRate:33},[r('ReactionCollectorPetExpeditionClaimReaction')]));a.equal(m.options.length,1);a.equal(m.options[0].requiresConfirmation,true);a.match(m.story,/Core/)}finally{close()}});
