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
const describe=x=>`${label(x.nickname)||'Sem apelido'} (espécie ${x.typeId})`;
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
   opts.push({label:`Depositar ${describe(data.ownPet)} no abrigo compartilhado`,supported:true,requiresConfirmation:true});continue;
  }
  if(type===WITHDRAW||type===SWITCH){
   if((type===WITHDRAW&&hasOwn)||(type===SWITCH&&!hasOwn)||Object.keys(details).length!==1||!positive(details.petEntityId)||!byId.has(details.petEntityId)||used.has(type+':'+details.petEntityId))return null;
   used.add(type+':'+details.petEntityId);actionCount++;
   const target=describe(byId.get(details.petEntityId));
   opts.push({label:type===WITHDRAW?`Retirar ${target} do abrigo compartilhado`:`Trocar ${describe(data.ownPet)} por ${target} do abrigo compartilhado`,supported:true,requiresConfirmation:true});continue;
  }
  return null;
 }
 if(actionCount<1)return null;
 for(const id of byId.keys())if(!used.has((hasOwn?SWITCH:WITHDRAW)+':'+id))return null;
 const original=hasOwn?`Seu companheiro: ${describe(data.ownPet)}.`:'Você não está com um companheiro no momento.';
 return {kind:K,title:'✦ ABRIGO — TRANSFERÊNCIA DE COMPANHEIROS',story:`${original}\nO abrigo pertence à guilda. Depósitos podem disponibilizar seu companheiro a outros membros; retiradas e trocas alteram o companheiro que você possui. O pacote não informa custo. Confira cada escolha antes de confirmar. O Core revalidará o estado da guilda.`,options:opts};
}

const FREE='ReactionCollectorPetFreeSelectionData',SELECT='ReactionCollectorPetFreeSelectReaction';
const validFreePet=x=>plain(x)&&Object.keys(x).length===7&&['typeId','nickname','rarity','sex','loveLevel','force','feedDelay'].every(k=>Object.hasOwn(x,k))&&pet({...x,nickname:x.nickname===null?'':x.nickname});
function freePetLabel(x,models){
 const v=models?.pets?.[x.typeId+'_'+(x.sex==='f'?'female':'male')];
 const raw=typeof v==='string'?v:v?.name_one||v?.name;
 const species=typeof raw==='string'&&text(raw)?label(raw):'Espécie '+x.typeId;
 const nick=label(x.nickname||'');return (nick?nick+' · ':'')+species+' · '+(x.sex==='f'?'fêmea':'macho')+' · raridade '+x.rarity+' · afinidade '+x.loveLevel;
}
function compileFreeSelection(packet,models={}){
 if(!plain(packet)||packet.data?.type!==FREE||!plain(packet.data.data)||!Array.isArray(packet.reactions))return null;
 const d=packet.data.data,r=packet.reactions;if(Object.keys(d).some(k=>!['ownPet','shelterPets'].includes(k))||!Array.isArray(d.shelterPets)||d.shelterPets.length<1||d.shelterPets.length>75||d.shelterPets.some(x=>!plain(x)||Object.keys(x).length!==2||!positive(x.petEntityId)||!validFreePet(x.pet))||(d.ownPet!==undefined&&!validFreePet(d.ownPet)))return null;
 const byId=new Map(d.shelterPets.map(x=>[x.petEntityId,x.pet]));if(byId.size!==d.shelterPets.length||r.some(x=>!plain(x)||!plain(x.data)))return null;
 const hasOwnChoice=r.length===d.shelterPets.length+2;
 if((hasOwnChoice&&!d.ownPet)||(!hasOwnChoice&&r.length!==d.shelterPets.length+1)||r.at(-1)?.type!==REFUSE||!empty(r.at(-1).data))return null;
 const selected=r.slice(0,-1);if(selected.some(x=>x.type!==SELECT||Object.keys(x.data).length!==1||!positive(x.data.petEntityId))||new Set(selected.map(x=>x.data.petEntityId)).size!==selected.length)return null;
 // Native Core emits optional own-pet reaction first; its entity ID is absent from OwnedPet.
 // Only that single non-shelter slot can be labeled own. All shelter targets must match order and IDs.
 if(hasOwnChoice&&byId.has(selected[0].data.petEntityId))return null;
 const offset=hasOwnChoice?1:0;
 if(d.shelterPets.some((x,i)=>selected[i+offset].data.petEntityId!==x.petEntityId))return null;
 const options=selected.map((x,i)=>({label:(hasOwnChoice&&i===0?'Seu companheiro: ':'Abrigo — posição '+(i-offset+1)+': ')+freePetLabel(hasOwnChoice&&i===0?d.ownPet:byId.get(x.data.petEntityId),models),supported:true,requiresConfirmation:false}));
 options.push({label:'Cancelar, sem libertar nenhum companheiro',supported:true,requiresConfirmation:false});
 return {title:'✦ LIBERTAÇÃO — SELECIONAR COMPANHEIRO',story:'Escolha qual companheiro deseja avaliar. O abrigo é compartilhado pela guilda. A seleção abre a confirmação original do Core, com custo, identidade e autorização revalidados. Libertar é irreversível. Nenhum pet será libertado apenas nesta seleção.'+(d.ownPet&&!hasOwnChoice?' Seu companheiro não está disponível para seleção.':''),options};
}
module.exports={compileCollector,K,DEPOSIT,WITHDRAW,SWITCH,REFUSE,FREE,compileFreeSelection};
