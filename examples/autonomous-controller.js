#!/usr/bin/env node
/**
 * Autonomous Minecraft Bot Controller - Pattern 2
 * 
 * This script demonstrates how an OpenClaw agent spawns a subagent to
 * autonomously control the Minecraft bot via the file-based interface.
 * 
 * USAGE:
 * 
 * From parent OpenClaw agent:
 * 
 * await sessions_spawn({
 *   task: `Run autonomous-controller.js to control the Minecraft bot.
 *          Survive, gather resources, build shelter, mine iron.
 *          Report progress every 10 minutes.`,
 *   label: "minecraft-controller",
 *   cleanup: "keep"
 * });
 * 
 * Or run directly (for testing):
 * node examples/autonomous-controller.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const EVENTS_FILE = process.env.EVENTS_FILE || '/data/minecraft-bot/events.json';
const COMMANDS_FILE = process.env.COMMANDS_FILE || '/data/minecraft-bot/commands.json';
const POLL_INTERVAL_MS = 5000;  // Read events every 5 seconds
const CHECKIN_INTERVAL_MS = 10 * 60 * 1000;  // Report to parent every 10 minutes

// State tracking
let lastCheckIn = Date.now();
let sessionStartTime = Date.now();
let stats = {
  commandsSent: 0,
  deaths: 0,
  foodGathered: 0,
  resourcesMined: 0,
  sheltersBuilt: 0
};

/**
 * Read the latest event from the bot
 */
function readLatestEvent() {
  try {
    const events = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
    return events[events.length - 1];
  } catch (err) {
    console.error('Failed to read events:', err.message);
    return null;
  }
}

/**
 * Send commands to the bot
 */
function sendCommands(commands) {
  try {
    fs.writeFileSync(COMMANDS_FILE, JSON.stringify(commands, null, 2));
    stats.commandsSent += commands.length;
    console.log(`Sent ${commands.length} command(s):`, commands.map(c => c.action).join(', '));
  } catch (err) {
    console.error('Failed to write commands:', err.message);
  }
}

/**
 * Decide what action to take based on current game state
 */
function decideAction(event) {
  if (!event || event.type !== 'perception') {
    return null;
  }

  const data = event.data;
  
  // === CRITICAL SURVIVAL ===
  
  // Low health - retreat!
  if (data.health < 6) {
    console.log(`🚨 CRITICAL: Health at ${data.health}/20, retreating!`);
    return [{ action: 'chat', message: '🚨 Low health, retreating!' }];
  }
  
  // Drowning - swim up!
  if (data.inWater && data.oxygen < 10) {
    console.log(`🌊 Drowning! Oxygen at ${data.oxygen}/20`);
    return [{ action: 'chat', message: 'Drowning, swimming up!' }];
  }
  
  // Critical hunger - find food NOW
  if (data.hungerUrgency === 'critical') {
    console.log(`🍖 CRITICAL HUNGER: ${data.food}/20`);
    stats.foodGathered++;
    return [{ action: 'find_food' }];
  }
  
  // Hostile mob nearby - attack or flee
  if (data.hostileMobs && data.hostileMobs.length > 0) {
    const nearest = data.hostileMobs[0];
    if (nearest.distance < 5) {
      console.log(`⚔️  Hostile mob nearby: ${nearest.type} at ${nearest.distance}m`);
      if (data.health > 12) {
        return [{ action: 'attack', target: nearest.type }];
      } else {
        return [{ action: 'chat', message: 'Fleeing from mob!' }];
      }
    }
  }
  
  // === BASIC NEEDS ===
  
  // Moderate hunger - gather food
  if (data.food < 12 && data.hungerUrgency !== 'normal') {
    console.log(`🍖 Hunger at ${data.food}/20, finding food`);
    stats.foodGathered++;
    return [{ action: 'find_food' }];
  }
  
  // Night time and no shelter - build or sleep
  if (!data.isDay && data.time > 13000) {
    console.log(`🌙 Night time (${data.time}), seeking shelter`);
    
    // Try to sleep first
    if (data.inventory.some(item => item && item.name && item.name.includes('bed'))) {
      return [{ action: 'sleep' }];
    }
    
    // Build shelter if we have resources
    if (data.inventory.some(item => item && item.name === 'oak_planks')) {
      console.log('🏠 Building shelter');
      stats.sheltersBuilt++;
      return [{ action: 'build', template: 'shelter' }];
    }
  }
  
  // === PROGRESSION ===
  
  // No wood - gather wood first (most important)
  const woodCount = data.inventory.filter(item => 
    item && item.name && item.name.includes('log')
  ).reduce((sum, item) => sum + item.count, 0);
  
  if (woodCount < 16) {
    console.log(`🌲 Need wood (${woodCount}/16), gathering`);
    return [{ action: 'gather_wood' }];
  }
  
  // Have wood, no tools - craft tools
  const hasPickaxe = data.inventory.some(item => 
    item && item.name && item.name.includes('pickaxe')
  );
  
  if (!hasPickaxe && woodCount >= 4) {
    console.log('🔨 Crafting wooden pickaxe');
    return [{ action: 'craft', item: 'wooden_pickaxe' }];
  }
  
  // Have pickaxe - mine stone
  const stoneCount = data.inventory.filter(item =>
    item && item.name === 'cobblestone'
  ).reduce((sum, item) => sum + item.count, 0);
  
  if (stoneCount < 32 && hasPickaxe) {
    console.log(`⛏️  Mining stone (${stoneCount}/32)`);
    stats.resourcesMined++;
    return [{ action: 'mine_resource', resource: 'stone' }];
  }
  
  // Have stone - craft better tools
  const hasStonePickaxe = data.inventory.some(item =>
    item && item.name === 'stone_pickaxe'
  );
  
  if (!hasStonePickaxe && stoneCount >= 3) {
    console.log('🔨 Crafting stone pickaxe');
    return [{ action: 'craft', item: 'stone_pickaxe' }];
  }
  
  // Have stone pickaxe - mine iron
  const ironCount = data.inventory.filter(item =>
    item && item.name && item.name.includes('iron')
  ).reduce((sum, item) => sum + item.count, 0);
  
  if (ironCount < 16 && hasStonePickaxe) {
    console.log(`⛏️  Mining iron (${ironCount}/16)`);
    stats.resourcesMined++;
    return [{ action: 'mine_resource', resource: 'iron_ore' }];
  }
  
  // Have iron ore - smelt it
  const hasIronIngots = data.inventory.some(item =>
    item && item.name === 'iron_ingot'
  );
  
  if (!hasIronIngots && ironCount > 0) {
    console.log('🔥 Smelting iron ore');
    return [{ action: 'smelt', item: 'iron_ore' }];
  }
  
  // === DEFAULT: EXPLORE ===
  console.log('🗺️  Exploring for resources');
  return [{ action: 'explore' }];
}

/**
 * Check if we should report back to parent agent
 */
function shouldCheckIn() {
  return Date.now() - lastCheckIn >= CHECKIN_INTERVAL_MS;
}

/**
 * Generate progress report for parent agent
 */
function generateProgressReport(event) {
  const uptime = Math.floor((Date.now() - sessionStartTime) / 1000 / 60); // minutes
  const data = event?.data || {};
  
  const report = {
    timestamp: new Date().toISOString(),
    uptime: `${uptime} minutes`,
    status: {
      health: `${data.health || 0}/20`,
      food: `${data.food || 0}/20`,
      position: data.position,
      isDay: data.isDay
    },
    stats: {
      commandsSent: stats.commandsSent,
      foodGathered: stats.foodGathered,
      resourcesMined: stats.resourcesMined,
      sheltersBuilt: stats.sheltersBuilt,
      deaths: stats.deaths
    },
    inventory: data.inventory ? data.inventory.length : 0,
    currentGoal: data.currentGoal || 'idle'
  };
  
  return report;
}

/**
 * Main control loop
 */
async function main() {
  console.log('🤖 Autonomous Minecraft Controller Started');
  console.log(`   Events: ${EVENTS_FILE}`);
  console.log(`   Commands: ${COMMANDS_FILE}`);
  console.log(`   Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`   Check-in interval: ${CHECKIN_INTERVAL_MS}ms`);
  console.log('');
  
  // Main loop
  while (true) {
    const event = readLatestEvent();
    
    if (event) {
      // Decide next action
      const commands = decideAction(event);
      
      if (commands) {
        sendCommands(commands);
      }
      
      // Check if we should report to parent
      if (shouldCheckIn()) {
        const report = generateProgressReport(event);
        console.log('\n📊 PROGRESS REPORT:');
        console.log(JSON.stringify(report, null, 2));
        console.log('');
        
        // In a real OpenClaw subagent, you'd use sessions_send here:
        // await sessions_send({
        //   sessionKey: parentSessionKey,
        //   message: `Minecraft Bot Progress:\n${JSON.stringify(report, null, 2)}`
        // });
        
        lastCheckIn = Date.now();
      }
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

// Handle errors gracefully
process.on('uncaughtException', (err) => {
  console.error('💥 Fatal error:', err.message);
  process.exit(1);
});

// Run
main().catch(err => {
  console.error('💥 Controller crashed:', err);
  process.exit(1);
});
