const { GoalBlock } = require('mineflayer-pathfinder').goals;
const { logEvent } = require('./events');
const { FOOD_ITEMS } = require('./perception');

let escaping = false;

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

function escapeWater(bot) {
  if (!bot.entity.isInWater) {
    if (escaping) {
      bot.setControlState('jump', false);
      bot.setControlState('sprint', false);
      escaping = false;
      logEvent('escaped_water', { position: bot.entity.position.floored() });
    }
    return;
  }

  bot.setControlState('jump', true);
  bot.setControlState('sprint', true);

  if (escaping) return; // already pathfinding to land
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

async function survivalTick(bot) {
  escapeWater(bot);
  if (bot.food < 6) {
    await autoEat(bot);
  }
}

module.exports = { survivalTick, autoEat, escapeWater };
