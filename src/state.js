const { STATE_FILE } = require('./config');
const { safeWrite } = require('./events');
const { getNearbyPlayers, getNearbyEntities, getNearbyBlocks, getInventory, getTimePhase } = require('./perception');

let currentAction = null;

function setCurrentAction(action) {
  currentAction = action;
}

function clearCurrentAction() {
  currentAction = null;
}

function buildState(bot) {
  const pos = bot.entity.position;
  return {
    timestamp: new Date().toISOString(),
    bot: {
      position: { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) },
      health: bot.health,
      food: bot.food,
      experience: {
        level: bot.experience.level,
        points: bot.experience.points,
      },
      isInWater: bot.entity.isInWater,
      isSleeping: bot.isSleeping,
      gameMode: bot.game.gameMode,
    },
    inventory: getInventory(bot),
    nearbyEntities: [
      ...getNearbyPlayers(bot),
      ...getNearbyEntities(bot),
    ],
    nearbyBlocks: getNearbyBlocks(bot),
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

module.exports = { writeState, buildState, setCurrentAction, clearCurrentAction };
