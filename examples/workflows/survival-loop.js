/**
 * Survival Loop - Autonomous agent decision loop
 *
 * This example shows how an AI agent should read state, make decisions,
 * and issue commands in a continuous loop. Run this alongside the bot.
 *
 * Usage: BOT_DATA_DIR=./data node examples/workflows/survival-loop.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.BOT_DATA_DIR || path.join(__dirname, '..', '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const COMMANDS_FILE = path.join(DATA_DIR, 'commands.json');

let commandCounter = 0;

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {
    return null;
  }
}

function readEvents() {
  try {
    return JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function sendCommand(action, params = {}) {
  const cmd = { id: `cmd-${++commandCounter}`, action, ...params };
  console.log(`[CMD] ${action}`, JSON.stringify(params));
  fs.writeFileSync(COMMANDS_FILE, JSON.stringify([cmd]));
  return cmd.id;
}

function hasItem(inventory, itemName) {
  return inventory.some(i => i.name.includes(itemName));
}

function countItem(inventory, itemName) {
  return inventory
    .filter(i => i.name.includes(itemName))
    .reduce((sum, i) => sum + i.count, 0);
}

// Wait for a command result by polling events
async function waitForResult(commandId, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const events = readEvents();
    const result = events.find(e => e.type === 'command_result' && e.commandId === commandId);
    if (result) return result;
    await new Promise(r => setTimeout(r, 500));
  }
  return null;
}

async function survivalTick() {
  const state = readState();
  if (!state) {
    console.log('[WAIT] No state yet...');
    return;
  }

  const { bot, inventory, inventoryStats, nearbyEntities, time, currentAction } = state;

  // --- Priority 1: Critical health ---
  if (bot.health < 6) {
    console.log(`[DANGER] Health critical: ${bot.health}`);
    if (hasItem(inventory, 'cooked_') || hasItem(inventory, 'bread') || hasItem(inventory, 'apple')) {
      sendCommand('eat');
    } else {
      sendCommand('stop');
    }
    return;
  }

  // --- Priority 2: Hunger ---
  if (bot.food < 8 && !hasItem(inventory, 'cooked_') && !hasItem(inventory, 'bread')) {
    console.log('[HUNGER] No food, hunting...');
    sendCommand('find_food');
    return;
  }

  // --- Priority 3: Night safety ---
  if (time.phase === 'night' && !bot.isSleeping) {
    console.log('[NIGHT] Trying to sleep...');
    sendCommand('sleep');
    return;
  }

  // --- Priority 4: Already busy ---
  if (currentAction) {
    console.log(`[BUSY] ${currentAction.type}: ${JSON.stringify(currentAction)}`);
    return; // Let the current action finish
  }

  // --- Priority 5: Inventory management ---
  if (inventoryStats.freeSlots < 3) {
    console.log('[FULL] Managing inventory...');
    sendCommand('manage_inventory');
    return;
  }

  // --- Priority 6: Tool progression ---
  if (!hasItem(inventory, 'pickaxe')) {
    console.log('[TOOLS] No pickaxe, gathering wood...');
    const id = sendCommand('mine_resource', { resource: 'wood', count: 5 });
    const result = await waitForResult(id, 60000);
    if (result?.success) {
      sendCommand('craft', { item: 'oak_planks', count: 16 });
      await new Promise(r => setTimeout(r, 2000));
      sendCommand('craft', { item: 'stick', count: 8 });
      await new Promise(r => setTimeout(r, 2000));
      sendCommand('craft', { item: 'wooden_pickaxe' });
    }
    return;
  }

  // --- Priority 7: Mine resources ---
  if (countItem(inventory, 'iron_ingot') < 5 && !hasItem(inventory, 'iron_pickaxe')) {
    console.log('[MINE] Mining stone for better tools...');
    sendCommand('mine_resource', { resource: 'stone', count: 12 });
    return;
  }

  // --- Priority 8: Explore ---
  console.log('[IDLE] Exploring...');
  sendCommand('goal', { goal: 'explore' });
}

// Main loop
async function main() {
  console.log(`Survival loop started. Data dir: ${DATA_DIR}`);
  console.log('Waiting for bot to connect...\n');

  while (true) {
    try {
      await survivalTick();
    } catch (err) {
      console.error('[ERROR]', err.message);
    }
    await new Promise(r => setTimeout(r, 2000)); // Check every 2 seconds
  }
}

main();
