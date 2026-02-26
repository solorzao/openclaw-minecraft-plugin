const { GoalBlock } = require('mineflayer-pathfinder').goals;
const { logEvent } = require('./events');
const { FOOD_ITEMS, HOSTILE_MOBS } = require('./perception');

let escaping = false;
let fleeing = false;
let fleeTimeout = null;
let savedGoal = null;

function canSeeEntity(bot, entity) {
  // Quick line-of-sight check using mineflayer's built-in method
  try {
    return bot.canSeeEntity(entity);
  } catch (e) {
    // If check fails, assume visible (safer to flee than not)
    return true;
  }
}

// Distances at which the bot reacts to threats
const CREEPER_FLEE_DIST = 12; // creepers explode at ~3 blocks, give wide berth
const HOSTILE_FLEE_DIST = 8;  // melee mobs
const FLEE_DURATION_MS = 4000;

async function autoEat(bot) {
  if (bot.food >= 6) return false;

  const foodItem = bot.inventory.items().find(item => FOOD_ITEMS.includes(item.name));
  if (!foodItem) {
    logEvent('hunger_warning', { food: bot.food, reason: 'no_food_items' });
    return false;
  }

  try {
    await bot.equip(foodItem, 'hand');
    await bot.consume();
    logEvent('ate_food', { item: foodItem.name, newFoodLevel: bot.food });
    return true;
  } catch (err) {
    logEvent('eat_failed', { error: err.message, item: foodItem.name });
    return false;
  }
}

function saveCurrentGoal(bot) {
  if (!fleeing && !escaping) {
    savedGoal = bot.pathfinder.goal;
  }
}

function restoreGoal(bot) {
  if (savedGoal) {
    bot.pathfinder.setGoal(savedGoal, true);
    savedGoal = null;
  }
}

function fleeFrom(bot, entity) {
  const botPos = bot.entity.position;
  const threatPos = entity.position;

  // Run in the opposite direction, 20 blocks away
  const dx = botPos.x - threatPos.x;
  const dz = botPos.z - threatPos.z;
  const dist = Math.sqrt(dx * dx + dz * dz) || 1;
  const fleeX = Math.floor(botPos.x + (dx / dist) * 20);
  const fleeZ = Math.floor(botPos.z + (dz / dist) * 20);
  const fleeY = Math.floor(botPos.y);

  bot.pathfinder.setGoal(new GoalBlock(fleeX, fleeY, fleeZ), false);
  return { x: fleeX, y: fleeY, z: fleeZ };
}

function checkThreats(bot) {
  if (fleeing || escaping) return; // already handling a survival situation

  const nearby = Object.values(bot.entities)
    .filter(e => {
      if (e === bot.entity || !e.position || e.type !== 'mob') return false;
      if (!HOSTILE_MOBS.includes(e.name?.toLowerCase())) return false;
      // Ignore mobs too far vertically (underground/above)
      if (Math.abs(e.position.y - bot.entity.position.y) > 10) return false;
      return true;
    })
    .map(e => ({
      entity: e,
      name: e.name.toLowerCase(),
      distance: bot.entity.position.distanceTo(e.position),
    }))
    .sort((a, b) => a.distance - b.distance);

  if (nearby.length === 0) return;

  const closest = nearby[0];

  // Determine flee distance based on mob type
  const fleeDist = closest.name === 'creeper' ? CREEPER_FLEE_DIST : HOSTILE_FLEE_DIST;

  if (closest.distance < fleeDist && canSeeEntity(bot, closest.entity)) {
    saveCurrentGoal(bot);
    fleeing = true;

    const target = fleeFrom(bot, closest.entity);
    logEvent('fleeing', {
      threat: closest.name,
      threatDistance: Math.floor(closest.distance),
      fleeTarget: target,
    });

    // Clear any existing flee timeout
    if (fleeTimeout) clearTimeout(fleeTimeout);

    // After fleeing for a bit, stop and restore previous goal
    fleeTimeout = setTimeout(() => {
      fleeing = false;
      fleeTimeout = null;
      restoreGoal(bot);
    }, FLEE_DURATION_MS);
  }
}

function escapeWater(bot) {
  if (!bot.entity.isInWater) {
    if (escaping) {
      bot.setControlState('jump', false);
      bot.setControlState('sprint', false);
      escaping = false;
      logEvent('escaped_water', { position: bot.entity.position.floored() });
      // Restore the previous goal after escaping water
      restoreGoal(bot);
    }
    return;
  }

  bot.setControlState('jump', true);
  bot.setControlState('sprint', true);

  if (escaping) return; // already pathfinding to land
  saveCurrentGoal(bot);
  escaping = true;

  const pos = bot.entity.position.floored();
  for (let r = 1; r <= 16; r++) {
    for (const [dx, dz] of [[r,0],[-r,0],[0,r],[0,-r],[r,r],[-r,-r],[r,-r],[-r,r]]) {
      for (let dy = -2; dy <= 4; dy++) {
        try {
          const checkPos = pos.offset(dx, dy, dz);
          const block = bot.blockAt(checkPos);
          const above = bot.blockAt(checkPos.offset(0, 1, 0));
          if (block && block.name !== 'water' && block.name !== 'air' && block.name !== 'lava'
              && above && (above.name === 'air' || above.name === 'cave_air')) {
            bot.pathfinder.setGoal(new GoalBlock(checkPos.x, checkPos.y + 1, checkPos.z));
            logEvent('swimming_to_land', { target: { x: checkPos.x, y: checkPos.y, z: checkPos.z }, distance: r });
            return;
          }
        } catch (e) {}
      }
    }
  }
}

function smartSprint(bot) {
  if (fleeing || escaping) return; // these manage their own sprint

  // Sprint when following a distant player, walk when close
  const action = require('./state').getCurrentAction();
  if (!action || action.type !== 'follow') {
    bot.setControlState('sprint', false);
    return;
  }

  const target = bot.players[action.username];
  if (!target?.entity) return;

  const dist = bot.entity.position.distanceTo(target.entity.position);
  bot.setControlState('sprint', dist > 8 && bot.food > 6);
}

async function survivalTick(bot) {
  escapeWater(bot);
  checkThreats(bot);
  smartSprint(bot);
  if (bot.food < 6) {
    await autoEat(bot);
  }
}

module.exports = { survivalTick, autoEat, escapeWater, checkThreats };
