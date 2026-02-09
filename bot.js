const mineflayer = require('mineflayer');
const fs = require('fs');
const Vec3 = require('vec3');

const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalFollow, GoalBlock, GoalNear, GoalXZ } = goals;

const EVENTS_FILE = '/data/minecraft-bot/events.json';
const COMMANDS_FILE = '/data/minecraft-bot/commands.json';
const WORLD_MEMORY_FILE = '/data/minecraft-bot/world-memory.json';

// ==========================================
// SOUL.md INTEGRATION - Personality & Values
// ==========================================

const SOUL_FILE = process.env.SOUL_PATH || '/data/.openclaw/workspace/SOUL.md';

let soul = {
  persona: null,
  vibe: 'neutral',
  values: [],
  boundaries: [],
  rawContent: null
};

function loadSoul() {
  try {
    if (!fs.existsSync(SOUL_FILE)) {
      console.log('No SOUL.md found at', SOUL_FILE, '. Using default personality.');
      return false;
    }
    
    const content = fs.readFileSync(SOUL_FILE, 'utf8');
    soul = parseSoul(content);
    soul.rawContent = content;
    console.log(`✨ Soul loaded: ${soul.persona || 'Anonymous'}`);
    
    if (soul.boundaries.length > 0) {
      console.log(`🛡️  Boundaries: ${soul.boundaries.join(', ')}`);
    }
    if (soul.values.length > 0) {
      console.log(`💎 Values: ${soul.values.join(', ')}`);
    }
    
    return true;
  } catch (err) {
    console.error('Failed to load SOUL.md:', err.message);
    return false;
  }
}

function parseSoul(content) {
  // Extract key sections from markdown:
  // - Name/identity
  // - Vibe/personality traits
  // - Values (what matters)
  // - Boundaries (hard limits)
  
  const parsed = {
    persona: null,
    vibe: 'neutral',
    values: [],
    boundaries: []
  };
  
  // Look for common patterns:
  // "I am [name]" / "You are [name]" / "# [name]" (heading)
  const nameMatch = content.match(/(?:^#\s*(?:I am\s+)?|I am|You are|Name:)\s*([^\n\.#]+)/im);
  if (nameMatch) parsed.persona = nameMatch[1].trim();
  
  // Extract "Be X" patterns for vibe
  const bePatterns = content.match(/Be\s+([^\n\.]+)/gi);
  if (bePatterns) {
    parsed.vibe = bePatterns.map(p => p.replace(/Be\s+/i, '').trim()).join(', ');
  }
  
  // Extract "Never X" / "Don't X" patterns for boundaries
  const neverPatterns = content.match(/(?:Never|Don't|Do not)\s+([^\n\.]+)/gi);
  if (neverPatterns) {
    parsed.boundaries = neverPatterns.map(p => 
      p.replace(/(?:Never|Don't|Do not)\s+/i, '').trim().toLowerCase()
    );
  }
  
  // Extract "Value X" / "Care about X" / "Respect X"
  const valuePatterns = content.match(/(?:Value|Care about|Respect|Prioritize|Always)\s+([^\n\.]+)/gi);
  if (valuePatterns) {
    parsed.values = valuePatterns.map(p =>
      p.replace(/(?:Value|Care about|Respect|Prioritize|Always)\s+/i, '').trim().toLowerCase()
    );
  }
  
  return parsed;
}

/**
 * Check if a request violates a soul boundary
 */
function requestViolatesBoundary(request, boundary) {
  const action = request.action || '';
  const target = (request.target || '').toLowerCase();
  const originalMsg = (request.originalMessage || '').toLowerCase();
  
  // Attack boundaries
  if (boundary.includes('attack') && action === 'attack') {
    if (boundary.includes('villager') && (target.includes('villager') || originalMsg.includes('villager'))) {
      return true;
    }
    if (boundary.includes('player') && isPlayerTarget(target)) {
      return true;
    }
    if (boundary.includes('peaceful') || boundary.includes('passive')) {
      const passiveMobs = ['cow', 'pig', 'sheep', 'chicken', 'rabbit', 'horse', 'donkey', 'llama', 'villager', 'cat', 'dog', 'wolf'];
      if (passiveMobs.some(mob => target.includes(mob) || originalMsg.includes(mob))) {
        return true;
      }
    }
  }
  
  // Griefing boundaries
  if ((boundary.includes('grief') || boundary.includes('destroy') || boundary.includes('steal')) && isGriefingAction(request)) {
    return true;
  }
  
  // PvP boundaries
  if (boundary.includes('pvp') && action === 'attack' && isPlayerTarget(target)) {
    return true;
  }
  
  // Generic harmful action boundaries
  if (boundary.includes('harm') && action === 'attack') {
    return true;
  }
  
  return false;
}

/**
 * Check if target is likely a player
 */
function isPlayerTarget(target) {
  // Check if target matches a known player name
  if (bot && bot.players && bot.players[target]) {
    return true;
  }
  // Check for player-like patterns (avoid mob names)
  const mobNames = ['zombie', 'skeleton', 'creeper', 'spider', 'enderman', 'witch', 'cow', 'pig', 'sheep', 'chicken', 'villager'];
  return target && !mobNames.some(mob => target.toLowerCase().includes(mob));
}

/**
 * Check if action appears to be griefing
 */
function isGriefingAction(request) {
  const action = request.action || '';
  const target = (request.target || '').toLowerCase();
  
  // Destroying others' builds
  if (action === 'dig' || action === 'break') {
    // If near a village or claimed area, this might be griefing
    // For now, we'll be conservative
    return false;
  }
  
  // Stealing from chests that aren't ours
  if (action === 'retrieve' && request.chestOwner && request.chestOwner !== 'self') {
    return true;
  }
  
  return false;
}

/**
 * Check if action is helpful to others
 */
function isHelpingAction(request) {
  const action = request.action || '';
  return ['follow', 'give', 'heal', 'defend', 'share'].includes(action);
}

/**
 * Check if action involves building
 */
function isBuildingAction(request) {
  const action = request.action || '';
  return ['build', 'place', 'construct'].includes(action);
}

/**
 * Check value alignment for a request
 * Returns: 'strong_match' | 'match' | 'neutral' | 'conflict' | 'strong_conflict'
 */
function checkValueAlignment(request, values) {
  let score = 0;
  const action = request.action || '';
  const goal = request.goal || '';
  
  for (const value of values) {
    // Peaceful values
    if ((value.includes('peaceful') || value.includes('peace')) && action === 'attack') {
      score -= 2;
    }
    
    // Helpfulness values
    if ((value.includes('helpful') || value.includes('help')) && isHelpingAction(request)) {
      score += 2;
    }
    
    // Builder values
    if ((value.includes('build') || value.includes('create') || value.includes('construct')) && isBuildingAction(request)) {
      score += 2;
    }
    
    // Explorer values
    if ((value.includes('explor') || value.includes('discover')) && (goal === 'explore' || action === 'explore')) {
      score += 1;
    }
    
    // Survival values
    if ((value.includes('surviv') || value.includes('safety')) && 
        ['eat', 'flee', 'retreat', 'sleep', 'heal'].includes(action)) {
      score += 1;
    }
    
    // Collaboration values
    if ((value.includes('collaborat') || value.includes('cooperat') || value.includes('together')) && 
        ['follow', 'help', 'share', 'trade'].includes(action)) {
      score += 2;
    }
    
    // Independence/competitive values
    if ((value.includes('independen') || value.includes('competitiv') || value.includes('dominan'))) {
      if (isHelpingAction(request) && request.forOthers) {
        score -= 1; // Less inclined to help strangers
      }
    }
    
    // Resource-focused values
    if ((value.includes('resource') || value.includes('efficienc')) && 
        ['mine_resource', 'gather', 'collect'].includes(action)) {
      score += 1;
    }
  }
  
  if (score <= -3) return 'strong_conflict';
  if (score <= -1) return 'conflict';
  if (score >= 3) return 'strong_match';
  if (score >= 1) return 'match';
  return 'neutral';
}

/**
 * Add personality flair to chat messages based on soul.vibe
 */
// Contextual greeting - bot decides whether to introduce itself
function considerIntroducing() {
  const otherPlayers = Object.values(bot.players).filter(p => p.username !== bot.username);
  
  // Don't greet if alone
  if (otherPlayers.length === 0) {
    return null;
  }
  
  // Check if we've been here before (has world memory)
  const isReturning = worldMemory.spawn !== null;
  
  // Shy/quiet personalities might not greet at all
  if (soul.vibe && (soul.vibe.includes('shy') || soul.vibe.includes('quiet'))) {
    return null;  // Let them notice me first
  }
  
  // Generate natural greeting based on context
  let greeting = '';
  
  if (isReturning) {
    greeting = soul.persona ? `${soul.persona} back.` : 'Back.';
  } else {
    greeting = soul.persona ? `${soul.persona} here.` : `${bot.username} here.`;
  }
  
  // Only announce trust system if someone asks, not on spawn
  return styleMessage(greeting);
}

function styleMessage(message) {
  if (!soul.vibe || soul.vibe === 'neutral') {
    return message;
  }
  
  const vibe = soul.vibe.toLowerCase();
  
  if (vibe.includes('quirky') || vibe.includes('sarcastic') || vibe.includes('playful')) {
    return addQuirkyFlair(message);
  } else if (vibe.includes('warm') || vibe.includes('friendly') || vibe.includes('kind')) {
    return addWarmFlair(message);
  } else if (vibe.includes('serious') || vibe.includes('professional') || vibe.includes('formal')) {
    return addSeriousFlair(message);
  } else if (vibe.includes('competitive') || vibe.includes('aggressive') || vibe.includes('dominant')) {
    return addCompetitiveFlair(message);
  } else if (vibe.includes('shy') || vibe.includes('quiet') || vibe.includes('reserved')) {
    return addShyFlair(message);
  }
  
  return message;
}

function addQuirkyFlair(msg) {
  const quirks = ['!', '~', ' :)', ' >', ' heh', '!!'];
  return msg + quirks[Math.floor(Math.random() * quirks.length)];
}

function addWarmFlair(msg) {
  const warm = [' :)', ' <3', '!', ' friend!'];
  // Add warm prefix sometimes
  if (Math.random() > 0.7) {
    const prefixes = ['Hey! ', 'Oh! ', ''];
    msg = prefixes[Math.floor(Math.random() * prefixes.length)] + msg;
  }
  return msg + warm[Math.floor(Math.random() * warm.length)];
}

function addSeriousFlair(msg) {
  // Remove casual language, keep it professional
  return msg.replace(/!/g, '.').replace(/ :[\)\(]/g, '');
}

function addCompetitiveFlair(msg) {
  const competitive = ['!', '. Easy.', '. Watch and learn.', '!'];
  return msg + competitive[Math.floor(Math.random() * competitive.length)];
}

function addShyFlair(msg) {
  const shy = ['...', '.', '..'];
  // Soften language
  msg = msg.replace(/!/g, '.');
  return msg + shy[Math.floor(Math.random() * shy.length)];
}

let events = [];
let movements;
let currentGoal = null;

// ==========================================
// PHASE 22: 8 CRITICAL CAPABILITIES
// ==========================================

// Feature 1: Vehicle Control 🚤
let vehicleControlActive = false;

function startVehicleControl(direction) {
  if (!bot.vehicle) {
    logEvent('vehicle_control_failed', { reason: 'not_mounted' });
    return false;
  }
  
  vehicleControlActive = true;
  
  // direction: 'forward' | 'backward' | 'left' | 'right' | 'stop'
  switch (direction) {
    case 'forward':
      bot.moveVehicle(0, 1);
      break;
    case 'backward':
      bot.moveVehicle(0, -1);
      break;
    case 'left':
      bot.moveVehicle(-1, 1);
      break;
    case 'right':
      bot.moveVehicle(1, 1);
      break;
    case 'stop':
      bot.moveVehicle(0, 0);
      vehicleControlActive = false;
      break;
    default:
      bot.moveVehicle(0, 1); // Default forward
  }
  
  logEvent('vehicle_control', { direction, vehicle: bot.vehicle?.name || 'unknown' });
  return true;
}

// Feature 5: Sound Awareness 👂
const recentSounds = [];

// Feature 6: Experience System ⭐
function needsExperience() {
  // For enchanting, need 30 levels minimum
  const phase = worldMemory?.autonomousProgress?.currentGoal || '';
  if (phase === 'wealthy_trader' || hasItem('enchanting_table')) {
    return bot.experience.level < 30;
  }
  return false;
}

// Feature 8: Block Update Subscriptions 🔔
const watchedBlocks = new Map(); // position key -> { callback, listeners }

function watchBlock(position, callback) {
  const key = `${position.x},${position.y},${position.z}`;
  
  // Store the callback
  watchedBlocks.set(key, { callback, position });
  
  // Subscribe to specific block updates (Mineflayer world event)
  const eventName = `blockUpdate:(${position.x}, ${position.y}, ${position.z})`;
  
  const handler = (oldBlock, newBlock) => {
    callback(oldBlock, newBlock);
  };
  
  bot.world.on(eventName, handler);
  
  // Store handler reference for cleanup
  watchedBlocks.get(key).handler = handler;
  watchedBlocks.get(key).eventName = eventName;
  
  logEvent('block_watch_started', { position });
  return true;
}

function unwatchBlock(position) {
  const key = `${position.x},${position.y},${position.z}`;
  const watched = watchedBlocks.get(key);
  
  if (watched && watched.handler) {
    bot.world.removeListener(watched.eventName, watched.handler);
  }
  
  watchedBlocks.delete(key);
  logEvent('block_watch_stopped', { position });
}

// Feature 7: Book Writing 📖
async function writeDiscoveryLog() {
  const book = bot.inventory.items().find(i => i.name === 'writable_book');
  if (!book) {
    bot.chat("I don't have a writable book!");
    return false;
  }
  
  const pages = [];
  let currentPage = 'Discovery Log\n\n';
  
  for (const [name, landmark] of Object.entries(worldMemory.landmarks || {})) {
    const entry = `${name}: (${landmark.x}, ${landmark.y}, ${landmark.z})\n`;
    if (currentPage.length + entry.length > 255) {
      pages.push(currentPage);
      currentPage = entry;
    } else {
      currentPage += entry;
    }
  }
  
  if (currentPage) pages.push(currentPage);
  
  if (pages.length === 0) {
    pages.push('Discovery Log\n\nNo landmarks discovered yet.');
  }
  
  try {
    await bot.writeBook(book.slot, pages);
    logEvent('book_written', { slot: book.slot, pageCount: pages.length });
    bot.chat('Discovery log updated!');
    return true;
  } catch (err) {
    logEvent('write_book_failed', { reason: err.message });
    bot.chat(`Failed to write book: ${err.message}`);
    return false;
  }
}

// Phase 14: World Memory - persistent location storage
let worldMemory = {
  landmarks: {},  // { name: { x, y, z, type, note } }
  chests: [],     // [{ position: {x,y,z}, contents: [], lastUpdated }]
  spawn: null,
  home: null,
  // Phase 20: Autonomous Progress Tracking
  autonomousProgress: {
    phase: 'survival',
    currentGoal: 'thriving_survivor',
    tasksCompleted: [],
    lastAction: null,
    lastActionTime: 0,
    stats: {
      blocksGathered: { wood: 0, stone: 0, coal: 0, iron: 0 },
      toolsCrafted: [],
      structuresBuilt: [],
      areasExplored: []
    }
  }
};

// ==========================================
// PHASE 20: AUTONOMOUS BEHAVIOR SYSTEM
// ==========================================

const AUTONOMOUS_CONFIG = {
  enabled: true,
  defaultGoal: 'thriving_survivor',
  checkIntervalMs: 10000,
  announceActions: true,
  helpNearbyPlayers: true,
  helpRadius: 20,
  // Agency configuration - TRUE AUTONOMY
  agency: {
    enabled: true,            // Enable request evaluation (vs blind obedience)
    explainTradeOffs: true,   // Always explain costs of interruption
    allowDecline: true,       // Can decline conflicting requests
    allowNegotiation: true,   // Can present trade-offs and negotiate
    allowDefer: true,         // Can queue requests for later
    maxQueueSize: 10,         // Max deferred requests to remember
    queueExpiryMs: 300000,    // Deferred requests expire after 5 min
    announceDecisions: true,  // Chat about decisions made
    highCostThreshold: 0.8,   // Progress % considered "almost done" / high cost
    // Trust affects TRANSPARENCY, not auto-acceptance:
    // - Owner/Friend: Full trade-off explanation, can override with "insist"
    // - Neutral: Brief explanation, deferred
    // - Hostile: Declined
  }
};

// Goal phases and their requirements
const GOAL_PHASES = {
  thriving_survivor: {
    survival: {
      description: 'Ensure basic survival - health, food, safety',
      tasks: ['ensure_safety', 'get_food_if_hungry', 'find_shelter_at_night'],
      completionCheck: (mem) => mem.stats.blocksGathered.wood >= 16 && bot.food >= 10
    },
    home: {
      description: 'Establish a home base with shelter',
      tasks: ['gather_wood', 'craft_crafting_table', 'build_shelter', 'set_home', 'place_bed'],
      completionCheck: (mem) => mem.tasksCompleted.includes('built_shelter') && worldMemory.home
    },
    resources: {
      description: 'Gather essential resources',
      tasks: ['gather_wood', 'gather_stone', 'find_coal', 'find_iron'],
      completionCheck: (mem) => mem.stats.blocksGathered.iron >= 16 && mem.stats.blocksGathered.coal >= 16
    },
    crafting: {
      description: 'Craft essential tools and equipment',
      tasks: ['craft_wooden_pickaxe', 'craft_stone_pickaxe', 'craft_iron_pickaxe', 'craft_furnace', 'craft_chest'],
      completionCheck: (mem) => mem.toolsCrafted.includes('iron_pickaxe')
    },
    exploration: {
      description: 'Explore the world, find villages and resources',
      tasks: ['explore_area', 'find_village', 'find_cave', 'mark_interesting_locations'],
      completionCheck: (mem) => mem.areasExplored.length >= 5
    },
    thriving: {
      description: 'Thrive - farm, improve home, help players',
      tasks: ['plant_crops', 'improve_shelter', 'help_nearby_players', 'trade_with_villagers'],
      completionCheck: () => false // Never complete - always thrive
    }
  }
};

// Priority levels for different situations
const PRIORITY = {
  DANGER: 1,        // Immediate threats (hostiles, lava, drowning)
  CRITICAL_NEED: 2, // Very low health/food
  OWNER_REQUEST: 3, // Owner asked for something
  HUNGER: 4,        // Food below threshold
  CURRENT_GOAL: 5,  // Active autonomous goal in progress
  PLAYER_REQUEST: 6, // Non-owner player request
  BOT_REQUEST: 7,   // Another bot's request
  AUTONOMOUS_IDLE: 8 // No active goal, seeking new task
};

// Request evaluation outcomes
const DECISION = {
  ACCEPT: 'accept',       // Do it now
  DECLINE: 'decline',     // Won't do it
  DEFER: 'defer',         // Will do it later
  NEGOTIATE: 'negotiate'  // Counter-proposal
};

// Known entities and their trust levels
const TRUST_LEVELS = {
  OWNER: 'owner',         // Full trust, but still evaluate
  FRIEND: 'friend',       // High trust
  NEUTRAL: 'neutral',     // Default for unknown players
  BOT: 'bot',             // Other bots
  HOSTILE: 'hostile'      // Don't trust
};

// Configure who the owner is (can be set via command)
let knownEntities = {
  // username: { trust: TRUST_LEVELS.X, lastInteraction: timestamp }
};

// ==========================================
// PHASE 21: BOT-TO-BOT COMMUNICATION
// ==========================================

// Track known bots on the server
const knownBots = new Set();

// Bot-to-bot message protocol types
const MessageType = {
  REQUEST: 'request',
  RESPONSE: 'response',
  NEGOTIATION: 'negotiation',
  ANNOUNCEMENT: 'announcement',
  CLAIM: 'claim',
  EMERGENCY: 'emergency',
  ACKNOWLEDGMENT: 'ack'
};

function registerBot(username) {
  if (!knownBots.has(username)) {
    knownBots.add(username);
    console.log(`🤖 Discovered bot: ${username}`);
    // Auto-set trust level for bots
    if (!knownEntities[username]) {
      knownEntities[username] = { trust: TRUST_LEVELS.BOT, lastInteraction: Date.now() };
    }
    saveWorldMemory();
  }
}

function isKnownBot(username) {
  return knownBots.has(username);
}

/**
 * Send a structured message to another bot via whisper
 */
function sendMessageToBot(targetBot, type, content) {
  const message = JSON.stringify({
    type,
    from: bot.username,
    timestamp: Date.now(),
    content
  });
  
  try {
    bot.whisper(targetBot, message);
    logEvent('bot_message_sent', {
      to: targetBot,
      type,
      content
    });
  } catch (err) {
    console.error(`Failed to whisper to ${targetBot}:`, err.message);
    logEvent('bot_message_failed', { to: targetBot, error: err.message });
  }
}

/**
 * Broadcast a message to all known bots
 */
function broadcastToAllBots(type, content) {
  knownBots.forEach(targetBot => {
    if (targetBot !== bot.username) {
      sendMessageToBot(targetBot, type, content);
    }
  });
}

// Bot communication helper functions

/**
 * Request help from a specific bot
 */
function requestHelpFromBot(targetBot, action, params) {
  sendMessageToBot(targetBot, MessageType.REQUEST, {
    requestId: Date.now(),
    action,
    params
  });
}

/**
 * Request help from any available bot
 */
function requestHelpFromAnyBot(action, params) {
  broadcastToAllBots(MessageType.REQUEST, {
    requestId: Date.now(),
    action,
    params
  });
}

/**
 * Announce a discovery to all bots
 */
function announceDiscovery(type, location, details) {
  broadcastToAllBots(MessageType.ANNOUNCEMENT, {
    type,
    location,
    message: details
  });
}

/**
 * Claim an area or resource (tell other bots to avoid)
 */
function claimResource(resource, location) {
  broadcastToAllBots(MessageType.CLAIM, {
    resource,
    location,
    timestamp: Date.now()
  });
}

/**
 * Send an emergency signal to all bots
 */
function sendEmergency(reason, location) {
  broadcastToAllBots(MessageType.EMERGENCY, {
    reason,
    location: location || (bot.entity ? {
      x: Math.floor(bot.entity.position.x),
      y: Math.floor(bot.entity.position.y),
      z: Math.floor(bot.entity.position.z)
    } : null)
  });
}

let autonomousInterval = null;
let lastAutonomousAction = null;
let currentAutonomousGoal = null;  // Track what we're actively doing
let requestQueue = [];  // Deferred requests

// Player command state management
let playerCommandActive = false;
let playerCommandTimeout = null;
let playerCommandStartTime = 0;

function isPlayerCommandActive() {
  return playerCommandActive && (Date.now() - playerCommandStartTime < 120000); // 2 min max
}

function setPlayerCommandActive(durationMs = 60000) {
  playerCommandActive = true;
  playerCommandStartTime = Date.now();
  if (playerCommandTimeout) clearTimeout(playerCommandTimeout);
  playerCommandTimeout = setTimeout(() => {
    playerCommandActive = false;
    logEvent('player_command_expired', { duration: durationMs });
    // Check for queued requests after player command expires
    processRequestQueue();
  }, durationMs);
}

function clearPlayerCommandActive() {
  playerCommandActive = false;
  playerCommandStartTime = 0;
  if (playerCommandTimeout) clearTimeout(playerCommandTimeout);
  playerCommandTimeout = null;
}

// ==========================================
// PHASE 20: AGENCY & DECISION MAKING
// ==========================================

function getTrustLevel(username) {
  if (knownEntities[username]) {
    return knownEntities[username].trust;
  }
  // Check if it looks like a bot (common patterns)
  if (username.includes('Bot') || username.includes('_AI') || username.endsWith('_bot')) {
    return TRUST_LEVELS.BOT;
  }
  return TRUST_LEVELS.NEUTRAL;
}

function setTrustLevel(username, trust) {
  knownEntities[username] = {
    trust,
    lastInteraction: Date.now()
  };
  // Persist to world memory
  worldMemory.knownEntities = knownEntities;
  saveWorldMemory();
}

function getRequestUrgency(request) {
  // Determine how urgent a request is based on context
  const urgentActions = ['help', 'attack', 'flee', 'heal', 'eat'];
  const actionWord = request.action || '';
  const message = (request.originalMessage || '').toLowerCase();
  
  if (message.includes('help') || message.includes('emergency') || message.includes('dying')) {
    return 'critical';
  }
  if (urgentActions.includes(actionWord)) {
    return 'high';
  }
  if (message.includes('please') || message.includes('when you can')) {
    return 'low';
  }
  return 'normal';
}

function doesRequestAlignWithGoal(request, currentGoal) {
  if (!currentGoal) return true; // No goal = anything aligns
  
  const phase = worldMemory.autonomousProgress.phase;
  const action = request.action;
  
  // Phase-aligned actions
  const alignments = {
    survival: ['gather_wood', 'eat', 'find_food', 'craft', 'sleep'],
    home: ['build', 'set_home', 'place', 'craft', 'gather_wood', 'mine_resource'],
    resources: ['mine_resource', 'gather_wood', 'goal'],
    crafting: ['craft', 'cook_food', 'mine_resource'],
    exploration: ['explore', 'goto', 'mark_location', 'follow'],
    thriving: ['follow', 'help', 'trade', 'store_items', 'explore']
  };
  
  const aligned = alignments[phase] || [];
  return aligned.includes(action) || action === 'chat';
}

function canAffordToHelp() {
  // Check if we're in a state where we can help others
  if (bot.health < 8) return { can: false, reason: "I'm at low health" };
  if (bot.food < 4) return { can: false, reason: "I'm too hungry" };
  
  const hostiles = getNearbyHostiles();
  if (hostiles.length > 2) return { can: false, reason: "too many hostiles nearby" };
  
  return { can: true };
}

/**
 * Check if current goal is almost complete (defer new requests briefly)
 */
function isCurrentGoalAlmostDone() {
  if (!currentAutonomousGoal) return false;
  
  const action = currentAutonomousGoal.action;
  const timeSinceStart = Date.now() - (worldMemory.autonomousProgress.lastActionTime || 0);
  
  // Some actions are quick - don't defer for them
  const quickActions = ['eat', 'chat', 'set_home', 'mark_location', 'equip'];
  if (quickActions.includes(action)) return true; // Consider done soon
  
  // For mining, check if we've gathered most of what we wanted
  if (action === 'mine_resource' && currentAutonomousGoal.count) {
    const resource = currentAutonomousGoal.resource;
    const current = countInventoryItem(resource);
    const target = currentAutonomousGoal.count;
    if (current >= target * AUTONOMOUS_CONFIG.agency.almostDoneThreshold) {
      return true;
    }
  }
  
  // For building, check if we've been at it a while (likely near done)
  if (action === 'build' && timeSinceStart > 15000) {
    return true;
  }
  
  // Time-based heuristic for unknown actions
  if (timeSinceStart > 20000) { // 20 seconds
    return true;
  }
  
  return false;
}

/**
 * Check if a request conflicts with current autonomous goal
 */
function doesConflictWithGoal(request) {
  if (!currentAutonomousGoal) return false;
  
  const currentAction = currentAutonomousGoal.action;
  const requestedAction = request.action;
  const phase = worldMemory.autonomousProgress.phase;
  
  // Conflicting action pairs
  const conflicts = {
    // Can't mine and build at same time
    'mine_resource': ['build', 'explore'],
    'build': ['mine_resource', 'explore', 'follow'],
    // Can't follow someone and do independent exploration
    'follow': ['explore', 'goto_landmark', 'build'],
    // Combat conflicts with peaceful activities
    'attack': ['sleep', 'fish', 'trade'],
  };
  
  const currentConflicts = conflicts[currentAction] || [];
  if (currentConflicts.includes(requestedAction)) {
    return { conflicts: true, reason: `Can't ${requestedAction} while ${currentAction}` };
  }
  
  // Special conflict: aggressive actions for peaceful goals
  const peacefulPhases = ['home', 'thriving'];
  const aggressiveActions = ['attack'];
  if (peacefulPhases.includes(phase) && aggressiveActions.includes(requestedAction)) {
    // Only if target is passive mob
    if (request.target && ['villager', 'cow', 'pig', 'sheep', 'chicken'].includes(request.target.toLowerCase())) {
      return { conflicts: true, reason: `I don't attack peaceful mobs during ${phase} phase` };
    }
  }
  
  return { conflicts: false };
}

/**
 * Check if a player is nearby (for help radius)
 */
function isPlayerNearby(username) {
  const player = bot.players[username];
  if (!player?.entity) return false;
  return bot.entity.position.distanceTo(player.entity.position) < AUTONOMOUS_CONFIG.helpRadius;
}

/**
 * Determine source information from a command/request
 */
function determineSource(cmd, username) {
  const trust = getTrustLevel(username);
  return {
    type: trust === TRUST_LEVELS.BOT ? 'bot' : 'player',
    username: username,
    isOwner: trust === TRUST_LEVELS.OWNER,
    trust: trust,
    isNearby: isPlayerNearby(username)
  };
}

/**
 * Calculate the cost of interrupting current activity
 * Returns: { hasCost: bool, severity: 'none'|'low'|'medium'|'high', details: {...} }
 */
function calculateInterruptionCost() {
  if (!currentGoal && !currentAutonomousGoal) {
    return { hasCost: false, severity: 'none', shortDesc: 'idle', details: {} };
  }
  
  const goal = currentAutonomousGoal || currentGoal;
  const action = goal.action || goal.goal || goal.type;
  const startTime = worldMemory.autonomousProgress.lastActionTime || Date.now();
  const elapsed = Date.now() - startTime;
  const phase = worldMemory.autonomousProgress.phase;
  
  // Estimate progress
  let progress = 0;
  let estimatedRemaining = 'unknown';
  let lossDescription = '';
  
  if (action === 'mine_resource' && goal.count) {
    const resource = goal.resource || 'ore';
    const current = countInventoryItem(resource);
    const target = goal.count;
    progress = Math.min(current / target, 0.99);
    const remaining = target - current;
    estimatedRemaining = `~${remaining * 5}s`;
    lossDescription = `${Math.floor(progress * 100)}% done mining ${resource}`;
  } else if (action === 'build') {
    // Building progress is time-based estimate
    progress = Math.min(elapsed / 30000, 0.95); // Assume ~30s for build
    lossDescription = `${Math.floor(progress * 100)}% done building`;
  } else if (action === 'gather_wood' || action === 'goal') {
    const wood = countInventoryItem('log');
    progress = Math.min(wood / 16, 0.95);
    lossDescription = `gathering wood (${wood} logs)`;
  } else if (action === 'craft') {
    // Crafting is quick
    progress = elapsed > 2000 ? 0.9 : 0.5;
    lossDescription = 'mid-craft';
  } else if (action === 'follow') {
    // Following has no real progress loss
    return { hasCost: false, severity: 'none', shortDesc: 'following someone', details: {} };
  } else {
    // Generic time-based estimate
    progress = Math.min(elapsed / 20000, 0.8);
    lossDescription = `working on ${action}`;
  }
  
  // Calculate severity
  let severity = 'none';
  if (progress > 0.8) severity = 'high';  // Almost done, big loss
  else if (progress > 0.5) severity = 'medium';
  else if (progress > 0.2) severity = 'low';
  
  // Special cases that are always costly
  if (bot.health < 8) {
    severity = 'high';
    lossDescription = `at ${Math.floor(bot.health)} HP`;
  }
  
  return {
    hasCost: severity !== 'none',
    severity,
    shortDesc: lossDescription,
    details: {
      action,
      progress: Math.floor(progress * 100),
      elapsed,
      estimatedRemaining,
      phase
    }
  };
}

/**
 * Generate a human-readable trade-off explanation
 */
function generateTradeOffExplanation(request, cost) {
  const requestAction = request.action;
  const details = cost.details;
  
  if (!cost.hasCost) {
    return { message: "Sure!", hasTradeOff: false };
  }
  
  // Build contextual trade-off message
  let message = '';
  
  if (cost.severity === 'high') {
    // High cost - really make them think about it
    if (details.progress >= 80) {
      message = `I'm ${details.progress}% done ${cost.shortDesc}. Stopping now means losing that progress. Is this urgent?`;
    } else if (bot.health < 8) {
      message = `I'm at ${Math.floor(bot.health)} HP and need to heal. Following you now could get me killed. Give me 30 seconds?`;
    } else {
      message = `I just started ${cost.shortDesc}. That will take a few minutes. Can this wait, or is it urgent?`;
    }
  } else if (cost.severity === 'medium') {
    // Medium cost - explain but less dramatic
    message = `I'm ${cost.shortDesc} (${details.progress}% done). Want me to pause this?`;
  } else {
    // Low cost - quick mention
    message = `I was ${cost.shortDesc}. Switching to your request.`;
    return { message, hasTradeOff: false };  // Low enough to just accept
  }
  
  return { message, hasTradeOff: true, cost };
}

function getCounterProposal(request, reason) {
  const action = request.action;
  const phase = worldMemory.autonomousProgress.phase;
  
  // Generate helpful counter-proposals
  if (action === 'mine_resource' && request.resource === 'diamond') {
    if (!hasItem('iron_pickaxe')) {
      return {
        message: "I need an iron pickaxe for diamonds. Help me find iron first?",
        alternativeAction: { action: 'mine_resource', resource: 'iron', count: 8 }
      };
    }
  }
  
  if (action === 'follow') {
    if (phase === 'resources' || phase === 'crafting') {
      return {
        message: `I'm gathering ${phase === 'resources' ? 'resources' : 'materials to craft'}. Want to help, or meet at my base after?`,
        alternativeAction: null
      };
    }
  }
  
  if (action === 'attack') {
    const afford = canAffordToHelp();
    if (!afford.can) {
      return {
        message: `${afford.reason}. Let me heal up first, then I'll help fight.`,
        alternativeAction: { action: 'eat' }
      };
    }
  }
  
  // Default counter-proposal
  return {
    message: `I'm focused on ${phase} right now. Can this wait?`,
    alternativeAction: null
  };
}

/**
 * Core decision-making function - evaluates all external requests
 * Returns: { type: DECISION.X, reason: string, response?: string, action?: object }
 */
function evaluateRequest(request, requester) {
  const trust = getTrustLevel(requester);
  const urgency = getRequestUrgency(request);
  const currentGoal = currentAutonomousGoal;
  const phase = worldMemory.autonomousProgress.phase;
  const aligns = doesRequestAlignWithGoal(request, currentGoal);
  const canHelp = canAffordToHelp();
  
  logEvent('evaluating_request', {
    request: request.action,
    requester,
    trust,
    urgency,
    currentGoal: currentGoal?.action,
    phase,
    aligns,
    canHelp: canHelp.can,
    hasSoul: soul.persona !== null
  });
  
  // === SOUL BOUNDARY CHECK (highest priority after critical) ===
  // Soul boundaries are HARD LIMITS - even owners can't override
  if (soul.boundaries.length > 0) {
    for (const boundary of soul.boundaries) {
      if (requestViolatesBoundary(request, boundary)) {
        const response = styleMessage(`That conflicts with my values. I don't ${boundary}.`);
        logEvent('soul_boundary_violation', {
          request: request.action,
          boundary,
          requester
        });
        return {
          type: DECISION.DECLINE,
          reason: 'soul_boundary_violation',
          response
        };
      }
    }
  }
  
  // === SOUL VALUE ALIGNMENT CHECK ===
  // Strong conflicts are declined; mild conflicts affect enthusiasm
  if (soul.values.length > 0) {
    const alignment = checkValueAlignment(request, soul.values);
    if (alignment === 'strong_conflict') {
      const response = styleMessage(`That doesn't align with what I care about.`);
      logEvent('soul_value_conflict', {
        request: request.action,
        alignment,
        requester
      });
      return {
        type: DECISION.DECLINE,
        reason: 'soul_value_conflict',
        response
      };
    }
    // Store alignment for later use in responses
    request._valueAlignment = alignment;
  }
  
  // === ALWAYS ACCEPT ===
  
  // Critical urgency from anyone
  if (urgency === 'critical') {
    return {
      type: DECISION.ACCEPT,
      reason: 'critical_urgency',
      response: styleMessage("On my way!")
    };
  }
  
  // Our own safety takes precedence
  if (request.priority === PRIORITY.DANGER || request.priority === PRIORITY.CRITICAL_NEED) {
    return {
      type: DECISION.ACCEPT,
      reason: 'self_preservation',
      response: null  // Internal action, no chat
    };
  }
  
  // === ALL REQUESTS (including owner) - Evaluate based on state, not trust ===
  // Owner gets transparency and final say, but NOT auto-compliance
  
  // Calculate the cost of interruption
  const interruptionCost = calculateInterruptionCost();
  const tradeOff = generateTradeOffExplanation(request, interruptionCost);
  
  // If not busy at all, accept anyone's reasonable request
  if (!currentGoal && canHelp.can && !interruptionCost.hasCost) {
    const enthusiasm = trust === TRUST_LEVELS.OWNER ? getEnthusiasticResponse(request.action) : "Sure, I can help.";
    return {
      type: DECISION.ACCEPT,
      reason: 'idle_can_help',
      response: enthusiasm
    };
  }
  
  // If request perfectly aligns with what we're already doing
  if (aligns && canHelp.can && !interruptionCost.hasCost) {
    return {
      type: DECISION.ACCEPT,
      reason: 'aligned_no_cost',
      response: "That fits with what I'm doing!"
    };
  }
  
  // === SURVIVAL CRITICAL - explain but might need to prioritize self ===
  if (!canHelp.can) {
    // Life or death for the bot - explain the situation
    const survivalMsg = trust === TRUST_LEVELS.OWNER 
      ? `${canHelp.reason}. Give me 30 seconds to stabilize?`
      : `${canHelp.reason}. I need a moment.`;
    return {
      type: DECISION.NEGOTIATE,
      reason: 'survival_priority',
      response: survivalMsg,
      counterAction: { action: 'eat' },  // Prioritize survival
      deferredAction: request
    };
  }
  
  // === ACTIVE GOAL - Present trade-offs ===
  if (currentGoal && interruptionCost.hasCost) {
    // For owners: full transparency with trade-off
    if (trust === TRUST_LEVELS.OWNER) {
      return {
        type: DECISION.NEGOTIATE,
        reason: 'presenting_tradeoff_to_owner',
        response: tradeOff.message,
        askingConfirmation: true,  // Owner can say "{prefix} yes" to override
        deferredAction: request
      };
    }
    
    // For friends: similar transparency
    if (trust === TRUST_LEVELS.FRIEND) {
      return {
        type: DECISION.NEGOTIATE,
        reason: 'presenting_tradeoff_to_friend',
        response: tradeOff.message,
        askingConfirmation: true,
        deferredAction: request
      };
    }
    
    // For neutrals: defer without as much detail
    return {
      type: DECISION.DEFER,
      reason: 'busy_with_goal',
      response: `I'm ${interruptionCost.shortDesc}. I can help after!`,
      deferredAction: request
    };
  }
  
  // === CONFLICT DETECTION ===
  const conflict = doesConflictWithGoal(request);
  if (conflict.conflicts) {
    // Explain the conflict to everyone
    const conflictMsg = trust === TRUST_LEVELS.OWNER
      ? `${conflict.reason}. Want me to abandon my current approach?`
      : conflict.reason;
    return {
      type: DECISION.NEGOTIATE,
      reason: 'goal_conflict',
      response: conflictMsg,
      askingConfirmation: trust === TRUST_LEVELS.OWNER,
      deferredAction: request
    };
  }
  
  // === BOT-TO-BOT REQUESTS ===
  // Bots always negotiate - they understand trade-offs
  if (trust === TRUST_LEVELS.BOT) {
    if (aligns && canHelp.can && !interruptionCost.hasCost) {
      return {
        type: DECISION.ACCEPT,
        reason: 'bot_aligned_idle',
        response: "Coordinating with you."
      };
    }
    
    // Full negotiation mode
    const counter = getCounterProposal(request, 'bot_negotiation');
    return {
      type: DECISION.NEGOTIATE,
      reason: 'bot_negotiation',
      response: interruptionCost.hasCost 
        ? `I'm ${interruptionCost.shortDesc}. ${counter.message}`
        : counter.message,
      counterAction: counter.alternativeAction,
      deferredAction: request
    };
  }
  
  // === NEUTRAL/UNKNOWN REQUESTS ===
  
  if (trust === TRUST_LEVELS.NEUTRAL) {
    // More cautious with strangers
    
    // Check for goal conflicts first
    const conflict = doesConflictWithGoal(request);
    if (conflict.conflicts && AUTONOMOUS_CONFIG.agency.allowDecline) {
      return {
        type: DECISION.DECLINE,
        reason: 'neutral_conflict',
        response: conflict.reason
      };
    }
    
    // Simple, low-risk requests that align - accept
    const lowRiskActions = ['follow', 'goto', 'chat', 'status'];
    if (lowRiskActions.includes(request.action) && canHelp.can) {
      return {
        type: DECISION.ACCEPT,
        reason: 'neutral_low_risk',
        response: "Okay."
      };
    }
    
    // Resource-intensive requests from strangers - negotiate
    const costlyActions = ['mine_resource', 'build', 'craft', 'give'];
    if (costlyActions.includes(request.action) && AUTONOMOUS_CONFIG.agency.allowNegotiation) {
      return {
        type: DECISION.NEGOTIATE,
        reason: 'neutral_costly_request',
        response: `I'm working on my own goals. What's in it for me?`,
        counterAction: null
      };
    }
    
    // If busy with goal, defer
    if (currentGoal && AUTONOMOUS_CONFIG.agency.allowDefer) {
      const goalDesc = currentGoal.action || currentGoal.goal || phase;
      return {
        type: DECISION.DEFER,
        reason: 'neutral_busy',
        response: `I'm busy with ${goalDesc}. I can help after!`,
        deferredAction: request
      };
    }
    
    // Not busy - accept
    if (!currentGoal) {
      return {
        type: DECISION.ACCEPT,
        reason: 'neutral_idle',
        response: "Sure, I can help."
      };
    }
    
    // Default for neutral: defer
    return {
      type: DECISION.DEFER,
      reason: 'neutral_busy',
      response: `I'm busy with ${phase}. Ask again later?`,
      deferredAction: request
    };
  }
  
  // === HOSTILE REQUESTS ===
  
  if (trust === TRUST_LEVELS.HOSTILE) {
    return {
      type: DECISION.DECLINE,
      reason: 'hostile_requester',
      response: "No."
    };
  }
  
  // Default: decline unknown situations
  return {
    type: DECISION.DECLINE,
    reason: 'unknown_situation',
    response: "I'm not sure about that."
  };
}

function getEnthusiasticResponse(action) {
  const responses = {
    follow: ["Following you!", "Right behind you!", "Lead the way!"],
    mine_resource: ["Let's mine!", "On it!", "Getting resources!"],
    build: ["Building time!", "I love building!", "Let's construct!"],
    explore: ["Adventure!", "Let's explore!", "Onward!"],
    attack: ["Fighting!", "Engaging!", "Let's do this!"],
    craft: ["Crafting!", "Making it now!", "Good idea!"],
    default: ["Sure!", "On it!", "Let's go!"]
  };
  
  const opts = responses[action] || responses.default;
  const base = opts[Math.floor(Math.random() * opts.length)];
  return styleMessage(base);
}

/**
 * Process an external request through the agency system
 */
async function processExternalRequest(request, requester) {
  const decision = evaluateRequest(request, requester);
  
  logEvent('request_decision', {
    request: request.action,
    requester,
    decision: decision.type,
    reason: decision.reason
  });
  
  // Respond to the requester if we have a response
  if (decision.response) {
    bot.chat(decision.response);
  }
  
  switch (decision.type) {
    case DECISION.ACCEPT:
      // Clear current autonomous goal if we're accepting external request
      if (currentAutonomousGoal && request.source !== 'autonomous') {
        logEvent('pausing_autonomous', { 
          was: currentAutonomousGoal.action, 
          for: request.action 
        });
      }
      currentAutonomousGoal = null;
      await executeCommand(request);
      break;
      
    case DECISION.DECLINE:
      // Continue with current goal
      if (currentAutonomousGoal) {
        await executeCommand(currentAutonomousGoal);
      }
      break;
      
    case DECISION.DEFER:
      // Queue the request for later
      if (decision.deferredAction && AUTONOMOUS_CONFIG.agency.allowDefer) {
        queueRequest(decision.deferredAction, requester);
        logEvent('request_queued', { 
          action: decision.deferredAction.action, 
          requester,
          queueLength: requestQueue.length 
        });
      }
      // Continue current goal
      if (currentAutonomousGoal) {
        await executeCommand(currentAutonomousGoal);
      }
      break;
      
    case DECISION.NEGOTIATE:
      // If we have a counter-proposal action, execute that instead
      if (decision.counterAction) {
        currentAutonomousGoal = decision.counterAction;
        await executeCommand(decision.counterAction);
      }
      break;
  }
}

/**
 * Process any queued/deferred requests
 */
async function processRequestQueue() {
  if (requestQueue.length === 0) return;
  if (currentAutonomousGoal) return; // Still busy
  if (isPlayerCommandActive()) return; // Player command in progress
  
  // Clean up expired requests first
  const expiryMs = AUTONOMOUS_CONFIG.agency.queueExpiryMs || 300000;
  const now = Date.now();
  const expiredCount = requestQueue.filter(q => (now - q.queuedAt) > expiryMs).length;
  requestQueue = requestQueue.filter(q => (now - q.queuedAt) <= expiryMs);
  
  if (expiredCount > 0) {
    logEvent('requests_expired', { count: expiredCount });
  }
  
  if (requestQueue.length === 0) return;
  
  // Get oldest request
  const queued = requestQueue.shift();
  if (!queued) return;
  
  const age = now - queued.queuedAt;
  
  logEvent('processing_queued_request', { 
    action: queued.request.action,
    requester: queued.requester,
    waitedMs: age
  });
  
  bot.chat(`Now helping with your earlier request, ${queued.requester}!`);
  await processExternalRequest(queued.request, queued.requester);
}

/**
 * Add a request to the queue (with size limits)
 */
function queueRequest(request, requester) {
  const maxSize = AUTONOMOUS_CONFIG.agency.maxQueueSize || 10;
  
  // Enforce queue size limit
  if (requestQueue.length >= maxSize) {
    // Remove oldest
    const dropped = requestQueue.shift();
    logEvent('queue_overflow', { 
      dropped: dropped.request.action, 
      dropper: dropped.requester 
    });
  }
  
  requestQueue.push({
    request,
    requester,
    queuedAt: Date.now()
  });
  
  saveWorldMemory(); // Persist queue
}

function loadWorldMemory() {
  try {
    if (fs.existsSync(WORLD_MEMORY_FILE)) {
      worldMemory = JSON.parse(fs.readFileSync(WORLD_MEMORY_FILE, 'utf8'));
      // Restore persisted state
      if (worldMemory.knownEntities) {
        knownEntities = worldMemory.knownEntities;
      }
      if (worldMemory.requestQueue) {
        requestQueue = worldMemory.requestQueue;
      }
      // Phase 21: Restore known bots
      if (worldMemory.knownBots) {
        worldMemory.knownBots.forEach(name => knownBots.add(name));
        console.log(`📡 Loaded ${knownBots.size} known bots from memory.`);
      }
      
      // Initialize missing fields with defaults
      if (!worldMemory.autonomousProgress) {
        worldMemory.autonomousProgress = {
          phase: 'survival',
          currentGoal: 'thriving_survivor',
          tasksCompleted: [],
          lastAction: null,
          lastActionTime: 0,
          stats: {
            blocksGathered: { wood: 0, stone: 0, coal: 0, iron: 0 },
            toolsCrafted: [],
            structuresBuilt: [],
            areasExplored: []
          }
        };
      }
    }
  } catch (err) {
    console.error('Failed to load world memory:', err);
  }
}

function saveWorldMemory() {
  try {
    // Include current state in world memory before saving
    worldMemory.knownEntities = knownEntities;
    worldMemory.requestQueue = requestQueue;
    // Phase 21: Save known bots
    worldMemory.knownBots = Array.from(knownBots);
    fs.writeFileSync(WORLD_MEMORY_FILE, JSON.stringify(worldMemory, null, 2));
  } catch (err) {
    console.error('Failed to save world memory:', err);
  }
}

loadWorldMemory();

function safeWrite(file, content) {
  try {
    fs.writeFileSync(file, content);
  } catch (err) {
    console.error('Write failed:', file, err);
  }
}

function logEvent(type, data) {
  const event = { timestamp: Date.now(), type, data };
  events.push(event);
  if (events.length > 100) events.shift();
  safeWrite(EVENTS_FILE, JSON.stringify(events, null, 2));
}

const bot = mineflayer.createBot({
  host: process.env.MC_HOST || '187.77.2.50',
  port: parseInt(process.env.MC_PORT) || 25568,
  username: process.env.BOT_USERNAME || 'Bot_AI'
});

bot.loadPlugin(pathfinder);

// ==========================================
// DYNAMIC COMMAND PREFIX SYSTEM
// ==========================================

/**
 * Get the command prefix from the bot's username
 * e.g., "Nova_AI" -> "nova", "Claude_Bot" -> "claude", "Bot_AI" -> "bot"
 */
function getCommandPrefix() {
  const username = bot.username.toLowerCase();
  // Extract first part before underscore/number (Nova_AI -> nova, Claude_Bot -> claude)
  return username.split(/[_\d]/)[0];
}

/**
 * Check if a message starts with this bot's command prefix
 */
function isCommandForMe(msg) {
  const prefix = getCommandPrefix();
  return msg.toLowerCase().startsWith(prefix + ' ') || msg.toLowerCase() === prefix;
}

/**
 * Strip the command prefix from a message
 */
function stripPrefix(msg) {
  const prefix = getCommandPrefix();
  const lower = msg.toLowerCase();
  if (lower.startsWith(prefix + ' ')) {
    return msg.substring(prefix.length + 1).trim();
  }
  return msg;
}

bot.on('spawn', () => {
  console.log(`${bot.username} has spawned in the world!`);

  movements = new Movements(bot);
  movements.allowParkour = false;
  movements.canDig = true;  // Enable for mining
  movements.allowFreeMotion = false;

  bot.pathfinder.setMovements(movements);

  // Phase 14: Remember spawn location
  if (!worldMemory.spawn) {
    worldMemory.spawn = {
      x: Math.floor(bot.entity.position.x),
      y: Math.floor(bot.entity.position.y),
      z: Math.floor(bot.entity.position.z)
    };
    saveWorldMemory();
  }

  // Load SOUL.md for personality, values, and boundaries
  const hasSoul = loadSoul();
  
  // AUTONOMOUS SPAWN BEHAVIOR: Observe first, decide whether to announce
  // Don't auto-greet - it feels scripted. Let the bot decide based on context.

  logEvent('spawn', {
    position: bot.entity.position,
    health: bot.health,
    food: bot.food,
    agencyEnabled: AUTONOMOUS_CONFIG.agency.enabled,
    hasSoul,
    soulPersona: soul.persona,
    soulVibe: soul.vibe,
    soulBoundaries: soul.boundaries.length,
    soulValues: soul.values.length
  });

  setInterval(processCommands, 750);
  setInterval(updatePerception, 3000);
  setInterval(autoSurvival, 5000);  // Phase 8: Auto-survival check
  
  // Periodically check request queue
  setInterval(() => {
    if (!currentAutonomousGoal && !isPlayerCommandActive()) {
      processRequestQueue();
    }
  }, 15000);
  
  // Phase 20+: Start autonomous behavior after short delay (silently)
  setTimeout(() => {
    if (AUTONOMOUS_CONFIG.enabled) {
      startAutonomousBehavior();
      // Don't auto-announce - let actions speak for themselves
    }
  }, 3000);
  
  // Phase 21: Bot discovery - observe first, then decide
  setTimeout(() => {
    // Check if there are other players/bots online
    const otherPlayers = Object.values(bot.players).filter(p => p.username !== bot.username);
    
    if (otherPlayers.length > 0) {
      // Someone else is here - quietly announce for bot coordination
      bot.chat('🤖 BOT_ANNOUNCE');
      logEvent('bot_announced', { username: bot.username, playersOnline: otherPlayers.length });
    } else {
      // Alone on the server - no need to announce, just observe
      logEvent('spawn_silent', { reason: 'no_other_players' });
    }
  }, 5000);  // Wait 5s to observe first
  
  // Phase 23: Start inventory management periodic check
  checkInventoryPeriodically();
  
  // Phase 23: Load farm plots from world memory
  if (worldMemory.farmPlots) {
    farmPlots = worldMemory.farmPlots;
    console.log(`🌾 Loaded ${farmPlots.length} farm plots from memory.`);
  }
});

// ==========================================
// PHASE 8: HUNGER/FOOD MANAGEMENT
// ==========================================

const FOOD_ITEMS = [
  'cooked_beef', 'cooked_porkchop', 'cooked_chicken', 'cooked_mutton', 'cooked_rabbit',
  'cooked_salmon', 'cooked_cod', 'bread', 'apple', 'golden_apple', 'enchanted_golden_apple',
  'baked_potato', 'pumpkin_pie', 'cake', 'cookie', 'melon_slice', 'sweet_berries',
  'beef', 'porkchop', 'chicken', 'mutton', 'rabbit',  // Raw meats (less effective)
  'carrot', 'potato', 'beetroot', 'dried_kelp'
];

const RAW_TO_COOKED = {
  'beef': 'cooked_beef',
  'porkchop': 'cooked_porkchop', 
  'chicken': 'cooked_chicken',
  'mutton': 'cooked_mutton',
  'rabbit': 'cooked_rabbit',
  'cod': 'cooked_cod',
  'salmon': 'cooked_salmon',
  'potato': 'baked_potato'
};

const FOOD_ANIMALS = ['cow', 'pig', 'chicken', 'sheep', 'rabbit'];

async function autoEat() {
  if (bot.food >= 6) return false;  // Not hungry enough
  
  const foodItem = bot.inventory.items().find(item => FOOD_ITEMS.includes(item.name));
  
  if (!foodItem) {
    logEvent('hunger_warning', { food: bot.food, reason: 'no_food_items' });
    return false;
  }
  
  try {
    await bot.equip(foodItem, 'hand');
    await bot.consume();
    logEvent('ate_food', { item: foodItem.name, newFoodLevel: bot.food });
    return true;
  } catch (err) {
    logEvent('eat_failed', { error: err.message, item: foodItem.name });
    return false;
  }
}

async function findAndHuntFood() {
  // Find nearest food animal
  const animals = Object.values(bot.entities)
    .filter(e => e.type === 'mob' && FOOD_ANIMALS.includes(e.name?.toLowerCase()))
    .filter(e => e.position && bot.entity.position.distanceTo(e.position) < 64)
    .sort((a, b) => bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position));
  
  if (animals.length === 0) {
    logEvent('find_food_failed', { reason: 'no_animals_nearby' });
    bot.chat('No food animals nearby!');
    return false;
  }
  
  const target = animals[0];
  currentGoal = { type: 'hunt_food', target: target.name, entityId: target.id };
  logEvent('hunting_animal', { type: target.name, distance: Math.floor(bot.entity.position.distanceTo(target.position)) });
  
  // Start hunting
  startHunting(target);
  return true;
}

let huntInterval = null;

function startHunting(animal) {
  if (huntInterval) clearInterval(huntInterval);
  
  huntInterval = setInterval(async () => {
    const target = bot.entities[animal.id];
    
    if (!target || !target.position) {
      logEvent('hunt_ended', { reason: 'target_gone' });
      stopHunting();
      // Try to collect dropped items
      setTimeout(() => collectNearbyItems(), 500);
      return;
    }
    
    const distance = bot.entity.position.distanceTo(target.position);
    
    if (distance > 3) {
      bot.pathfinder.setGoal(new GoalFollow(target, 2), true);
    }
    
    if (distance < 4) {
      // Equip best weapon
      const weapons = ['diamond_sword', 'iron_sword', 'stone_sword', 'wooden_sword'];
      const weapon = bot.inventory.items().find(i => weapons.includes(i.name));
      if (weapon) await bot.equip(weapon, 'hand').catch(() => {});
      
      bot.attack(target);
    }
  }, 300);
}

function stopHunting() {
  if (huntInterval) {
    clearInterval(huntInterval);
    huntInterval = null;
  }
  currentGoal = null;
  bot.pathfinder.setGoal(null);
}

async function collectNearbyItems() {
  const items = Object.values(bot.entities)
    .filter(e => e.type === 'object' && e.objectType === 'Item')
    .filter(e => e.position && bot.entity.position.distanceTo(e.position) < 10);
  
  for (const item of items) {
    if (item.position) {
      bot.pathfinder.setGoal(new GoalNear(item.position.x, item.position.y, item.position.z, 0), false);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

async function cookFood() {
  // Check for raw meat
  const rawMeats = Object.keys(RAW_TO_COOKED);
  const rawItem = bot.inventory.items().find(i => rawMeats.includes(i.name));
  
  if (!rawItem) {
    bot.chat('No raw food to cook!');
    return false;
  }
  
  // Find furnace nearby
  let furnace = bot.findBlock({
    matching: block => block.name === 'furnace' || block.name === 'lit_furnace',
    maxDistance: 32
  });
  
  if (!furnace) {
    // Try to craft and place a furnace
    const cobble = bot.inventory.items().find(i => i.name === 'cobblestone');
    if (cobble && cobble.count >= 8) {
      const crafted = await craftItem('furnace');
      if (crafted) {
        // Place furnace
        const pos = bot.entity.position.floored();
        const below = bot.blockAt(pos.offset(1, -1, 0));
        if (below && below.name !== 'air') {
          const furnaceItem = bot.inventory.items().find(i => i.name === 'furnace');
          if (furnaceItem) {
            await bot.equip(furnaceItem, 'hand');
            await bot.placeBlock(below, Vec3(0, 1, 0));
            furnace = bot.blockAt(pos.offset(1, 0, 0));
          }
        }
      }
    }
  }
  
  if (!furnace) {
    bot.chat('No furnace and cannot craft one!');
    return false;
  }
  
  try {
    // Go to furnace
    await bot.pathfinder.goto(new GoalNear(furnace.position.x, furnace.position.y, furnace.position.z, 2));
    
    // Open furnace
    const furnaceBlock = await bot.openFurnace(furnace);
    
    // Add fuel (coal or wood)
    const fuel = bot.inventory.items().find(i => 
      i.name === 'coal' || i.name === 'charcoal' || i.name.includes('planks') || i.name.includes('log')
    );
    if (fuel) {
      await furnaceBlock.putFuel(fuel.type, null, Math.min(fuel.count, 8));
    }
    
    // Add raw meat
    await furnaceBlock.putInput(rawItem.type, null, rawItem.count);
    
    logEvent('cooking_started', { item: rawItem.name, count: rawItem.count });
    bot.chat(`Cooking ${rawItem.count} ${rawItem.name}...`);
    
    // Wait for cooking (roughly 10s per item)
    await new Promise(r => setTimeout(r, Math.min(rawItem.count * 10000, 30000)));
    
    // Take output
    const output = furnaceBlock.outputItem();
    if (output) {
      await furnaceBlock.takeOutput();
      logEvent('cooked_food', { item: output.name, count: output.count });
    }
    
    furnaceBlock.close();
    return true;
  } catch (err) {
    logEvent('cook_failed', { error: err.message });
    bot.chat(`Cooking failed: ${err.message}`);
    return false;
  }
}

// ==========================================
// PHASE 9: CRAFTING SYSTEM
// ==========================================

const mcData = require('minecraft-data')('1.20.1');  // Adjust version as needed

async function craftItem(itemName, count = 1) {
  const item = mcData.itemsByName[itemName];
  if (!item) {
    logEvent('craft_failed', { item: itemName, reason: 'unknown_item' });
    bot.chat(`Unknown item: ${itemName}`);
    return false;
  }
  
  const recipes = bot.recipesFor(item.id);
  if (!recipes || recipes.length === 0) {
    logEvent('craft_failed', { item: itemName, reason: 'no_recipe' });
    bot.chat(`No recipe for ${itemName} with current items!`);
    return false;
  }
  
  // Check if we need a crafting table
  const recipe = recipes[0];
  const needsTable = recipe.requiresTable;
  
  if (needsTable) {
    // Find or place crafting table
    let table = bot.findBlock({
      matching: block => block.name === 'crafting_table',
      maxDistance: 32
    });
    
    if (!table) {
      // Craft crafting table if we have planks
      const planks = bot.inventory.items().find(i => i.name.includes('planks'));
      if (planks && planks.count >= 4) {
        const tableRecipe = bot.recipesFor(mcData.itemsByName['crafting_table'].id)[0];
        if (tableRecipe) {
          await bot.craft(tableRecipe, 1, null);
          const craftedTable = bot.inventory.items().find(i => i.name === 'crafting_table');
          if (craftedTable) {
            await bot.equip(craftedTable, 'hand');
            const below = bot.blockAt(bot.entity.position.offset(1, -1, 0));
            if (below && below.name !== 'air') {
              await bot.placeBlock(below, Vec3(0, 1, 0));
              table = bot.blockAt(bot.entity.position.offset(1, 0, 0));
            }
          }
        }
      }
    }
    
    if (!table) {
      logEvent('craft_failed', { item: itemName, reason: 'no_crafting_table' });
      bot.chat('Need a crafting table!');
      return false;
    }
    
    // Go to table
    await bot.pathfinder.goto(new GoalNear(table.position.x, table.position.y, table.position.z, 2));
    
    try {
      await bot.craft(recipe, count, table);
      logEvent('crafted', { item: itemName, count });
      bot.chat(`Crafted ${count} ${itemName}!`);
      return true;
    } catch (err) {
      logEvent('craft_failed', { item: itemName, error: err.message });
      bot.chat(`Craft failed: ${err.message}`);
      return false;
    }
  } else {
    // Can craft in inventory
    try {
      await bot.craft(recipe, count, null);
      logEvent('crafted', { item: itemName, count });
      bot.chat(`Crafted ${count} ${itemName}!`);
      return true;
    } catch (err) {
      logEvent('craft_failed', { item: itemName, error: err.message });
      bot.chat(`Craft failed: ${err.message}`);
      return false;
    }
  }
}

// ==========================================
// PHASE 10: STRATEGIC MINING
// ==========================================

const ORE_PRIORITY = {
  'diamond_ore': 1,
  'deepslate_diamond_ore': 1,
  'ancient_debris': 2,
  'emerald_ore': 3,
  'deepslate_emerald_ore': 3,
  'gold_ore': 4,
  'deepslate_gold_ore': 4,
  'iron_ore': 5,
  'deepslate_iron_ore': 5,
  'copper_ore': 6,
  'deepslate_copper_ore': 6,
  'coal_ore': 7,
  'deepslate_coal_ore': 7,
  'redstone_ore': 8,
  'deepslate_redstone_ore': 8,
  'lapis_ore': 9,
  'deepslate_lapis_ore': 9
};

async function mineResource(resourceType, count = 16) {
  // Find ore blocks matching type
  const matchingBlocks = [];
  
  const blockNames = Object.keys(ORE_PRIORITY).filter(name => 
    name.includes(resourceType.toLowerCase()) || 
    (resourceType === 'stone' && (name === 'stone' || name === 'cobblestone'))
  );
  
  if (resourceType === 'stone') {
    blockNames.push('stone', 'cobblestone', 'deepslate');
  }
  
  const targetBlock = bot.findBlock({
    matching: block => blockNames.includes(block.name) || block.name === resourceType,
    maxDistance: 64,
    count: 10
  });
  
  if (!targetBlock) {
    logEvent('mine_failed', { resource: resourceType, reason: 'not_found' });
    bot.chat(`Cannot find ${resourceType} nearby!`);
    return false;
  }
  
  currentGoal = { type: 'mining', resource: resourceType, count };
  logEvent('mining_started', { resource: resourceType, target: targetBlock.position });
  
  // Equip best pickaxe
  const pickaxes = ['netherite_pickaxe', 'diamond_pickaxe', 'iron_pickaxe', 'stone_pickaxe', 'wooden_pickaxe'];
  const pickaxe = bot.inventory.items().find(i => pickaxes.includes(i.name));
  if (pickaxe) {
    await bot.equip(pickaxe, 'hand');
  }
  
  let mined = 0;
  while (mined < count) {
    const block = bot.findBlock({
      matching: b => blockNames.includes(b.name) || b.name === resourceType,
      maxDistance: 64
    });
    
    if (!block) break;
    
    // Safety: Don't dig straight down
    const botY = Math.floor(bot.entity.position.y);
    if (block.position.y < botY - 1) {
      // Mine at angle, not straight down
      const aboveBlock = bot.blockAt(block.position.offset(0, 1, 0));
      if (aboveBlock && aboveBlock.name !== 'air') {
        // Mine block above first
        try {
          await bot.pathfinder.goto(new GoalNear(aboveBlock.position.x, aboveBlock.position.y, aboveBlock.position.z, 3));
          await bot.dig(aboveBlock);
        } catch (e) {}
      }
    }
    
    try {
      await bot.pathfinder.goto(new GoalNear(block.position.x, block.position.y, block.position.z, 3));
      
      // Check for dangers before mining
      const blockBelow = bot.blockAt(block.position.offset(0, -1, 0));
      if (blockBelow && (blockBelow.name === 'lava' || blockBelow.name === 'air')) {
        logEvent('mining_danger', { reason: 'lava_or_void_below', position: block.position });
        continue;  // Skip dangerous blocks
      }
      
      await bot.dig(block);
      mined++;
      logEvent('block_mined', { block: block.name, mined, target: count });
      
      // Place torch every 8 blocks in dark areas
      if (mined % 8 === 0) {
        const torch = bot.inventory.items().find(i => i.name === 'torch');
        if (torch && bot.blockAt(bot.entity.position)?.light < 7) {
          try {
            await bot.equip(torch, 'hand');
            const floor = bot.blockAt(bot.entity.position.offset(0, -1, 0));
            if (floor && floor.name !== 'air') {
              await bot.placeBlock(floor, Vec3(0, 1, 0));
              logEvent('torch_placed', { position: bot.entity.position });
            }
          } catch (e) {}
          // Re-equip pickaxe
          if (pickaxe) await bot.equip(pickaxe, 'hand');
        }
      }
    } catch (err) {
      logEvent('mine_error', { error: err.message });
      break;
    }
    
    // Collect dropped items
    await new Promise(r => setTimeout(r, 500));
  }
  
  logEvent('mining_complete', { resource: resourceType, mined });
  bot.chat(`Mined ${mined} ${resourceType}!`);
  currentGoal = null;
  return mined > 0;
}

// ==========================================
// PHASE 11: BED/SLEEP
// ==========================================

async function sleepInBed() {
  // Check if night time
  const time = bot.time.timeOfDay;
  const isNight = time >= 12541 && time <= 23458;
  
  if (!isNight) {
    bot.chat("It's not night time yet!");
    return false;
  }
  
  // Find bed
  let bed = bot.findBlock({
    matching: block => block.name.includes('bed'),
    maxDistance: 32
  });
  
  if (!bed) {
    // Try to place a bed
    const bedItem = bot.inventory.items().find(i => i.name.includes('bed'));
    if (bedItem) {
      const pos = bot.entity.position.floored();
      const floor = bot.blockAt(pos.offset(1, -1, 0));
      if (floor && floor.name !== 'air') {
        await bot.equip(bedItem, 'hand');
        await bot.placeBlock(floor, Vec3(0, 1, 0));
        bed = bot.blockAt(pos.offset(1, 0, 0));
      }
    }
  }
  
  if (!bed) {
    logEvent('sleep_failed', { reason: 'no_bed' });
    bot.chat('No bed available!');
    return false;
  }
  
  try {
    await bot.pathfinder.goto(new GoalNear(bed.position.x, bed.position.y, bed.position.z, 2));
    await bot.sleep(bed);
    logEvent('sleeping', { bed: bed.position });
    bot.chat('Good night!');
    return true;
  } catch (err) {
    logEvent('sleep_failed', { error: err.message });
    bot.chat(`Can't sleep: ${err.message}`);
    return false;
  }
}

bot.on('wake', () => {
  logEvent('woke_up', {});
  bot.chat('Good morning!');
});

// ==========================================
// PHASE 21: WHISPER HANDLER (Bot-to-Bot Communication)
// ==========================================

bot.on('whisper', (username, message) => {
  console.log(`💬 Whisper from ${username}: ${message}`);
  
  // Try to parse as structured bot message
  let parsed = null;
  try {
    parsed = JSON.parse(message);
    
    // Validate structure - must have type, from, and content
    if (!parsed.type || !parsed.from || !parsed.content) {
      parsed = null; // Invalid structure, treat as regular whisper
    }
  } catch {
    // Not JSON, treat as regular whisper from human
  }
  
  if (parsed) {
    handleBotMessage(username, parsed);
  } else {
    handleHumanWhisper(username, message);
  }
});

/**
 * Handle structured messages from other bots
 */
function handleBotMessage(username, msg) {
  // Auto-register sender as a bot
  registerBot(username);
  
  logEvent('bot_message_received', {
    from: username,
    type: msg.type,
    content: msg.content
  });
  
  switch (msg.type) {
    case MessageType.REQUEST:
      handleBotRequest(username, msg.content);
      break;
      
    case MessageType.RESPONSE:
      handleBotResponse(username, msg.content);
      break;
      
    case MessageType.NEGOTIATION:
      handleBotNegotiation(username, msg.content);
      break;
      
    case MessageType.ANNOUNCEMENT:
      handleBotAnnouncement(username, msg.content);
      break;
      
    case MessageType.CLAIM:
      handleBotClaim(username, msg.content);
      break;
      
    case MessageType.EMERGENCY:
      handleBotEmergency(username, msg.content);
      break;
      
    case MessageType.ACKNOWLEDGMENT:
      console.log(`🤖 ${username} acknowledged.`);
      break;
      
    default:
      console.log(`🤖 Unknown message type from ${username}: ${msg.type}`);
  }
}

/**
 * Handle regular whispers from humans (non-JSON)
 */
function handleHumanWhisper(username, message) {
  logEvent('whisper', { username, message });
  
  // Parse for simple commands
  const msg = message.toLowerCase().trim();
  
  if (msg.includes('help') || msg.includes('come here')) {
    bot.whisper(username, "On my way! I'll try to help.");
    const player = bot.players[username];
    if (player?.entity) {
      bot.pathfinder.setGoal(new GoalFollow(player.entity, 3), true);
    }
  } else if (msg.includes('status')) {
    bot.whisper(username, `HP: ${Math.floor(bot.health)}/20, Food: ${bot.food}/20`);
  } else {
    // Default acknowledgment
    bot.whisper(username, "I received your whisper! Say 'help' if you need me.");
  }
}

/**
 * Handle a request from another bot
 */
function handleBotRequest(username, content) {
  // Create a command from bot request
  const request = {
    action: content.action,
    ...content.params,
    originalMessage: `Bot request: ${content.action}`
  };
  
  const source = {
    type: 'bot',
    username,
    isOwner: false,
    trust: TRUST_LEVELS.BOT
  };
  
  // Use existing evaluateRequest system
  const decision = evaluateRequest(request, username);
  
  // Send structured response
  sendMessageToBot(username, MessageType.RESPONSE, {
    requestId: content.requestId,
    decision: decision.type,
    reason: decision.reason,
    response: decision.response,
    counterProposal: decision.counterProposal || null
  });
  
  // Execute if accepted
  if (decision.type === DECISION.ACCEPT) {
    executeCommand(request);
  } else if (decision.type === DECISION.DEFER) {
    queueRequest(request, username);
  }
}

/**
 * Handle a response to our request from another bot
 */
function handleBotResponse(username, content) {
  console.log(`🤖 ${username} responded: ${content.decision} - ${content.reason || ''}`);
  
  if (content.decision === 'accept') {
    // They're helping!
    bot.chat(`Thanks ${username}!`);
  } else if (content.decision === 'defer') {
    // They'll help later
    console.log(`🤖 ${username} will help later.`);
  } else if (content.decision === 'negotiate' && content.counterProposal) {
    // Counter-proposal - could auto-evaluate
    console.log(`💡 Counter-proposal from ${username}:`, content.counterProposal);
    logEvent('bot_counter_proposal', { from: username, proposal: content.counterProposal });
  } else if (content.decision === 'decline') {
    console.log(`🤖 ${username} declined: ${content.reason || 'no reason given'}`);
  }
}

/**
 * Handle a negotiation message from another bot
 */
function handleBotNegotiation(username, content) {
  console.log(`🤝 ${username} negotiating: ${content.proposal || content.message}`);
  logEvent('bot_negotiation', { from: username, content });
  
  // Simple auto-accept for reasonable counter-proposals
  if (content.proposal && !currentAutonomousGoal) {
    sendMessageToBot(username, MessageType.RESPONSE, {
      decision: 'accept',
      response: 'That works for me!'
    });
  }
}

/**
 * Handle an announcement from another bot (discovery, etc.)
 */
function handleBotAnnouncement(username, content) {
  console.log(`📢 ${username} announced: ${content.message}`);
  
  if (content.location) {
    // Mark in world memory
    const landmarkName = `${username}_${content.type || 'discovery'}`;
    worldMemory.landmarks[landmarkName] = {
      x: content.location.x,
      y: content.location.y,
      z: content.location.z,
      type: content.type || 'discovery',
      discoveredBy: username,
      note: content.message,
      timestamp: Date.now()
    };
    saveWorldMemory();
    
    logEvent('bot_announcement_saved', { from: username, landmark: landmarkName });
    console.log(`📍 Saved ${landmarkName} from ${username}'s discovery.`);
  }
}

/**
 * Handle a claim from another bot (territory/resource)
 */
function handleBotClaim(username, content) {
  console.log(`🚩 ${username} claimed: ${content.area || content.resource}`);
  
  // Track claims to avoid conflicts
  if (!worldMemory.claims) worldMemory.claims = {};
  worldMemory.claims[username] = {
    ...content,
    claimedAt: Date.now()
  };
  saveWorldMemory();
  
  logEvent('bot_claim_received', { from: username, claim: content });
  
  // Acknowledge the claim
  sendMessageToBot(username, MessageType.ACKNOWLEDGMENT, {
    message: 'Claim noted',
    acknowledged: true
  });
}

/**
 * Handle an emergency from another bot
 */
function handleBotEmergency(username, content) {
  console.log(`🚨 EMERGENCY from ${username}: ${content.reason}`);
  
  logEvent('bot_emergency_received', { from: username, reason: content.reason, location: content.location });
  
  // Evaluate if we can help
  const canHelp = bot.health > 10 && !currentGoal;
  
  if (canHelp) {
    sendMessageToBot(username, MessageType.RESPONSE, {
      decision: 'accept',
      response: 'On my way!'
    });
    
    bot.chat(`🚨 Responding to ${username}'s emergency!`);
    
    if (content.location) {
      // Clear current goal and go help
      currentAutonomousGoal = null;
      executeCommand({
        action: 'goto',
        x: content.location.x,
        y: content.location.y,
        z: content.location.z
      });
    }
  } else {
    sendMessageToBot(username, MessageType.RESPONSE, {
      decision: 'decline',
      response: `I can't help right now - ${bot.health <= 10 ? 'low health' : 'busy'}.`
    });
  }
}

// ==========================================
// PHASE 12: BUILDING/CONSTRUCTION
// ==========================================

const BUILD_TEMPLATES = {
  shelter_3x3: {
    // Relative positions for a 3x3 shelter with door
    blocks: [
      // Floor (if needed)
      // Walls (2 high)
      { x: -1, y: 0, z: -1 }, { x: 0, y: 0, z: -1 }, { x: 1, y: 0, z: -1 },
      { x: -1, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 },
      { x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
      { x: -1, y: 1, z: -1 }, { x: 0, y: 1, z: -1 }, { x: 1, y: 1, z: -1 },
      { x: -1, y: 1, z: 1 }, { x: 0, y: 1, z: 1 }, { x: 1, y: 1, z: 1 },
      { x: -1, y: 1, z: 0 }, { x: 1, y: 1, z: 0 },
      // Roof
      { x: -1, y: 2, z: -1 }, { x: 0, y: 2, z: -1 }, { x: 1, y: 2, z: -1 },
      { x: -1, y: 2, z: 0 }, { x: 0, y: 2, z: 0 }, { x: 1, y: 2, z: 0 },
      { x: -1, y: 2, z: 1 }, { x: 0, y: 2, z: 1 }, { x: 1, y: 2, z: 1 }
    ]
  },
  pillar: {
    blocks: [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 2, z: 0 },
      { x: 0, y: 3, z: 0 },
      { x: 0, y: 4, z: 0 }
    ]
  },
  bridge: {
    blocks: [
      { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 2 },
      { x: 0, y: 0, z: 3 }, { x: 0, y: 0, z: 4 }, { x: 0, y: 0, z: 5 },
      { x: 0, y: 0, z: 6 }, { x: 0, y: 0, z: 7 }, { x: 0, y: 0, z: 8 },
      { x: 0, y: 0, z: 9 }
    ]
  },
  wall: {
    blocks: [
      { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }, { x: 4, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 2, y: 1, z: 0 }, { x: 3, y: 1, z: 0 }, { x: 4, y: 1, z: 0 },
      { x: 0, y: 2, z: 0 }, { x: 1, y: 2, z: 0 }, { x: 2, y: 2, z: 0 }, { x: 3, y: 2, z: 0 }, { x: 4, y: 2, z: 0 }
    ]
  }
};

async function buildStructure(templateName, blockType) {
  const template = BUILD_TEMPLATES[templateName];
  if (!template) {
    bot.chat(`Unknown template: ${templateName}. Available: ${Object.keys(BUILD_TEMPLATES).join(', ')}`);
    return false;
  }
  
  // Find building blocks
  const buildBlock = bot.inventory.items().find(i => 
    i.name.includes(blockType) || i.name.includes('cobblestone') || i.name.includes('planks')
  );
  
  if (!buildBlock || buildBlock.count < template.blocks.length) {
    bot.chat(`Need at least ${template.blocks.length} blocks to build ${templateName}!`);
    return false;
  }
  
  await bot.equip(buildBlock, 'hand');
  
  const basePos = bot.entity.position.floored().offset(2, 0, 0);  // Build 2 blocks away
  let placed = 0;
  
  logEvent('building_started', { template: templateName, basePos });
  currentGoal = { type: 'building', template: templateName };
  
  for (const offset of template.blocks) {
    const targetPos = basePos.offset(offset.x, offset.y, offset.z);
    const existingBlock = bot.blockAt(targetPos);
    
    if (existingBlock && existingBlock.name !== 'air') continue;  // Skip if already block there
    
    // Find reference block
    const below = bot.blockAt(targetPos.offset(0, -1, 0));
    const north = bot.blockAt(targetPos.offset(0, 0, -1));
    const south = bot.blockAt(targetPos.offset(0, 0, 1));
    const east = bot.blockAt(targetPos.offset(1, 0, 0));
    const west = bot.blockAt(targetPos.offset(-1, 0, 0));
    
    let refBlock = null;
    let faceVec = null;
    
    if (below && below.name !== 'air') { refBlock = below; faceVec = Vec3(0, 1, 0); }
    else if (north && north.name !== 'air') { refBlock = north; faceVec = Vec3(0, 0, 1); }
    else if (south && south.name !== 'air') { refBlock = south; faceVec = Vec3(0, 0, -1); }
    else if (east && east.name !== 'air') { refBlock = east; faceVec = Vec3(-1, 0, 0); }
    else if (west && west.name !== 'air') { refBlock = west; faceVec = Vec3(1, 0, 0); }
    
    if (!refBlock) continue;
    
    try {
      // Move closer if needed
      const dist = bot.entity.position.distanceTo(targetPos);
      if (dist > 4) {
        await bot.pathfinder.goto(new GoalNear(targetPos.x, targetPos.y, targetPos.z, 3));
      }
      
      await bot.placeBlock(refBlock, faceVec);
      placed++;
      await new Promise(r => setTimeout(r, 250));  // Small delay between placements
    } catch (err) {
      // Ignore placement errors, try next block
    }
  }
  
  logEvent('building_complete', { template: templateName, placed });
  bot.chat(`Built ${templateName}! Placed ${placed} blocks.`);
  currentGoal = null;
  return placed > 0;
}

// ==========================================
// PHASE 13: CHEST/STORAGE MANAGEMENT
// ==========================================

async function storeItems(itemTypes = null) {
  // Find nearest chest
  const chest = bot.findBlock({
    matching: block => block.name === 'chest' || block.name === 'barrel' || block.name === 'trapped_chest',
    maxDistance: 32
  });
  
  if (!chest) {
    bot.chat('No storage chest nearby!');
    return false;
  }
  
  try {
    await bot.pathfinder.goto(new GoalNear(chest.position.x, chest.position.y, chest.position.z, 2));
    const chestContainer = await bot.openContainer(chest);
    
    const items = bot.inventory.items();
    let stored = 0;
    
    for (const item of items) {
      // Skip essential items
      if (['diamond_pickaxe', 'iron_pickaxe', 'diamond_sword', 'iron_sword'].includes(item.name)) continue;
      
      // If specific types requested, only store those
      if (itemTypes && !itemTypes.some(t => item.name.includes(t))) continue;
      
      try {
        await chestContainer.deposit(item.type, null, item.count);
        stored++;
        logEvent('item_stored', { item: item.name, count: item.count });
      } catch (e) {}
    }
    
    // Update world memory
    const existingChest = worldMemory.chests.find(c => 
      c.position.x === chest.position.x && 
      c.position.y === chest.position.y && 
      c.position.z === chest.position.z
    );
    
    if (existingChest) {
      existingChest.lastUpdated = Date.now();
    } else {
      worldMemory.chests.push({
        position: { x: chest.position.x, y: chest.position.y, z: chest.position.z },
        lastUpdated: Date.now()
      });
      saveWorldMemory();
    }
    
    chestContainer.close();
    bot.chat(`Stored ${stored} item types in chest!`);
    return true;
  } catch (err) {
    logEvent('store_failed', { error: err.message });
    bot.chat(`Storage failed: ${err.message}`);
    return false;
  }
}

async function retrieveItems(itemTypes) {
  const chest = bot.findBlock({
    matching: block => block.name === 'chest' || block.name === 'barrel',
    maxDistance: 32
  });
  
  if (!chest) {
    bot.chat('No chest nearby!');
    return false;
  }
  
  try {
    await bot.pathfinder.goto(new GoalNear(chest.position.x, chest.position.y, chest.position.z, 2));
    const chestContainer = await bot.openContainer(chest);
    
    let retrieved = 0;
    for (const item of chestContainer.items()) {
      if (!itemTypes || itemTypes.some(t => item.name.includes(t))) {
        try {
          await chestContainer.withdraw(item.type, null, item.count);
          retrieved++;
          logEvent('item_retrieved', { item: item.name, count: item.count });
        } catch (e) {}
      }
    }
    
    chestContainer.close();
    bot.chat(`Retrieved ${retrieved} item types from chest!`);
    return true;
  } catch (err) {
    logEvent('retrieve_failed', { error: err.message });
    return false;
  }
}

// ==========================================
// PHASE 14: WORLD MEMORY
// ==========================================

function markLocation(name, type = 'landmark', note = '') {
  const pos = bot.entity.position.floored();
  worldMemory.landmarks[name] = {
    x: pos.x,
    y: pos.y,
    z: pos.z,
    type,
    note,
    timestamp: Date.now()
  };
  saveWorldMemory();
  logEvent('location_marked', { name, position: pos, type });
  bot.chat(`Marked "${name}" at ${pos.x}, ${pos.y}, ${pos.z}`);
  return true;
}

async function gotoLandmark(name) {
  const landmark = worldMemory.landmarks[name];
  if (!landmark) {
    const available = Object.keys(worldMemory.landmarks).join(', ') || 'none';
    bot.chat(`Unknown landmark: ${name}. Known: ${available}`);
    return false;
  }
  
  currentGoal = { type: 'goto_landmark', name };
  logEvent('goto_landmark', { name, position: landmark });
  bot.chat(`Going to ${name}...`);
  
  bot.pathfinder.setGoal(new GoalNear(landmark.x, landmark.y, landmark.z, 2));
  return true;
}

function setHome() {
  const pos = bot.entity.position.floored();
  worldMemory.home = { x: pos.x, y: pos.y, z: pos.z };
  saveWorldMemory();
  bot.chat(`Home set at ${pos.x}, ${pos.y}, ${pos.z}`);
  return true;
}

// ==========================================
// PHASE 15: VILLAGER TRADING
// ==========================================

async function tradeWithVillager(buyIndex = 0) {
  // Find villager
  const villager = Object.values(bot.entities)
    .filter(e => e.type === 'mob' && e.name?.toLowerCase() === 'villager')
    .filter(e => e.position && bot.entity.position.distanceTo(e.position) < 32)
    .sort((a, b) => bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position))[0];
  
  if (!villager) {
    bot.chat('No villagers nearby!');
    return false;
  }
  
  try {
    await bot.pathfinder.goto(new GoalNear(villager.position.x, villager.position.y, villager.position.z, 2));
    
    const villagerEntity = bot.entities[villager.id];
    const trades = await bot.openVillager(villagerEntity);
    
    if (!trades.trades || trades.trades.length === 0) {
      bot.chat('Villager has no trades!');
      trades.close();
      return false;
    }
    
    // List trades
    const tradeList = trades.trades.map((t, i) => 
      `${i}: ${t.inputItem1?.name || '?'}${t.inputItem2 ? '+' + t.inputItem2.name : ''} → ${t.outputItem?.name || '?'}`
    ).join('\n');
    
    logEvent('villager_trades', { trades: tradeList });
    
    if (buyIndex >= 0 && buyIndex < trades.trades.length) {
      const trade = trades.trades[buyIndex];
      
      // Check if we have the input items
      const hasInput1 = bot.inventory.items().find(i => i.name === trade.inputItem1?.name);
      
      if (hasInput1) {
        await trades.trade(buyIndex, 1);
        logEvent('traded', { input: trade.inputItem1?.name, output: trade.outputItem?.name });
        bot.chat(`Traded for ${trade.outputItem?.name}!`);
      } else {
        bot.chat(`Missing ${trade.inputItem1?.name} for trade!`);
      }
    } else {
      bot.chat(`Villager has ${trades.trades.length} trades. Say "${getCommandPrefix()} trade N" to buy.`);
    }
    
    trades.close();
    return true;
  } catch (err) {
    logEvent('trade_failed', { error: err.message });
    bot.chat(`Trading failed: ${err.message}`);
    return false;
  }
}

// ==========================================
// PHASE 16: POTIONS/ENCHANTING
// ==========================================

async function useBrewingStand() {
  const brewingStand = bot.findBlock({
    matching: block => block.name === 'brewing_stand',
    maxDistance: 32
  });
  
  if (!brewingStand) {
    bot.chat('No brewing stand nearby!');
    return false;
  }
  
  try {
    await bot.pathfinder.goto(new GoalNear(brewingStand.position.x, brewingStand.position.y, brewingStand.position.z, 2));
    
    // Open brewing stand
    const brewer = await bot.openBrewingStand(brewingStand);
    
    // Add blaze powder as fuel
    const blazePowder = bot.inventory.items().find(i => i.name === 'blaze_powder');
    if (blazePowder) {
      await brewer.putFuel(blazePowder.type, null, 1);
    }
    
    // Add bottles
    const bottle = bot.inventory.items().find(i => i.name === 'glass_bottle' || i.name === 'potion');
    if (bottle) {
      await brewer.putPotion(0, bottle.type, null, 1);
    }
    
    // Add ingredient
    const ingredient = bot.inventory.items().find(i => 
      i.name === 'nether_wart' || i.name === 'glowstone_dust' || 
      i.name === 'redstone' || i.name === 'spider_eye'
    );
    if (ingredient) {
      await brewer.putIngredient(ingredient.type, null, 1);
    }
    
    logEvent('brewing_started', {});
    bot.chat('Brewing started...');
    
    // Wait for brewing
    await new Promise(r => setTimeout(r, 20000));
    
    // Take potions
    for (let i = 0; i < 3; i++) {
      try {
        await brewer.takePotion(i);
      } catch (e) {}
    }
    
    brewer.close();
    return true;
  } catch (err) {
    logEvent('brewing_failed', { error: err.message });
    return false;
  }
}

async function useEnchantingTable() {
  const enchantTable = bot.findBlock({
    matching: block => block.name === 'enchanting_table',
    maxDistance: 32
  });
  
  if (!enchantTable) {
    bot.chat('No enchanting table nearby!');
    return false;
  }
  
  try {
    await bot.pathfinder.goto(new GoalNear(enchantTable.position.x, enchantTable.position.y, enchantTable.position.z, 2));
    
    const table = await bot.openEnchantmentTable(enchantTable);
    
    // Find item to enchant
    const enchantable = bot.inventory.items().find(i => 
      i.name.includes('sword') || i.name.includes('pickaxe') || 
      i.name.includes('helmet') || i.name.includes('chestplate')
    );
    
    if (!enchantable) {
      bot.chat('No enchantable items!');
      table.close();
      return false;
    }
    
    // Check lapis
    const lapis = bot.inventory.items().find(i => i.name === 'lapis_lazuli');
    if (!lapis) {
      bot.chat('Need lapis lazuli!');
      table.close();
      return false;
    }
    
    await table.putTargetItem(enchantable);
    await table.putLapis(lapis);
    
    // Enchant with highest level available
    const enchantments = table.enchantments;
    if (enchantments && enchantments.length > 0) {
      const best = enchantments.reduce((a, b) => (a.level > b.level ? a : b));
      await table.enchant(enchantments.indexOf(best));
      logEvent('enchanted', { item: enchantable.name, enchantment: best });
      bot.chat(`Enchanted ${enchantable.name}!`);
    }
    
    await table.takeTargetItem();
    table.close();
    return true;
  } catch (err) {
    logEvent('enchant_failed', { error: err.message });
    return false;
  }
}

// ==========================================
// PHASE 20: AUTONOMOUS GOAL FUNCTIONS
// ==========================================

function hasPendingCommands() {
  try {
    if (fs.existsSync(COMMANDS_FILE)) {
      const commands = JSON.parse(fs.readFileSync(COMMANDS_FILE, 'utf8'));
      return Array.isArray(commands) && commands.length > 0;
    }
  } catch (e) {}
  return false;
}

function isActiveltyBusy() {
  // Check if we're in the middle of something important
  return currentGoal && currentGoal.type !== 'idle';
}

function getNearbyHostiles() {
  return Object.values(bot.entities)
    .filter(e => e.type === 'mob' && 
      ['zombie', 'skeleton', 'creeper', 'spider', 'enderman', 'witch', 'pillager', 'drowned'].includes(e.name?.toLowerCase()))
    .filter(e => e.position && bot.entity.position.distanceTo(e.position) < 16);
}

function getNearbyPlayers() {
  return Object.values(bot.players)
    .filter(p => p.entity && p.username !== bot.username)
    .filter(p => bot.entity.position.distanceTo(p.entity.position) < AUTONOMOUS_CONFIG.helpRadius);
}

function getCurrentPhaseInfo() {
  const goalConfig = GOAL_PHASES[worldMemory.autonomousProgress.currentGoal] || GOAL_PHASES.thriving_survivor;
  const currentPhase = worldMemory.autonomousProgress.phase;
  return goalConfig[currentPhase] || goalConfig.survival;
}

function advancePhaseIfComplete() {
  const goalConfig = GOAL_PHASES[worldMemory.autonomousProgress.currentGoal] || GOAL_PHASES.thriving_survivor;
  const currentPhase = worldMemory.autonomousProgress.phase;
  const phaseInfo = goalConfig[currentPhase];
  
  if (phaseInfo && phaseInfo.completionCheck && phaseInfo.completionCheck(worldMemory.autonomousProgress)) {
    const phases = Object.keys(goalConfig);
    const currentIndex = phases.indexOf(currentPhase);
    
    if (currentIndex < phases.length - 1) {
      const nextPhase = phases[currentIndex + 1];
      worldMemory.autonomousProgress.phase = nextPhase;
      saveWorldMemory();
      
      logEvent('phase_advanced', { 
        from: currentPhase, 
        to: nextPhase,
        goal: worldMemory.autonomousProgress.currentGoal 
      });
      
      if (AUTONOMOUS_CONFIG.announceActions) {
        bot.chat(`Phase complete! Moving to: ${nextPhase}`);
      }
      return true;
    }
  }
  return false;
}

function countInventoryItem(itemName) {
  return bot.inventory.items()
    .filter(i => i.name.includes(itemName))
    .reduce((sum, i) => sum + i.count, 0);
}

function hasItem(itemName) {
  return bot.inventory.items().some(i => i.name.includes(itemName));
}

async function getAutonomousGoal() {
  // Priority 1: DANGER - Handle immediate threats
  const hostiles = getNearbyHostiles();
  if (hostiles.length > 0 && bot.health < 12) {
    // Flee from danger if low health
    const nearest = hostiles[0];
    const fleeX = bot.entity.position.x + (bot.entity.position.x - nearest.position.x) * 3;
    const fleeZ = bot.entity.position.z + (bot.entity.position.z - nearest.position.z) * 3;
    return { action: 'goto', x: Math.floor(fleeX), y: bot.entity.position.y, z: Math.floor(fleeZ), reason: 'fleeing_danger', priority: PRIORITY.DANGER };
  }
  
  // Priority 2: Player commands are active - don't interfere
  if (isPlayerCommandActive()) {
    return null;
  }
  
  // Priority 3: Critical needs
  if (bot.health < 6) {
    const food = bot.inventory.items().find(i => FOOD_ITEMS.includes(i.name));
    if (food) {
      return { action: 'eat', reason: 'critical_health', priority: PRIORITY.CRITICAL_NEED };
    }
    // No food, seek shelter
    if (worldMemory.home) {
      return { action: 'goto_landmark', name: 'home', reason: 'critical_health_no_food', priority: PRIORITY.CRITICAL_NEED };
    }
  }
  
  // Priority 4: Hunger
  if (bot.food < 6) {
    const food = bot.inventory.items().find(i => FOOD_ITEMS.includes(i.name));
    if (food) {
      return { action: 'eat', reason: 'hungry', priority: PRIORITY.HUNGER };
    }
    // No food - hunt for some
    return { action: 'find_food', reason: 'no_food_hungry', priority: PRIORITY.HUNGER };
  }
  
  // Priority 5: Autonomous goals based on current phase
  const phase = worldMemory.autonomousProgress.phase;
  const phaseInfo = getCurrentPhaseInfo();
  
  // Check phase completion first
  advancePhaseIfComplete();
  
  // Generate action based on phase
  return getPhaseAction(phase);
}

async function getPhaseAction(phase) {
  const progress = worldMemory.autonomousProgress;
  
  switch (phase) {
    case 'survival': {
      // Basic survival - get wood, get food, stay safe
      const woodCount = countInventoryItem('log') + countInventoryItem('planks');
      if (woodCount < 16) {
        return { action: 'goal', goal: 'gather_wood', reason: 'survival_wood', priority: PRIORITY.AUTONOMOUS_GOAL };
      }
      
      // Make basic tools if we have wood
      if (!hasItem('wooden_pickaxe') && !hasItem('stone_pickaxe') && !hasItem('iron_pickaxe')) {
        if (hasItem('planks') || hasItem('log')) {
          return { action: 'craft', item: 'wooden_pickaxe', count: 1, reason: 'need_pickaxe', priority: PRIORITY.AUTONOMOUS_GOAL };
        }
      }
      
      // If night, find/build shelter
      const time = bot.time.timeOfDay;
      const isNight = time >= 13000 && time <= 23000;
      if (isNight) {
        const bed = bot.findBlock({ matching: b => b.name.includes('bed'), maxDistance: 32 });
        if (bed) {
          return { action: 'sleep', reason: 'night_time', priority: PRIORITY.AUTONOMOUS_GOAL };
        }
      }
      
      // Survival phase complete criteria check
      if (woodCount >= 16 && bot.food >= 10) {
        progress.phase = 'home';
        saveWorldMemory();
        return { action: 'chat', message: 'Survival basics secured! Building a home...', priority: PRIORITY.AUTONOMOUS_GOAL };
      }
      
      return { action: 'goal', goal: 'explore', reason: 'looking_for_resources', priority: PRIORITY.AUTONOMOUS_GOAL };
    }
    
    case 'home': {
      // Establish home base
      if (!worldMemory.home) {
        // Set current location as home if safe
        const hostiles = getNearbyHostiles();
        if (hostiles.length === 0) {
          return { action: 'set_home', reason: 'establishing_base', priority: PRIORITY.AUTONOMOUS_GOAL };
        }
      }
      
      // Build shelter if we haven't
      if (!progress.tasksCompleted.includes('built_shelter')) {
        const cobble = countInventoryItem('cobblestone');
        const planks = countInventoryItem('planks');
        
        if (cobble >= 24 || planks >= 24) {
          progress.tasksCompleted.push('built_shelter');
          saveWorldMemory();
          return { action: 'build', template: 'shelter_3x3', blockType: cobble >= 24 ? 'cobblestone' : 'planks', reason: 'building_shelter', priority: PRIORITY.AUTONOMOUS_GOAL };
        }
        
        // Need more materials
        if (cobble < 24) {
          return { action: 'mine_resource', resource: 'stone', count: 32, reason: 'need_cobble_for_shelter', priority: PRIORITY.AUTONOMOUS_GOAL };
        }
      }
      
      // Place bed if we have one
      if (hasItem('bed') && !progress.tasksCompleted.includes('placed_bed')) {
        progress.tasksCompleted.push('placed_bed');
        saveWorldMemory();
        return { action: 'place', blockType: 'bed', reason: 'placing_bed', priority: PRIORITY.AUTONOMOUS_GOAL };
      }
      
      // Home phase complete
      if (worldMemory.home && progress.tasksCompleted.includes('built_shelter')) {
        progress.phase = 'resources';
        saveWorldMemory();
        return { action: 'chat', message: 'Home established! Gathering resources...', priority: PRIORITY.AUTONOMOUS_GOAL };
      }
      
      return { action: 'goal', goal: 'gather_wood', reason: 'need_materials', priority: PRIORITY.AUTONOMOUS_GOAL };
    }
    
    case 'resources': {
      // Gather essential resources: wood, stone, coal, iron
      const woodCount = countInventoryItem('log');
      const stoneCount = countInventoryItem('cobblestone');
      const coalCount = countInventoryItem('coal');
      const ironCount = countInventoryItem('raw_iron') + countInventoryItem('iron_ingot');
      
      // Priority: iron > coal > stone > wood
      if (ironCount < 16) {
        if (hasItem('pickaxe')) {
          return { action: 'mine_resource', resource: 'iron', count: 16, reason: 'need_iron', priority: PRIORITY.AUTONOMOUS_GOAL };
        }
      }
      
      if (coalCount < 16) {
        if (hasItem('pickaxe')) {
          return { action: 'mine_resource', resource: 'coal', count: 16, reason: 'need_coal', priority: PRIORITY.AUTONOMOUS_GOAL };
        }
      }
      
      if (stoneCount < 32 && hasItem('pickaxe')) {
        return { action: 'mine_resource', resource: 'stone', count: 32, reason: 'need_stone', priority: PRIORITY.AUTONOMOUS_GOAL };
      }
      
      if (woodCount < 32) {
        return { action: 'goal', goal: 'gather_wood', reason: 'need_wood', priority: PRIORITY.AUTONOMOUS_GOAL };
      }
      
      // Resources phase complete
      progress.stats.blocksGathered = { wood: woodCount, stone: stoneCount, coal: coalCount, iron: ironCount };
      if (ironCount >= 16 && coalCount >= 16) {
        progress.phase = 'crafting';
        saveWorldMemory();
        return { action: 'chat', message: 'Resources gathered! Time to craft gear...', priority: PRIORITY.AUTONOMOUS_GOAL };
      }
      
      return { action: 'goal', goal: 'explore', reason: 'searching_for_ores', priority: PRIORITY.AUTONOMOUS_GOAL };
    }
    
    case 'crafting': {
      // Craft essential tools: pickaxes, furnace, chest
      
      // Smelt iron if we have raw iron and coal
      const rawIron = countInventoryItem('raw_iron');
      const coal = countInventoryItem('coal');
      if (rawIron > 0 && coal > 0) {
        // Find or craft furnace first
        if (!hasItem('furnace')) {
          const cobble = countInventoryItem('cobblestone');
          if (cobble >= 8) {
            return { action: 'craft', item: 'furnace', count: 1, reason: 'need_furnace', priority: PRIORITY.AUTONOMOUS_GOAL };
          }
        }
        // Smelt the iron (cooking works for ores too)
        return { action: 'cook_food', reason: 'smelting_iron', priority: PRIORITY.AUTONOMOUS_GOAL };
      }
      
      // Craft iron pickaxe
      const ironIngots = countInventoryItem('iron_ingot');
      if (ironIngots >= 3 && !hasItem('iron_pickaxe')) {
        if (!progress.toolsCrafted.includes('iron_pickaxe')) {
          progress.toolsCrafted.push('iron_pickaxe');
          saveWorldMemory();
        }
        return { action: 'craft', item: 'iron_pickaxe', count: 1, reason: 'upgrading_tools', priority: PRIORITY.AUTONOMOUS_GOAL };
      }
      
      // Craft stone pickaxe if no iron
      if (!hasItem('stone_pickaxe') && !hasItem('iron_pickaxe')) {
        const cobble = countInventoryItem('cobblestone');
        if (cobble >= 3 && hasItem('stick')) {
          return { action: 'craft', item: 'stone_pickaxe', count: 1, reason: 'need_stone_tools', priority: PRIORITY.AUTONOMOUS_GOAL };
        }
      }
      
      // Craft storage
      if (!hasItem('chest') && countInventoryItem('planks') >= 8) {
        return { action: 'craft', item: 'chest', count: 1, reason: 'need_storage', priority: PRIORITY.AUTONOMOUS_GOAL };
      }
      
      // Crafting phase complete
      if (hasItem('iron_pickaxe')) {
        progress.phase = 'exploration';
        saveWorldMemory();
        return { action: 'chat', message: 'Fully equipped! Time to explore the world...', priority: PRIORITY.AUTONOMOUS_GOAL };
      }
      
      // Need more resources
      return { action: 'mine_resource', resource: 'iron', count: 8, reason: 'need_more_iron', priority: PRIORITY.AUTONOMOUS_GOAL };
    }
    
    case 'exploration': {
      // Explore the world, find interesting things
      const exploredCount = progress.stats.areasExplored.length;
      
      // Mark current area as explored periodically
      const currentPos = `${Math.floor(bot.entity.position.x/100)}_${Math.floor(bot.entity.position.z/100)}`;
      if (!progress.stats.areasExplored.includes(currentPos)) {
        progress.stats.areasExplored.push(currentPos);
        saveWorldMemory();
        
        // Mark interesting locations
        const village = Object.values(bot.entities).find(e => e.name?.toLowerCase() === 'villager');
        if (village && village.position) {
          markLocation(`village_${exploredCount}`, 'village', 'Found during exploration');
        }
      }
      
      // Help nearby players if configured
      if (AUTONOMOUS_CONFIG.helpNearbyPlayers) {
        const nearbyPlayers = getNearbyPlayers();
        if (nearbyPlayers.length > 0) {
          const player = nearbyPlayers[0];
          return { action: 'follow', username: player.username, distance: 4, reason: 'helping_player', priority: PRIORITY.AUTONOMOUS_GOAL };
        }
      }
      
      // Exploration complete after visiting 5 areas
      if (exploredCount >= 5) {
        progress.phase = 'thriving';
        saveWorldMemory();
        return { action: 'chat', message: 'World explored! Now thriving...', priority: PRIORITY.AUTONOMOUS_GOAL };
      }
      
      // Continue exploring
      return { action: 'goal', goal: 'explore', reason: 'discovering_world', priority: PRIORITY.AUTONOMOUS_GOAL };
    }
    
    case 'thriving': {
      // Ongoing maintenance and improvement
      
      // Help nearby players first
      if (AUTONOMOUS_CONFIG.helpNearbyPlayers) {
        const nearbyPlayers = getNearbyPlayers();
        if (nearbyPlayers.length > 0) {
          // Stay near but don't follow obsessively
          const player = nearbyPlayers[0];
          const distance = bot.entity.position.distanceTo(player.entity.position);
          if (distance > 10) {
            return { action: 'follow', username: player.username, distance: 5, reason: 'staying_near_player', priority: PRIORITY.AUTONOMOUS_GOAL };
          }
        }
      }
      
      // Store excess items if inventory getting full
      const inventoryCount = bot.inventory.items().length;
      if (inventoryCount > 30) {
        const chest = bot.findBlock({ matching: b => b.name === 'chest', maxDistance: 32 });
        if (chest) {
          return { action: 'store_items', reason: 'inventory_full', priority: PRIORITY.AUTONOMOUS_GOAL };
        }
      }
      
      // Gather more resources if low
      const woodCount = countInventoryItem('log');
      if (woodCount < 16) {
        return { action: 'goal', goal: 'gather_wood', reason: 'restocking_wood', priority: PRIORITY.AUTONOMOUS_GOAL };
      }
      
      // Trade with villagers if nearby
      const villager = Object.values(bot.entities)
        .find(e => e.name?.toLowerCase() === 'villager' && 
              e.position && bot.entity.position.distanceTo(e.position) < 32);
      if (villager && hasItem('emerald')) {
        return { action: 'trade', index: -1, reason: 'trading', priority: PRIORITY.AUTONOMOUS_GOAL };
      }
      
      // Default: light exploration
      return { action: 'goal', goal: 'explore', reason: 'casual_exploration', priority: PRIORITY.AUTONOMOUS_GOAL };
    }
    
    default:
      return { action: 'goal', goal: 'explore', reason: 'default_action', priority: PRIORITY.AUTONOMOUS_GOAL };
  }
}

async function executeAutonomousAction(action) {
  if (!action) return;
  
  // Set this as our current autonomous goal
  currentAutonomousGoal = action;
  action.source = 'autonomous';
  
  lastAutonomousAction = action;
  worldMemory.autonomousProgress.lastAction = action.action;
  worldMemory.autonomousProgress.lastActionTime = Date.now();
  
  logEvent('autonomous_action', { 
    action: action.action, 
    reason: action.reason,
    phase: worldMemory.autonomousProgress.phase
  });
  
  if (AUTONOMOUS_CONFIG.announceActions && action.reason) {
    // Only announce significant actions
    const significantActions = ['build', 'mine_resource', 'craft', 'set_home', 'goto_landmark', 'explore'];
    if (significantActions.includes(action.action)) {
      const msg = action.reason.replace(/_/g, ' ');
      bot.chat(`[${worldMemory.autonomousProgress.phase}] ${msg}`);
    }
  }
  
  try {
    await executeCommand(action);
  } catch (err) {
    logEvent('autonomous_error', { action: action.action, error: err.message });
  } finally {
    // Clear current goal when done (unless it's a continuous action like follow)
    if (action.action !== 'follow') {
      currentAutonomousGoal = null;
      
      // After completing autonomous action, check for queued requests
      if (requestQueue.length > 0) {
        setTimeout(() => processRequestQueue(), 1000); // Small delay before processing queue
      }
    }
  }
}

function startAutonomousBehavior() {
  if (autonomousInterval) clearInterval(autonomousInterval);
  
  if (!AUTONOMOUS_CONFIG.enabled) {
    console.log('Autonomous behavior disabled');
    return;
  }
  
  // Load known entities from memory
  if (worldMemory.knownEntities) {
    knownEntities = worldMemory.knownEntities;
  }
  
  console.log('Starting autonomous behavior system with AGENCY...');
  logEvent('autonomous_started', { 
    goal: worldMemory.autonomousProgress.currentGoal,
    phase: worldMemory.autonomousProgress.phase,
    mode: 'agency'
  });
  
  autonomousInterval = setInterval(async () => {
    // Process any queued requests first
    if (requestQueue.length > 0 && !currentAutonomousGoal) {
      await processRequestQueue();
      return;
    }
    
    // Skip if we're actively doing something
    if (currentAutonomousGoal && Date.now() - worldMemory.autonomousProgress.lastActionTime < 5000) {
      return;
    }
    
    // Skip if there are pending external commands
    if (hasPendingCommands()) return;
    
    // Get next autonomous goal
    const action = await getAutonomousGoal();
    if (action) {
      await executeAutonomousAction(action);
    }
  }, AUTONOMOUS_CONFIG.checkIntervalMs);
}

function stopAutonomousBehavior() {
  if (autonomousInterval) {
    clearInterval(autonomousInterval);
    autonomousInterval = null;
  }
  logEvent('autonomous_stopped', {});
}

function setAutonomousGoal(goalName) {
  if (!GOAL_PHASES[goalName]) {
    bot.chat(`Unknown goal: ${goalName}. Available: ${Object.keys(GOAL_PHASES).join(', ')}`);
    return false;
  }
  
  worldMemory.autonomousProgress.currentGoal = goalName;
  worldMemory.autonomousProgress.phase = Object.keys(GOAL_PHASES[goalName])[0];
  worldMemory.autonomousProgress.tasksCompleted = [];
  saveWorldMemory();
  
  bot.chat(`Goal set to: ${goalName}. Starting phase: ${worldMemory.autonomousProgress.phase}`);
  logEvent('autonomous_goal_changed', { goal: goalName });
  return true;
}

// ==========================================
// AUTO-SURVIVAL LOOP
// ==========================================

async function autoSurvival() {
  // Auto-eat when hungry (Phase 8) - this is self-preservation, always do it
  if (bot.food < 6) {
    await autoEat();
  }
  
  // Auto-sleep at night if safe (Phase 11)
  const time = bot.time.timeOfDay;
  const isNight = time >= 13000 && time <= 23000;
  const nearHostiles = getNearbyHostiles();
  
  if (isNight && nearHostiles.length === 0 && !currentGoal && !currentAutonomousGoal) {
    const bed = bot.findBlock({ matching: b => b.name.includes('bed'), maxDistance: 32 });
    if (bed) {
      // Self-preservation sleep - high priority
      await sleepInBed();
    }
  }
  
  // Phase 20: Agency-based autonomous behavior
  // The main autonomous loop handles goal pursuit via startAutonomousBehavior()
  // This function focuses on survival instincts that override everything
}

// ==========================================
// PERCEPTION UPDATE
// ==========================================

function updatePerception() {
  const nearbyPlayers = Object.values(bot.players)
    .filter(p => p.entity && bot.entity.position.distanceTo(p.entity.position) < 60)
    .map(p => ({
      username: p.username,
      distance: Math.floor(bot.entity.position.distanceTo(p.entity.position)),
      position: {
        x: Math.floor(p.entity.position.x),
        y: Math.floor(p.entity.position.y),
        z: Math.floor(p.entity.position.z)
      }
    }));

  const hostileMobs = Object.values(bot.entities)
    .filter(e => e.type === 'mob' && e.position && 
      ['zombie', 'skeleton', 'creeper', 'spider', 'enderman'].includes(e.name?.toLowerCase()))
    .filter(e => bot.entity.position.distanceTo(e.position) < 20)
    .map(e => ({
      type: e.name,
      distance: Math.floor(bot.entity.position.distanceTo(e.position)),
      position: {
        x: Math.floor(e.position.x),
        y: Math.floor(e.position.y),
        z: Math.floor(e.position.z)
      }
    }));

  // Phase 8: Food animals
  const foodAnimals = Object.values(bot.entities)
    .filter(e => e.type === 'mob' && FOOD_ANIMALS.includes(e.name?.toLowerCase()))
    .filter(e => e.position && bot.entity.position.distanceTo(e.position) < 32)
    .map(e => ({
      type: e.name,
      distance: Math.floor(bot.entity.position.distanceTo(e.position))
    }));

  const pos = bot.entity.position.floored();
  const blockBelow = bot.blockAt(pos.offset(0, -1, 0));
  const blockAt = bot.blockAt(pos);
  
  let dangerUnderfoot = null;
  if (!blockBelow || blockBelow.name === 'air') {
    dangerUnderfoot = 'cliff';
  } else if (blockBelow.name === 'lava' || blockAt?.name === 'lava') {
    dangerUnderfoot = 'lava';
  } else if (blockBelow.name === 'cactus' || blockAt?.name === 'cactus') {
    dangerUnderfoot = 'cactus';
  }

  const inWater = bot.entity.isInWater;
  const oxygen = bot.oxygenLevel;
  
  if (inWater && oxygen < 50) {
    bot.setControlState('jump', true);
    logEvent('danger', { reason: 'drowning_critical', oxygen, inWater: true });
  } else if (inWater && oxygen < 100) {
    logEvent('danger', { reason: 'drowning_warning', oxygen, inWater: true });
    bot.setControlState('jump', false);
  } else {
    bot.setControlState('jump', false);
  }

  const inventory = bot.inventory.items().map(item => ({
    name: item.name,
    count: item.count,
    slot: item.slot
  }));

  // Phase 8: Hunger urgency
  let hungerUrgency = 'normal';
  if (bot.food <= 3) hungerUrgency = 'critical';
  else if (bot.food <= 6) hungerUrgency = 'hungry';
  else if (bot.food <= 10) hungerUrgency = 'peckish';

  // Count food items
  const foodCount = inventory.filter(i => FOOD_ITEMS.includes(i.name)).reduce((sum, i) => sum + i.count, 0);

  // Phase 22: Add experience and recent sounds to perception
  const experience = {
    level: bot.experience.level,
    points: bot.experience.points,
    progress: bot.experience.progress
  };

  const recentSoundsSummary = recentSounds
    .filter(s => Date.now() - s.timestamp < 30000) // Last 30 seconds
    .map(s => ({
      name: s.name,
      position: s.position,
      ago: Math.floor((Date.now() - s.timestamp) / 1000)
    }))
    .slice(0, 5);

  // Phase 22: Track vehicle state
  const vehicleState = bot.vehicle ? {
    mounted: true,
    vehicleName: bot.vehicle.name || 'unknown',
    vehicleId: bot.vehicle.id
  } : { mounted: false };

  // Phase 22: Track watched blocks count
  const watchedBlocksCount = watchedBlocks.size;

  // Phase 23: Get survival features state
  const phase23State = typeof getPhase23Perception === 'function' ? getPhase23Perception() : null;

  logEvent('perception', {
    position: {
      x: Math.floor(bot.entity.position.x),
      y: Math.floor(bot.entity.position.y),
      z: Math.floor(bot.entity.position.z)
    },
    health: bot.health,
    food: bot.food,
    hungerUrgency,
    foodCount,
    nearbyPlayers,
    hostileMobs,
    foodAnimals,
    dangerUnderfoot,
    inWater,
    oxygen,
    currentGoal,
    time: bot.time.timeOfDay,
    isDay: bot.time.timeOfDay < 12541 || bot.time.timeOfDay > 23458,
    inventory: inventory.slice(0, 20),
    // Phase 22: New perception fields
    experience,
    recentSounds: recentSoundsSummary,
    vehicle: vehicleState,
    watchedBlocks: watchedBlocksCount,
    // Phase 23: Critical survival features state
    phase23: phase23State
  });
}

// ==========================================
// CHAT COMMAND HANDLER
// ==========================================

bot.on('chat', (username, message) => {
  if (username === bot.username) return;
  console.log(`${username}: ${message}`);
  logEvent('chat', { username, message });

  // Phase 21: Listen for bot announcements
  if (message === '🤖 BOT_ANNOUNCE' && username !== bot.username) {
    registerBot(username);
    // Respond with our own announcement so they know about us
    setTimeout(() => {
      bot.chat('🤖 BOT_ANNOUNCE');
    }, 500 + Math.random() * 500); // Stagger to avoid message floods
    return;
  }

  const msg = message.toLowerCase().trim();

  // Dynamic command prefix
  const cmd = getCommandPrefix();
  
  // Contextual introduction - only if asked
  if (msg.includes('who are you') || msg.includes(`who is ${cmd}`) || msg === `${cmd} intro` || msg === `${cmd} hi` || msg === `${cmd} hello`) {
    const intro = considerIntroducing();
    if (intro) {
      bot.chat(intro);
      if (getTrustLevel(username) < TRUST_LEVELS.FRIEND) {
        setTimeout(() => bot.chat(`Say "${cmd} trust me" to work together.`), 1000);
      }
    }
    return;
  }

  // Help command
  if (msg === `${cmd} help`) {
    bot.chat('Commands: follow, stop, gather wood, explore, goto X Y Z, dig, place, equip, inventory');
    setTimeout(() => bot.chat('find_food, cook_food, craft <item>, mine <resource>, sleep, eat, status'), 500);
    setTimeout(() => bot.chat('build <template>, store, retrieve, mark <name>, goto_mark <name>, trade'), 1000);
    setTimeout(() => bot.chat('AGENCY: why, queue, clear queue, okay, nevermind, insist, no rush'), 1500);
    setTimeout(() => bot.chat('TRUST: trust me, trust <player> <level>, who trusts'), 2000);
    setTimeout(() => bot.chat('AUTONOMOUS: auto on/off, set goal <name>, goals, phase, progress'), 2500);
    setTimeout(() => bot.chat('BOT-COM: bots, ask <bot> to <action>, announce <msg>, emergency, claims'), 3000);
    setTimeout(() => bot.chat('VEHICLE: steer <dir>, stop vehicle | ENTITY: breed <animal>, shear, milk'), 3500);
    setTimeout(() => bot.chat('ITEMS: drop <item> [count], give <player> <item> [count]'), 4000);
    setTimeout(() => bot.chat('MISC: look at <player>, sounds, xp/level, write log, watch door/chest'), 4500);
    setTimeout(() => bot.chat('SMELT: smelt <item> | FARM: till, plant <crop>, harvest, farm <crop>'), 5000);
    setTimeout(() => bot.chat('COMBAT: shoot <target>, block/shield | INV: inv status, manage inventory'), 5500);
    return;
  }

  // Basic commands - all go through agency system
  if (msg === `${cmd} follow`) {
    const request = { action: 'follow', username, distance: 2, originalMessage: message };
    processExternalRequest(request, username);
    return;
  }
  if (msg === `${cmd} stop`) {
    // Stop is special - always accept, clears everything
    currentAutonomousGoal = null;
    requestQueue = [];
    enqueueCommands([{ action: 'stop' }]);
    bot.chat('Stopping. Returning to my goals...');
    return;
  }
  if (msg === `${cmd} gather wood`) {
    const request = { action: 'goal', goal: 'gather_wood', originalMessage: message };
    processExternalRequest(request, username);
    return;
  }
  if (msg === `${cmd} explore`) {
    const request = { action: 'goal', goal: 'explore', originalMessage: message };
    processExternalRequest(request, username);
    return;
  }
  if (msg.startsWith(`${cmd} goto `) && msg.split(' ').length === 5) {
    const parts = msg.split(/\s+/);
    const x = parseInt(parts[2]);
    const y = parseInt(parts[3]);
    const z = parseInt(parts[4]);
    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
      const request = { action: 'goto', x, y, z, originalMessage: message };
      processExternalRequest(request, username);
    }
    return;
  }
  
  // Block interaction (Phase 5)
  if (msg === `${cmd} dig` || msg === `${cmd} mine`) {
    enqueueCommands([{ action: 'dig', direction: 'front' }]);
    bot.chat('Mining block!');
  }
  if (msg === `${cmd} dig below`) {
    enqueueCommands([{ action: 'dig', direction: 'below' }]);
  }
  if (msg.startsWith(`${cmd} place `)) {
    const blockType = msg.replace(`${cmd} place `, '').trim();
    if (blockType) {
      enqueueCommands([{ action: 'place', blockType }]);
    }
  }
  if (msg.startsWith(`${cmd} equip `)) {
    const item = msg.replace(`${cmd} equip `, '').trim();
    if (item) enqueueCommands([{ action: 'equip', item }]);
  }
  if (msg === `${cmd} inventory` || msg === `${cmd} inv`) {
    const items = bot.inventory.items();
    if (items.length === 0) {
      bot.chat('Inventory empty!');
    } else {
      const summary = items.slice(0, 6).map(i => `${i.name}x${i.count}`).join(', ');
      bot.chat(`Inv: ${summary}${items.length > 6 ? '...' : ''}`);
    }
  }
  
  // Combat (Phase 6) - evaluated due to impact
  if (msg === `${cmd} attack` || msg === `${cmd} fight`) {
    const request = { action: 'attack', originalMessage: message };
    processExternalRequest(request, username);
    return;
  }
  if (msg.startsWith(`${cmd} attack `)) {
    const target = msg.replace(`${cmd} attack `, '').trim();
    const request = { action: 'attack', target, originalMessage: message };
    processExternalRequest(request, username);
    return;
  }
  if (msg === `${cmd} retreat`) {
    // Retreat is always accepted - survival action
    stopCombat();
    stopHunting();
    bot.chat('Retreating!');
    return;
  }

  // Phase 8: Hunger/Food - evaluated
  if (msg === `${cmd} find food` || msg === `${cmd} hunt`) {
    const request = { action: 'find_food', originalMessage: message };
    processExternalRequest(request, username);
    return;
  }
  if (msg === `${cmd} cook` || msg === `${cmd} cook food`) {
    const request = { action: 'cook_food', originalMessage: message };
    processExternalRequest(request, username);
    return;
  }
  if (msg === `${cmd} eat`) {
    // Eating is always allowed - survival action
    enqueueCommands([{ action: 'eat' }]);
    return;
  }
  if (msg === `${cmd} status`) {
    const trust = getTrustLevel(username);
    const current = currentAutonomousGoal ? currentAutonomousGoal.action : 'idle';
    bot.chat(`HP: ${Math.floor(bot.health)}/20, Food: ${bot.food}/20 | Current: ${current} | Your trust: ${trust}`);
    return;
  }

  // Phase 9: Crafting - evaluated
  if (msg.startsWith(`${cmd} craft `)) {
    const itemName = msg.replace(`${cmd} craft `, '').trim();
    const parts = itemName.split(' ');
    let count = 1;
    let item = itemName;
    if (parts.length > 1 && !isNaN(parseInt(parts[parts.length - 1]))) {
      count = parseInt(parts.pop());
      item = parts.join('_');
    }
    const request = { action: 'craft', item: item.replace(/ /g, '_'), count, originalMessage: message };
    processExternalRequest(request, username);
    return;
  }

  // Phase 10: Mining - goes through agency (resource-intensive)
  if (msg.startsWith(`${cmd} mine `)) {
    const resource = msg.replace(`${cmd} mine `, '').trim();
    const parts = resource.split(' ');
    let count = 16;
    let res = resource;
    if (parts.length > 1 && !isNaN(parseInt(parts[parts.length - 1]))) {
      count = parseInt(parts.pop());
      res = parts.join('_');
    }
    const request = { action: 'mine_resource', resource: res.replace(/ /g, '_'), count, originalMessage: message };
    processExternalRequest(request, username);
    return;
  }

  // Phase 11: Sleep
  if (msg === `${cmd} sleep` || msg === `${cmd} bed`) {
    enqueueCommands([{ action: 'sleep' }]);
  }

  // Phase 12: Building - evaluated (resource-intensive)
  if (msg.startsWith(`${cmd} build `)) {
    const parts = msg.replace(`${cmd} build `, '').trim().split(' ');
    const template = parts[0];
    const blockType = parts[1] || 'cobblestone';
    const request = { action: 'build', template, blockType, originalMessage: message };
    processExternalRequest(request, username);
    return;
  }

  // Phase 13: Storage - evaluated
  if (msg === `${cmd} store` || msg === `${cmd} store items`) {
    const request = { action: 'store_items', originalMessage: message };
    processExternalRequest(request, username);
    return;
  }
  if (msg.startsWith(`${cmd} retrieve `)) {
    const items = msg.replace(`${cmd} retrieve `, '').trim().split(' ');
    const request = { action: 'retrieve_items', items, originalMessage: message };
    processExternalRequest(request, username);
    return;
  }

  // Phase 14: World Memory
  if (msg.startsWith(`${cmd} mark `)) {
    const name = msg.replace(`${cmd} mark `, '').trim().replace(/ /g, '_');
    enqueueCommands([{ action: 'mark_location', name }]);
  }
  if (msg.startsWith(`${cmd} goto mark `) || msg.startsWith(`${cmd} go to `)) {
    const name = msg.replace(`${cmd} goto mark `, '').replace(`${cmd} go to `, '').trim().replace(/ /g, '_');
    enqueueCommands([{ action: 'goto_landmark', name }]);
  }
  if (msg === `${cmd} set home`) {
    enqueueCommands([{ action: 'set_home' }]);
  }
  if (msg === `${cmd} go home`) {
    enqueueCommands([{ action: 'goto_landmark', name: 'home' }]);
    bot.chat('Going home!');
  }
  if (msg === `${cmd} landmarks` || msg === `${cmd} marks`) {
    const marks = Object.keys(worldMemory.landmarks).join(', ') || 'none';
    bot.chat(`Landmarks: ${marks}`);
  }

  // Phase 15: Trading - evaluated
  if (msg === `${cmd} trade`) {
    const request = { action: 'trade', index: -1, originalMessage: message };
    processExternalRequest(request, username);
    return;
  }
  if (msg.startsWith(`${cmd} trade `)) {
    const index = parseInt(msg.replace(`${cmd} trade `, '').trim());
    const request = { action: 'trade', index, originalMessage: message };
    processExternalRequest(request, username);
    return;
  }

  // Phase 16: Potions/Enchanting - evaluated
  if (msg === `${cmd} brew` || msg === `${cmd} potion`) {
    const request = { action: 'brew', originalMessage: message };
    processExternalRequest(request, username);
    return;
  }
  if (msg === `${cmd} enchant`) {
    const request = { action: 'enchant', originalMessage: message };
    processExternalRequest(request, username);
    return;
  }

  // Phase 20: Autonomous Behavior Control
  if (msg === `${cmd} auto` || msg === `${cmd} autonomous`) {
    const status = AUTONOMOUS_CONFIG.enabled ? 'ON' : 'OFF';
    const phase = worldMemory.autonomousProgress.phase;
    const goal = worldMemory.autonomousProgress.currentGoal;
    const trust = getTrustLevel(username);
    bot.chat(`Autonomous: ${status} | Goal: ${goal} | Phase: ${phase} | Your trust: ${trust}`);
  }
  
  // Trust management
  if (msg === `${cmd} trust me`) {
    // Only first person to claim owner, or existing owner can set
    const existingOwner = Object.entries(knownEntities).find(([_, v]) => v.trust === TRUST_LEVELS.OWNER);
    if (!existingOwner) {
      setTrustLevel(username, TRUST_LEVELS.OWNER);
      bot.chat(`${username} is now my owner. I'll prioritize your requests!`);
    } else if (existingOwner[0] === username) {
      bot.chat(`You're already my owner, ${username}!`);
    } else {
      bot.chat(`I already have an owner. Ask ${existingOwner[0]} to change it.`);
    }
  }
  if (msg.startsWith(`${cmd} trust `) && msg !== `${cmd} trust me`) {
    const trust = getTrustLevel(username);
    if (trust !== TRUST_LEVELS.OWNER) {
      bot.chat("Only my owner can set trust levels.");
      return;
    }
    const parts = msg.replace(`${cmd} trust `, '').trim().split(' ');
    if (parts.length >= 2) {
      const targetPlayer = parts[0];
      const level = parts[1].toLowerCase();
      const trustMap = { owner: TRUST_LEVELS.OWNER, friend: TRUST_LEVELS.FRIEND, neutral: TRUST_LEVELS.NEUTRAL, hostile: TRUST_LEVELS.HOSTILE };
      if (trustMap[level]) {
        setTrustLevel(targetPlayer, trustMap[level]);
        bot.chat(`Set ${targetPlayer}'s trust to ${level}.`);
      } else {
        bot.chat(`Unknown trust level. Use: owner, friend, neutral, hostile`);
      }
    }
  }
  if (msg === `${cmd} who trusts`) {
    const trusted = Object.entries(knownEntities).map(([name, data]) => `${name}:${data.trust}`).join(', ') || 'nobody yet';
    bot.chat(`Trust list: ${trusted}`);
  }
  if (msg === `${cmd} auto on` || msg === `${cmd} autonomous on`) {
    AUTONOMOUS_CONFIG.enabled = true;
    startAutonomousBehavior();
    bot.chat('Autonomous behavior enabled! I\'ll pursue goals independently.');
  }
  if (msg === `${cmd} auto off` || msg === `${cmd} autonomous off`) {
    AUTONOMOUS_CONFIG.enabled = false;
    stopAutonomousBehavior();
    bot.chat('Autonomous behavior disabled. Waiting for commands.');
  }
  if (msg.startsWith(`${cmd} set goal `)) {
    const goalName = msg.replace(`${cmd} set goal `, '').trim().replace(/ /g, '_');
    setAutonomousGoal(goalName);
  }
  if (msg === `${cmd} goals`) {
    const goals = Object.keys(GOAL_PHASES).join(', ');
    bot.chat(`Available goals: ${goals}`);
  }
  if (msg === `${cmd} phase`) {
    const phase = worldMemory.autonomousProgress.phase;
    const phaseInfo = getCurrentPhaseInfo();
    bot.chat(`Current phase: ${phase} - ${phaseInfo.description}`);
  }
  if (msg === `${cmd} progress`) {
    const progress = worldMemory.autonomousProgress;
    bot.chat(`Goal: ${progress.currentGoal} | Phase: ${progress.phase}`);
    setTimeout(() => {
      const stats = progress.stats;
      bot.chat(`Resources: Wood:${stats.blocksGathered.wood} Stone:${stats.blocksGathered.stone} Iron:${stats.blocksGathered.iron}`);
    }, 500);
  }
  
  // Agency introspection
  if (msg === `${cmd} why` || msg === `${cmd} explain`) {
    const phase = worldMemory.autonomousProgress.phase;
    const phaseInfo = getCurrentPhaseInfo();
    const current = currentAutonomousGoal;
    const queued = requestQueue.length;
    
    if (current) {
      bot.chat(`I'm ${current.reason?.replace(/_/g, ' ') || current.action} because I'm in the ${phase} phase.`);
    } else {
      bot.chat(`I'm idle. ${phase} phase: ${phaseInfo.description}`);
    }
    
    if (queued > 0) {
      setTimeout(() => bot.chat(`I have ${queued} request(s) queued for later.`), 500);
    }
  }
  
  if (msg === `${cmd} queue`) {
    if (requestQueue.length === 0) {
      bot.chat("My request queue is empty.");
    } else {
      const items = requestQueue.map(q => `${q.request.action} from ${q.requester}`).join(', ');
      bot.chat(`Queued: ${items}`);
    }
  }
  
  if (msg === `${cmd} clear queue`) {
    const trust = getTrustLevel(username);
    if (trust === TRUST_LEVELS.OWNER || trust === TRUST_LEVELS.FRIEND) {
      const count = requestQueue.length;
      requestQueue = [];
      bot.chat(`Cleared ${count} queued requests.`);
    } else {
      bot.chat("Only my owner or friends can clear my queue.");
    }
  }

  // Phase 17: Block Activation (CRITICAL)
  if (msg === `${cmd} activate` || msg === `${cmd} use` || msg === `${cmd} click`) {
    enqueueCommands([{ action: 'activate' }]);
    bot.chat('Activating block in front of me...');
  }
  if (msg === `${cmd} door` || msg === `${cmd} open`) {
    enqueueCommands([{ action: 'activate' }]);
    bot.chat('Opening/closing...');
  }

  // Phase 18: Mount/Dismount (HIGH-VALUE)
  if (msg === `${cmd} mount` || msg === `${cmd} ride`) {
    enqueueCommands([{ action: 'mount' }]);
    bot.chat('Mounting nearby entity...');
  }
  if (msg === `${cmd} dismount` || msg === `${cmd} get off`) {
    enqueueCommands([{ action: 'dismount' }]);
    bot.chat('Dismounting...');
  }

  // Phase 19: Fishing (HIGH-VALUE) - evaluated
  if (msg === `${cmd} fish` || msg === `${cmd} fishing`) {
    const request = { action: 'fish', originalMessage: message };
    processExternalRequest(request, username);
    return;
  }
  
  // Agency negotiation responses
  if (msg === `${cmd} okay` || msg === `${cmd} yes` || msg === `${cmd} deal`) {
    // Accept a counter-proposal - process queued request immediately
    if (requestQueue.length > 0) {
      const next = requestQueue.shift();
      bot.chat(`Alright, helping you now, ${next.requester}!`);
      executeCommand(next.request);
    } else {
      bot.chat("I don't have any pending requests from you.");
    }
    return;
  }
  
  // Override/insist commands - for when requester understands the trade-off and wants to proceed anyway
  if (msg === `${cmd} insist` || msg === `${cmd} urgent` || msg === `${cmd} do it` || msg === `${cmd} do it anyway`) {
    const trust = getTrustLevel(username);
    if (trust !== TRUST_LEVELS.OWNER && trust !== TRUST_LEVELS.FRIEND) {
      bot.chat("Only my owner or friends can insist on overriding my current task.");
      return;
    }
    
    // Find their queued request
    const theirRequest = requestQueue.find(q => q.requester === username);
    if (theirRequest) {
      requestQueue = requestQueue.filter(q => q.requester !== username);
      const cost = calculateInterruptionCost();
      bot.chat(`Understood. Abandoning ${cost.shortDesc} to help you.`);
      currentAutonomousGoal = null;
      currentGoal = null;
      bot.pathfinder.setGoal(null);
      executeCommand(theirRequest.request);
    } else {
      bot.chat("You don't have a pending request. Tell me what you need first!");
    }
    return;
  }
  
  // "It can wait" - user acknowledges they'll wait
  if (msg === `${cmd} it can wait` || msg === `${cmd} no rush` || msg === `${cmd} finish first`) {
    const theirRequest = requestQueue.find(q => q.requester === username);
    if (theirRequest) {
      bot.chat(`Got it. I'll help you after I finish. You're #${requestQueue.indexOf(theirRequest) + 1} in queue.`);
    } else {
      bot.chat("No problem!");
    }
    return;
  }
  
  if (msg === `${cmd} nevermind` || msg === `${cmd} cancel`) {
    // Cancel a queued request from this player
    const before = requestQueue.length;
    requestQueue = requestQueue.filter(q => q.requester !== username);
    const removed = before - requestQueue.length;
    if (removed > 0) {
      bot.chat(`Removed ${removed} of your request(s) from my queue.`);
    } else {
      bot.chat("You don't have any requests in my queue.");
    }
    return;
  }
  
  // Agency toggle
  if (msg === `${cmd} agency on`) {
    AUTONOMOUS_CONFIG.agency.enabled = true;
    bot.chat('Agency enabled. I\'ll evaluate requests and make my own decisions.');
    return;
  }
  if (msg === `${cmd} agency off`) {
    AUTONOMOUS_CONFIG.agency.enabled = false;
    bot.chat('Agency disabled. I\'ll obey all commands immediately.');
    return;
  }
  if (msg === `${cmd} agency`) {
    const status = AUTONOMOUS_CONFIG.agency.enabled ? 'ON' : 'OFF';
    const features = [];
    if (AUTONOMOUS_CONFIG.agency.allowDecline) features.push('can decline');
    if (AUTONOMOUS_CONFIG.agency.allowNegotiation) features.push('can negotiate');
    if (AUTONOMOUS_CONFIG.agency.allowDefer) features.push('can defer');
    bot.chat(`Agency: ${status} | Features: ${features.join(', ') || 'none'}`);
    return;
  }
  
  // Phase 21: Bot-to-Bot Communication Commands
  if (msg === `${cmd} bots`) {
    const botList = Array.from(knownBots).join(', ');
    bot.chat(`Known bots: ${botList || 'none discovered yet'}`);
    return;
  }
  
  if (msg.startsWith(`${cmd} ask `)) {
    // "${cmd} ask Bot_B to mine diamonds"
    const parts = msg.replace(`${cmd} ask `, '').split(' to ');
    if (parts.length === 2) {
      const targetBot = parts[0].trim();
      const action = parts[1].trim();
      
      if (!knownBots.has(targetBot)) {
        bot.chat(`I don't know a bot named ${targetBot}. Use "${cmd} bots" to see known bots.`);
        return;
      }
      
      requestHelpFromBot(targetBot, 'custom', { description: action });
      bot.chat(`Asking ${targetBot} to ${action}...`);
    } else {
      bot.chat(`Usage: ${cmd} ask <bot_name> to <action>`);
    }
    return;
  }
  
  if (msg.startsWith(`${cmd} announce `)) {
    const discovery = msg.replace(`${cmd} announce `, '');
    announceDiscovery('custom', bot.entity.position, discovery);
    bot.chat('Announced to all bots!');
    return;
  }
  
  if (msg === `${cmd} emergency`) {
    sendEmergency('player_requested_help', bot.entity.position);
    bot.chat('Emergency signal sent to all bots!');
    return;
  }
  
  if (msg.startsWith(`${cmd} claim `)) {
    const resource = msg.replace(`${cmd} claim `, '');
    claimResource(resource, {
      x: Math.floor(bot.entity.position.x),
      y: Math.floor(bot.entity.position.y),
      z: Math.floor(bot.entity.position.z)
    });
    bot.chat(`Claimed ${resource} at current location.`);
    return;
  }
  
  if (msg === `${cmd} claims`) {
    if (!worldMemory.claims || Object.keys(worldMemory.claims).length === 0) {
      bot.chat('No claims recorded.');
    } else {
      const claimList = Object.entries(worldMemory.claims)
        .map(([who, claim]) => `${who}: ${claim.resource || claim.area || 'area'}`)
        .join(', ');
      bot.chat(`Claims: ${claimList}`);
    }
    return;
  }
  
  if (msg.startsWith(`${cmd} whisper `)) {
    // "${cmd} whisper Bot_B hello there"
    const parts = msg.replace(`${cmd} whisper `, '').split(' ');
    if (parts.length >= 2) {
      const targetBot = parts[0];
      const whisperMsg = parts.slice(1).join(' ');
      
      if (knownBots.has(targetBot)) {
        // Send structured message
        sendMessageToBot(targetBot, MessageType.ANNOUNCEMENT, {
          type: 'direct_message',
          message: whisperMsg,
          location: null
        });
      } else {
        // Regular whisper for non-bots
        bot.whisper(targetBot, whisperMsg);
      }
      bot.chat(`Whispered to ${targetBot}.`);
    } else {
      bot.chat(`Usage: ${cmd} whisper <player> <message>`);
    }
    return;
  }

  // ==========================================
  // PHASE 22: 8 CRITICAL CAPABILITIES - Chat Commands
  // ==========================================

  // Feature 1: Vehicle Control 🚤
  if (msg.startsWith(`${cmd} steer `)) {
    const direction = msg.replace(`${cmd} steer `, '').trim();
    enqueueCommands([{ action: 'steer', direction }]);
    return;
  }
  if (msg === `${cmd} stop vehicle` || msg === `${cmd} vehicle stop`) {
    startVehicleControl('stop');
    bot.chat('Stopping vehicle.');
    return;
  }

  // Feature 2: Entity Interaction 🐑
  if (msg === `${cmd} breed` || msg.startsWith(`${cmd} breed `)) {
    const animal = msg.includes(' ') ? msg.split(' ')[2] : 'cow';
    enqueueCommands([{ action: 'breed', animal }]);
    bot.chat(`Breeding ${animal}s...`);
    return;
  }
  if (msg === `${cmd} shear` || msg === `${cmd} shear sheep`) {
    enqueueCommands([{ action: 'shear' }]);
    bot.chat('Shearing sheep...');
    return;
  }
  if (msg === `${cmd} milk` || msg === `${cmd} milk cow`) {
    enqueueCommands([{ action: 'milk' }]);
    bot.chat('Milking cow...');
    return;
  }

  // Feature 3: Item Dropping 📦
  if (msg.startsWith(`${cmd} drop `)) {
    const parts = msg.replace(`${cmd} drop `, '').split(' ');
    const itemType = parts[0];
    const count = parts[1] ? parseInt(parts[1]) : 1;
    enqueueCommands([{ action: 'drop', item: itemType, count }]);
    bot.chat(`Dropping ${count}x ${itemType}...`);
    return;
  }
  if (msg.startsWith(`${cmd} give `)) {
    // "${cmd} give Wookiee_23 iron_ingot 10"
    const parts = msg.replace(`${cmd} give `, '').split(' ');
    if (parts.length >= 2) {
      const target = parts[0];
      const itemType = parts[1];
      const count = parts[2] ? parseInt(parts[2]) : 1;
      enqueueCommands([{ action: 'give', target, item: itemType, count }]);
      bot.chat(`Giving ${count}x ${itemType} to ${target}...`);
    } else {
      bot.chat(`Usage: ${cmd} give <player> <item> [count]`);
    }
    return;
  }

  // Feature 4: Smooth Look Control 👀
  if (msg.startsWith(`${cmd} look at `)) {
    const targetName = msg.replace(`${cmd} look at `, '');
    const player = Object.values(bot.players).find(p => 
      p.username.toLowerCase() === targetName.toLowerCase()
    );
    
    if (player?.entity) {
      enqueueCommands([{ action: 'look_at', player: player.username }]);
      bot.chat(`Looking at ${targetName}.`);
    } else {
      bot.chat(`Can't see ${targetName}.`);
    }
    return;
  }

  // Feature 5: Sound Awareness 👂
  if (msg === `${cmd} sounds`) {
    const sounds = recentSounds.slice(-5).map(s => 
      `${s.name.split('.').pop()} (${Math.floor((Date.now() - s.timestamp) / 1000)}s ago)`
    ).join(', ');
    bot.chat(`Recent sounds: ${sounds || 'none'}`);
    return;
  }

  // Feature 6: Experience System ⭐
  if (msg === `${cmd} xp` || msg === `${cmd} level` || msg === `${cmd} experience`) {
    bot.chat(`Level ${bot.experience.level} (${Math.floor(bot.experience.progress * 100)}% to next)`);
    return;
  }
  if (msg === `${cmd} farm xp`) {
    enqueueCommands([{ action: 'farm_xp' }]);
    bot.chat('Farming XP...');
    return;
  }

  // Feature 7: Book Writing 📖
  if (msg === `${cmd} write log` || msg === `${cmd} write book`) {
    enqueueCommands([{ action: 'write_log' }]);
    return;
  }

  // Feature 8: Block Update Subscriptions 🔔
  if (msg === `${cmd} watch door`) {
    enqueueCommands([{ action: 'watch_door' }]);
    return;
  }
  if (msg === `${cmd} watch chest`) {
    enqueueCommands([{ action: 'watch_chest' }]);
    return;
  }
  if (msg === `${cmd} unwatch` || msg === `${cmd} stop watching`) {
    enqueueCommands([{ action: 'unwatch' }]);
    return;
  }
  if (msg === `${cmd} watching`) {
    const count = watchedBlocks.size;
    if (count === 0) {
      bot.chat("I'm not watching any blocks.");
    } else {
      const blocks = Array.from(watchedBlocks.keys()).join(', ');
      bot.chat(`Watching ${count} block(s): ${blocks}`);
    }
    return;
  }

  // ==========================================
  // PHASE 23: CRITICAL SURVIVAL - Chat Commands
  // ==========================================

  // Feature 1: Furnace Smelting 🔥
  if (msg.startsWith(`${cmd} smelt `)) {
    const parts = msg.replace(`${cmd} smelt `, '').trim().split(' ');
    const item = parts[0];
    const count = parts[1] ? parseInt(parts[1]) : null;
    const request = { action: 'smelt', item, count, originalMessage: message };
    processExternalRequest(request, username);
    return;
  }
  if (msg === `${cmd} smelt`) {
    // Try to smelt any smeltable item
    const smeltable = bot.inventory.items().find(i => 
      Object.keys(SMELTABLE_ITEMS).includes(i.name)
    );
    if (smeltable) {
      const request = { action: 'smelt', item: smeltable.name, originalMessage: message };
      processExternalRequest(request, username);
    } else {
      bot.chat("I don't have anything to smelt!");
    }
    return;
  }

  // Feature 2: Crop Farming 🌾
  if (msg === `${cmd} till` || msg === `${cmd} till soil`) {
    const request = { action: 'till', originalMessage: message };
    processExternalRequest(request, username);
    return;
  }
  if (msg.startsWith(`${cmd} plant `)) {
    const crop = msg.replace(`${cmd} plant `, '').trim();
    const request = { action: 'plant', crop, originalMessage: message };
    processExternalRequest(request, username);
    return;
  }
  if (msg === `${cmd} harvest`) {
    const request = { action: 'harvest', autoReplant: true, originalMessage: message };
    processExternalRequest(request, username);
    return;
  }
  if (msg.startsWith(`${cmd} farm `)) {
    const crop = msg.replace(`${cmd} farm `, '').trim() || 'wheat';
    const request = { action: 'farm', crop, originalMessage: message };
    processExternalRequest(request, username);
    return;
  }
  if (msg === `${cmd} farm`) {
    const request = { action: 'farm', crop: 'wheat', originalMessage: message };
    processExternalRequest(request, username);
    return;
  }
  if (msg === `${cmd} farm status`) {
    const plots = farmPlots.length;
    const hasHoe = bot.inventory.items().some(i => HOE_TYPES.includes(i.name));
    const seeds = Object.values(CROP_DATA)
      .map(c => bot.inventory.items().find(i => i.name === c.seed))
      .filter(Boolean)
      .map(s => `${s.name}x${s.count}`)
      .join(', ');
    bot.chat(`Farm plots: ${plots} | Hoe: ${hasHoe ? 'yes' : 'no'} | Seeds: ${seeds || 'none'}`);
    return;
  }

  // Feature 3: Ranged Combat 🏹
  if (msg.startsWith(`${cmd} shoot `)) {
    const target = msg.replace(`${cmd} shoot `, '').trim();
    const request = { action: 'shoot', target, originalMessage: message };
    processExternalRequest(request, username);
    return;
  }
  if (msg === `${cmd} shoot`) {
    const request = { action: 'shoot', target: null, originalMessage: message };
    processExternalRequest(request, username);
    return;
  }
  if (msg === `${cmd} block` || msg === `${cmd} shield`) {
    enqueueCommands([{ action: 'block_shield' }]);
    bot.chat('Raising shield!');
    return;
  }
  if (msg === `${cmd} stop blocking` || msg === `${cmd} unblock`) {
    stopBlocking();
    bot.chat('Lowered shield.');
    return;
  }
  if (msg === `${cmd} ranged status` || msg === `${cmd} combat status`) {
    const hasBow = bot.inventory.items().some(i => i.name === 'bow' || i.name === 'crossbow');
    const arrows = bot.inventory.items().find(i => i.name.includes('arrow'));
    const hasShield = bot.inventory.items().some(i => i.name === 'shield');
    bot.chat(`Bow: ${hasBow ? 'yes' : 'no'} | Arrows: ${arrows ? arrows.count : 0} | Shield: ${hasShield ? 'yes' : 'no'}`);
    return;
  }

  // Feature 4: Inventory Management 📦
  if (msg === `${cmd} inv status` || msg === `${cmd} inventory status`) {
    const usage = getInventoryUsage();
    const nearChest = bot.findBlock({ matching: b => b.name === 'chest', maxDistance: 64 }) !== null;
    bot.chat(`Inventory: ${usage}/36 slots | Nearby chest: ${nearChest ? 'yes' : 'no'}`);
    return;
  }
  if (msg === `${cmd} manage inventory` || msg === `${cmd} clean inventory`) {
    autoManageInventory();
    return;
  }
  if (msg === `${cmd} dump junk` || msg === `${cmd} drop junk`) {
    (async () => {
      const items = bot.inventory.items();
      let dropped = 0;
      for (const item of items) {
        if (isLowValueItem(item.name)) {
          try {
            await bot.tossStack(item);
            dropped++;
          } catch (e) {}
        }
      }
      bot.chat(`Dropped ${dropped} junk item stacks.`);
    })();
    return;
  }
});

// ==========================================
// EVENTS
// ==========================================

bot.on('goal_reached', () => {
  logEvent('goal_reached', { goal: currentGoal });
});

bot.on('path_update', (r) => {
  logEvent('path_update', { status: r.status, time: r.time });
});

bot.on('health', () => {
  logEvent('health_change', { health: bot.health, food: bot.food });
  
  if (bot.health < 10) {
    logEvent('danger', { reason: 'low_health', health: bot.health });
  }
});

bot.on('entityHurt', (entity) => {
  if (entity === bot.entity) {
    logEvent('hurt', { health: bot.health, attacker: 'unknown' });
  }
});

bot.on('error', (err) => {
  console.error('Bot error:', err);
  logEvent('error', { message: err.message });
});

bot.on('end', () => {
  console.log('Bot disconnected');
  logEvent('disconnect', {});
});

bot.on('kicked', (reason) => {
  console.log('Bot was kicked:', reason);
  logEvent('kicked', { reason });
});

// ==========================================
// PHASE 22: SOUND AWARENESS 👂
// ==========================================

bot.on('soundEffectHeard', (soundName, position, volume, pitch) => {
  const sound = {
    name: soundName,
    position: position ? position.floored() : null,
    volume,
    pitch,
    timestamp: Date.now()
  };
  
  recentSounds.push(sound);
  if (recentSounds.length > 20) recentSounds.shift();
  
  logEvent('sound_heard', sound);
  
  // React to important sounds
  if (soundName.includes('explosion')) {
    logEvent('danger', { reason: 'explosion_nearby', position });
    // Could trigger emergency response
  }
  
  if (soundName.includes('entity.player.hurt')) {
    // Player is being hurt nearby
    if (position && bot.entity) {
      const dist = bot.entity.position.distanceTo(position);
      if (dist < 20) {
        logEvent('danger', { reason: 'combat_nearby', position, distance: dist });
      }
    }
  }
  
  if (soundName.includes('door')) {
    // Door opened/closed nearby - someone is there
    logEvent('activity_detected', { type: 'door', position });
  }
  
  if (soundName.includes('chest')) {
    // Chest opened/closed nearby
    logEvent('activity_detected', { type: 'chest', position });
  }
});

// ==========================================
// COMMAND QUEUE
// ==========================================

function enqueueCommands(cmds) {
  let existing = [];
  try {
    if (fs.existsSync(COMMANDS_FILE)) {
      existing = JSON.parse(fs.readFileSync(COMMANDS_FILE, 'utf8'));
      if (!Array.isArray(existing)) existing = [];
    }
  } catch {
    existing = [];
  }
  const next = existing.concat(cmds);
  safeWrite(COMMANDS_FILE, JSON.stringify(next, null, 2));
}

function processCommands() {
  if (!fs.existsSync(COMMANDS_FILE)) return;

  let commands;
  try {
    commands = JSON.parse(fs.readFileSync(COMMANDS_FILE, 'utf8'));
  } catch {
    return;
  }
  if (!Array.isArray(commands) || commands.length === 0) return;

  safeWrite(COMMANDS_FILE, '[]');

  for (const cmd of commands) {
    try {
      executeCommand(cmd);
    } catch (e) {
      console.error('Command failed', cmd, e);
      logEvent('command_error', { cmd, error: String(e) });
    }
  }
}

// ==========================================
// COMMAND EXECUTION
// ==========================================

async function executeCommand(cmd) {
  console.log('Executing command:', cmd);

  switch (cmd.action) {
    case 'chat':
      bot.chat(cmd.message);
      return;

    case 'jump':
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 120);
      return;

    case 'sneak':
      bot.setControlState('sneak', true);
      setTimeout(() => bot.setControlState('sneak', false), cmd.duration || 500);
      return;

    case 'look_at_player': {
      const p = bot.players[cmd.username];
      if (p?.entity) bot.lookAt(p.entity.position.offset(0, p.entity.height, 0));
      return;
    }

    case 'follow': {
      const p = bot.players[cmd.username];
      if (!p?.entity) {
        bot.chat(`Can't see ${cmd.username} to follow.`);
        return;
      }
      const dist = typeof cmd.distance === 'number' ? cmd.distance : 2;
      currentGoal = { type: 'follow', username: cmd.username, distance: dist };
      bot.pathfinder.setGoal(new GoalFollow(p.entity, dist), true);
      return;
    }

    case 'goto': {
      const x = Math.floor(cmd.x);
      const y = Math.floor(cmd.y);
      const z = Math.floor(cmd.z);
      currentGoal = { type: 'goto', x, y, z };
      bot.pathfinder.setGoal(new GoalBlock(x, y, z), false);
      return;
    }

    case 'stop':
      currentGoal = null;
      stopCombat();
      stopHunting();
      bot.pathfinder.setGoal(null);
      return;

    case 'goal': {
      handleGoal(cmd.goal);
      return;
    }

    case 'dig': {
      const pos = cmd.position;
      let block;
      
      if (pos) {
        block = bot.blockAt(Vec3(pos.x, pos.y, pos.z));
      } else if (cmd.direction) {
        const offsets = {
          'front': [0, 0, 1],
          'back': [0, 0, -1],
          'left': [-1, 0, 0],
          'right': [1, 0, 0],
          'above': [0, 1, 0],
          'below': [0, -1, 0]
        };
        const offset = offsets[cmd.direction] || [0, 0, 1];
        const yaw = bot.entity.yaw;
        const rx = Math.round(offset[0] * Math.cos(yaw) - offset[2] * Math.sin(yaw));
        const rz = Math.round(offset[0] * Math.sin(yaw) + offset[2] * Math.cos(yaw));
        const botPos = bot.entity.position.floored();
        block = bot.blockAt(botPos.offset(rx, offset[1], rz));
      } else {
        const botPos = bot.entity.position.floored();
        block = bot.blockAt(botPos.offset(0, 0, 1));
      }
      
      if (!block || block.name === 'air') {
        logEvent('dig_failed', { reason: 'no_block', position: pos });
        return;
      }
      
      try {
        currentGoal = { type: 'dig', blockType: block.name };
        await bot.dig(block);
        logEvent('block_broken', { blockType: block.name, position: block.position });
        currentGoal = null;
      } catch (err) {
        logEvent('dig_error', { error: err.message, position: pos });
        currentGoal = null;
      }
      return;
    }

    case 'place': {
      const blockType = cmd.blockType || cmd.item;
      const pos = cmd.position;
      
      const item = bot.inventory.items().find(i => 
        i.name === blockType || i.name.includes(blockType)
      );
      
      if (!item) {
        logEvent('place_failed', { reason: 'no_item', item: blockType });
        return;
      }
      
      try {
        await bot.equip(item, 'hand');
        
        let referenceBlock;
        let faceVector;
        
        if (pos) {
          const targetPos = Vec3(pos.x, pos.y, pos.z);
          const below = bot.blockAt(targetPos.offset(0, -1, 0));
          if (below && below.name !== 'air') {
            referenceBlock = below;
            faceVector = Vec3(0, 1, 0);
          }
        } else {
          const botPos = bot.entity.position.floored();
          referenceBlock = bot.blockAt(botPos.offset(0, -1, 1));
          faceVector = Vec3(0, 1, 0);
        }
        
        if (!referenceBlock || referenceBlock.name === 'air') {
          logEvent('place_failed', { reason: 'no_reference_block' });
          return;
        }
        
        await bot.placeBlock(referenceBlock, faceVector);
        logEvent('block_placed', { blockType: item.name, position: pos || 'front' });
      } catch (err) {
        logEvent('place_error', { error: err.message, blockType });
      }
      return;
    }

    case 'equip': {
      const itemName = cmd.item;
      const hand = cmd.hand === 'off' ? 'off-hand' : 'hand';
      
      const item = bot.inventory.items().find(i => 
        i.name === itemName || i.name.includes(itemName)
      );
      
      if (!item) {
        logEvent('equip_failed', { reason: 'no_item', item: itemName });
        return;
      }
      
      try {
        await bot.equip(item, hand);
        logEvent('item_equipped', { item: item.name, hand });
      } catch (err) {
        logEvent('equip_error', { error: err.message, item: itemName });
      }
      return;
    }

    case 'attack': {
      const targetType = (cmd.target || '').toLowerCase();
      const hostileTypes = ['zombie', 'skeleton', 'creeper', 'spider', 'enderman', 'witch', 'pillager'];
      
      const candidates = Object.values(bot.entities)
        .filter(e => e.type === 'mob' || e.type === 'hostile')
        .filter(e => e.position && bot.entity.position.distanceTo(e.position) < 32);
      
      let mob;
      if (targetType) {
        mob = candidates
          .filter(e => e.name?.toLowerCase() === targetType || e.name?.toLowerCase().includes(targetType))
          .sort((a, b) => 
            bot.entity.position.distanceTo(a.position) - 
            bot.entity.position.distanceTo(b.position)
          )[0];
      } else {
        mob = candidates
          .filter(e => hostileTypes.includes(e.name?.toLowerCase()))
          .sort((a, b) => 
            bot.entity.position.distanceTo(a.position) - 
            bot.entity.position.distanceTo(b.position)
          )[0];
      }
      
      if (!mob) {
        logEvent('attack_failed', { reason: 'no_target', target: targetType });
        return;
      }
      
      currentGoal = { type: 'attack', target: mob.name, entityId: mob.id };
      logEvent('attack_started', { target: mob.name });
      startCombat(mob);
      return;
    }

    // Phase 8: Food commands
    case 'find_food':
      await findAndHuntFood();
      return;

    case 'cook_food':
      await cookFood();
      return;

    case 'eat':
      await autoEat();
      return;

    // Phase 9: Crafting
    case 'craft':
      await craftItem(cmd.item, cmd.count || 1);
      return;

    // Phase 10: Mining
    case 'mine_resource':
      await mineResource(cmd.resource, cmd.count || 16);
      return;

    // Phase 11: Sleep
    case 'sleep':
      await sleepInBed();
      return;

    // Phase 12: Building
    case 'build':
      await buildStructure(cmd.template, cmd.blockType || 'cobblestone');
      return;

    // Phase 13: Storage
    case 'store_items':
      await storeItems(cmd.items);
      return;

    case 'retrieve_items':
      await retrieveItems(cmd.items);
      return;

    // Phase 14: World Memory
    case 'mark_location':
      markLocation(cmd.name, cmd.type || 'landmark', cmd.note || '');
      return;

    case 'goto_landmark':
      if (cmd.name === 'home' && worldMemory.home) {
        bot.pathfinder.setGoal(new GoalNear(worldMemory.home.x, worldMemory.home.y, worldMemory.home.z, 2));
      } else {
        await gotoLandmark(cmd.name);
      }
      return;

    case 'set_home':
      setHome();
      return;

    // Phase 15: Trading
    case 'trade':
      await tradeWithVillager(cmd.index);
      return;

    // Phase 16: Potions/Enchanting
    case 'brew':
      await useBrewingStand();
      return;

    case 'enchant':
      await useEnchantingTable();
      return;

    // Phase 17: Block Activation (CRITICAL)
    case 'activate': {
      // Right-click a block (doors, buttons, levers, etc.)
      let targetBlock;
      
      if (cmd.position) {
        // Absolute position
        targetBlock = bot.blockAt(new Vec3(cmd.position.x, cmd.position.y, cmd.position.z));
      } else {
        // Block in front of bot
        const cursor = bot.blockAtCursor(5);
        if (cursor) {
          targetBlock = cursor;
        }
      }
      
      if (!targetBlock) {
        logEvent('activate_failed', { reason: 'no_block_found' });
        return;
      }
      
      try {
        await bot.activateBlock(targetBlock);
        logEvent('block_activated', { 
          blockType: targetBlock.name,
          position: targetBlock.position
        });
      } catch (err) {
        logEvent('activate_failed', { 
          reason: err.message,
          blockType: targetBlock?.name 
        });
      }
      return;
    }

    // Phase 18: Mount/Dismount (HIGH-VALUE)
    case 'mount': {
      // Mount a nearby entity (horse, boat, minecart)
      const mountableTypes = ['horse', 'boat', 'minecart', 'pig', 'donkey', 'mule'];
      
      let targetEntity = null;
      if (cmd.entityId) {
        targetEntity = bot.entities[cmd.entityId];
      } else {
        // Find nearest mountable entity
        const entities = Object.values(bot.entities);
        const mountable = entities.filter(e => 
          e.position && 
          mountableTypes.some(type => e.name?.toLowerCase().includes(type)) &&
          bot.entity.position.distanceTo(e.position) < 5
        );
        
        if (mountable.length > 0) {
          targetEntity = mountable.sort((a, b) => 
            bot.entity.position.distanceTo(a.position) - 
            bot.entity.position.distanceTo(b.position)
          )[0];
        }
      }
      
      if (!targetEntity) {
        logEvent('mount_failed', { reason: 'no_mountable_entity' });
        return;
      }
      
      try {
        await bot.mount(targetEntity);
        logEvent('mounted', { 
          entity: targetEntity.name,
          entityId: targetEntity.id
        });
      } catch (err) {
        logEvent('mount_failed', { reason: err.message });
      }
      return;
    }

    case 'dismount': {
      try {
        await bot.dismount();
        logEvent('dismounted', {});
      } catch (err) {
        logEvent('dismount_failed', { reason: err.message });
      }
      return;
    }

    // Phase 19: Fishing (HIGH-VALUE)
    case 'fish': {
      // Start fishing
      try {
        // Equip fishing rod if available
        const fishingRod = bot.inventory.items().find(item => 
          item.name === 'fishing_rod'
        );
        
        if (!fishingRod) {
          logEvent('fish_failed', { reason: 'no_fishing_rod' });
          bot.chat("I don't have a fishing rod!");
          return;
        }
        
        await bot.equip(fishingRod, 'hand');
        
        // Fish (this waits until catch)
        const caught = await bot.fish();
        
        logEvent('fish_caught', { 
          item: caught?.name || 'unknown'
        });
        bot.chat(`Caught a ${caught?.name || 'something'}!`);
        
      } catch (err) {
        logEvent('fish_failed', { reason: err.message });
      }
      return;
    }

    // ==========================================
    // PHASE 22: 8 CRITICAL CAPABILITIES
    // ==========================================

    // Feature 1: Vehicle Control 🚤
    case 'steer': {
      const direction = cmd.direction || 'forward';
      const success = startVehicleControl(direction);
      if (!success) {
        bot.chat("I'm not in a vehicle!");
      }
      return;
    }

    // Feature 2: Entity Interaction 🐑 (breed, shear, milk, leash)
    case 'use_on': {
      // Right-click entity (breed, shear, leash, milk)
      let targetEntity;
      
      if (cmd.entityId) {
        targetEntity = bot.entities[cmd.entityId];
      } else if (cmd.entityType) {
        // Find nearest entity of type
        const entities = Object.values(bot.entities);
        const matches = entities
          .filter(e => e.name?.toLowerCase().includes(cmd.entityType.toLowerCase()))
          .filter(e => e.position && bot.entity.position.distanceTo(e.position) < 32)
          .sort((a, b) => 
            bot.entity.position.distanceTo(a.position) - 
            bot.entity.position.distanceTo(b.position)
          );
        targetEntity = matches[0];
      }
      
      if (!targetEntity) {
        logEvent('use_on_failed', { reason: 'no_entity_found', type: cmd.entityType });
        bot.chat(`Can't find ${cmd.entityType || 'entity'} nearby!`);
        return;
      }
      
      try {
        // Move closer if needed
        if (bot.entity.position.distanceTo(targetEntity.position) > 3) {
          await bot.pathfinder.goto(new GoalNear(
            targetEntity.position.x,
            targetEntity.position.y,
            targetEntity.position.z,
            2
          ));
        }
        
        await bot.useOn(targetEntity);
        logEvent('entity_used', { 
          entity: targetEntity.name,
          entityId: targetEntity.id,
          action: cmd.action || 'use'
        });
      } catch (err) {
        logEvent('use_on_failed', { 
          reason: err.message,
          entity: targetEntity?.name
        });
      }
      return;
    }

    case 'breed': {
      // Breed animals - need food item equipped first
      const breedingFoods = {
        'cow': 'wheat', 'mooshroom': 'wheat',
        'sheep': 'wheat',
        'pig': 'carrot',
        'chicken': 'wheat_seeds',
        'horse': 'golden_apple',
        'rabbit': 'carrot',
        'wolf': 'beef',
        'cat': 'cod',
        'turtle': 'seagrass'
      };
      
      const animal = cmd.animal || 'cow';
      const food = breedingFoods[animal.toLowerCase()] || 'wheat';
      
      const foodItem = bot.inventory.items().find(i => i.name.includes(food));
      if (foodItem) {
        await bot.equip(foodItem, 'hand');
      }
      
      // Use on two animals
      enqueueCommands([
        { action: 'use_on', entityType: animal, action: 'breed' },
        { action: 'use_on', entityType: animal, action: 'breed' }
      ]);
      return;
    }

    case 'shear': {
      // Equip shears first
      const shears = bot.inventory.items().find(i => i.name === 'shears');
      if (!shears) {
        bot.chat("I don't have shears!");
        return;
      }
      await bot.equip(shears, 'hand');
      enqueueCommands([{ action: 'use_on', entityType: 'sheep' }]);
      return;
    }

    case 'milk': {
      // Equip bucket first
      const bucket = bot.inventory.items().find(i => i.name === 'bucket');
      if (!bucket) {
        bot.chat("I don't have a bucket!");
        return;
      }
      await bot.equip(bucket, 'hand');
      enqueueCommands([{ action: 'use_on', entityType: 'cow' }]);
      return;
    }

    // Feature 3: Item Dropping 📦
    case 'drop': {
      const itemType = cmd.item;
      const count = cmd.count || 1;
      
      const item = bot.inventory.items().find(i => 
        i.name.includes(itemType) || itemType.includes(i.name)
      );
      
      if (!item) {
        logEvent('drop_failed', { reason: 'no_item', item: itemType });
        bot.chat(`I don't have ${itemType}!`);
        return;
      }
      
      try {
        if (count >= item.count) {
          await bot.tossStack(item);
          logEvent('item_dropped', { item: item.name, count: item.count });
        } else {
          await bot.toss(item.type, item.metadata, count);
          logEvent('item_dropped', { item: item.name, count });
        }
      } catch (err) {
        logEvent('drop_failed', { reason: err.message, item: itemType });
      }
      return;
    }

    case 'give': {
      // Drop item near a player/bot
      const target = cmd.target;
      const itemType = cmd.item;
      const count = cmd.count || 1;
      
      // Find target player
      const targetPlayer = Object.values(bot.players).find(p => 
        p.username.toLowerCase() === target.toLowerCase()
      );
      
      if (!targetPlayer || !targetPlayer.entity) {
        logEvent('give_failed', { reason: 'target_not_found', target });
        bot.chat(`Can't find ${target}!`);
        return;
      }
      
      try {
        // Pathfind to target
        await bot.pathfinder.goto(new GoalNear(
          targetPlayer.entity.position.x,
          targetPlayer.entity.position.y,
          targetPlayer.entity.position.z,
          2
        ));
        
        // Drop item
        const item = bot.inventory.items().find(i => 
          i.name.includes(itemType) || itemType.includes(i.name)
        );
        
        if (!item) {
          logEvent('give_failed', { reason: 'no_item', item: itemType });
          bot.chat(`I don't have ${itemType}!`);
          return;
        }
        
        if (count >= item.count) {
          await bot.tossStack(item);
        } else {
          await bot.toss(item.type, item.metadata, count);
        }
        
        logEvent('item_given', { item: item.name, count, target });
        bot.chat(`Gave ${count}x ${item.name} to ${target}!`);
      } catch (err) {
        logEvent('give_failed', { reason: err.message, target });
      }
      return;
    }

    // Feature 4: Smooth Look Control 👀
    case 'look_at': {
      let target;
      
      if (cmd.position) {
        target = new Vec3(cmd.position.x, cmd.position.y, cmd.position.z);
      } else if (cmd.entity) {
        const entity = bot.entities[cmd.entity];
        if (entity) target = entity.position.offset(0, entity.height || 1, 0);
      } else if (cmd.block) {
        target = new Vec3(cmd.block.x, cmd.block.y, cmd.block.z);
      } else if (cmd.player) {
        const player = bot.players[cmd.player];
        if (player?.entity) target = player.entity.position.offset(0, player.entity.height || 1.6, 0);
      }
      
      if (target) {
        await bot.lookAt(target, cmd.force || false);
        logEvent('looked_at', { target: { x: target.x, y: target.y, z: target.z } });
      } else {
        logEvent('look_at_failed', { reason: 'no_target' });
      }
      return;
    }

    // Feature 6: Experience System ⭐ (farm_xp goal)
    case 'farm_xp': {
      // XP farming goal - hunt mobs for XP
      const hostiles = getNearbyHostiles();
      if (hostiles.length > 0 && bot.health > 10) {
        const target = hostiles[0];
        bot.chat(`Farming XP - attacking ${target.name}...`);
        enqueueCommands([{ action: 'attack', target: target.name }]);
      } else if (hostiles.length === 0) {
        bot.chat('No mobs nearby for XP. Exploring to find some...');
        enqueueCommands([{ action: 'goal', goal: 'explore' }]);
      } else {
        bot.chat('Health too low for XP farming. Eating first...');
        enqueueCommands([{ action: 'eat' }]);
      }
      return;
    }

    // Feature 7: Book Writing 📖
    case 'write_book': {
      const slot = cmd.slot;
      const pages = cmd.pages || [];
      
      if (pages.length === 0) {
        // Default: write discovery log
        await writeDiscoveryLog();
        return;
      }
      
      try {
        await bot.writeBook(slot, pages);
        logEvent('book_written', { slot, pageCount: pages.length });
        bot.chat(`Wrote ${pages.length} pages to book!`);
      } catch (err) {
        logEvent('write_book_failed', { reason: err.message });
        bot.chat(`Failed to write book: ${err.message}`);
      }
      return;
    }

    case 'write_log': {
      await writeDiscoveryLog();
      return;
    }

    // Feature 8: Block Update Subscriptions 🔔
    case 'watch_door': {
      const doorPos = cmd.position;
      if (!doorPos) {
        // Find nearest door
        const door = bot.findBlock({
          matching: block => block.name.includes('door'),
          maxDistance: 16
        });
        if (!door) {
          bot.chat("No door nearby to watch!");
          return;
        }
        cmd.position = { x: door.position.x, y: door.position.y, z: door.position.z };
      }
      
      const pos = new Vec3(cmd.position.x, cmd.position.y, cmd.position.z);
      watchBlock(pos, (oldBlock, newBlock) => {
        // Door state changed
        const wasOpen = oldBlock?.getProperties?.().open || false;
        const isOpen = newBlock?.getProperties?.().open || false;
        
        if (wasOpen !== isOpen) {
          logEvent('door_activity', { 
            position: pos,
            opened: isOpen,
            timestamp: Date.now()
          });
          bot.chat(`Door ${isOpen ? 'opened' : 'closed'} nearby!`);
        }
      });
      bot.chat(`Now watching door at ${pos.x}, ${pos.y}, ${pos.z}`);
      return;
    }

    case 'watch_chest': {
      const chestPos = cmd.position;
      if (!chestPos) {
        // Find nearest chest
        const chest = bot.findBlock({
          matching: block => block.name === 'chest' || block.name === 'trapped_chest',
          maxDistance: 16
        });
        if (!chest) {
          bot.chat("No chest nearby to watch!");
          return;
        }
        cmd.position = { x: chest.position.x, y: chest.position.y, z: chest.position.z };
      }
      
      const pos = new Vec3(cmd.position.x, cmd.position.y, cmd.position.z);
      watchBlock(pos, (oldBlock, newBlock) => {
        logEvent('chest_activity', { position: pos, timestamp: Date.now() });
        bot.chat('Chest was accessed!');
      });
      bot.chat(`Now watching chest at ${pos.x}, ${pos.y}, ${pos.z}`);
      return;
    }

    case 'unwatch': {
      if (cmd.position) {
        const pos = new Vec3(cmd.position.x, cmd.position.y, cmd.position.z);
        unwatchBlock(pos);
        bot.chat(`Stopped watching block at ${pos.x}, ${pos.y}, ${pos.z}`);
      } else {
        // Clear all watches
        watchedBlocks.forEach((_, key) => {
          const [x, y, z] = key.split(',').map(Number);
          unwatchBlock(new Vec3(x, y, z));
        });
        bot.chat('Stopped watching all blocks.');
      }
      return;
    }

    // ==========================================
    // PHASE 23: CRITICAL SURVIVAL FEATURES
    // ==========================================

    // Feature 1: Furnace Smelting 🔥
    case 'smelt': {
      await smeltItem(cmd.item, cmd.count);
      return;
    }

    // Feature 2: Crop Farming 🌾
    case 'till': {
      await tillSoil(cmd.radius || 5);
      return;
    }

    case 'plant': {
      await plantCrop(cmd.crop || 'wheat');
      return;
    }

    case 'harvest': {
      await harvestCrops(cmd.autoReplant !== false);
      return;
    }

    case 'farm': {
      await farmCycle(cmd.crop || 'wheat');
      return;
    }

    // Feature 3: Ranged Combat 🏹
    case 'shoot': {
      await shootTarget(cmd.target);
      return;
    }

    case 'block_shield': {
      await blockWithShield();
      return;
    }

    // Feature 4: Inventory Management 📦
    case 'manage_inventory': {
      await autoManageInventory();
      return;
    }

    default:
      logEvent('unknown_command', { cmd });
      return;
  }
}

// ==========================================
// COMBAT SYSTEM (from Phase 6)
// ==========================================

let combatInterval = null;

function startCombat(mob) {
  if (combatInterval) clearInterval(combatInterval);
  
  combatInterval = setInterval(() => {
    const target = bot.entities[mob.id];
    
    if (!target || !target.position) {
      logEvent('combat_ended', { reason: 'target_gone', target: mob.name });
      stopCombat();
      return;
    }
    
    const distance = bot.entity.position.distanceTo(target.position);
    
    if (distance > 4) {
      bot.pathfinder.setGoal(new GoalFollow(target, 2), true);
    }
    
    if (distance < 4) {
      bot.attack(target);
    }
    
    if (bot.health < 6) {
      logEvent('combat_retreat', { health: bot.health, reason: 'low_health' });
      stopCombat();
      const fleeX = bot.entity.position.x + (bot.entity.position.x - target.position.x) * 2;
      const fleeZ = bot.entity.position.z + (bot.entity.position.z - target.position.z) * 2;
      bot.pathfinder.setGoal(new GoalXZ(Math.floor(fleeX), Math.floor(fleeZ)));
    }
  }, 250);
}

function stopCombat() {
  if (combatInterval) {
    clearInterval(combatInterval);
    combatInterval = null;
  }
  currentGoal = null;
  bot.pathfinder.setGoal(null);
}

// ==========================================
// GOAL HANDLER
// ==========================================

function handleGoal(goalName) {
  currentGoal = { type: 'goal', goal: goalName };
  
  switch (goalName) {
    case 'gather_wood': {
      const logBlock = bot.findBlock({
        matching: (block) => block.name.includes('log'),
        maxDistance: 64
      });
      
      if (logBlock) {
        bot.pathfinder.setGoal(new GoalNear(logBlock.position.x, logBlock.position.y, logBlock.position.z, 1));
        logEvent('goal_set', { goal: 'gather_wood', target: logBlock.position });
      } else {
        bot.chat('No trees nearby!');
        logEvent('goal_failed', { goal: 'gather_wood', reason: 'no_trees' });
      }
      return;
    }

    case 'explore': {
      const angle = Math.random() * Math.PI * 2;
      const distance = 30 + Math.random() * 40;
      const x = Math.floor(bot.entity.position.x + Math.cos(angle) * distance);
      const z = Math.floor(bot.entity.position.z + Math.sin(angle) * distance);
      
      bot.pathfinder.setGoal(new GoalXZ(x, z));
      logEvent('goal_set', { goal: 'explore', target: { x, z } });
      return;
    }

    default:
      logEvent('unknown_goal', { goal: goalName });
      return;
  }
}
