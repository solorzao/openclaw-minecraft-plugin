const { STATE_FILE } = require('./config');
const { safeWrite } = require('./events');
const {
  getNearbyPlayers, getNearbyEntities, getNearbyBlocks, getNotableBlocks,
  getLightLevel, getInventory, getEquipment, getArmorRating, getInventoryStats,
  getDimension, getTimePhase,
} = require('./perception');

let currentAction = null;
let lastHealth = null;

function deduplicateEntities(entities) {
  const seen = new Set();
  return entities.filter(e => {
    // Use position as dedup key - two entities at same spot are duplicates
    const key = `${e.position.x},${e.position.y},${e.position.z}`;
    // Keep the first one (players from getNearbyPlayers come first, with proper names)
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function setCurrentAction(action) {
  currentAction = action;
}

function getCurrentAction() {
  return currentAction;
}

function clearCurrentAction() {
  currentAction = null;
}

function buildState(bot) {
  const pos = bot.entity.position;

  // Track health trend
  const health = bot.health;
  let healthTrend = 'stable';
  if (lastHealth !== null) {
    if (health > lastHealth) healthTrend = 'healing';
    else if (health < lastHealth) healthTrend = 'taking_damage';
  }
  lastHealth = health;

  // Biome and weather
  let biome = 'unknown';
  try {
    const block = bot.blockAt(pos.floored());
    const b = block?.biome;
    biome = typeof b === 'string' ? b : (b?.name || b?.displayName || 'unknown');
  } catch (e) {}
  const weather = bot.isRaining ? (bot.thunderState ? 'thunder' : 'rain') : 'clear';

  return {
    timestamp: new Date().toISOString(),
    bot: {
      position: { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) },
      health,
      healthTrend,
      food: bot.food,
      saturation: bot.foodSaturation || 0,
      experience: {
        level: bot.experience.level,
        points: bot.experience.points,
      },
      isInWater: bot.entity.isInWater,
      isSleeping: bot.isSleeping,
      isOnFire: bot.entity.isOnFire || false,
      gameMode: bot.game.gameMode,
      dimension: getDimension(bot),
      biome,
      weather,
      lightLevel: getLightLevel(bot),
    },
    equipment: getEquipment(bot),
    armor: getArmorRating(bot),
    inventory: getInventory(bot),
    inventoryStats: getInventoryStats(bot),
    nearbyEntities: deduplicateEntities([
      ...getNearbyPlayers(bot),
      ...getNearbyEntities(bot),
    ]),
    nearbyBlocks: getNearbyBlocks(bot),
    notableBlocks: getNotableBlocks(bot),
    time: {
      timeOfDay: bot.time.timeOfDay,
      phase: getTimePhase(bot),
    },
    currentAction,
  };
}

function writeState(bot) {
  try {
    const state = buildState(bot);
    safeWrite(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('Failed to write state:', err.message);
  }
}

module.exports = { writeState, buildState, setCurrentAction, getCurrentAction, clearCurrentAction };
