#!/usr/bin/env node

/**
 * Basic Minecraft Bot Controller
 *
 * Reads state.json and events.json from the bot and writes commands.json to control it.
 * Implements simple survival logic: health, hunger, combat, social, exploration.
 *
 * Usage:
 *   node basic-controller.js
 *
 * Requirements:
 *   - Bot running (npm start) with data/ directory created
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DATA_DIR = process.env.BOT_DATA_DIR || path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const COMMANDS_FILE = path.join(DATA_DIR, 'commands.json');
const CHECK_INTERVAL = 5000;  // Check every 5 seconds

// State tracking
let commandCounter = 0;
let consecutiveErrors = 0;

function nextId() {
  return `ctrl-${++commandCounter}`;
}

/**
 * Read current bot state
 */
function readState() {
  try {
    const data = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      consecutiveErrors++;
    }
    return null;
  }
}

/**
 * Read recent events (for command results, chat, etc.)
 */
function readEvents() {
  try {
    const data = fs.readFileSync(EVENTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * Write commands for bot to execute
 */
function writeCommands(commands) {
  try {
    // Add IDs to commands that don't have them
    const withIds = commands.map(cmd => cmd.id ? cmd : { id: nextId(), ...cmd });
    fs.writeFileSync(COMMANDS_FILE, JSON.stringify(withIds, null, 2));
    consecutiveErrors = 0;
    return true;
  } catch (err) {
    console.error('Failed to write commands:', err.message);
    consecutiveErrors++;
    return false;
  }
}

/**
 * Decide what the bot should do based on current state
 */
function decide(state) {
  const { bot, inventory, nearbyEntities, time } = state;

  // Priority 1: CRITICAL HEALTH
  if (bot.health < 6) {
    console.log('CRITICAL: Low health! Stopping.');
    return [{ action: 'stop' }];
  }

  // Priority 2: IN WATER
  if (bot.isInWater) {
    console.log('WARNING: In water! Jumping.');
    return [{ action: 'jump' }];
  }

  // Priority 3: HUNGER
  if (bot.food < 6) {
    const hasFood = inventory.some(i =>
      ['cooked_beef', 'cooked_porkchop', 'bread', 'apple', 'baked_potato'].includes(i.name));

    if (hasFood) {
      console.log('HUNGRY: Eating food...');
      return [{ action: 'eat' }];
    } else {
      console.log('HUNGRY: Finding food...');
      return [{ action: 'find_food' }];
    }
  }

  // Priority 4: COMBAT
  const hostiles = nearbyEntities.filter(e => e.type === 'hostile');
  if (hostiles.length > 0 && bot.health > 10) {
    const nearest = hostiles[0];
    console.log(`COMBAT: ${nearest.name} at ${nearest.distance}m - Engaging!`);
    return [{ action: 'attack', target: nearest.name }];
  }

  // Priority 5: NIGHT - try to sleep
  if (time.phase === 'night') {
    console.log('NIGHT: Trying to sleep...');
    return [{ action: 'sleep' }];
  }

  // Priority 6: SOCIAL (follow nearby player)
  const players = nearbyEntities.filter(e => e.type === 'player');
  if (players.length > 0) {
    const player = players[0];
    if (player.distance > 5) {
      console.log(`SOCIAL: Following ${player.name} (${player.distance}m away)`);
      return [{ action: 'follow', username: player.name, distance: 3 }];
    }
    // Already close, stand by
    console.log(`SOCIAL: Near ${player.name}, standing by.`);
    return [];
  }

  // Priority 7: EXPLORE
  console.log('IDLE: Exploring...');
  return [{ action: 'goal', goal: 'explore' }];
}

/**
 * Main control loop
 */
function controlLoop() {
  const state = readState();

  if (!state) {
    console.log('Waiting for bot to start...');
    return;
  }

  // Status display
  const { bot, time } = state;
  console.log('-'.repeat(50));
  console.log(`Status: HP=${bot.health.toFixed(1)}/20 | Food=${bot.food}/20 | ${time.phase}`);
  console.log(`Position: (${bot.position.x}, ${bot.position.y}, ${bot.position.z})`);

  // Decide actions
  const commands = decide(state);

  if (commands.length > 0) {
    console.log(`Commands: ${commands.map(c => c.action).join(', ')}`);
    writeCommands(commands);
  } else {
    console.log('No action needed');
  }

  // Health check
  if (consecutiveErrors > 5) {
    console.error('Too many errors! Check if bot is running.');
    process.exit(1);
  }
}

/**
 * Start controller
 */
function main() {
  console.log('Minecraft Bot Controller');
  console.log('==================================================');
  console.log(`State:    ${STATE_FILE}`);
  console.log(`Events:   ${EVENTS_FILE}`);
  console.log(`Commands: ${COMMANDS_FILE}`);
  console.log(`Interval: ${CHECK_INTERVAL}ms`);
  console.log('==================================================');
  console.log('');

  // Check if data dir exists
  if (!fs.existsSync(DATA_DIR)) {
    console.warn('data/ directory not found. Waiting for bot to start...');
  }

  // Initial run
  controlLoop();

  // Continuous monitoring
  setInterval(controlLoop, CHECK_INTERVAL);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nController shutting down...');
    process.exit(0);
  });
}

// Run
main();
