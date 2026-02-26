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

// Tool selection: maps block material to the best tool category
const TOOL_FOR_MATERIAL = {
  rock: 'pickaxe', stone: 'pickaxe', ore: 'pickaxe', metal: 'pickaxe',
  wood: 'axe', plant: 'axe',
  dirt: 'shovel', sand: 'shovel', gravel: 'shovel', clay: 'shovel', snow: 'shovel', soul: 'shovel',
  web: 'sword', wool: 'shears',
};

// Tool tiers in descending quality
const TOOL_TIERS = ['netherite', 'diamond', 'iron', 'stone', 'golden', 'wooden'];

function selectBestTool(bot, block) {
  if (!block) return null;
  const blockName = block.name.toLowerCase();

  // Determine what tool type is needed
  let toolType = null;
  for (const [keyword, tool] of Object.entries(TOOL_FOR_MATERIAL)) {
    if (blockName.includes(keyword)) { toolType = tool; break; }
  }
  // Fallback heuristics
  if (!toolType) {
    if (blockName.includes('log') || blockName.includes('plank') || blockName.includes('wood')) toolType = 'axe';
    else if (blockName.includes('ore') || blockName.includes('stone') || blockName.includes('brick')
      || blockName.includes('obsidian') || blockName.includes('concrete') || blockName.includes('terracotta')) toolType = 'pickaxe';
    else if (blockName.includes('dirt') || blockName.includes('grass') || blockName.includes('sand')
      || blockName.includes('gravel') || blockName.includes('clay') || blockName.includes('soul')
      || blockName.includes('mycelium') || blockName.includes('podzol') || blockName.includes('mud')) toolType = 'shovel';
  }
  if (!toolType) return null;

  // Find the best tier of this tool type in inventory
  for (const tier of TOOL_TIERS) {
    const tool = bot.inventory.items().find(i => i.name === `${tier}_${toolType}`);
    if (tool) return tool;
  }
  return null;
}

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
    // Auto-select best tool for the block
    const bestTool = selectBestTool(bot, block);
    if (bestTool) await bot.equip(bestTool, 'hand');

    setCurrentAction({ type: 'dig', blockType: block.name });
    const blockPos = block.position.clone();
    await bot.dig(block);
    // Walk over the drop to auto-collect it
    try {
      await bot.pathfinder.goto(new GoalNear(blockPos.x, blockPos.y, blockPos.z, 0));
    } catch (e) {} // Best effort - don't fail if we can't reach the exact spot
    await new Promise(r => setTimeout(r, 300)); // Brief pause to pick up item
    logEvent('command_result', { commandId: cmd.id, success: true, detail: `Broke ${block.name}${bestTool ? ' with ' + bestTool.name : ''}` });
    clearCurrentAction();
  } catch (err) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
    clearCurrentAction();
  }
}

async function mineResource(bot, cmd) {
  const resourceType = cmd.resource || cmd.target;
  const count = cmd.count || 16;

  const resLower = resourceType.toLowerCase();
  const blockNames = Object.keys(ORE_PRIORITY).filter(n => n.includes(resLower));
  if (resLower === 'stone') blockNames.push('stone', 'cobblestone', 'deepslate');
  if (resLower === 'wood' || resLower === 'log') {
    blockNames.push('oak_log', 'spruce_log', 'birch_log', 'jungle_log', 'acacia_log', 'dark_oak_log',
      'mangrove_log', 'cherry_log', 'crimson_stem', 'warped_stem');
  }
  if (resLower === 'sand') blockNames.push('sand', 'red_sand');
  if (resLower === 'gravel') blockNames.push('gravel');
  if (resLower === 'clay') blockNames.push('clay');

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

  // Auto-select best pickaxe (or appropriate tool)
  const bestTool = selectBestTool(bot, targetBlock) ||
    bot.inventory.items().find(i => i.name.includes('pickaxe'));
  if (bestTool) await bot.equip(bestTool, 'hand');

  let mined = 0;
  const miningStart = Date.now();
  let stopReason = 'completed';
  while (mined < count) {
    const block = bot.findBlock({
      matching: b => blockNames.includes(b.name) || b.name === resourceType,
      maxDistance: 64,
    });
    if (!block) { stopReason = 'no_more_blocks'; break; }

    // Update currentAction with progress
    setCurrentAction({ type: 'mining', resource: resourceType, count, mined, progress: `${mined}/${count}` });

    try {
      await bot.pathfinder.goto(new GoalNear(block.position.x, block.position.y, block.position.z, 3));
      const blockBelow = bot.blockAt(block.position.offset(0, -1, 0));
      if (blockBelow && (blockBelow.name === 'lava' || blockBelow.name === 'air')) continue;

      // Check tool durability before mining
      const heldItem = bot.heldItem;
      if (heldItem && heldItem.durabilityUsed !== undefined && heldItem.maxDurability) {
        if (heldItem.maxDurability - heldItem.durabilityUsed <= 2) {
          logEvent('tool_low_durability', { tool: heldItem.name, remaining: heldItem.maxDurability - heldItem.durabilityUsed });
          // Try to equip a fresh tool
          const freshTool = selectBestTool(bot, block);
          if (freshTool && freshTool !== heldItem) {
            await bot.equip(freshTool, 'hand');
          } else {
            stopReason = 'tool_broken'; break;
          }
        }
      }

      const blockPos = block.position.clone();
      await bot.dig(block);
      mined++;
      // Walk over the drop to auto-collect it
      try {
        await bot.pathfinder.goto(new GoalNear(blockPos.x, blockPos.y, blockPos.z, 0));
      } catch (e) {}
      await new Promise(r => setTimeout(r, 200));
      logEvent('block_mined', { block: block.name, mined, target: count, elapsed: Math.floor((Date.now() - miningStart) / 1000) });

      if (mined % 8 === 0) {
        const torch = bot.inventory.items().find(i => i.name === 'torch');
        if (torch && bot.blockAt(bot.entity.position)?.light < 7) {
          try {
            await bot.equip(torch, 'hand');
            const floor = bot.blockAt(bot.entity.position.offset(0, -1, 0));
            if (floor && floor.name !== 'air') await bot.placeBlock(floor, new Vec3(0, 1, 0));
          } catch (e) {}
          if (bestTool) await bot.equip(bestTool, 'hand');
        }
      }

      // Check inventory space
      if (bot.inventory.items().length >= 35) {
        stopReason = 'inventory_full'; break;
      }

      await new Promise(r => setTimeout(r, 500));
    } catch (err) { stopReason = `error: ${err.message}`; break; }
  }

  const elapsed = Math.floor((Date.now() - miningStart) / 1000);
  logEvent('mining_complete', { resource: resourceType, mined, target: count, elapsed, stopReason });
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

  // Equip best weapon
  const weapons = ['netherite_sword', 'diamond_sword', 'iron_sword', 'stone_sword', 'golden_sword', 'wooden_sword'];
  const weapon = bot.inventory.items().find(i => weapons.includes(i.name));
  if (weapon) await bot.equip(weapon, 'hand').catch(() => {});

  if (huntInterval) clearInterval(huntInterval);
  const huntStart = Date.now();
  const MAX_HUNT_MS = 30000; // 30 second timeout

  huntInterval = setInterval(async () => {
    const t = bot.entities[target.id];
    const elapsed = Date.now() - huntStart;

    // Target gone or timeout
    if (!t || !t.position || elapsed > MAX_HUNT_MS) {
      clearInterval(huntInterval); huntInterval = null;
      clearCurrentAction();
      logEvent('hunt_ended', {
        target: target.name,
        reason: !t ? 'target_killed' : 'timeout',
        elapsed: Math.floor(elapsed / 1000),
      });
      // Briefly pause then try to collect nearby dropped items
      await new Promise(r => setTimeout(r, 500));
      const drops = Object.values(bot.entities)
        .filter(e => e.type === 'object' && e.objectType === 'Item')
        .filter(e => e.position && bot.entity.position.distanceTo(e.position) < 8);
      for (const drop of drops) {
        try {
          await bot.pathfinder.goto(new GoalNear(drop.position.x, drop.position.y, drop.position.z, 1));
        } catch (e) {}
      }
      return;
    }

    const distance = bot.entity.position.distanceTo(t.position);
    if (distance > 3) bot.pathfinder.setGoal(new GoalFollow(t, 2), true);
    if (distance < 4) {
      bot.attack(t);
    }
  }, 300);
}

async function collectItems(bot, cmd) {
  const radius = cmd.radius || 16;
  const items = Object.values(bot.entities)
    .filter(e => e.type === 'object' && e.objectType === 'Item')
    .filter(e => e.position && bot.entity.position.distanceTo(e.position) < radius)
    .sort((a, b) => bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position));

  if (items.length === 0) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No items on the ground nearby' });
    return;
  }

  setCurrentAction({ type: 'collecting', count: items.length });
  let collected = 0;

  // Snapshot inventory before collecting
  const inventoryBefore = {};
  bot.inventory.items().forEach(i => { inventoryBefore[i.name] = (inventoryBefore[i.name] || 0) + i.count; });

  for (const item of items) {
    if (!item.position || !bot.entities[item.id]) continue;
    try {
      await bot.pathfinder.goto(new GoalNear(item.position.x, item.position.y, item.position.z, 1));
      collected++;
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      // Item may have despawned or become unreachable
    }
  }

  // Calculate what was actually picked up
  const inventoryAfter = {};
  bot.inventory.items().forEach(i => { inventoryAfter[i.name] = (inventoryAfter[i.name] || 0) + i.count; });
  const gained = {};
  for (const [name, count] of Object.entries(inventoryAfter)) {
    const diff = count - (inventoryBefore[name] || 0);
    if (diff > 0) gained[name] = diff;
  }

  clearCurrentAction();
  logEvent('command_result', {
    commandId: cmd.id, success: collected > 0,
    detail: `Collected ${collected}/${items.length} items`,
    itemsGained: gained,
  });
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
