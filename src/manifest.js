const fs = require('fs');
const { MANIFEST_FILE } = require('./config');
const { safeWrite } = require('./events');

// Complete description of every action the bot supports, its parameters, and what it does.
// This file is the single source of truth for agent capability discovery.
const ACTIONS = {
  // --- Movement ---
  goto: {
    category: 'movement',
    description: 'Navigate to coordinates using pathfinding',
    params: { x: 'number (required)', y: 'number (required)', z: 'number (required)' },
  },
  follow: {
    category: 'movement',
    description: 'Follow a player, maintaining distance',
    params: { username: 'string (required)', distance: 'number (default: 2)' },
  },
  stop: {
    category: 'movement',
    description: 'Cancel all movement and pathfinding',
    params: {},
  },
  look_at_player: {
    category: 'movement',
    description: 'Turn to face a player',
    params: { username: 'string (required)' },
  },
  look_at: {
    category: 'movement',
    description: 'Turn to face a position, player, or block',
    params: { position: '{x,y,z} (optional)', player: 'string (optional)', block: '{x,y,z} (optional)', force: 'boolean (default: false)' },
  },
  jump: {
    category: 'movement',
    description: 'Jump once',
    params: {},
  },
  sneak: {
    category: 'movement',
    description: 'Crouch for a duration',
    params: { duration: 'number ms (default: 500)' },
  },
  steer: {
    category: 'movement',
    description: 'Steer a mounted vehicle',
    params: { direction: '"forward"|"back"|"left"|"right"', duration: 'number ms (default: 1000)' },
  },
  mount: {
    category: 'movement',
    description: 'Mount a nearby entity (horse, boat, minecart, pig, donkey, mule)',
    params: { entityId: 'number (optional, auto-finds nearest)' },
  },
  dismount: {
    category: 'movement',
    description: 'Dismount current vehicle',
    params: {},
  },

  // --- Combat ---
  attack: {
    category: 'combat',
    description: 'Melee attack a mob (auto-equips best weapon, retreats at low health)',
    params: { target: 'string (optional, mob name or "hostile" for nearest)' },
  },
  shoot: {
    category: 'combat',
    description: 'Ranged attack with bow/crossbow (maintains distance, retreats at low health)',
    params: { target: 'string (optional, entity name or nearest hostile)' },
  },
  block_shield: {
    category: 'combat',
    description: 'Block with shield for 5 seconds',
    params: {},
  },

  // --- Gathering ---
  dig: {
    category: 'gathering',
    description: 'Break a single block (auto-selects best tool)',
    params: { position: '{x,y,z} (optional)', direction: '"front"|"back"|"left"|"right"|"above"|"below" (optional)' },
  },
  mine_resource: {
    category: 'gathering',
    description: 'Find and continuously mine a resource type (auto-selects tool, places torches)',
    params: { resource: 'string (required, e.g. "iron_ore", "wood", "stone")', count: 'number (default: 16)' },
  },
  find_food: {
    category: 'gathering',
    description: 'Hunt nearby food animals (cow, pig, chicken, sheep, rabbit)',
    params: {},
  },
  collect_items: {
    category: 'gathering',
    description: 'Pick up dropped items on the ground',
    params: { radius: 'number (default: 16)' },
  },
  drop: {
    category: 'gathering',
    description: 'Drop items from inventory',
    params: { item: 'string (required)', count: 'number (default: 1)' },
  },
  give: {
    category: 'gathering',
    description: 'Give items to a player (walks to them first)',
    params: { target: 'string (required, username)', item: 'string (required)', count: 'number (default: 1)' },
  },

  // --- Crafting ---
  craft: {
    category: 'crafting',
    description: 'Craft an item (auto-places crafting table if needed)',
    params: { item: 'string (required, item name)', count: 'number (default: 1)' },
  },
  smelt: {
    category: 'crafting',
    description: 'Smelt items in furnace (auto-places furnace, auto-selects fuel)',
    params: { item: 'string (required)', count: 'number (optional)' },
  },
  cook_food: {
    category: 'crafting',
    description: 'Cook raw meat in a furnace',
    params: {},
  },

  // --- Building ---
  place: {
    category: 'building',
    description: 'Place a single block',
    params: { blockType: 'string (required)', position: '{x,y,z} (optional)' },
  },
  build: {
    category: 'building',
    description: 'Build a structure from a template',
    params: { template: '"shelter_3x3"|"pillar"|"bridge"|"wall"', blockType: 'string (default: "cobblestone")' },
  },

  // --- Farming ---
  till: {
    category: 'farming',
    description: 'Till dirt near water with a hoe',
    params: { radius: 'number (default: 5)' },
  },
  plant: {
    category: 'farming',
    description: 'Plant seeds on farmland',
    params: { crop: 'string (default: "wheat")' },
  },
  harvest: {
    category: 'farming',
    description: 'Harvest mature crops (can auto-replant)',
    params: { autoReplant: 'boolean (default: true)' },
  },
  farm: {
    category: 'farming',
    description: 'Full farming cycle: till, plant, wait, harvest',
    params: { crop: 'string (default: "wheat")' },
  },

  // --- Interaction ---
  chat: {
    category: 'interaction',
    description: 'Send a chat message to all players',
    params: { message: 'string (required)' },
  },
  whisper: {
    category: 'interaction',
    description: 'Send a private message to a specific player',
    params: { username: 'string (required)', message: 'string (required)' },
  },
  equip: {
    category: 'interaction',
    description: 'Equip an item to hand or off-hand',
    params: { item: 'string (required)', hand: '"main"|"off" (default: "main")' },
  },
  unequip: {
    category: 'interaction',
    description: 'Remove equipment from a slot',
    params: { slot: '"hand"|"off-hand"|"head"|"torso"|"legs"|"feet" (required)' },
  },
  eat: {
    category: 'interaction',
    description: 'Eat food from inventory',
    params: {},
  },
  drink_potion: {
    category: 'interaction',
    description: 'Drink a potion from inventory',
    params: { potion: 'string (optional, potion name filter)' },
  },
  sleep: {
    category: 'interaction',
    description: 'Find a bed and sleep (only works at night)',
    params: {},
  },
  activate: {
    category: 'interaction',
    description: 'Right-click/activate a block (doors, buttons, levers, etc.)',
    params: { position: '{x,y,z} (optional, uses block at cursor if omitted)' },
  },
  fish: {
    category: 'interaction',
    description: 'Fish with a fishing rod',
    params: {},
  },
  use_on: {
    category: 'interaction',
    description: 'Use held item on an entity (breed animals, etc.)',
    params: { entityId: 'number (optional)', entityType: 'string (optional)' },
  },
  trade: {
    category: 'interaction',
    description: 'Trade with a villager (list trades or execute a trade by index)',
    params: { index: 'number (optional, omit to list all trades)' },
  },
  brew: {
    category: 'interaction',
    description: 'Brew potions at a brewing stand',
    params: {},
  },
  enchant: {
    category: 'interaction',
    description: 'Enchant an item at an enchanting table',
    params: {},
  },
  store_items: {
    category: 'interaction',
    description: 'Store non-essential items in a nearby chest',
    params: { items: 'string[] (optional, filter by item names)' },
  },
  retrieve_items: {
    category: 'interaction',
    description: 'Retrieve items from a nearby chest',
    params: { items: 'string[] (optional, filter by item names)' },
  },
  manage_inventory: {
    category: 'interaction',
    description: 'Auto-manage inventory: store in chest or drop low-value items when nearly full',
    params: {},
  },

  // --- Creative mode ---
  creative_fly: {
    category: 'creative',
    description: 'Toggle creative mode flight (start or stop flying)',
    params: { enabled: 'boolean (default: true)' },
  },
  creative_fly_to: {
    category: 'creative',
    description: 'Fly in a straight line to a position (creative mode only)',
    params: { x: 'number (required)', y: 'number (required)', z: 'number (required)' },
  },
  creative_give: {
    category: 'creative',
    description: 'Give an item to the bot in creative mode',
    params: { item: 'string (required)', count: 'number (default: 1)', slot: 'number (default: 36, first inventory slot)' },
  },

  // --- Utility ---
  scan: {
    category: 'utility',
    description: 'Comprehensive area survey: blocks, entities, food, threats',
    params: { radius: 'number (default: 32)' },
  },
  find_blocks: {
    category: 'utility',
    description: 'Search for blocks of a specific type',
    params: { blockType: 'string (required)', maxDistance: 'number (default: 64)', count: 'number (default: 10)' },
  },
  where_am_i: {
    category: 'utility',
    description: 'Quick status: position, dimension, biome, health, food, gameMode, time',
    params: {},
  },
  list_recipes: {
    category: 'utility',
    description: 'Show craftable items or recipe ingredients',
    params: { item: 'string (optional, omit for all craftable)' },
  },
  goto_block: {
    category: 'utility',
    description: 'Navigate to the nearest block of a type',
    params: { blockType: 'string (required)', maxDistance: 'number (default: 64)' },
  },
  verify: {
    category: 'utility',
    description: 'Preflight check: can the bot perform an action?',
    params: { check: '"craft"|"smelt"|"goto"|"attack"|"sleep"|"mine"', item: 'string (for craft/smelt)', x: 'number', y: 'number', z: 'number', target: 'string', resource: 'string' },
  },
  cancel: {
    category: 'utility',
    description: 'Cancel the currently running action',
    params: {},
  },
  inspect_container: {
    category: 'utility',
    description: 'Look inside a container without taking items',
    params: { position: '{x,y,z} (optional, finds nearest if omitted)' },
  },
  set_note: {
    category: 'utility',
    description: 'Save a persistent note (survives restarts)',
    params: { key: 'string (required)', value: 'string (required, set empty to delete)' },
  },
  get_notes: {
    category: 'utility',
    description: 'Retrieve stored notes',
    params: { key: 'string (optional, omit for all notes)' },
  },
  goal: {
    category: 'utility',
    description: 'Execute a high-level goal',
    params: { goal: '"gather_wood"|"explore"' },
  },
};

const EVENTS = {
  // System events
  spawn: { description: 'Bot joined the world', fields: 'position, isRespawn' },
  disconnect: { description: 'Bot disconnected from server', fields: '' },
  error: { description: 'Bot encountered an error', fields: 'message' },
  kicked: { description: 'Server kicked the bot', fields: 'reason' },

  // Chat events
  chat: { description: 'Player sent a chat message', fields: 'username, message' },
  whisper: { description: 'Player whispered to bot', fields: 'username, message' },
  server_message: { description: 'System/server message (death messages, advancements, etc)', fields: 'message, type' },

  // Player events
  player_joined: { description: 'A player joined the server', fields: 'username' },
  player_left: { description: 'A player left the server', fields: 'username' },

  // Health / combat events
  danger: { description: 'Bot health dropped below 10', fields: 'reason, health, food' },
  hurt: { description: 'Bot took damage', fields: 'health' },
  death: { description: 'Bot died', fields: 'position' },
  combat_ended: { description: 'Combat finished', fields: 'reason, target, hitsDealt, elapsed' },
  combat_retreat: { description: 'Bot retreated due to low health', fields: 'health, reason, hitsDealt, damageTaken' },
  arrow_shot: { description: 'Bot fired an arrow', fields: 'target, distance' },

  // Entity events
  entity_spawn: { description: 'A notable entity appeared nearby', fields: 'name, type, distance, position' },
  entity_gone: { description: 'A tracked entity disappeared', fields: 'name, type, reason' },

  // World events
  experience_gained: { description: 'Bot gained experience', fields: 'level, points, progress' },
  weather_changed: { description: 'Weather changed', fields: 'old, new' },
  dig_completed: { description: 'Finished breaking a block', fields: 'block, position' },
  dig_aborted: { description: 'Mining was interrupted', fields: 'block, position' },
  item_collected: { description: 'Bot picked up an item', fields: 'collector, item' },

  // Activity events
  woke_up: { description: 'Bot woke up from bed', fields: '' },
  goal_reached: { description: 'Pathfinder arrived at destination', fields: '' },
  path_failed: { description: 'Pathfinding failed', fields: 'status (noPath/timeout/stuck)' },

  // Survival auto-behavior events
  hunger_warning: { description: 'Bot is hungry with no food', fields: 'food, reason' },
  ate_food: { description: 'Auto-ate food', fields: 'item, newFoodLevel' },
  eat_failed: { description: 'Failed to eat', fields: 'error, item' },
  fleeing: { description: 'Running from a threat', fields: 'threat, threatDistance, fleeTarget' },
  flee_ended: { description: 'Stopped fleeing', fields: 'reason, elapsed' },
  escaped_water: { description: 'Got out of water', fields: 'position' },
  swimming_to_land: { description: 'Pathfinding to escape water', fields: 'target, distance' },
  stuck: { description: 'Bot stuck, no movement detected', fields: 'position, action, ticks, retries' },
  auto_equipped: { description: 'Auto-equipped better armor', fields: 'item, slot' },

  // Command events
  command_received: { description: 'Command acknowledged', fields: 'commandId, action' },
  command_result: { description: 'Command completed', fields: 'commandId, success, detail, ...(action-specific data)' },

  // Mining/gathering events
  block_mined: { description: 'Mined a single block', fields: 'block, mined, target, elapsed' },
  mining_complete: { description: 'Mining session finished', fields: 'resource, mined, target, elapsed, stopReason' },
  smelting_started: { description: 'Started smelting', fields: 'item, count, expectedOutput' },
  tool_low_durability: { description: 'Tool about to break', fields: 'tool, remaining' },
  hunt_ended: { description: 'Hunting session finished', fields: 'target, reason, elapsed' },
};

const STATE_FIELDS = {
  'bot.position': 'Bot position {x, y, z}',
  'bot.velocity': 'Current velocity {x, y, z}',
  'bot.yaw': 'Horizontal look direction (radians)',
  'bot.pitch': 'Vertical look direction (radians)',
  'bot.health': 'Health (0-20)',
  'bot.healthTrend': '"stable"|"healing"|"taking_damage"',
  'bot.food': 'Hunger level (0-20)',
  'bot.saturation': 'Hidden saturation value',
  'bot.oxygenLevel': 'Breath remaining (0-20, relevant when underwater)',
  'bot.experience': '{level, points, progress}',
  'bot.isInWater': 'Whether submerged',
  'bot.isSleeping': 'Whether in bed',
  'bot.isOnFire': 'Whether burning',
  'bot.isUsingItem': 'Whether actively using held item (eating, drawing bow, blocking)',
  'bot.gameMode': '"survival"|"creative"|"adventure"|"spectator"',
  'bot.dimension': '"overworld"|"nether"|"the_end"',
  'bot.biome': 'Current biome name',
  'bot.weather': '"clear"|"rain"|"thunder"',
  'bot.lightLevel': 'Block light level (0-15)',
  'bot.effects': 'Active potion effects [{id, name, amplifier, duration}]',
  'bot.difficulty': 'Server difficulty',
  'bot.hardcore': 'Whether hardcore mode',
  'bot.spawnPoint': 'Bot respawn coordinates or null',
  'equipment': 'Items in each slot {hand, offHand, head, chest, legs, feet}',
  'armor': '{pieces[], totalProtection}',
  'inventory': 'All items [{name, count, slot}]',
  'inventoryStats': '{usedSlots, totalSlots, freeSlots, totalItems}',
  'nearbyEntities': 'Up to 20 entities within 32 blocks [{name, type, distance, position, health?, entityId}]',
  'nearbyBlocks': 'Block type counts in 17x9x17 area',
  'notableBlocks': 'Special blocks within 33 blocks [{name, position, distance}]',
  'time': '{timeOfDay (0-24000), phase ("day"|"sunset"|"night"), day}',
  'players': 'All online players [{username, ping, gameMode}]',
  'vehicle': 'Currently mounted entity or null',
  'currentAction': 'What the bot is doing now {type, ...progress}',
  'pathfinding': '{active, goalX, goalY, goalZ, distanceToGoal, isMoving}',
  'survival': '{isFleeing, isEscapingWater, isStuck, stuckTicks, nearestThreat, fleeInfo}',
  'combat': '{active, target, targetHealth, hitsDealt, damageTaken, elapsed} or null',
  'notes': 'Persistent key-value notes {key: {value, updatedAt}}',
};

const AUTONOMOUS_BEHAVIORS = [
  { name: 'autoEat', trigger: 'food < 6', description: 'Eats best available food from inventory' },
  { name: 'escapeWater', trigger: 'bot is submerged', description: 'Pathfinds to land, activates jump and sprint' },
  { name: 'checkThreats', trigger: 'hostile mob within 12-16 blocks', description: 'Flees from hostile mobs (creepers: 16 blocks, others: 12)' },
  { name: 'checkStuck', trigger: 'no movement for 5+ seconds during an action', description: 'Retries or wanders randomly to get unstuck' },
  { name: 'smartSprint', trigger: 'following a distant player', description: 'Sprints when player is >8 blocks away' },
  { name: 'autoEquipArmor', trigger: 'every 10 seconds', description: 'Equips best available armor pieces' },
];

const IPC_PROTOCOL = {
  description: 'File-based IPC: agent reads state.json and events.json, writes commands.json',
  files: {
    'state.json': { direction: 'bot -> agent', frequency: 'every 1s', description: 'Complete world state snapshot' },
    'events.json': { direction: 'bot -> agent', frequency: 'on event', description: 'Rolling buffer of 200 events with incrementing IDs' },
    'commands.json': { direction: 'agent -> bot', frequency: 'polled every 500ms', description: 'JSON array of commands, cleared after reading' },
    'manifest.json': { direction: 'bot -> agent', frequency: 'written once on startup', description: 'This file: describes all capabilities' },
    'notes.json': { direction: 'bidirectional', frequency: 'on demand', description: 'Persistent key-value store for agent memory' },
  },
  commandFormat: {
    example: '[{"id": "cmd-1", "action": "goto", "x": 100, "y": 64, "z": -50}]',
    notes: 'id is optional but recommended for matching command_result events. action is required.',
  },
};

function buildManifest() {
  return {
    name: 'openclaw-minecraft-bot',
    version: require('../package.json').version,
    description: 'Headless Minecraft bot body for AI agents. Control via file-based IPC.',
    generatedAt: new Date().toISOString(),
    protocol: IPC_PROTOCOL,
    actions: ACTIONS,
    events: EVENTS,
    stateFields: STATE_FIELDS,
    autonomousBehaviors: AUTONOMOUS_BEHAVIORS,
  };
}

function writeManifest() {
  try {
    const manifest = buildManifest();
    safeWrite(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
    console.log(`Manifest written to ${MANIFEST_FILE}`);
  } catch (err) {
    console.error('Failed to write manifest:', err.message);
  }
}

module.exports = { writeManifest, buildManifest, ACTIONS };
