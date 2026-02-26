const assert = require('assert');
const perception = require('../src/perception');

// Mock bot factory
function createMockBot(overrides = {}) {
  const pos = overrides.position || { x: 100, y: 64, z: 200 };
  const posObj = {
    x: pos.x, y: pos.y, z: pos.z,
    floored() { return { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z), offset: (dx, dy, dz) => ({ x: Math.floor(pos.x) + dx, y: Math.floor(pos.y) + dy, z: Math.floor(pos.z) + dz }) }; },
    distanceTo(other) { return Math.sqrt((pos.x - other.x) ** 2 + (pos.y - other.y) ** 2 + (pos.z - other.z) ** 2); },
    offset(dx, dy, dz) { return { x: pos.x + dx, y: pos.y + dy, z: pos.z + dz }; },
    clone() { return { ...posObj }; },
  };

  return {
    username: 'TestBot',
    entity: { position: posObj, isInWater: false, isOnFire: false, yaw: 0 },
    health: overrides.health || 20,
    food: overrides.food || 20,
    foodSaturation: 5,
    experience: { level: 0, points: 0 },
    heldItem: overrides.heldItem || null,
    isSleeping: false,
    isRaining: false,
    thunderState: false,
    time: { timeOfDay: overrides.timeOfDay || 6000 },
    game: { gameMode: 'survival', dimension: overrides.dimension || 'minecraft:overworld' },
    players: overrides.players || {},
    entities: overrides.entities || {},
    inventory: {
      items() { return overrides.items || []; },
      slots: overrides.slots || {},
    },
    blockAt(pos) { return overrides.blockAtFn ? overrides.blockAtFn(pos) : { name: 'stone', light: 15, biome: 'plains' }; },
    findBlock() { return null; },
    findBlocks() { return []; },
    ...overrides.extra,
  };
}

describe('perception', () => {
  describe('HOSTILE_MOBS', () => {
    it('should include common hostiles', () => {
      assert(perception.HOSTILE_MOBS.includes('zombie'));
      assert(perception.HOSTILE_MOBS.includes('creeper'));
      assert(perception.HOSTILE_MOBS.includes('skeleton'));
      assert(perception.HOSTILE_MOBS.includes('enderman'));
      assert(perception.HOSTILE_MOBS.includes('phantom'));
    });

    it('should not include passive mobs', () => {
      assert(!perception.HOSTILE_MOBS.includes('cow'));
      assert(!perception.HOSTILE_MOBS.includes('pig'));
      assert(!perception.HOSTILE_MOBS.includes('sheep'));
    });
  });

  describe('FOOD_ITEMS', () => {
    it('should include cooked meats first', () => {
      assert(perception.FOOD_ITEMS.includes('cooked_beef'));
      assert(perception.FOOD_ITEMS.includes('cooked_chicken'));
      assert(perception.FOOD_ITEMS.includes('bread'));
    });

    it('should include raw meats as fallback', () => {
      assert(perception.FOOD_ITEMS.includes('beef'));
      assert(perception.FOOD_ITEMS.includes('chicken'));
    });
  });

  describe('getNearbyPlayers', () => {
    it('should return nearby players with distance and position', () => {
      const bot = createMockBot({
        players: {
          'Player1': {
            username: 'Player1',
            entity: {
              position: {
                x: 105, y: 64, z: 200,
                distanceTo: () => 5,
              },
            },
          },
          'TestBot': {
            username: 'TestBot',
            entity: {
              position: { x: 100, y: 64, z: 200 },
            },
          },
        },
      });

      const players = perception.getNearbyPlayers(bot);
      assert.strictEqual(players.length, 1);
      assert.strictEqual(players[0].name, 'Player1');
      assert.strictEqual(players[0].type, 'player');
      assert.strictEqual(players[0].distance, 5);
    });

    it('should exclude self from nearby players', () => {
      const bot = createMockBot({
        players: {
          'TestBot': {
            username: 'TestBot',
            entity: { position: { x: 100, y: 64, z: 200, distanceTo: () => 0 } },
          },
        },
      });

      const players = perception.getNearbyPlayers(bot);
      assert.strictEqual(players.length, 0);
    });
  });

  describe('getNearbyEntities', () => {
    it('should classify hostile mobs correctly', () => {
      const bot = createMockBot({
        entities: {
          1: {
            name: 'zombie',
            type: 'mob',
            position: {
              x: 105, y: 64, z: 200,
              distanceTo: () => 5,
            },
          },
          2: {
            name: 'cow',
            type: 'mob',
            position: {
              x: 110, y: 64, z: 200,
              distanceTo: () => 10,
            },
          },
        },
      });

      // Set bot entity different from entities
      bot.entities[99] = bot.entity;
      const entities = perception.getNearbyEntities(bot);
      assert(entities.some(e => e.name === 'zombie' && e.type === 'hostile'));
      assert(entities.some(e => e.name === 'cow' && e.type === 'passive'));
    });

    it('should filter out clutter entities', () => {
      const bot = createMockBot({
        entities: {
          1: { name: 'arrow', type: 'object', position: { x: 101, y: 64, z: 200, distanceTo: () => 1 } },
          2: { name: 'experience_orb', type: 'orb', position: { x: 102, y: 64, z: 200, distanceTo: () => 2 } },
          3: { name: 'item', type: 'object', position: { x: 103, y: 64, z: 200, distanceTo: () => 3 } },
        },
      });

      const entities = perception.getNearbyEntities(bot);
      assert.strictEqual(entities.length, 0);
    });

    it('should limit to 20 entities', () => {
      const entities = {};
      for (let i = 0; i < 30; i++) {
        entities[i] = {
          name: 'cow',
          type: 'mob',
          position: { x: 100 + i, y: 64, z: 200, distanceTo: () => i },
        };
      }
      const bot = createMockBot({ entities });
      const result = perception.getNearbyEntities(bot);
      assert(result.length <= 20);
    });
  });

  describe('getTimePhase', () => {
    it('should return day during morning', () => {
      const bot = createMockBot({ timeOfDay: 6000 });
      assert.strictEqual(perception.getTimePhase(bot), 'day');
    });

    it('should return sunset during dusk', () => {
      const bot = createMockBot({ timeOfDay: 12000 });
      assert.strictEqual(perception.getTimePhase(bot), 'sunset');
    });

    it('should return night during midnight', () => {
      const bot = createMockBot({ timeOfDay: 18000 });
      assert.strictEqual(perception.getTimePhase(bot), 'night');
    });
  });

  describe('getEquipment', () => {
    it('should return null for empty slots', () => {
      const bot = createMockBot({ slots: {} });
      const equip = perception.getEquipment(bot);
      assert.strictEqual(equip.hand, null);
      assert.strictEqual(equip.head, null);
      assert.strictEqual(equip.chest, null);
    });

    it('should return item info for equipped slots', () => {
      const bot = createMockBot({
        heldItem: { name: 'diamond_sword', count: 1 },
        slots: {
          5: { name: 'iron_helmet', count: 1 },
          6: { name: 'iron_chestplate', count: 1 },
        },
      });
      const equip = perception.getEquipment(bot);
      assert.strictEqual(equip.hand.name, 'diamond_sword');
      assert.strictEqual(equip.head.name, 'iron_helmet');
      assert.strictEqual(equip.chest.name, 'iron_chestplate');
    });
  });

  describe('getArmorRating', () => {
    it('should return 0 for no armor', () => {
      const bot = createMockBot({ slots: {} });
      const armor = perception.getArmorRating(bot);
      assert.strictEqual(armor.totalProtection, 0);
      assert.strictEqual(armor.pieces.length, 0);
    });

    it('should calculate protection for iron armor', () => {
      const bot = createMockBot({
        slots: {
          5: { name: 'iron_helmet', count: 1 },
          6: { name: 'iron_chestplate', count: 1 },
          7: { name: 'iron_leggings', count: 1 },
          8: { name: 'iron_boots', count: 1 },
        },
      });
      const armor = perception.getArmorRating(bot);
      assert.strictEqual(armor.pieces.length, 4);
      assert(armor.totalProtection > 0);
    });
  });

  describe('getInventoryStats', () => {
    it('should calculate free slots correctly', () => {
      const bot = createMockBot({
        items: [
          { name: 'cobblestone', count: 64, slot: 0 },
          { name: 'dirt', count: 32, slot: 1 },
        ],
      });
      const stats = perception.getInventoryStats(bot);
      assert.strictEqual(stats.usedSlots, 2);
      assert.strictEqual(stats.freeSlots, 34);
      assert.strictEqual(stats.totalItems, 96);
    });
  });

  describe('getDimension', () => {
    it('should detect overworld', () => {
      const bot = createMockBot({ dimension: 'minecraft:overworld' });
      assert.strictEqual(perception.getDimension(bot), 'overworld');
    });

    it('should detect nether', () => {
      const bot = createMockBot({ dimension: 'minecraft:the_nether' });
      assert.strictEqual(perception.getDimension(bot), 'nether');
    });

    it('should detect the end', () => {
      const bot = createMockBot({ dimension: 'minecraft:the_end' });
      assert.strictEqual(perception.getDimension(bot), 'the_end');
    });
  });

  describe('countInventoryItem', () => {
    it('should count items by name', () => {
      const bot = createMockBot({
        items: [
          { name: 'cobblestone', count: 64, slot: 0 },
          { name: 'cobblestone', count: 32, slot: 1 },
          { name: 'dirt', count: 10, slot: 2 },
        ],
      });
      assert.strictEqual(perception.countInventoryItem(bot, 'cobblestone'), 96);
      assert.strictEqual(perception.countInventoryItem(bot, 'dirt'), 10);
    });

    it('should return 0 for items not in inventory', () => {
      const bot = createMockBot({ items: [] });
      assert.strictEqual(perception.countInventoryItem(bot, 'diamond'), 0);
    });
  });

  describe('hasItem', () => {
    it('should return true when item exists', () => {
      const bot = createMockBot({
        items: [{ name: 'diamond_pickaxe', count: 1, slot: 0 }],
      });
      assert.strictEqual(perception.hasItem(bot, 'diamond_pickaxe'), true);
    });

    it('should return false when item does not exist', () => {
      const bot = createMockBot({ items: [] });
      assert.strictEqual(perception.hasItem(bot, 'diamond_pickaxe'), false);
    });
  });
});
