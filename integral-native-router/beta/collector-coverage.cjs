'use strict';
// Structural audit, never a game permission or proof of real WhatsApp availability.
const upstream='Crownicles/Crownicles@64d08c05f11949029317341735f6f73024f19f9b';
const all='Altar AnyShopSmallEvent BadPetSmallEvent BigEvent BuyCategorySlot BuyHeal Cart ChangeClass ChooseDestination City DailyBonus DefensePersonality Drink EpicShopSmallEvent Equip Fight FightChooseAction FightPet Gardener GoToPVEIsland GobletsGame GuildCreate GuildDescription GuildElder GuildElderRemove GuildInvite GuildKick GuildLeave InteractOtherPlayersPoor ItemAccept ItemChoice JoinBoat Limoges Lottery PetExpedition PetExpeditionChoice PetExpeditionFinished PetFeedWithGuild PetFeedWithoutGuild PetFoodSmallEvent PetFree PetFreeShelterConfirm PetFreeSelection PetSell PetTransfer PveFight RecipeShopSmallEvent Sell Shop ShopSmallEvent SkipMissionShopItem TokenMerchant Unlock UseTokens Witch'.split(' ');
const main='BigEvent ChooseDestination RecipeShopSmallEvent DefensePersonality Shop Sell PetFeedWithGuild PetFeedWithoutGuild BuyCategorySlot UseTokens ChangeClass JoinBoat DailyBonus Drink Equip GuildCreate GuildDescription GuildLeave PetFree PetFreeShelterConfirm PetTransfer'.split(' ');
const world='City Fight FightChooseAction FightPet PveFight BuyHeal Cart Gardener GoToPVEIsland'.split(' ');
const items='ItemChoice ShopSmallEvent EpicShopSmallEvent TokenMerchant ItemAccept'.split(' ');
const smallEvents='GobletsGame Lottery Altar Witch PetFoodSmallEvent BadPetSmallEvent Limoges'.split(' ');
const expedition='PetExpedition PetExpeditionChoice PetExpeditionFinished'.split(' ');
const social='GuildInvite PetSell'.split(' ');
function audit(){
 const catalog=new Map();
 for(const name of all){if(catalog.has(name))throw Error('COLLECTOR_DUPLICATE_'+name);catalog.set(name,{name:'ReactionCollector'+name+'Data',source:'Lib/src/packets/interaction/ReactionCollector'+(name==='PetFreeShelterConfirm'||name==='PetFreeSelection'?'PetFree':name==='InteractOtherPlayersPoor'?'InteractOtherPlayers':name)+'.ts',route:'adapter-only'});}
 for(const [route,items] of [['main-presenter',main],['world-validated',world],['item-validated',items],['event-validated',smallEvents],['expedition-validated',expedition],['two-party-private',social],['abstract-base',['AnyShopSmallEvent']]])for(const k of items){if(!catalog.has(k))throw Error('COLLECTOR_NOT_UPSTREAM_'+k);if(catalog.get(k).route!=='adapter-only')throw Error('COLLECTOR_ROUTE_DUPLICATE_'+k);catalog.get(k).route=route;}
 const rows=[...catalog.values()].map(row=>({...row,status:'code path only; real Core+WhatsApp QA pending'}));
 const counts=Object.fromEntries(['main-presenter','world-validated','item-validated','event-validated','expedition-validated','two-party-private','adapter-only','abstract-base'].map(k=>[k,rows.filter(x=>x.route===k).length]));
 return {upstream,totalTypes:rows.length,counts,rows};
}
if(require.main===module)process.stdout.write(JSON.stringify(audit(),null,2)+'\n');
module.exports={audit};
