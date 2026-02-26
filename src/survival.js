const { GoalBlock, GoalFollow } = require('mineflayer-pathfinder').goals;
const { logEvent } = require('./events');
const { FOOD_ITEMS, HOSTILE_MOBS } = require('./perception');

let escaping = false;
let fleeing = false;
let fleeStartTime = 0;
let savedGoal = null;
let lastPos = null;
let stuckTicks = 0;
const STUCK_THRESHOLD = 5; // 5 ticks * 1s = 5s without moving

// Distances at which the bot reacts to threats
const CREEPER_FLEE_DIST = 16; // creepers explode at ~3 blocks, give very wide berth
const HOSTILE_FLEE_DIST = 12; // melee mobs - need margin for tick interval
const FLEE_SAFE_MARGIN = 8;   // must be this far beyond flee dist before stopping
const MAX_FLEE_MS = 12000;    // max flee time to prevent infinite running

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
  // Rebuild goal from currentAction rather than using saved goal (entity refs go stale)
  const action = require('./state').getCurrentAction();
  if (action && action.type === 'follow') {
    const p = bot.players[action.username];
    if (p?.entity) {
      bot.pathfinder.setGoal(new GoalFollow(p.entity, action.distance || 2), true);
      savedGoal = null;
      return;
    }
  }
  // Fallback to saved goal for non-follow actions
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

function getNearestHostile(bot) {
  return Object.values(bot.entities)
    .filter(e => {
      if (e === bot.entity || !e.position) return false;
      const name = (e.name || e.displayName || '').toLowerCase();
      if (!HOSTILE_MOBS.includes(name)) return false;
      if (Math.abs(e.position.y - bot.entity.position.y) > 10) return false;
      return true;
    })
    .map(e => ({
      entity: e,
      name: (e.name || e.displayName).toLowerCase(),
      distance: bot.entity.position.distanceTo(e.position),
    }))
    .sort((a, b) => a.distance - b.distance)[0] || null;
}

function checkThreats(bot) {
  if (escaping) return;

  const closest = getNearestHostile(bot);

  // While fleeing, check if we're safe enough to stop
  if (fleeing) {
    const elapsed = Date.now() - fleeStartTime;
    const fleeDist = closest?.name === 'creeper' ? CREEPER_FLEE_DIST : HOSTILE_FLEE_DIST;
    const safeDist = fleeDist + FLEE_SAFE_MARGIN;

    if (!closest || closest.distance > safeDist || elapsed > MAX_FLEE_MS) {
      fleeing = false;
      logEvent('flee_ended', {
        reason: !closest ? 'threat_gone' : elapsed > MAX_FLEE_MS ? 'max_time' : 'safe_distance',
        elapsed: Math.floor(elapsed / 1000),
      });
      restoreGoal(bot);
    } else {
      // Still too close - update flee direction toward the current threat
      fleeFrom(bot, closest.entity);
    }
    return;
  }

  if (!closest) return;

  const fleeDist = closest.name === 'creeper' ? CREEPER_FLEE_DIST : HOSTILE_FLEE_DIST;

  if (closest.distance < fleeDist) {
    saveCurrentGoal(bot);
    fleeing = true;
    fleeStartTime = Date.now();

    const target = fleeFrom(bot, closest.entity);
    logEvent('fleeing', {
      threat: closest.name,
      threatDistance: Math.floor(closest.distance),
      fleeTarget: target,
    });
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

let stuckRetries = 0;
const MAX_STUCK_RETRIES = 3;

function checkStuck(bot) {
  const action = require('./state').getCurrentAction();
  if (!action) {
    stuckTicks = 0;
    stuckRetries = 0;
    lastPos = null;
    return;
  }

  const pos = bot.entity.position;
  if (lastPos && pos.distanceTo(lastPos) < 0.5) {
    stuckTicks++;
    if (stuckTicks >= STUCK_THRESHOLD) {
      logEvent('stuck', { position: pos.floored(), action, ticks: stuckTicks, retries: stuckRetries });

      // For follow actions, retry with fresh goal before giving up
      if (action.type === 'follow' && stuckRetries < MAX_STUCK_RETRIES) {
        stuckRetries++;
        const p = bot.players[action.username];
        if (p?.entity) {
          bot.pathfinder.setGoal(new GoalFollow(p.entity, action.distance || 2), true);
          logEvent('follow_retry', { username: action.username, retry: stuckRetries });
          stuckTicks = 0;
          // Keep lastPos so next tick correctly detects still-stuck
          return;
        }
      }

      // Give up - clear action and try a random wander to get unstuck
      bot.pathfinder.setGoal(null);
      require('./state').clearCurrentAction();
      stuckTicks = 0;
      stuckRetries = 0;
      lastPos = null;

      // Wander in a random direction to escape the stuck area
      const angle = Math.random() * Math.PI * 2;
      const wanderDist = 10 + Math.random() * 15;
      const wx = Math.floor(pos.x + Math.cos(angle) * wanderDist);
      const wz = Math.floor(pos.z + Math.sin(angle) * wanderDist);
      bot.pathfinder.setGoal(new GoalBlock(wx, Math.floor(pos.y), wz), false);
      logEvent('wander', { reason: 'stuck_giveup', target: { x: wx, z: wz } });
    }
  } else {
    stuckTicks = 0;
    if (lastPos) stuckRetries = 0; // only reset retries on actual movement
  }
  lastPos = pos.clone();
}

async function survivalTick(bot) {
  escapeWater(bot);
  checkThreats(bot);
  checkStuck(bot);
  smartSprint(bot);
  if (bot.food < 6) {
    await autoEat(bot);
  }
}

module.exports = { survivalTick, autoEat, escapeWater, checkThreats };
