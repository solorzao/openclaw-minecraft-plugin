const Vec3 = require('vec3');
const { goals } = require('mineflayer-pathfinder');
const { GoalNear } = goals;
const { logEvent } = require('../events');
const { setCurrentAction, clearCurrentAction } = require('../state');
const { countInventoryItem } = require('../perception');

const RAW_TO_COOKED = {
  'beef': 'cooked_beef', 'porkchop': 'cooked_porkchop', 'chicken': 'cooked_chicken',
  'mutton': 'cooked_mutton', 'rabbit': 'cooked_rabbit', 'cod': 'cooked_cod',
  'salmon': 'cooked_salmon', 'potato': 'baked_potato',
};

const SMELTABLE_ITEMS = {
  'iron_ore': 'iron_ingot', 'deepslate_iron_ore': 'iron_ingot', 'raw_iron': 'iron_ingot',
  'gold_ore': 'gold_ingot', 'deepslate_gold_ore': 'gold_ingot', 'raw_gold': 'gold_ingot',
  'copper_ore': 'copper_ingot', 'deepslate_copper_ore': 'copper_ingot', 'raw_copper': 'copper_ingot',
  'ancient_debris': 'netherite_scrap',
  'cobblestone': 'stone', 'stone': 'smooth_stone', 'sand': 'glass',
  'clay_ball': 'brick', 'netherrack': 'nether_brick', 'wet_sponge': 'sponge', 'cactus': 'green_dye',
};

const FUEL_PRIORITY = [
  'lava_bucket', 'coal_block', 'coal', 'charcoal', 'blaze_rod', 'dried_kelp_block',
];

// mcData is loaded lazily after bot spawns so we can detect the game version
let mcData = null;
function ensureMcData(bot) {
  if (!mcData) mcData = require('minecraft-data')(bot.version);
}

async function craft(bot, cmd) {
  ensureMcData(bot);
  const itemName = cmd.recipe || cmd.item;
  const count = cmd.count || 1;

  const item = mcData.itemsByName[itemName];
  if (!item) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: `Unknown item: ${itemName}` });
    return;
  }

  const recipes = bot.recipesFor(item.id);
  if (!recipes || recipes.length === 0) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: `No recipe or missing materials for ${itemName}` });
    return;
  }

  const recipe = recipes[0];
  if (recipe.requiresTable) {
    let table = bot.findBlock({ matching: b => b.name === 'crafting_table', maxDistance: 32 });
    if (!table) {
      // Try to craft and place a crafting table
      const planks = bot.inventory.items().find(i => i.name.includes('planks'));
      if (planks && planks.count >= 4) {
        const tableItem = mcData.itemsByName['crafting_table'];
        const tableRecipes = bot.recipesFor(tableItem.id);
        if (tableRecipes && tableRecipes.length > 0) {
          await bot.craft(tableRecipes[0], 1, null);
          const ct = bot.inventory.items().find(i => i.name === 'crafting_table');
          if (ct) {
            await bot.equip(ct, 'hand');
            const below = bot.blockAt(bot.entity.position.offset(1, -1, 0));
            if (below && below.name !== 'air') {
              await bot.placeBlock(below, new Vec3(0, 1, 0));
              table = bot.blockAt(bot.entity.position.offset(1, 0, 0));
            }
          }
        }
      }
    }
    if (!table) {
      logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No crafting table available' });
      return;
    }
    await bot.pathfinder.goto(new GoalNear(table.position.x, table.position.y, table.position.z, 2));
    try {
      await bot.craft(recipe, count, table);
      logEvent('command_result', { commandId: cmd.id, success: true, detail: `Crafted ${count} ${itemName}` });
    } catch (err) {
      logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
    }
  } else {
    try {
      await bot.craft(recipe, count, null);
      logEvent('command_result', { commandId: cmd.id, success: true, detail: `Crafted ${count} ${itemName}` });
    } catch (err) {
      logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
    }
  }
}

async function smelt(bot, cmd) {
  const itemName = (cmd.item || '').replace(/ /g, '_').toLowerCase();
  const itemToSmelt = bot.inventory.items().find(i =>
    i.name === itemName || i.name.includes(itemName) || itemName.includes(i.name));

  if (!itemToSmelt) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: `No ${itemName} to smelt` });
    return;
  }

  const outputName = SMELTABLE_ITEMS[itemToSmelt.name];
  if (!outputName) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: `${itemToSmelt.name} cannot be smelted` });
    return;
  }

  const smeltCount = cmd.count || itemToSmelt.count;

  let furnace = bot.findBlock({
    matching: b => b.name === 'furnace' || b.name === 'blast_furnace' || b.name === 'smoker',
    maxDistance: 32,
  });

  if (!furnace) {
    if (countInventoryItem(bot, 'cobblestone') >= 8) {
      await craft(bot, { id: cmd.id + '_furnace', recipe: 'furnace', count: 1 });
      const fi = bot.inventory.items().find(i => i.name === 'furnace');
      if (fi) {
        await bot.equip(fi, 'hand');
        const below = bot.blockAt(bot.entity.position.offset(1, -1, 0));
        if (below && below.name !== 'air') {
          try {
            await bot.placeBlock(below, new Vec3(0, 1, 0));
            furnace = bot.blockAt(bot.entity.position.offset(1, 0, 0));
          } catch (e) {}
        }
      }
    }
    if (!furnace) {
      logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No furnace available' });
      return;
    }
  }

  let fuelItem = null;
  for (const fname of FUEL_PRIORITY) {
    fuelItem = bot.inventory.items().find(i => i.name === fname);
    if (fuelItem) break;
  }
  // Also check for planks/logs as fuel
  if (!fuelItem) {
    fuelItem = bot.inventory.items().find(i => i.name.includes('planks') || i.name.includes('log'));
  }
  if (!fuelItem) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No fuel available' });
    return;
  }

  try {
    await bot.pathfinder.goto(new GoalNear(furnace.position.x, furnace.position.y, furnace.position.z, 2));
    const fb = await bot.openFurnace(furnace);
    const fuelCount = Math.min(Math.ceil(smeltCount / 8), fuelItem.count);
    await fb.putFuel(fuelItem.type, null, fuelCount);
    const actualCount = Math.min(smeltCount, itemToSmelt.count);
    await fb.putInput(itemToSmelt.type, null, actualCount);

    setCurrentAction({ type: 'smelting', item: itemToSmelt.name, count: actualCount });
    logEvent('smelting_started', { item: itemToSmelt.name, count: actualCount, expectedOutput: outputName });

    const waitTime = Math.min(actualCount * 10000, 300000);
    let collected = 0;
    const startTime = Date.now();

    while (Date.now() - startTime < waitTime) {
      await new Promise(r => setTimeout(r, 5000));
      const output = fb.outputItem();
      if (output && output.count > 0) {
        await fb.takeOutput();
        collected += output.count;
        const input = fb.inputItem();
        if (!input || input.count === 0) break;
      }
    }

    const finalOutput = fb.outputItem();
    if (finalOutput && finalOutput.count > 0) {
      await fb.takeOutput();
      collected += finalOutput.count;
    }
    fb.close();

    clearCurrentAction();
    logEvent('command_result', { commandId: cmd.id, success: collected > 0, detail: `Smelted ${collected} ${outputName}` });
  } catch (err) {
    clearCurrentAction();
    logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
  }
}

async function cookFood(bot, cmd) {
  const rawMeats = Object.keys(RAW_TO_COOKED);
  const rawItem = bot.inventory.items().find(i => rawMeats.includes(i.name));

  if (!rawItem) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No raw food to cook' });
    return;
  }

  // Delegate to smelt
  await smelt(bot, { ...cmd, item: rawItem.name, count: rawItem.count });
}

module.exports = { craft, smelt, cookFood };
