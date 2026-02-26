const Vec3 = require('vec3');
const { goals } = require('mineflayer-pathfinder');
const { GoalNear, GoalFollow } = goals;
const { logEvent } = require('../events');
const { setCurrentAction, clearCurrentAction } = require('../state');

const ORE_PRIORITY = {
  'diamond_ore': 1, 'deepslate_diamond_ore': 1,
  'ancient_debris': 2,
  'emerald_ore': 3, 'deepslate_emerald_ore': 3,
  'gold_ore': 4, 'deepslate_gold_ore': 4,
  'iron_ore': 5, 'deepslate_iron_ore': 5,
  'copper_ore': 6, 'deepslate_copper_ore': 6,
  'coal_ore': 7, 'deepslate_coal_ore': 7,
  'redstone_ore': 8, 'deepslate_redstone_ore': 8,
  'lapis_ore': 9, 'deepslate_lapis_ore': 9,
};

const FOOD_ANIMALS = ['cow', 'pig', 'chicken', 'sheep', 'rabbit'];

let huntInterval = null;

async function dig(bot, cmd) {
  let block;
  if (cmd.position) {
    block = bot.blockAt(new Vec3(cmd.position.x, cmd.position.y, cmd.position.z));
  } else if (cmd.direction) {
    const offsets = { front: [0,0,1], back: [0,0,-1], left: [-1,0,0], right: [1,0,0], above: [0,1,0], below: [0,-1,0] };
    const offset = offsets[cmd.direction] || [0,0,1];
    const yaw = bot.entity.yaw;
    const rx = Math.round(offset[0] * Math.cos(yaw) - offset[2] * Math.sin(yaw));
    const rz = Math.round(offset[0] * Math.sin(yaw) + offset[2] * Math.cos(yaw));
    block = bot.blockAt(bot.entity.position.floored().offset(rx, offset[1], rz));
  } else {
    block = bot.blockAt(bot.entity.position.floored().offset(0, 0, 1));
  }

  if (!block || block.name === 'air') {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No block to dig' });
    return;
  }

  try {
    setCurrentAction({ type: 'dig', blockType: block.name });
    await bot.dig(block);
    logEvent('command_result', { commandId: cmd.id, success: true, detail: `Broke ${block.name}` });
    clearCurrentAction();
  } catch (err) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
    clearCurrentAction();
  }
}

async function mineResource(bot, cmd) {
  const resourceType = cmd.resource || cmd.target;
  const count = cmd.count || 16;

  const blockNames = Object.keys(ORE_PRIORITY).filter(n => n.includes(resourceType.toLowerCase()));
  if (resourceType === 'stone') blockNames.push('stone', 'cobblestone', 'deepslate');

  const targetBlock = bot.findBlock({
    matching: b => blockNames.includes(b.name) || b.name === resourceType,
    maxDistance: 64,
  });

  if (!targetBlock) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: `Cannot find ${resourceType} nearby` });
    return;
  }

  setCurrentAction({ type: 'mining', resource: resourceType, count });
  logEvent('command_result', { commandId: cmd.id, success: true, detail: `Mining ${resourceType}` });

  const pickaxes = ['netherite_pickaxe', 'diamond_pickaxe', 'iron_pickaxe', 'stone_pickaxe', 'wooden_pickaxe'];
  const pickaxe = bot.inventory.items().find(i => pickaxes.includes(i.name));
  if (pickaxe) await bot.equip(pickaxe, 'hand');

  let mined = 0;
  while (mined < count) {
    const block = bot.findBlock({
      matching: b => blockNames.includes(b.name) || b.name === resourceType,
      maxDistance: 64,
    });
    if (!block) break;

    try {
      await bot.pathfinder.goto(new GoalNear(block.position.x, block.position.y, block.position.z, 3));
      const blockBelow = bot.blockAt(block.position.offset(0, -1, 0));
      if (blockBelow && (blockBelow.name === 'lava' || blockBelow.name === 'air')) continue;
      await bot.dig(block);
      mined++;
      logEvent('block_mined', { block: block.name, mined, target: count });

      if (mined % 8 === 0) {
        const torch = bot.inventory.items().find(i => i.name === 'torch');
        if (torch && bot.blockAt(bot.entity.position)?.light < 7) {
          try {
            await bot.equip(torch, 'hand');
            const floor = bot.blockAt(bot.entity.position.offset(0, -1, 0));
            if (floor && floor.name !== 'air') await bot.placeBlock(floor, new Vec3(0, 1, 0));
          } catch (e) {}
          if (pickaxe) await bot.equip(pickaxe, 'hand');
        }
      }
      await new Promise(r => setTimeout(r, 500));
    } catch (err) { break; }
  }

  logEvent('mining_complete', { resource: resourceType, mined });
  clearCurrentAction();
}

async function findFood(bot, cmd) {
  const animals = Object.values(bot.entities)
    .filter(e => e.type === 'mob' && FOOD_ANIMALS.includes(e.name?.toLowerCase()))
    .filter(e => e.position && bot.entity.position.distanceTo(e.position) < 64)
    .sort((a, b) => bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position));

  if (animals.length === 0) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No food animals nearby' });
    return;
  }

  const target = animals[0];
  setCurrentAction({ type: 'hunting', target: target.name });
  logEvent('command_result', { commandId: cmd.id, success: true, detail: `Hunting ${target.name}` });

  if (huntInterval) clearInterval(huntInterval);
  huntInterval = setInterval(async () => {
    const t = bot.entities[target.id];
    if (!t || !t.position) {
      clearInterval(huntInterval); huntInterval = null; clearCurrentAction();
      return;
    }
    const distance = bot.entity.position.distanceTo(t.position);
    if (distance > 3) bot.pathfinder.setGoal(new GoalFollow(t, 2), true);
    if (distance < 4) {
      const weapons = ['diamond_sword', 'iron_sword', 'stone_sword', 'wooden_sword'];
      const weapon = bot.inventory.items().find(i => weapons.includes(i.name));
      if (weapon) await bot.equip(weapon, 'hand').catch(() => {});
      bot.attack(t);
    }
  }, 300);
}

async function collectItems(bot, cmd) {
  const items = Object.values(bot.entities)
    .filter(e => e.type === 'object' && e.objectType === 'Item')
    .filter(e => e.position && bot.entity.position.distanceTo(e.position) < 10);

  for (const item of items) {
    if (item.position) {
      bot.pathfinder.setGoal(new GoalNear(item.position.x, item.position.y, item.position.z, 0), false);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  logEvent('command_result', { commandId: cmd.id, success: true, detail: `Collecting ${items.length} items` });
}

async function drop(bot, cmd) {
  const itemType = cmd.item;
  const count = cmd.count || 1;
  const item = bot.inventory.items().find(i => i.name.includes(itemType) || itemType.includes(i.name));

  if (!item) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: `Don't have ${itemType}` });
    return;
  }

  try {
    if (count >= item.count) await bot.tossStack(item);
    else await bot.toss(item.type, item.metadata, count);
    logEvent('command_result', { commandId: cmd.id, success: true, detail: `Dropped ${count}x ${item.name}` });
  } catch (err) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
  }
}

async function give(bot, cmd) {
  const target = cmd.target;
  const itemType = cmd.item;
  const count = cmd.count || 1;

  const player = Object.values(bot.players).find(p => p.username.toLowerCase() === target.toLowerCase());
  if (!player || !player.entity) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: `Can't find ${target}` });
    return;
  }

  try {
    await bot.pathfinder.goto(new GoalNear(player.entity.position.x, player.entity.position.y, player.entity.position.z, 2));
    const item = bot.inventory.items().find(i => i.name.includes(itemType) || itemType.includes(i.name));
    if (!item) {
      logEvent('command_result', { commandId: cmd.id, success: false, detail: `Don't have ${itemType}` });
      return;
    }
    if (count >= item.count) await bot.tossStack(item);
    else await bot.toss(item.type, item.metadata, count);
    logEvent('command_result', { commandId: cmd.id, success: true, detail: `Gave ${count}x ${item.name} to ${target}` });
  } catch (err) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
  }
}

module.exports = { dig, mineResource, findFood, collectItems, drop, give };
