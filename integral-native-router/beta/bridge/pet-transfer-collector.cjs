'use strict';
/**
 * Crownicles 6.2.0.b: verified original ReactionCollectorPetTransferData.
 * Source: Lib/src/packets/interaction/ReactionCollectorPetTransfer.ts.
 * Display-only: the Core alone owns guild rules, costs and mutations.
 */
const K='ReactionCollectorPetTransferData';
const DEPOSIT='ReactionCollectorPetTransferDepositReaction';
const WITHDRAW='ReactionCollectorPetTransferWithdrawReaction';
const SWITCH='ReactionCollectorPetTransferSwitchReaction';
const REFUSE='ReactionCollectorRefuseReaction';
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const empty=x=>plain(x)&&Object.keys(x).length===0;
const positive=x=>Number.isSafeInteger(x)&&x>0;
const text=x=>typeof x==='string'&&x.length<=70&&!/[\x00-\x1f\x7f<>\x60*@]/.test(x);
const label=x=>String(x).replace(/[_~]/g,' ').replace(/\s+/g,' ').trim();
const pet=x=>plain(x)&&positive(x.typeId)&&text(x.nickname)&&['m','f'].includes(x.sex)
 &&Number.isSafeInteger(x.rarity)&&x.rarity>=0
 &&Number.isFinite(x.loveLevel)&&x.loveLevel>=0
 &&Number.isFinite(x.force)&&x.force>=0
 &&Number.isFinite(x.feedDelay)&&x.feedDelay>=0;
const describe=x=>\`\${label(x.nickname)||'Sem apelido'} (espécie \${x.typeId})\`;
function compileCollector(packet){
 if(!plain(packet)||!plain(packet.data)||packet.data.type!==K||!plain(packet.data.data)||!Array.isArray(packet.reactions))return null;
 const data=packet.data.data,rx=packet.reactions;
 if(Object.keys(data).some(k=>!['ownPet','shelterPets'].includes(k))||rx.length<2||rx.length>100||!Array.isArray(data.shelterPets)||data.shelterPets.length>75||data.shelterPets.some(x=>!plain(x)||Object.keys(x).some(k=>!['petEntityId','pet'].includes(k))||!positive(x.petEntityId)||!pet(x.pet))||(data.ownPet!==undefined&&!pet(data.ownPet)))return null;
 const byId=new Map(data.shelterPets.map(x=>[x.petEntityId,x.pet]));
 if(byId.size!==data.shelterPets.length)return null;
 const hasOwn=data.ownPet!==undefined,refusal=rx.filter(x=>x?.type===REFUSE);
 if(refusal.length!==1||!empty(refusal[0].data))return null;
 const used=new Set(),opts=[];let actionCount=0;
 for(const reaction of rx){
  if(!plain(reaction)||typeof reaction.type!=='string'||!plain(reaction.data))return null;
  const {type}=reaction,details=reaction.data;
  if(type===REFUSE){opts.push({label:'Cancelar transferência, sem alterar os companheiros',supported:true,requiresConfirmation:false});continue;}
  if(type===DEPOSIT){
   if(!hasOwn||!empty(details)||used.has(DEPOSIT))return null;
   used.add(DEPOSIT);actionCount++;
   opts.push({label:\`Depositar \${describe(data.ownPet)} no abrigo compartilhado\`,supported:true,requiresConfirmation:true});continue;
  }
  if(type===WITHDRAW||type===SWITCH){
   if((type===WITHDRAW&&hasOwn)||(type===SWITCH&&!hasOwn)||Object.keys(details).length!==1||!positive(details.petEntityId)||!byId.has(details.petEntityId)||used.has(type+':'+details.petEntityId))return null;
   used.add(type+':'+details.petEntityId);actionCount++;
   const target=describe(byId.get(details.petEntityId));
   opts.push({label:type===WITHDRAW?\`Retirar \${target} do abrigo compartilhado\`:\`Trocar \${describe(data.ownPet)} por \${target} do abrigo compartilhado\`,supported:true,requiresConfirmation:true});continue;
  }
  return null;
 }
 if(actionCount<1)return null;
 for(const id of byId.keys())if(!used.has((hasOwn?SWITCH:WITHDRAW)+':'+id))return null;
 const original=hasOwn?\`Seu companheiro: \${describe(data.ownPet)}.\`:'Você não está com um companheiro no momento.';
 return {kind:K,title:'✦ ABRIGO — TRANSFERÊNCIA DE COMPANHEIROS',story:\`\${original}\nO abrigo pertence à guilda. Depósitos podem disponibilizar seu companheiro a outros membros; retiradas e trocas alteram o companheiro que você possui. O pacote não informa custo. Confira cada escolha antes de confirmar. O Core revalidará o estado da guilda.\`,options:opts};
}
module.exports={compileCollector,K,DEPOSIT,WITHDRAW,SWITCH,REFUSE};
