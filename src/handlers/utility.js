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

// Preflight check: can the bot perform this action?
async function verify(bot, cmd) {
  const action = (cmd.check || '').toLowerCase();
  const result = { action, feasible: false, reason: '', details: {} };

  let mcData;
  try { mcData = require('minecraft-data')(bot.version); } catch (e) {}

  switch (action) {
    case 'craft': {
      const itemName = cmd.item || cmd.recipe || '';
      if (!mcData) { result.reason = 'Game data not loaded'; break; }
      const item = mcData.itemsByName[itemName];
      if (!item) { result.reason = `Unknown item: ${itemName}`; break; }
      const recipes = bot.recipesFor(item.id);
      if (recipes && recipes.length > 0) {
        result.feasible = true;
        result.reason = 'Can craft now';
        result.details.recipesAvailable = recipes.length;
        result.details.requiresTable = recipes[0].requiresTable || false;
      } else {
        // Show what's missing
        const allRecipes = bot.recipesFor(item.id, null, true);
        if (allRecipes && allRecipes.length > 0) {
          const r = allRecipes[0];
          const missing = [];
          if (r.delta) {
            for (const d of r.delta) {
              if (d.count < 0) {
                const ingItem = mcData.items[d.id];
                const ingName = ingItem ? ingItem.name : `id:${d.id}`;
                const { countInventoryItem } = require('../perception');
                const have = countInventoryItem(bot, ingName);
                const need = Math.abs(d.count);
                missing.push({ item: ingName, need, have });
              }
            }
          }
          result.reason = 'Missing materials';
          result.details.missing = missing;
          result.details.requiresTable = r.requiresTable || false;
          const hasTable = bot.findBlock({ matching: b => b.name === 'crafting_table', maxDistance: 32 });
          result.details.tableNearby = !!hasTable;
        } else {
          result.reason = `No recipe exists for ${itemName}`;
        }
      }
      break;
    }
    case 'smelt': {
      const itemName = cmd.item || '';
      const hasItem = bot.inventory.items().find(i => i.name.includes(itemName));
      if (!hasItem) { result.reason = `No ${itemName} in inventory`; break; }
      const hasFurnace = bot.findBlock({ matching: b => ['furnace', 'blast_furnace', 'smoker'].includes(b.name), maxDistance: 32 });
      const hasFuel = bot.inventory.items().find(i =>
        ['coal', 'charcoal', 'coal_block', 'lava_bucket', 'blaze_rod', 'dried_kelp_block'].includes(i.name) ||
        i.name.includes('planks') || i.name.includes('log'));
      result.feasible = !!(hasItem && (hasFurnace || require('../perception').countInventoryItem(bot, 'cobblestone') >= 8) && hasFuel);
      result.reason = result.feasible ? 'Can smelt' : (!hasFuel ? 'No fuel' : !hasFurnace ? 'No furnace (need 8 cobblestone to craft)' : 'Cannot smelt this item');
      result.details = { hasItem: !!hasItem, furnaceNearby: !!hasFurnace, hasFuel: !!hasFuel };
      break;
    }
    case 'goto': {
      const x = cmd.x, y = cmd.y, z = cmd.z;
      if (x === undefined || z === undefined) { result.reason = 'Missing coordinates'; break; }
      const distance = Math.floor(Math.sqrt((x - bot.entity.position.x) ** 2 + (z - bot.entity.position.z) ** 2));
      result.feasible = true;
      result.reason = `${distance} blocks away`;
      result.details = { distance, estimatedTime: `${Math.ceil(distance / 4)}s` };
      break;
    }
    case 'attack': {
      const targetType = (cmd.target || '').toLowerCase();
      const candidates = Object.values(bot.entities)
        .filter(e => e !== bot.entity && e.position && e.type === 'mob')
        .filter(e => !targetType || (e.name || '').toLowerCase().includes(targetType))
        .filter(e => bot.entity.position.distanceTo(e.position) < 32);
      const weapon = bot.inventory.items().find(i => i.name.includes('sword') || i.name.includes('axe'));
      result.feasible = candidates.length > 0;
      result.reason = candidates.length > 0 ? `${candidates.length} targets available` : `No ${targetType || 'mob'} targets nearby`;
      result.details = { targetCount: candidates.length, hasWeapon: !!weapon, weaponName: weapon?.name || 'none' };
      break;
    }
    case 'sleep': {
      const time = bot.time.timeOfDay;
      const isNight = time >= 12541 && time <= 23458;
      const hasBed = bot.findBlock({ matching: b => b.name.includes('bed'), maxDistance: 32 }) ||
        bot.inventory.items().find(i => i.name.includes('bed'));
      result.feasible = isNight && !!hasBed;
      result.reason = !isNight ? `Not night (time: ${time}, night starts at 12541)` : !hasBed ? 'No bed available' : 'Can sleep now';
      result.details = { isNight, timeOfDay: time, bedAvailable: !!hasBed };
      break;
    }
    case 'mine': {
      const resource = (cmd.resource || cmd.target || '').toLowerCase();
      const block = bot.findBlock({ matching: b => b.name.includes(resource), maxDistance: 64 });
      const hasTool = bot.inventory.items().find(i => i.name.includes('pickaxe') || i.name.includes('axe') || i.name.includes('shovel'));
      result.feasible = !!block;
      result.reason = block ? `Found ${block.name} ${Math.floor(bot.entity.position.distanceTo(block.position))} blocks away` : `No ${resource} within 64 blocks`;
      result.details = { blockFound: !!block, hasTool: !!hasTool, toolName: hasTool?.name || 'none' };
      if (block) result.details.position = { x: block.position.x, y: block.position.y, z: block.position.z };
      break;
    }
    default:
      result.reason = `Unknown action to verify: ${action}. Verifiable actions: craft, smelt, goto, attack, sleep, mine`;
  }

  logEvent('command_result', { commandId: cmd.id, success: true, detail: `Verify ${action}: ${result.reason}`, verify: result });
}

// Cancel the current running action
async function cancel(bot, cmd) {
  const { getCurrentAction, clearCurrentAction } = require('../state');
  const action = getCurrentAction();

  if (!action) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No action running to cancel' });
    return;
  }

  // Stop pathfinding
  bot.pathfinder.setGoal(null);

  // Stop combat if active
  try {
    const { stopCombat } = require('./combat');
    stopCombat(bot);
  } catch (e) {}

  // Clear all control states
  ['forward', 'back', 'left', 'right', 'jump', 'sprint', 'sneak'].forEach(ctrl => {
    try { bot.setControlState(ctrl, false); } catch (e) {}
  });

  clearCurrentAction();
  logEvent('command_result', { commandId: cmd.id, success: true, detail: `Cancelled: ${action.type}`, cancelledAction: action });
}

// Inspect a nearby container's contents without taking anything
async function inspectContainer(bot, cmd) {
  const containerTypes = ['chest', 'trapped_chest', 'barrel', 'shulker_box', 'ender_chest', 'hopper', 'dropper', 'dispenser'];
  let containerBlock;

  if (cmd.position) {
    containerBlock = bot.blockAt(new Vec3(cmd.position.x, cmd.position.y, cmd.position.z));
  } else {
    containerBlock = bot.findBlock({
      matching: b => containerTypes.some(t => b.name.includes(t)),
      maxDistance: 32,
    });
  }

  if (!containerBlock || !containerTypes.some(t => containerBlock.name.includes(t))) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No container found nearby' });
    return;
  }

  try {
    await bot.pathfinder.goto(new GoalNear(containerBlock.position.x, containerBlock.position.y, containerBlock.position.z, 2));
    const container = await bot.openContainer(containerBlock);
    const items = container.items().map(i => ({ name: i.name, count: i.count, slot: i.slot }));
    const freeSlots = container.slots.filter(s => s === null).length;
    container.close();

    logEvent('command_result', {
      commandId: cmd.id, success: true,
      detail: `${containerBlock.name} has ${items.length} item types`,
      container: {
        type: containerBlock.name,
        position: { x: containerBlock.position.x, y: containerBlock.position.y, z: containerBlock.position.z },
        items,
        freeSlots,
      },
    });
  } catch (err) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: `Failed to inspect: ${err.message}` });
  }
}

// Save/retrieve notes for LLM memory persistence
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');

function loadNotes() {
  try {
    if (fs.existsSync(NOTES_FILE)) return JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'));
  } catch (e) {}
  return {};
}

function saveNotes(notes) {
  try { fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2)); } catch (e) {}
}

async function setNote(bot, cmd) {
  const key = cmd.key;
  const value = cmd.value;
  if (!key) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'Note key is required' });
    return;
  }

  const notes = loadNotes();
  if (value === null || value === undefined || value === '') {
    delete notes[key];
    saveNotes(notes);
    logEvent('command_result', { commandId: cmd.id, success: true, detail: `Deleted note: ${key}` });
  } else {
    notes[key] = { value, updatedAt: new Date().toISOString() };
    saveNotes(notes);
    logEvent('command_result', { commandId: cmd.id, success: true, detail: `Saved note: ${key}` });
  }
}

async function getNotes(bot, cmd) {
  const notes = loadNotes();
  const key = cmd.key;
  if (key) {
    const note = notes[key];
    if (note) {
      logEvent('command_result', { commandId: cmd.id, success: true, detail: `${key}: ${note.value}`, note: { key, ...note } });
    } else {
      logEvent('command_result', { commandId: cmd.id, success: false, detail: `No note found for key: ${key}` });
    }
  } else {
    const keys = Object.keys(notes);
    logEvent('command_result', { commandId: cmd.id, success: true, detail: `${keys.length} notes stored`, notes });
  }
}

// Enhanced list_recipes that always shows ingredients
async function listRecipesDetailed(bot, cmd) {
  let mcData;
  try {
    mcData = require('minecraft-data')(bot.version);
  } catch (e) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'Failed to load game data' });
    return;
  }

  const itemName = (cmd.item || '').toLowerCase().replace(/ /g, '_');

  if (itemName) {
    const item = mcData.itemsByName[itemName];
    if (!item) {
      logEvent('command_result', { commandId: cmd.id, success: false, detail: `Unknown item: ${itemName}` });
      return;
    }
    // Get ALL recipes regardless of materials (includeUnobtainable)
    let recipes = bot.recipesFor(item.id, null, true);
    if (!recipes || recipes.length === 0) {
      logEvent('command_result', { commandId: cmd.id, success: false, detail: `No recipes for ${itemName}` });
      return;
    }

    const { countInventoryItem } = require('../perception');
    const recipeInfo = recipes.slice(0, 3).map(r => {
      const ingredients = [];
      let canCraft = true;
      if (r.delta) {
        for (const d of r.delta) {
          if (d.count < 0) {
            const ingItem = mcData.items[d.id];
            const ingName = ingItem ? ingItem.name : `id:${d.id}`;
            const have = countInventoryItem(bot, ingName);
            const need = Math.abs(d.count);
            ingredients.push({ item: ingName, need, have, sufficient: have >= need });
            if (have < need) canCraft = false;
          }
        }
      }
      return {
        requiresTable: r.requiresTable || false,
        canCraftNow: canCraft,
        ingredients,
      };
    });

    logEvent('command_result', {
      commandId: cmd.id, success: true,
      detail: `${recipes.length} recipe(s) for ${itemName}`,
      recipes: recipeInfo,
    });
  } else {
    // Show craftable items with their ingredients
    const checkItems = [
      'crafting_table', 'furnace', 'chest', 'stick', 'torch',
      'wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'diamond_pickaxe',
      'wooden_sword', 'stone_sword', 'iron_sword', 'diamond_sword',
      'wooden_axe', 'stone_axe', 'iron_axe',
      'wooden_shovel', 'stone_shovel', 'iron_shovel',
      'oak_planks', 'spruce_planks', 'birch_planks', 'jungle_planks',
      'bread', 'bucket', 'shield', 'bow', 'arrow',
      'iron_helmet', 'iron_chestplate', 'iron_leggings', 'iron_boots',
      'diamond_helmet', 'diamond_chestplate', 'diamond_leggings', 'diamond_boots',
    ];

    const craftable = [];
    const almostCraftable = [];

    for (const name of checkItems) {
      const item = mcData.itemsByName[name];
      if (!item) continue;
      const recipes = bot.recipesFor(item.id);
      if (recipes && recipes.length > 0) {
        craftable.push(name);
      } else {
        // Check if nearly craftable (missing only 1-2 items)
        const allRecipes = bot.recipesFor(item.id, null, true);
        if (allRecipes && allRecipes.length > 0) {
          const r = allRecipes[0];
          let missingTypes = 0;
          if (r.delta) {
            for (const d of r.delta) {
              if (d.count < 0) {
                const ingItem = mcData.items[d.id];
                const ingName = ingItem ? ingItem.name : '';
                const { countInventoryItem } = require('../perception');
                if (countInventoryItem(bot, ingName) < Math.abs(d.count)) missingTypes++;
              }
            }
          }
          if (missingTypes <= 1) almostCraftable.push(name);
        }
      }
    }

    logEvent('command_result', {
      commandId: cmd.id, success: true,
      detail: `Can craft: ${craftable.length} items, almost: ${almostCraftable.length}`,
      craftable,
      almostCraftable,
    });
  }
}

module.exports = { scan, findBlocks, whereAmI, listRecipes: listRecipesDetailed, gotoNearestBlock, verify, cancel, inspectContainer, setNote, getNotes };
