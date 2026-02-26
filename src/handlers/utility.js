const Vec3 = require('vec3');
const { goals } = require('mineflayer-pathfinder');
const { GoalNear } = goals;
const { logEvent } = require('../events');
const { setCurrentAction, clearCurrentAction } = require('../state');
const { NOTABLE_BLOCKS, HOSTILE_MOBS, FOOD_ITEMS } = require('../perception');

async function scan(bot, cmd) {
  const radius = cmd.radius || 32;
  const pos = bot.entity.position.floored();

  // Scan blocks
  const blockCounts = {};
  const notableFound = [];
  const scanRadius = Math.min(radius, 32);

  for (let dx = -scanRadius; dx <= scanRadius; dx++) {
    for (let dy = -16; dy <= 16; dy++) {
      for (let dz = -scanRadius; dz <= scanRadius; dz++) {
        try {
          const block = bot.blockAt(pos.offset(dx, dy, dz));
          if (!block || block.name === 'air' || block.name === 'cave_air') continue;
          blockCounts[block.name] = (blockCounts[block.name] || 0) + 1;
          if (NOTABLE_BLOCKS.some(n => block.name.includes(n))) {
            notableFound.push({
              name: block.name,
              position: { x: pos.x + dx, y: pos.y + dy, z: pos.z + dz },
            });
          }
        } catch (e) {}
      }
    }
  }

  // Scan entities
  const entities = Object.values(bot.entities)
    .filter(e => e !== bot.entity && e.position && bot.entity.position.distanceTo(e.position) < radius)
    .map(e => ({
      name: e.name || e.displayName || 'unknown',
      type: HOSTILE_MOBS.includes((e.name || '').toLowerCase()) ? 'hostile' : (e.type || 'other'),
      distance: Math.floor(bot.entity.position.distanceTo(e.position)),
      position: { x: Math.floor(e.position.x), y: Math.floor(e.position.y), z: Math.floor(e.position.z) },
    }))
    .sort((a, b) => a.distance - b.distance);

  // Food assessment
  const foodItems = bot.inventory.items().filter(i => FOOD_ITEMS.includes(i.name));
  const totalFood = foodItems.reduce((sum, i) => sum + i.count, 0);

  // Top 15 most common blocks
  const topBlocks = Object.entries(blockCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .reduce((obj, [k, v]) => { obj[k] = v; return obj; }, {});

  const scanResult = {
    position: { x: pos.x, y: pos.y, z: pos.z },
    radius: scanRadius,
    topBlocks,
    notableBlocks: notableFound.slice(0, 20),
    entities: entities.slice(0, 30),
    foodSupply: { items: foodItems.map(i => ({ name: i.name, count: i.count })), total: totalFood },
    hostileCount: entities.filter(e => e.type === 'hostile').length,
    playerCount: entities.filter(e => e.type === 'player').length,
  };

  logEvent('command_result', { commandId: cmd.id, success: true, detail: `Scanned ${scanRadius} block radius`, scan: scanResult });
}

async function findBlocks(bot, cmd) {
  const blockType = (cmd.blockType || cmd.block || '').toLowerCase().replace(/ /g, '_');
  const maxDistance = cmd.maxDistance || 64;
  const count = cmd.count || 10;

  if (!blockType) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No block type specified' });
    return;
  }

  const blocks = bot.findBlocks({
    matching: b => b.name.includes(blockType),
    maxDistance,
    count,
  });

  if (blocks.length === 0) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: `No ${blockType} found within ${maxDistance} blocks` });
    return;
  }

  const results = blocks.map(pos => {
    const block = bot.blockAt(pos);
    return {
      name: block ? block.name : blockType,
      position: { x: pos.x, y: pos.y, z: pos.z },
      distance: Math.floor(bot.entity.position.distanceTo(pos)),
    };
  }).sort((a, b) => a.distance - b.distance);

  logEvent('command_result', { commandId: cmd.id, success: true, detail: `Found ${results.length} ${blockType}`, blocks: results });
}

async function whereAmI(bot, cmd) {
  const pos = bot.entity.position;
  let biome = 'unknown';
  try {
    const block = bot.blockAt(pos.floored());
    const b = block?.biome;
    biome = typeof b === 'string' ? b : (b?.name || b?.displayName || 'unknown');
  } catch (e) {}

  let dimension = 'overworld';
  try {
    const dim = bot.game.dimension;
    if (dim.includes('nether')) dimension = 'nether';
    else if (dim.includes('end')) dimension = 'the_end';
  } catch (e) {}

  const status = {
    position: { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) },
    dimension,
    biome,
    health: bot.health,
    food: bot.food,
    gameMode: bot.game.gameMode,
    time: bot.time.timeOfDay,
    weather: bot.isRaining ? (bot.thunderState ? 'thunder' : 'rain') : 'clear',
    inventorySlots: `${bot.inventory.items().length}/36`,
  };

  logEvent('command_result', { commandId: cmd.id, success: true, detail: `At ${status.position.x}, ${status.position.y}, ${status.position.z} in ${dimension}`, status });
}

async function listRecipes(bot, cmd) {
  let mcData;
  try {
    mcData = require('minecraft-data')(bot.version);
  } catch (e) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'Failed to load game data' });
    return;
  }

  const itemName = (cmd.item || '').toLowerCase().replace(/ /g, '_');

  if (itemName) {
    // Show recipes for a specific item
    const item = mcData.itemsByName[itemName];
    if (!item) {
      logEvent('command_result', { commandId: cmd.id, success: false, detail: `Unknown item: ${itemName}` });
      return;
    }
    const recipes = bot.recipesFor(item.id);
    if (!recipes || recipes.length === 0) {
      logEvent('command_result', { commandId: cmd.id, success: false, detail: `No recipes for ${itemName} (or missing materials)` });
      return;
    }
    const recipeInfo = recipes.map(r => ({
      requiresTable: r.requiresTable || false,
      ingredients: r.delta ? r.delta.filter(d => d.count < 0).map(d => {
        const ingItem = mcData.items[d.id];
        return { name: ingItem ? ingItem.name : `id:${d.id}`, count: Math.abs(d.count) };
      }) : [],
    }));
    logEvent('command_result', { commandId: cmd.id, success: true, detail: `Found ${recipes.length} recipe(s) for ${itemName}`, recipes: recipeInfo });
  } else {
    // Show what can be crafted from current inventory
    const craftable = [];
    const items = bot.inventory.items();
    const seen = new Set();

    for (const invItem of items) {
      const recipes = bot.recipesFor(invItem.type);
      if (recipes && recipes.length > 0 && !seen.has(invItem.name)) {
        seen.add(invItem.name);
      }
    }

    // Check common useful items
    const checkItems = [
      'crafting_table', 'furnace', 'chest', 'stick', 'torch',
      'wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe',
      'wooden_sword', 'stone_sword', 'iron_sword',
      'wooden_axe', 'stone_axe', 'iron_axe',
      'wooden_shovel', 'stone_shovel', 'iron_shovel',
      'planks', 'oak_planks', 'spruce_planks', 'birch_planks',
      'bread', 'bucket', 'shield', 'bow', 'arrow',
    ];

    for (const name of checkItems) {
      const item = mcData.itemsByName[name];
      if (!item) continue;
      const recipes = bot.recipesFor(item.id);
      if (recipes && recipes.length > 0) {
        craftable.push(name);
      }
    }

    logEvent('command_result', { commandId: cmd.id, success: true, detail: `Can craft: ${craftable.join(', ') || 'nothing'}`, craftable });
  }
}

async function gotoNearestBlock(bot, cmd) {
  const blockType = (cmd.blockType || cmd.block || '').toLowerCase().replace(/ /g, '_');
  const maxDistance = cmd.maxDistance || 64;

  if (!blockType) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No block type specified' });
    return;
  }

  const block = bot.findBlock({
    matching: b => b.name.includes(blockType),
    maxDistance,
  });

  if (!block) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: `No ${blockType} found within ${maxDistance} blocks` });
    return;
  }

  setCurrentAction({ type: 'goto_block', blockType: block.name, target: { x: block.position.x, y: block.position.y, z: block.position.z } });
  try {
    await bot.pathfinder.goto(new GoalNear(block.position.x, block.position.y, block.position.z, 2));
    logEvent('command_result', { commandId: cmd.id, success: true, detail: `Reached ${block.name} at ${block.position.x}, ${block.position.y}, ${block.position.z}` });
  } catch (err) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: `Failed to reach ${block.name}: ${err.message}` });
  }
  clearCurrentAction();
}

module.exports = { scan, findBlocks, whereAmI, listRecipes, gotoNearestBlock };
