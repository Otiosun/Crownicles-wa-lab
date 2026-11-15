/**
 * EXTRA CANDIDATE TEST, not yet executed against actual Crownicles Core.
 * Copy to upstream Core/__tests__-integration/handlers/ on pinned 6.2.0.b.
 * Uses upstream setupCoreForTests with a NEW per-suite disposable schema.
 * NEVER point TEST_DB_* at the user's production database.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ModelStatic } from "sequelize";
import { CoreTestEnvironment, loadProductionModule, setupCoreForTests } from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { InventorySlot as InventorySlotType } from "../../src/core/database/game/models/InventorySlot";
import type InventoryInfoType from "../../src/core/database/game/models/InventoryInfo";
import { ItemCategory, ItemConstants } from "../../../Lib/src/constants/ItemConstants";
import { CommandEquipActionReq } from "../../../Lib/src/packets/commands/CommandEquipPacket";

const OWN = "wa-equip-test-owner";
const OTHER = "wa-equip-test-other";
const SABRE = 2;
const SWORD = 9;

type EquipService = typeof import("../../src/core/utils/EquipActionService");
type CoreHandlersModule = typeof import("../../src/core/packetHandlers/handlers/CoreHandlers");

describe("WhatsApp equipment action via native Core + disposable MariaDB schema", () => {
 let env: CoreTestEnvironment;
 let Player: ModelStatic<PlayerType>;
 let InventorySlot: ModelStatic<InventorySlotType>;
 let InventoryInfo: ModelStatic<InventoryInfoType>;
 let equip: EquipService["handleEquipAction"];

 beforeAll(async () => {
  env = await setupCoreForTests("wa_equipment");
  const models = env.crownicles.gameDatabase.sequelize.models;
  Player = models.Player as ModelStatic<PlayerType>;
  InventorySlot = models.InventorySlot as ModelStatic<InventorySlotType>;
  InventoryInfo = models.InventoryInfo as ModelStatic<InventoryInfoType>;
  equip = loadProductionModule<EquipService>("core/utils/EquipActionService").handleEquipAction;
 });
 afterAll(async () => { await env?.teardown(); });
 beforeEach(async () => {
  await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
  try {
   for (const model of [InventorySlot, InventoryInfo, Player]) {
    await (model as ModelStatic<PlayerType>).destroy({ truncate: true, force: true });
   }
  }
  finally { await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1"); }
 });
 async function addPlayer(kid: string, active = 0, reserve?: number, capacity = 3): Promise<PlayerType> {
  const player = await Player.create({ keycloakId: kid });
  await InventoryInfo.create({ playerId: player.id, weaponSlots: capacity });
  for (const category of [ItemCategory.WEAPON, ItemCategory.ARMOR, ItemCategory.POTION, ItemCategory.OBJECT]) {
   await InventorySlot.create({
    playerId: player.id, slot: 0, itemCategory: category,
    itemId: category === ItemCategory.WEAPON ? active : 0,
    itemLevel: 0, itemEnchantmentId: null
   });
  }
  if (reserve !== undefined) {
   await InventorySlot.create({
    playerId: player.id, slot: 1, itemCategory: ItemCategory.WEAPON,
    itemId: reserve, itemLevel: 0, itemEnchantmentId: null
   });
  }
  return player;
 }
 const get = async (p: PlayerType, slot: number) => await InventorySlot.findOne({
  where: { playerId: p.id, itemCategory: ItemCategory.WEAPON, slot }
 });
 const action = (name: "equip" | "deposit", slot: number): CommandEquipActionReq => ({
  action: name, itemCategory: ItemCategory.WEAPON, slot
 });

 it("equips reserve item, persists active slot and returns refreshed categories", async () => {
  const p = await addPlayer(OWN, 0, SWORD);
  const result = await equip(OWN, action("equip", 1));
  expect(result.success).toBe(true);
  expect(result.categories.length).toBeGreaterThan(0);
  expect((await get(p, 0))?.itemId).toBe(SWORD);
  expect(await get(p, 1)).toBeNull();
 });

 it("swaps two real items without duplicating inventory state", async () => {
  const p = await addPlayer(OWN, SABRE, SWORD);
  const result = await equip(OWN, action("equip", 1));
  expect(result.success).toBe(true);
  expect((await get(p, 0))?.itemId).toBe(SWORD);
  expect((await get(p, 1))?.itemId).toBe(SABRE);
 });

 it("deposit moves equipped item to reserve when inventory has capacity", async () => {
  const p = await addPlayer(OWN, SABRE);
  const result = await equip(OWN, action("deposit", 0));
  expect(result.success).toBe(true);
  expect((await get(p, 0))?.itemId).toBe(0);
  expect((await get(p, 1))?.itemId).toBe(SABRE);
 });

 it("no active item: deposit rejected with no mutation", async () => {
  const p = await addPlayer(OWN, 0);
  const result = await equip(OWN, action("deposit", 0));
  expect(result.success).toBe(false);
  expect(result.error).toBe(ItemConstants.EQUIP_ERRORS.NO_ITEM);
  expect((await get(p, 0))?.itemId).toBe(0);
 });

 it("missing reserve item is rejected and cannot equip invented items", async () => {
  const p = await addPlayer(OWN, SABRE);
  const result = await equip(OWN, action("equip", 7));
  expect(result.success).toBe(false);
  expect(result.error).toBe(ItemConstants.EQUIP_ERRORS.INVALID);
  expect((await get(p, 0))?.itemId).toBe(SABRE);
 });

 it("a player's context cannot alter another player's inventory", async () => {
  const owner = await addPlayer(OWN, SABRE, SWORD);
  const other = await addPlayer(OTHER, 0);
  const result = await equip(OTHER, action("equip", 1));
  expect(result.success).toBe(false);
  expect((await get(owner, 0))?.itemId).toBe(SABRE);
  expect((await get(owner, 1))?.itemId).toBe(SWORD);
  expect((await get(other, 0))?.itemId).toBe(0);
 });

 it("CoreHandlers responds with official packet and writes the same database state", async () => {
  const player = await addPlayer(OWN, SABRE, SWORD);
  const { default: CoreHandlers } = loadProductionModule<CoreHandlersModule>("core/packetHandlers/handlers/CoreHandlers");
  const response: any[] = [];
  await new CoreHandlers().equipAction(response, {
   frontEndOrigin: "lab", frontEndSubOrigin: "wa-test", keycloakId: OWN
  }, action("equip", 1));
  expect(response.some(packet => packet.constructor.name === "CommandEquipActionRes")).toBe(true);
  expect((response.find(packet => packet.constructor.name === "CommandEquipActionRes") as {success:boolean}).success).toBe(true);
  expect((await get(player, 0))?.itemId).toBe(SWORD);
 });
});
