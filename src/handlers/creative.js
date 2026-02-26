const Vec3 = require('vec3');
const { logEvent } = require('../events');
const { setCurrentAction, clearCurrentAction } = require('../state');

async function creativeFly(bot, cmd) {
  if (bot.game.gameMode !== 'creative') {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'Not in creative mode' });
    return;
  }

  const enabled = cmd.enabled !== false;
  try {
    if (enabled) {
      bot.creative.startFlying();
      logEvent('command_result', { commandId: cmd.id, success: true, detail: 'Creative flight started' });
    } else {
      bot.creative.stopFlying();
      logEvent('command_result', { commandId: cmd.id, success: true, detail: 'Creative flight stopped' });
    }
  } catch (err) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
  }
}

async function creativeFlyTo(bot, cmd) {
  if (bot.game.gameMode !== 'creative') {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'Not in creative mode' });
    return;
  }

  if (cmd.x === undefined || cmd.y === undefined || cmd.z === undefined) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'x, y, z coordinates required' });
    return;
  }

  const dest = new Vec3(cmd.x, cmd.y, cmd.z);
  setCurrentAction({ type: 'creative_fly_to', target: { x: cmd.x, y: cmd.y, z: cmd.z } });

  try {
    await bot.creative.flyTo(dest);
    clearCurrentAction();
    logEvent('command_result', { commandId: cmd.id, success: true, detail: `Flew to ${cmd.x}, ${cmd.y}, ${cmd.z}` });
  } catch (err) {
    clearCurrentAction();
    logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
  }
}

async function creativeGive(bot, cmd) {
  if (bot.game.gameMode !== 'creative') {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'Not in creative mode' });
    return;
  }

  const itemName = cmd.item;
  if (!itemName) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'item name required' });
    return;
  }

  let mcData;
  try {
    mcData = require('minecraft-data')(bot.version);
  } catch (e) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'Failed to load game data' });
    return;
  }

  const item = mcData.itemsByName[itemName];
  if (!item) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: `Unknown item: ${itemName}` });
    return;
  }

  const count = cmd.count || 1;
  const slot = cmd.slot || 36; // First inventory slot

  try {
    const Item = require('prismarine-item')(bot.version);
    const itemStack = new Item(item.id, count);
    await bot.creative.setInventorySlot(slot, itemStack);
    logEvent('command_result', { commandId: cmd.id, success: true, detail: `Gave ${count}x ${itemName}` });
  } catch (err) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
  }
}

module.exports = { creativeFly, creativeFlyTo, creativeGive };
