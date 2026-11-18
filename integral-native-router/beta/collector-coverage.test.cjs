'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {audit}=require('./collector-coverage.cjs');
test('55 distinct official data contracts (not 56 completed menus)',()=>{const x=audit();a.equal(x.totalTypes,55);a.equal(new Set(x.rows.map(o=>o.name)).size,55);a.equal(x.upstream.includes('64d08c05'),true)});
test('normal bridge route, expedition adapter, two-party routing and blocked adapter counted separately',()=>{const x=audit();a.deepEqual(x.counts,{'main-presenter':26,'expedition-validated':3,'two-party-private':2,'adapter-only':24})});
test('all three expedition original collector types route to strict validation',()=>{const x=audit();a.deepEqual(x.rows.filter(y=>y.route==='expedition-validated').map(y=>y.name).sort(),['ReactionCollectorPetExpeditionChoiceData','ReactionCollectorPetExpeditionData','ReactionCollectorPetExpeditionFinishedData'].sort())});
test('unexposed interactions cannot be counted as WhatsApp ready',()=>{const x=audit();for(const name of ['ReactionCollectorAnyShopSmallEventData','ReactionCollectorWitchData','ReactionCollectorFightPetData','ReactionCollectorPetFreeSelectionData']){const row=x.rows.find(y=>y.name===name);a(row);a.equal(row.route,'adapter-only');a.match(row.status,/pending/)} });
test('PetFree inner forms point to their actual upstream source file',()=>{const x=audit();for(const suffix of ['PetFreeData','PetFreeShelterConfirmData','PetFreeSelectionData']){const row=x.rows.find(y=>y.name==='ReactionCollector'+suffix);a(row);a.match(row.source,/ReactionCollectorPetFree\.ts$/)}});
