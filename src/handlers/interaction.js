const Vec3 = require('vec3');
const { goals } = require('mineflayer-pathfinder');
const { GoalNear } = goals;
const { logEvent } = require('../events');
const { setCurrentAction, clearCurrentAction } = require('../state');
const { FOOD_ITEMS } = require('../perception');

async function chat(bot, cmd) {
  bot.chat(cmd.message);
  logEvent('command_result', { commandId: cmd.id, success: true, detail: `Said: ${cmd.message}` });
}

async function whisper(bot, cmd) {
  if (!cmd.username || !cmd.message) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'username and message are required' });
    return;
  }
  bot.whisper(cmd.username, cmd.message);
  logEvent('command_result', { commandId: cmd.id, success: true, detail: `Whispered to ${cmd.username}: ${cmd.message}` });
}

async function equip(bot, cmd) {
  const itemName = cmd.item;
  const hand = cmd.hand === 'off' ? 'off-hand' : 'hand';
  const item = bot.inventory.items().find(i => i.name === itemName || i.name.includes(itemName));

  if (!item) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: `No ${itemName} in inventory` });
    return;
  }

  try {
    await bot.equip(item, hand);
    logEvent('command_result', { commandId: cmd.id, success: true, detail: `Equipped ${item.name}` });
  } catch (err) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
  }
}

async function unequip(bot, cmd) {
  const validSlots = ['hand', 'off-hand', 'head', 'torso', 'legs', 'feet'];
  const slot = cmd.slot || 'hand';
  if (!validSlots.includes(slot)) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: `Invalid slot: ${slot}. Valid: ${validSlots.join(', ')}` });
    return;
  }

  try {
    await bot.unequip(slot);
    logEvent('command_result', { commandId: cmd.id, success: true, detail: `Unequipped ${slot}` });
  } catch (err) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
  }
}

async function drinkPotion(bot, cmd) {
  const filter = cmd.potion ? cmd.potion.toLowerCase() : null;
  const potion = bot.inventory.items().find(i => {
    if (i.name !== 'potion' && i.name !== 'splash_potion' && i.name !== 'lingering_potion') return false;
    if (filter && !i.name.includes(filter)) {
      // Check nbt/display name for potion type
      const displayName = (i.displayName || i.name || '').toLowerCase();
      if (!displayName.includes(filter)) return false;
    }
    return true;
  });

  if (!potion) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: `No ${filter || 'potion'} in inventory` });
    return;
  }

  try {
    await bot.equip(potion, 'hand');
    bot.activateItem();
    // Potions take about 1.6 seconds to drink
    await new Promise(r => setTimeout(r, 1800));
    bot.deactivateItem();
    logEvent('command_result', { commandId: cmd.id, success: true, detail: `Drank ${potion.displayName || potion.name}` });
  } catch (err) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
  }
}

async function eat(bot, cmd) {
  if (bot.food >= 20) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'Not hungry' });
    return;
  }

  const foodItem = bot.inventory.items().find(item => FOOD_ITEMS.includes(item.name));
  if (!foodItem) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No food in inventory' });
    return;
  }

  try {
    await bot.equip(foodItem, 'hand');
    await bot.consume();
    logEvent('command_result', { commandId: cmd.id, success: true, detail: `Ate ${foodItem.name}` });
  } catch (err) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
  }
}

async function sleep(bot, cmd) {
  const time = bot.time.timeOfDay;
  const isNight = time >= 12541 && time <= 23458;
  if (!isNight) {
    const ticksUntilNight = time < 12541 ? 12541 - time : (24000 - time) + 12541;
    const secondsUntilNight = Math.floor(ticksUntilNight / 20);
    logEvent('command_result', {
      commandId: cmd.id, success: false,
      detail: `Not night time (current: ${time}, night starts at 12541, ~${secondsUntilNight}s away)`,
      timeOfDay: time,
      ticksUntilNight,
    });
    return;
  }

  let bed = bot.findBlock({ matching: b => b.name.includes('bed'), maxDistance: 32 });
  if (!bed) {
    const bedItem = bot.inventory.items().find(i => i.name.includes('bed'));
    if (bedItem) {
      const floor = bot.blockAt(bot.entity.position.floored().offset(1, -1, 0));
      if (floor && floor.name !== 'air') {
        await bot.equip(bedItem, 'hand');
        await bot.placeBlock(floor, new Vec3(0, 1, 0));
        bed = bot.blockAt(bot.entity.position.floored().offset(1, 0, 0));
      }
    }
  }

  if (!bed) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No bed available' });
    return;
  }

  try {
    await bot.pathfinder.goto(new GoalNear(bed.position.x, bed.position.y, bed.position.z, 2));
    await bot.sleep(bed);
    logEvent('command_result', { commandId: cmd.id, success: true, detail: 'Sleeping' });
  } catch (err) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
  }
}

async function activate(bot, cmd) {
  let block;
  if (cmd.position) {
    block = bot.blockAt(new Vec3(cmd.position.x, cmd.position.y, cmd.position.z));
  } else {
    block = bot.blockAtCursor(5);
  }

  if (!block) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No block to activate' });
    return;
  }

  try {
    await bot.activateBlock(block);
    logEvent('command_result', { commandId: cmd.id, success: true, detail: `Activated ${block.name}` });
  } catch (err) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
  }
}

async function fish(bot, cmd) {
  const rod = bot.inventory.items().find(i => i.name === 'fishing_rod');
  if (!rod) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No fishing rod' });
    return;
  }

  try {
    await bot.equip(rod, 'hand');
    setCurrentAction({ type: 'fishing' });
    const caught = await bot.fish();
    clearCurrentAction();
    logEvent('command_result', { commandId: cmd.id, success: true, detail: `Caught ${caught?.name || 'something'}` });
  } catch (err) {
    clearCurrentAction();
    logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
  }
}

async function useOn(bot, cmd) {
  let target;
  if (cmd.entityId) {
    target = bot.entities[cmd.entityId];
  } else if (cmd.entityType) {
    target = Object.values(bot.entities)
      .filter(e => e.name?.toLowerCase().includes(cmd.entityType.toLowerCase()))
      .filter(e => e.position && bot.entity.position.distanceTo(e.position) < 32)
      .sort((a, b) => bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position))[0];
  }

  if (!target) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: `No entity found: ${cmd.entityType || cmd.entityId}` });
    return;
  }

  try {
    if (bot.entity.position.distanceTo(target.position) > 3) {
      await bot.pathfinder.goto(new GoalNear(target.position.x, target.position.y, target.position.z, 2));
    }
    await bot.useOn(target);
    logEvent('command_result', { commandId: cmd.id, success: true, detail: `Used on ${target.name}` });
  } catch (err) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
  }
}

async function trade(bot, cmd) {
  const villager = Object.values(bot.entities)
    .filter(e => e.type === 'mob' && e.name?.toLowerCase() === 'villager')
    .filter(e => e.position && bot.entity.position.distanceTo(e.position) < 32)
    .sort((a, b) => bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position))[0];

  if (!villager) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No villagers nearby' });
    return;
  }

  try {
    await bot.pathfinder.goto(new GoalNear(villager.position.x, villager.position.y, villager.position.z, 2));
    const trades = await bot.openVillager(bot.entities[villager.id]);

    if (!trades.trades || trades.trades.length === 0) {
      trades.close();
      logEvent('command_result', { commandId: cmd.id, success: false, detail: 'Villager has no trades' });
      return;
    }

    // If no index provided or index is out of range, list all trades with details
    const buyIndex = cmd.index;
    if (buyIndex === undefined || buyIndex === null || buyIndex >= trades.trades.length) {
      const tradeList = trades.trades.map((t, i) => ({
        index: i,
        input1: t.inputItem1 ? { name: t.inputItem1.name, count: t.inputItem1.count } : null,
        input2: t.inputItem2 ? { name: t.inputItem2.name, count: t.inputItem2.count } : null,
        output: t.outputItem ? { name: t.outputItem.name, count: t.outputItem.count } : null,
        disabled: t.tradeDisabled || false,
        uses: t.nbTradeUses || 0,
        maxUses: t.maximumNbTradeUses || 0,
      }));
      trades.close();
      logEvent('command_result', {
        commandId: cmd.id, success: true,
        detail: `${tradeList.length} trades available`,
        trades: tradeList,
      });
    } else {
      const t = trades.trades[buyIndex];
      const hasInput = bot.inventory.items().find(i => i.name === t.inputItem1?.name);
      if (hasInput) {
        await trades.trade(buyIndex, 1);
        logEvent('command_result', { commandId: cmd.id, success: true, detail: `Traded for ${t.outputItem?.name}` });
      } else {
        logEvent('command_result', {
          commandId: cmd.id, success: false,
          detail: `Missing ${t.inputItem1?.name} (need ${t.inputItem1?.count || 1})`,
          required: t.inputItem1 ? { name: t.inputItem1.name, count: t.inputItem1.count } : null,
        });
      }
    }
    trades.close();
  } catch (err) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
  }
}

async function brew(bot, cmd) {
  const stand = bot.findBlock({ matching: b => b.name === 'brewing_stand', maxDistance: 32 });
  if (!stand) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No brewing stand nearby' });
    return;
  }

  try {
    await bot.pathfinder.goto(new GoalNear(stand.position.x, stand.position.y, stand.position.z, 2));
    const brewer = await bot.openBrewingStand(stand);

    const blazePowder = bot.inventory.items().find(i => i.name === 'blaze_powder');
    if (blazePowder) await brewer.putFuel(blazePowder.type, null, 1);

    const bottle = bot.inventory.items().find(i => i.name === 'glass_bottle' || i.name === 'potion');
    if (bottle) await brewer.putPotion(0, bottle.type, null, 1);

    const ingredient = bot.inventory.items().find(i =>
      ['nether_wart', 'glowstone_dust', 'redstone', 'spider_eye'].includes(i.name));
    if (ingredient) await brewer.putIngredient(ingredient.type, null, 1);

    setCurrentAction({ type: 'brewing' });
    await new Promise(r => setTimeout(r, 20000));
    for (let i = 0; i < 3; i++) { try { await brewer.takePotion(i); } catch (e) {} }
    brewer.close();
    clearCurrentAction();

    logEvent('command_result', { commandId: cmd.id, success: true, detail: 'Brewing complete' });
  } catch (err) {
    clearCurrentAction();
    logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
  }
}

async function enchant(bot, cmd) {
  const table = bot.findBlock({ matching: b => b.name === 'enchanting_table', maxDistance: 32 });
  if (!table) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No enchanting table nearby' });
    return;
  }

  try {
    await bot.pathfinder.goto(new GoalNear(table.position.x, table.position.y, table.position.z, 2));
    const et = await bot.openEnchantmentTable(table);

    const enchantable = bot.inventory.items().find(i =>
      i.name.includes('sword') || i.name.includes('pickaxe') || i.name.includes('helmet') || i.name.includes('chestplate'));
    if (!enchantable) { et.close(); logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No enchantable items' }); return; }

    const lapis = bot.inventory.items().find(i => i.name === 'lapis_lazuli');
    if (!lapis) { et.close(); logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No lapis lazuli' }); return; }

    await et.putTargetItem(enchantable);
    await et.putLapis(lapis);

    const enchantments = et.enchantments;
    if (enchantments && enchantments.length > 0) {
      const best = enchantments.reduce((a, b) => (a.level > b.level ? a : b));
      await et.enchant(enchantments.indexOf(best));
      logEvent('command_result', { commandId: cmd.id, success: true, detail: `Enchanted ${enchantable.name}` });
    } else {
      logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No enchantments available' });
    }

    await et.takeTargetItem();
    et.close();
  } catch (err) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
  }
}

async function storeItems(bot, cmd) {
  const chest = bot.findBlock({
    matching: b => b.name === 'chest' || b.name === 'barrel' || b.name === 'trapped_chest',
    maxDistance: 32,
  });
  if (!chest) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No storage chest nearby' });
    return;
  }

  try {
    await bot.pathfinder.goto(new GoalNear(chest.position.x, chest.position.y, chest.position.z, 2));
    const container = await bot.openContainer(chest);
    const essentials = ['diamond_pickaxe', 'iron_pickaxe', 'diamond_sword', 'iron_sword'];
    let stored = 0;

    for (const item of bot.inventory.items()) {
      if (essentials.includes(item.name)) continue;
      if (cmd.items && !cmd.items.some(t => item.name.includes(t))) continue;
      try { await container.deposit(item.type, null, item.count); stored++; } catch (e) { break; }
    }

    container.close();
    logEvent('command_result', { commandId: cmd.id, success: stored > 0, detail: `Stored ${stored} item types` });
  } catch (err) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
  }
}

async function retrieveItems(bot, cmd) {
  const chest = bot.findBlock({ matching: b => b.name === 'chest' || b.name === 'barrel', maxDistance: 32 });
  if (!chest) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No chest nearby' });
    return;
  }

  try {
    await bot.pathfinder.goto(new GoalNear(chest.position.x, chest.position.y, chest.position.z, 2));
    const container = await bot.openContainer(chest);
    let retrieved = 0;
    for (const item of container.items()) {
      if (!cmd.items || cmd.items.some(t => item.name.includes(t))) {
        try { await container.withdraw(item.type, null, item.count); retrieved++; } catch (e) {}
      }
    }
    container.close();
    logEvent('command_result', { commandId: cmd.id, success: retrieved > 0, detail: `Retrieved ${retrieved} item types` });
  } catch (err) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
  }
}

async function manageInventory(bot, cmd) {
  const ESSENTIAL = ['pickaxe', 'axe', 'shovel', 'hoe', 'sword', 'bow', 'shield', 'helmet', 'chestplate', 'leggings', 'boots', 'torch', 'coal', 'iron_ingot', 'cooked_'];
  const LOW_VALUE = ['dirt', 'cobblestone', 'gravel', 'sand', 'netherrack', 'andesite', 'diorite', 'granite', 'tuff', 'rotten_flesh', 'poisonous_potato', 'spider_eye'];

  const usage = bot.inventory.items().length;
  if (usage < 32) {
    logEvent('command_result', { commandId: cmd.id, success: true, detail: `Inventory OK (${usage}/36)` });
    return;
  }

  const chest = bot.findBlock({ matching: b => b.name === 'chest' || b.name === 'barrel', maxDistance: 64 });
  if (chest) {
    try {
      await bot.pathfinder.goto(new GoalNear(chest.position.x, chest.position.y, chest.position.z, 2));
      const container = await bot.openContainer(chest);
      let deposited = 0;
      for (const item of bot.inventory.items()) {
        if (ESSENTIAL.some(e => item.name.includes(e))) continue;
        try { await container.deposit(item.type, null, item.count); deposited++; } catch (e) { break; }
      }
      container.close();
      logEvent('command_result', { commandId: cmd.id, success: deposited > 0, detail: `Deposited ${deposited} stacks` });
    } catch (err) {
      logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
    }
  } else {
    let dropped = 0;
    for (const item of bot.inventory.items()) {
      if (LOW_VALUE.some(lv => item.name.includes(lv))) {
        try { await bot.tossStack(item); dropped++; } catch (e) {}
      }
      if (bot.inventory.items().length < 28) break;
    }
    logEvent('command_result', { commandId: cmd.id, success: dropped > 0, detail: `Dropped ${dropped} low-value stacks` });
  }
}

module.exports = { chat, whisper, equip, unequip, drinkPotion, eat, sleep, activate, fish, useOn, trade, brew, enchant, storeItems, retrieveItems, manageInventory };
