'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Presenter}=require('./bridge/presenter.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'crownicles-event-'));fs.writeFileSync(path.join(dir,'models.json'),JSON.stringify({weapons:{3:{name:'Espada lunar'}}}));test.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
const rx=(k,data={})=>({type:'ReactionCollector'+k+'Reaction',data}),p=(k,data,reactions)=>({id:'ev',endTime:2000000000000,data:{type:'ReactionCollector'+k+'Data',data},reactions});
const make=()=>new Presenter(dir),uid='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',wi='5511999999999@s.whatsapp.net';
const store=()=>({saved:null,saveMenu(wa,m){this.saved=m},clearMenu(wa,id){if(this.saved?.id===id)this.saved=null}});
const packet=(name,packet)=>({name,packet});
const cases=[
 ['GobletsGame',{},[['Metal','metal','classic'],['Biggest','biggest','safe'],['Sparkling','sparkling','risky'],['Cracked','cracked','gambler']].map(([t,id,strategy])=>rx('GobletsGame'+t,{id,strategy})),'CÁLICES'],
 ['Lottery',{},['Easy','Medium','Hard'].map(t=>rx('Lottery'+t)),'LOTERIA'],
 ['Altar',{poolAmount:100,poolThreshold:500},[rx('AltarContribute',{amount:200}),rx('Refuse')],'ALTAR'],
 ['Witch',{},['book','frog','nothing'].map(id=>rx('Witch',{id})),'BRUXA'],
 ['PetFoodSmallEvent',{foodType:'soup',petSex:'f'},['Investigate','SendPet','Continue'].map(t=>rx('PetFood'+t)),''],
 ['BadPetSmallEvent',{petId:2,sex:'f',petNickname:'Luna'},['giveMeat','wait','flee'].map(id=>rx('BadPet',{id})),''],
 ['Limoges',{questionId:'journeyInvitation'},[rx('Accept'),rx('Refuse')],'']
 ];
for(const [k,d,r,title] of cases)test(k+' native path and malformed data fail closed',()=>{const pr=make(),m=pr.menu(p(k,d,r),uid);assert.ok(m.title.includes(title));assert.ok(m.options.length===r.length&&m.options.every(o=>o.supported));pr.universalLab=true;const bad=pr.menu(p(k,d,[...r,r[0]]),uid);assert.ok(bad.title.includes('NÃO VALIDADA')&&bad.options.every(o=>!o.supported));});
test('altar saved exactly, valid decline is safe',()=>{const pr=make(),s=store(),q=p('Altar',{poolAmount:100,poolThreshold:500},[rx('Refuse'),rx('AltarContribute',{amount:200})]);const out=pr.apply([packet('ReactionCollectorCreationPacket',q)],wi,s,uid);assert.ok(out.includes('ALTAR')&&out.includes('2.')&&s.saved.id==='ev'&&!s.saved.options[0].requiresConfirmation&&s.saved.options[1].requiresConfirmation)});
test('witch and goblets renderer receives native outcome',()=>{const pr=make(),s=store(),out=pr.apply([packet('SmallEventGobletsGamePacket',{malus:'item',value:0,goblet:'sparkling',strategy:'risky',itemCategory:0,itemId:3}),packet('SmallEventWitchResultPacket',{ingredientId:'frog',isIngredient:true,forceEffect:false,effectId:'occupied',timeLost:5,lifeLoss:5,outcome:0})],wi,s,uid);assert.ok(out.includes('Espada lunar')&&out.includes('poção')&&!out.includes('Vida perdida')&&!out.includes('5 min'))});
test('bad pet food reports actual pet diet and not dwarf preference',()=>{const out=make().apply([packet('SmallEventBadPetPacket',{petId:2,sex:'f',loveLost:2,interactionType:'giveMeatLikes'})],wi,store(),uid);assert.ok(out.includes('companheiro gosta de carne')&&out.includes('ciúmes')&&!out.includes('anão gostou'))});
