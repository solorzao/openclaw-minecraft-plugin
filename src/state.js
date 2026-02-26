const { STATE_FILE } = require('./config');
const { safeWrite, getLatestEventId } = require('./events');
const {
  getNearbyPlayers, getNearbyEntities, getNearbyBlocks, getNotableBlocks,
  getLightLevel, getInventory, getEquipment, getArmorRating, getInventoryStats,
  getDimension, getTimePhase, getActiveEffects,
} = require('./perception');

const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./config');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');

// Lazy-loaded to avoid circular dependency (survival requires state)
let _getSurvivalState = null;
let _getCombatState = null;
let _loadAck = null;
function lazyLoadModules() {
  if (!_getSurvivalState) {
    _getSurvivalState = require('./survival').getSurvivalState;
    _getCombatState = require('./handlers/combat').getCombatState;
    _loadAck = require('./handlers/utility').loadAck;
  }
}

function loadNotes() {
  try {
    if (fs.existsSync(NOTES_FILE)) return JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'));
  } catch (e) {}
  return {};
}

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
  lazyLoadModules();
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

  // Pathfinding status
  let pathfinding = null;
  try {
    const goal = bot.pathfinder.goal;
    if (goal) {
      pathfinding = { active: true };
      // Extract goal coordinates if available
      if (goal.x !== undefined) pathfinding.goalX = Math.floor(goal.x);
      if (goal.y !== undefined) pathfinding.goalY = Math.floor(goal.y);
      if (goal.z !== undefined) pathfinding.goalZ = Math.floor(goal.z);
      // Distance to goal
      if (pathfinding.goalX !== undefined && pathfinding.goalZ !== undefined) {
        const dx = (pathfinding.goalX || 0) - pos.x;
        const dz = (pathfinding.goalZ || 0) - pos.z;
        pathfinding.distanceToGoal = Math.floor(Math.sqrt(dx * dx + dz * dz));
      }
    }
  } catch (e) {}

  // Get survival and combat states
  let survivalState = null;
  let combatInfo = null;
  try { survivalState = _getSurvivalState(); } catch (e) {}
  try { combatInfo = _getCombatState(); } catch (e) {}

  return {
    timestamp: new Date().toISOString(),
    bot: {
      position: { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) },
      velocity: {
        x: Math.round(bot.entity.velocity.x * 100) / 100,
        y: Math.round(bot.entity.velocity.y * 100) / 100,
        z: Math.round(bot.entity.velocity.z * 100) / 100,
      },
      yaw: Math.round(bot.entity.yaw * 100) / 100,
      pitch: Math.round(bot.entity.pitch * 100) / 100,
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
      effects: getActiveEffects(bot),
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
    pathfinding,
    survival: survivalState,
    combat: combatInfo,
    notes: loadNotes(),
    latestEventId: getLatestEventId(),
    lastAckedEventId: _loadAck ? _loadAck().lastAckedEventId : null,
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
