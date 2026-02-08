#!/usr/bin/env node

/**
 * Basic Minecraft Bot Controller
 * 
 * Reads events.json from the bot and writes commands.json to control it.
 * Implements simple survival logic: health, hunger, combat, social, exploration.
 * 
 * Usage:
 *   node basic-controller.js
 * 
 * Requirements:
 *   - bot.js running in parent directory
 *   - events.json and commands.json in parent directory
 */

const fs = require('fs');
const path = require('path');

// Configuration
const EVENTS_FILE = path.join(__dirname, '..', 'events.json');
const COMMANDS_FILE = path.join(__dirname, '..', 'commands.json');
const CHECK_INTERVAL = 10000;  // Check every 10 seconds

// State tracking
let lastCommandTime = 0;
let consecutiveErrors = 0;

/**
 * Read latest events from bot
 */
function readEvents() {
  try {
    const data = fs.readFileSync(EVENTS_FILE, 'utf8');
    const events = JSON.parse(data);
    return events;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('❌ Failed to read events:', err.message);
      consecutiveErrors++;
    }
    return [];
  }
}

/**
 * Write commands for bot to execute
 */
function writeCommands(commands) {
  try {
    fs.writeFileSync(COMMANDS_FILE, JSON.stringify(commands, null, 2));
    lastCommandTime = Date.now();
    consecutiveErrors = 0;
    return true;
  } catch (err) {
    console.error('❌ Failed to write commands:', err.message);
    consecutiveErrors++;
    return false;
  }
}

/**
 * Decide what the bot should do based on current state
 */
function decide(perception) {
  const {
    health,
    food,
    hungerUrgency,
    hostileMobs,
    nearbyPlayers,
    dangerUnderfoot,
    inWater,
    oxygen,
    position,
    currentGoal
  } = perception.data;

  // Priority 1: IMMEDIATE DANGER
  if (health < 6) {
    console.log('🚨 CRITICAL: Low health! Stopping and retreating.');
    return [
      { action: 'stop' },
      { action: 'chat', message: 'Help! Low health!' }
    ];
  }

  if (dangerUnderfoot) {
    console.log(`⚠️  DANGER: ${dangerUnderfoot} detected! Moving to safety.`);
    return [{ action: 'stop' }];
  }

  if (inWater && oxygen < 100) {
    console.log('💧 DROWNING: Low oxygen! Swimming up.');
    // Bot auto-swims at oxygen < 50, but we can help
    return [{ action: 'jump' }];
  }

  // Priority 2: HUNGER
  if (hungerUrgency === 'critical' || food < 6) {
    console.log('🍖 HUNGRY: Finding food...');
    
    // If we have food, eat it
    if (perception.data.foodCount > 0) {
      return [{ action: 'eat' }];
    }
    
    // Otherwise hunt
    return [{ action: 'find_food' }];
  }

  if (hungerUrgency === 'high' && food < 12) {
    console.log('🍗 Moderate hunger. Looking for food...');
    return [{ action: 'find_food' }];
  }

  // Priority 3: COMBAT
  if (hostileMobs.length > 0 && health > 10) {
    const nearest = hostileMobs[0];
    console.log(`⚔️  COMBAT: ${nearest.type} at ${nearest.distance}m - Engaging!`);
    
    if (nearest.distance < 30) {
      return [{ action: 'attack', target: nearest.type }];
    }
  }

  // Priority 4: SOCIAL (follow player)
  if (nearbyPlayers.length > 0) {
    const player = nearbyPlayers[0];
    
    // If player is far, follow them
    if (player.distance > 5) {
      console.log(`👥 SOCIAL: Following ${player.username} (${player.distance}m away)`);
      return [{ action: 'follow', username: player.username, distance: 3 }];
    }
    
    // If close to player and idle, we're good
    if (!currentGoal || currentGoal.type === 'follow') {
      console.log(`✅ SOCIAL: Near ${player.username}, standing by.`);
      return [];  // No commands needed
    }
  }

  // Priority 5: AUTONOMOUS BEHAVIOR
  console.log('🌍 AUTONOMOUS: Exploring world...');
  return [{ action: 'goal', goal: 'explore' }];
}

/**
 * Main control loop
 */
function controlLoop() {
  const events = readEvents();
  
  if (events.length === 0) {
    console.log('⏳ Waiting for bot to start...');
    return;
  }

  // Find latest perception event
  const perception = events.reverse().find(e => e.type === 'perception');
  
  if (!perception) {
    console.log('⏳ Waiting for perception data...');
    return;
  }

  // Status display
  const { health, food, position, hungerUrgency } = perception.data;
  console.log('─'.repeat(60));
  console.log(`📊 Status: HP=${health.toFixed(1)}/20 | Food=${food}/20 | Hunger=${hungerUrgency}`);
  console.log(`📍 Position: (${position.x}, ${position.y}, ${position.z})`);
  console.log(`⏰ Time: ${new Date().toLocaleTimeString()}`);

  // Decide actions
  const commands = decide(perception);
  
  if (commands.length > 0) {
    console.log(`🎮 Commands: ${commands.map(c => c.action).join(', ')}`);
    writeCommands(commands);
  } else {
    console.log('✨ No action needed');
  }

  // Health check
  if (consecutiveErrors > 5) {
    console.error('💥 Too many errors! Check if bot is running.');
    console.error('   Run: ps aux | grep bot.js');
    process.exit(1);
  }
}

/**
 * Start controller
 */
function main() {
  console.log('🤖 Minecraft Bot Controller');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`📂 Events:   ${EVENTS_FILE}`);
  console.log(`📝 Commands: ${COMMANDS_FILE}`);
  console.log(`⏱️  Interval: ${CHECK_INTERVAL}ms`);
  console.log('════════════════════════════════════════════════════════════');
  console.log('');
  
  // Check if files exist
  if (!fs.existsSync(EVENTS_FILE)) {
    console.warn('⚠️  events.json not found. Waiting for bot to start...');
  }
  
  // Initial run
  controlLoop();
  
  // Continuous monitoring
  setInterval(controlLoop, CHECK_INTERVAL);
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n👋 Controller shutting down...');
    process.exit(0);
  });
}

// Run
main();
