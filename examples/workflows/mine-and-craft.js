/**
 * Mine and Craft Workflow - Step-by-step resource gathering
 *
 * Demonstrates the full progression from nothing to iron tools:
 * wood → planks → sticks → wooden pickaxe → stone → stone pickaxe →
 * iron ore → smelt → iron pickaxe
 *
 * Usage: BOT_DATA_DIR=./data node examples/workflows/mine-and-craft.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.BOT_DATA_DIR || path.join(__dirname, '..', '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const COMMANDS_FILE = path.join(DATA_DIR, 'commands.json');

let commandCounter = 0;

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch (e) { return null; }
}

function readEvents() {
  try { return JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8')); }
  catch (e) { return []; }
}

function sendCommand(action, params = {}) {
  const cmd = { id: `mc-${++commandCounter}`, action, ...params };
  fs.writeFileSync(COMMANDS_FILE, JSON.stringify([cmd]));
  return cmd.id;
}

async function waitForResult(commandId, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const events = readEvents();
    const result = events.find(e => e.type === 'command_result' && e.commandId === commandId);
    if (result) return result;
    await new Promise(r => setTimeout(r, 500));
  }
  return { success: false, detail: 'Timed out waiting for result' };
}

function hasItem(name) {
  const state = readState();
  if (!state) return false;
  return state.inventory.some(i => i.name.includes(name));
}

async function step(description, action, params = {}, timeout = 60000) {
  console.log(`\n--- ${description} ---`);
  const id = sendCommand(action, params);
  const result = await waitForResult(id, timeout);
  if (result.success) {
    console.log(`  OK: ${result.detail}`);
  } else {
    console.log(`  FAILED: ${result.detail}`);
  }
  // Small delay between steps
  await new Promise(r => setTimeout(r, 1000));
  return result;
}

async function main() {
  console.log('=== Mine and Craft Workflow ===\n');
  console.log('Goal: Progress from nothing to iron tools.\n');

  // Wait for bot to be ready
  while (!readState()) {
    console.log('Waiting for bot...');
    await new Promise(r => setTimeout(r, 2000));
  }

  const state = readState();
  console.log(`Bot at ${state.bot.position.x}, ${state.bot.position.y}, ${state.bot.position.z}`);
  console.log(`Health: ${state.bot.health}, Food: ${state.bot.food}`);
  console.log(`Inventory: ${state.inventoryStats.usedSlots} items\n`);

  // Phase 1: Wood
  if (!hasItem('pickaxe')) {
    await step('Survey area', 'scan');
    await step('Gather wood', 'mine_resource', { resource: 'wood', count: 8 }, 120000);
    await step('Collect dropped items', 'collect_items');
    await step('Craft oak planks', 'craft', { item: 'oak_planks', count: 20 });
    await step('Craft sticks', 'craft', { item: 'stick', count: 8 });
    await step('Craft crafting table', 'craft', { item: 'crafting_table' });
    await step('Craft wooden pickaxe', 'craft', { item: 'wooden_pickaxe' });
    await step('Craft wooden sword', 'craft', { item: 'wooden_sword' });
  }

  // Phase 2: Stone
  if (!hasItem('stone_pickaxe') && !hasItem('iron_pickaxe')) {
    await step('Mine stone', 'mine_resource', { resource: 'stone', count: 16 }, 120000);
    await step('Craft stone pickaxe', 'craft', { item: 'stone_pickaxe' });
    await step('Craft stone sword', 'craft', { item: 'stone_sword' });
  }

  // Phase 3: Iron
  if (!hasItem('iron_ingot') && !hasItem('iron_pickaxe')) {
    const findResult = await step('Find iron ore', 'find_blocks', { blockType: 'iron_ore', maxDistance: 64 });
    if (findResult.success) {
      await step('Mine iron ore', 'mine_resource', { resource: 'iron_ore', count: 10 }, 180000);
      await step('Collect dropped items', 'collect_items');
      await step('Smelt raw iron', 'smelt', { item: 'raw_iron' }, 120000);
    } else {
      console.log('\nNo iron ore found nearby. Try exploring first:');
      console.log('  {"action": "goal", "goal": "explore"}');
    }
  }

  // Phase 4: Iron tools
  if (hasItem('iron_ingot')) {
    await step('Craft iron pickaxe', 'craft', { item: 'iron_pickaxe' });
    await step('Craft iron sword', 'craft', { item: 'iron_sword' });

    const ingotCount = readState()?.inventory
      .filter(i => i.name === 'iron_ingot')
      .reduce((s, i) => s + i.count, 0) || 0;

    if (ingotCount >= 5) {
      await step('Craft iron helmet', 'craft', { item: 'iron_helmet' });
    }
    if (ingotCount >= 8) {
      await step('Craft iron chestplate', 'craft', { item: 'iron_chestplate' });
    }
  }

  // Summary
  console.log('\n=== Workflow Complete ===');
  const finalState = readState();
  if (finalState) {
    console.log(`\nFinal inventory (${finalState.inventoryStats.usedSlots} slots used):`);
    for (const item of finalState.inventory) {
      console.log(`  ${item.count}x ${item.name}`);
    }
    console.log(`\nArmor: ${finalState.armor.pieces.join(', ') || 'none'}`);
    console.log(`Equipment: ${finalState.equipment.hand?.name || 'empty hand'}`);
  }
}

main().catch(console.error);
