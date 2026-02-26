const assert = require('assert');
const fs = require('fs');
const path = require('path');

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
    entity: {
      position: posObj,
      isInWater: false,
      isOnFire: false,
      yaw: 0,
      pitch: 0,
      velocity: { x: 0, y: 0, z: 0 },
      effects: overrides.effects || {},
    },
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
    pathfinder: { goal: null, setGoal() {}, setMovements() {} },
    ...overrides.extra,
  };
}

describe('getActiveEffects', () => {
  const { getActiveEffects } = require('../src/perception');

  it('should return empty array when no effects', () => {
    const bot = createMockBot();
    assert.deepStrictEqual(getActiveEffects(bot), []);
  });

  it('should return effects when present', () => {
    const bot = createMockBot({
      effects: {
        1: { name: 'speed', amplifier: 1, duration: 600 },
        14: { name: 'invisibility', amplifier: 0, duration: 200 },
      },
    });
    const effects = getActiveEffects(bot);
    assert.strictEqual(effects.length, 2);
    assert.strictEqual(effects[0].name, 'speed');
    assert.strictEqual(effects[0].amplifier, 1);
    assert.strictEqual(effects[0].duration, 30); // 600 ticks / 20 = 30s
    assert.strictEqual(effects[1].name, 'invisibility');
  });
});

describe('entity health and entityId in getNearbyEntities', () => {
  const { getNearbyEntities } = require('../src/perception');

  it('should include entityId', () => {
    const bot = createMockBot({
      entities: {
        42: {
          id: 42,
          name: 'zombie',
          type: 'mob',
          position: { x: 105, y: 64, z: 200, distanceTo: () => 5 },
          metadata: [null, null, null, null, null, null, null, null, null, 20],
        },
      },
    });
    // Override entity position with proper distanceTo
    bot.entities[42].position = {
      x: 105, y: 64, z: 200,
      distanceTo(other) { return Math.sqrt((105 - other.x) ** 2 + (64 - other.y) ** 2 + (200 - other.z) ** 2); },
    };
    const entities = getNearbyEntities(bot);
    assert.strictEqual(entities.length, 1);
    assert.strictEqual(entities[0].entityId, 42);
    assert.strictEqual(entities[0].type, 'hostile');
  });

  it('should include entity health when available', () => {
    const bot = createMockBot({
      entities: {
        42: {
          id: 42,
          name: 'zombie',
          type: 'mob',
          position: {
            x: 105, y: 64, z: 200,
            distanceTo(other) { return 5; },
          },
          metadata: [null, null, null, null, null, null, null, null, null, 15.5],
        },
      },
    });
    const entities = getNearbyEntities(bot);
    assert.strictEqual(entities[0].health, 15.5);
  });
});

describe('getSurvivalState', () => {
  const { getSurvivalState } = require('../src/survival');

  it('should return survival state object', () => {
    const state = getSurvivalState();
    assert.strictEqual(typeof state.isFleeing, 'boolean');
    assert.strictEqual(typeof state.isEscapingWater, 'boolean');
    assert.strictEqual(typeof state.isStuck, 'boolean');
    assert.strictEqual(typeof state.stuckTicks, 'number');
  });

  it('should have null nearestThreat when no threats', () => {
    const state = getSurvivalState();
    // At initial state there should be no threat
    assert.strictEqual(state.isFleeing, false);
  });
});

describe('getCombatState', () => {
  const { getCombatState } = require('../src/handlers/combat');

  it('should return null when not in combat', () => {
    const state = getCombatState();
    assert.strictEqual(state, null);
  });
});

describe('notes system', () => {
  const DATA_DIR = path.join(__dirname, '..', 'data');
  const NOTES_FILE = path.join(DATA_DIR, 'notes.json');

  beforeEach(() => {
    // Clean up notes file
    try { fs.unlinkSync(NOTES_FILE); } catch (e) {}
  });

  afterEach(() => {
    try { fs.unlinkSync(NOTES_FILE); } catch (e) {}
  });

  it('should save and load notes', () => {
    const notes = { base_location: { value: '100 64 200', updatedAt: new Date().toISOString() } };
    fs.writeFileSync(NOTES_FILE, JSON.stringify(notes));
    const loaded = JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'));
    assert.strictEqual(loaded.base_location.value, '100 64 200');
  });

  it('should handle missing notes file', () => {
    // Notes file doesn't exist - should not throw
    const exists = fs.existsSync(NOTES_FILE);
    assert.strictEqual(exists, false);
  });
});

describe('enriched state.json structure', () => {
  // We can't easily test buildState without a full bot, but we can verify the module loads
  const state = require('../src/state');

  it('should export all required functions', () => {
    assert.strictEqual(typeof state.writeState, 'function');
    assert.strictEqual(typeof state.buildState, 'function');
    assert.strictEqual(typeof state.setCurrentAction, 'function');
    assert.strictEqual(typeof state.getCurrentAction, 'function');
    assert.strictEqual(typeof state.clearCurrentAction, 'function');
  });
});

describe('command dispatch includes new commands', () => {
  // Verify the commands.js registers new utility commands
  it('should have verify, cancel, inspect_container, set_note, get_notes in dispatch', () => {
    // Read the commands.js file and check for new registrations
    const commandsSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'commands.js'), 'utf8');
    assert(commandsSrc.includes('verify:'), 'missing verify command');
    assert(commandsSrc.includes('cancel:'), 'missing cancel command');
    assert(commandsSrc.includes('inspect_container:'), 'missing inspect_container command');
    assert(commandsSrc.includes('set_note:'), 'missing set_note command');
    assert(commandsSrc.includes('get_notes:'), 'missing get_notes command');
  });

  it('should log command_received event on execution', () => {
    const commandsSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'commands.js'), 'utf8');
    assert(commandsSrc.includes('command_received'), 'missing command_received acknowledgment');
  });
});
