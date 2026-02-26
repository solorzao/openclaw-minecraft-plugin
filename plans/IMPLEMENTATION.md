# Implementation Plan: OpenClaw Direct Integration

**Status:** Ready to implement  
**Estimated Time:** 2-3 hours  
**Goal:** Enable OpenClaw (Nova) to directly control Minecraft bot with full situational awareness

---

## Overview

Transform the bot from queue-based conversational system to direct LLM control:
- **Current:** Player → Bot queues → OpenClaw manually polls → Responds
- **Target:** Player → Bot logs event → OpenClaw heartbeat polls → Responds + commands instantly

---

## Phase 1: Bot-Side Changes (90 minutes)

### 1.1 Rich Perception System

**File:** `bot.js`  
**Location:** After utility functions, before event handlers (~line 1600)

**Add function:**
```javascript
/**
 * Generate rich world perception for OpenClaw
 * Provides structured data about nearby blocks, entities, and environment
 */
function generatePerception() {
  try {
    // Find blocks within 32 blocks
    const nearbyPositions = bot.findBlocks({
      matching: (block) => block.name !== 'air',
      maxDistance: 32,
      count: 1000
    });
    
    // Count block types
    const blockCounts = {};
    nearbyPositions.forEach(pos => {
      const block = bot.blockAt(pos);
      if (block) {
        blockCounts[block.name] = (blockCounts[block.name] || 0) + 1;
      }
    });
    
    // Get nearby entities with details
    const entities = Object.values(bot.entities)
      .filter(e => e.position && e.position.distanceTo(bot.entity.position) < 32)
      .map(e => {
        const distance = Math.floor(bot.entity.position.distanceTo(e.position));
        const direction = getCardinalDirection(bot.entity.position, e.position);
        
        return {
          type: e.type,
          name: e.name || e.username,
          distance: distance,
          direction: direction,
          health: e.health || null
        };
      });
    
    // What are we looking at? (ray trace)
    const lookingAt = bot.blockAtCursor(32);
    
    // Time of day helper
    const time = bot.time.timeOfDay;
    let timeOfDay = 'day';
    if (time >= 0 && time < 6000) timeOfDay = 'day';
    else if (time >= 6000 && time < 12000) timeOfDay = 'dusk';
    else if (time >= 12000 && time < 18000) timeOfDay = 'night';
    else if (time >= 18000 && time < 24000) timeOfDay = 'dawn';
    
    return {
      lookingAt: lookingAt ? {
        type: lookingAt.name,
        distance: Math.floor(bot.entity.position.distanceTo(lookingAt.position))
      } : null,
      blocksNearby: blockCounts,
      entities: entities,
      lightLevel: bot.blockAt(bot.entity.position)?.light || 0,
      timeOfDay: timeOfDay,
      biome: bot.world.getBiome ? bot.world.getBiome(bot.entity.position) : 'unknown'
    };
  } catch (err) {
    console.error('Perception generation error:', err.message);
    return null;
  }
}

/**
 * Get cardinal direction from one position to another
 */
function getCardinalDirection(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const angle = Math.atan2(dz, dx) * 180 / Math.PI;
  
  if (angle >= -45 && angle < 45) return 'east';
  if (angle >= 45 && angle < 135) return 'south';
  if (angle >= 135 || angle < -135) return 'west';
  return 'north';
}
```

### 1.2 Update State Broadcasting

**File:** `bot.js`  
**Location:** Find existing state update interval (~line 1770 in spawn handler)

**Modify existing interval:**
```javascript
// Update state.json every 5 seconds with perception
setInterval(() => {
  const state = {
    username: bot.username,
    position: {
      x: Math.floor(bot.entity.position.x),
      y: Math.floor(bot.entity.position.y),
      z: Math.floor(bot.entity.position.z)
    },
    health: bot.health,
    food: bot.food,
    inventory: bot.inventory.items().map(i => ({
      name: i.name,
      count: i.count
    })),
    currentGoal: currentAutonomousGoal?.action || 'idle',
    perception: generatePerception(), // NEW
    nearbyPlayers: Object.keys(bot.players).filter(p => p !== bot.username),
    nearbyHostiles: getNearbyHostiles().map(e => ({
      type: e.name,
      distance: Math.floor(bot.entity.position.distanceTo(e.position))
    })),
    timestamp: new Date().toISOString()
  };
  
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('Failed to write state:', err.message);
  }
}, 5000);
```

### 1.3 Command Execution System

**File:** `bot.js`  
**Location:** After state broadcasting interval

**Add new interval:**
```javascript
/**
 * Execute commands from OpenClaw
 * Polls commands.json every 2 seconds
 */
setInterval(async () => {
  try {
    if (!fs.existsSync(COMMANDS_FILE)) {
      fs.writeFileSync(COMMANDS_FILE, '[]');
      return;
    }
    
    const commandsData = fs.readFileSync(COMMANDS_FILE, 'utf8');
    const commands = JSON.parse(commandsData);
    
    if (!commands || commands.length === 0) return;
    
    console.log(`[OpenClaw] Executing ${commands.length} command(s)...`);
    
    // Execute each command
    for (const cmd of commands) {
      console.log(`[OpenClaw] → ${cmd.action}`, cmd);
      
      try {
        await executeCommand(cmd);
      } catch (err) {
        console.error(`[OpenClaw] Command failed: ${cmd.action}`, err.message);
      }
    }
    
    // Clear commands after execution
    fs.writeFileSync(COMMANDS_FILE, '[]');
    
  } catch (err) {
    console.error('[OpenClaw] Command polling error:', err.message);
  }
}, 2000);
```

### 1.4 Enhanced Event Logging

**File:** `bot.js`  
**Location:** Modify existing chat event handler (~line 3647)

**Update chat handler:**
```javascript
bot.on('chat', (username, message) => {
  if (username === bot.username) return;
  console.log(`${username}: ${message}`);
  
  // Enhanced event with context
  logEvent('chat', { 
    username, 
    message,
    context: {
      botPosition: {
        x: Math.floor(bot.entity.position.x),
        y: Math.floor(bot.entity.position.y),
        z: Math.floor(bot.entity.position.z)
      },
      botCurrentGoal: currentAutonomousGoal?.action || 'idle',
      botHealth: bot.health,
      botFood: bot.food,
      timeOfDay: bot.time.timeOfDay
    }
  });

  // Phase 21: Detect other bots by username patterns (no public spam)
  if (username.includes('Bot') || username.includes('_AI') || username.endsWith('_bot')) {
    registerBot(username);
  }

  // Queue conversation for agent if bot is mentioned
  if (mentionsBot(message)) {
    queueConversation(username, message);
  }
});
```

**Test checklist:**
- [ ] Bot starts without errors
- [ ] `state.json` updates every 5s with perception data
- [ ] `commands.json` is polled and executed
- [ ] Chat events include context
- [ ] Perception includes blocks, entities, light, time

---

## Phase 2: OpenClaw Minecraft Tool (45 minutes)

### 2.1 Create Skill Directory

**Location:** `/data/.openclaw/workspace/skills/minecraft/`

```bash
mkdir -p /data/.openclaw/workspace/skills/minecraft
cd /data/.openclaw/workspace/skills/minecraft
```

### 2.2 Create minecraft.js Implementation

**File:** `/data/.openclaw/workspace/skills/minecraft/minecraft.js`

```javascript
const fs = require('fs');
const path = require('path');

const DATA_DIR = '/data/minecraft-bot';
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const RESPONSES_FILE = path.join(DATA_DIR, 'responses.json');
const COMMANDS_FILE = path.join(DATA_DIR, 'commands.json');

let lastEventId = 0;

/**
 * OpenClaw Minecraft Bot Control
 */
class MinecraftBot {
  /**
   * Get current bot status + world perception
   * @returns {Object} Bot state including position, health, inventory, and perception
   */
  status() {
    if (!fs.existsSync(STATE_FILE)) {
      return { error: 'Bot not running or state file missing' };
    }
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  }
  
  /**
   * Poll for new events (chat, damage, goals completed, etc.)
   * @returns {Array} New events since last poll
   */
  poll() {
    if (!fs.existsSync(EVENTS_FILE)) {
      return [];
    }
    
    const events = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
    const newEvents = events.filter(e => e.id > lastEventId);
    
    if (newEvents.length > 0) {
      lastEventId = Math.max(...newEvents.map(e => e.id));
    }
    
    return newEvents;
  }
  
  /**
   * Speak in Minecraft chat
   * @param {string} message - Message to send
   */
  chat(message) {
    if (!fs.existsSync(RESPONSES_FILE)) {
      fs.writeFileSync(RESPONSES_FILE, '[]');
    }
    
    const responses = JSON.parse(fs.readFileSync(RESPONSES_FILE, 'utf8'));
    responses.push({
      id: Date.now(),
      message: message,
      timestamp: new Date().toISOString()
    });
    fs.writeFileSync(RESPONSES_FILE, JSON.stringify(responses, null, 2));
  }
  
  /**
   * Execute bot command (mine, craft, build, etc.)
   * @param {string} action - Command action (e.g., 'mine_resource', 'craft', 'goto')
   * @param {Object} params - Command parameters
   */
  command(action, params = {}) {
    if (!fs.existsSync(COMMANDS_FILE)) {
      fs.writeFileSync(COMMANDS_FILE, '[]');
    }
    
    const commands = JSON.parse(fs.readFileSync(COMMANDS_FILE, 'utf8'));
    commands.push({
      action: action,
      ...params,
      timestamp: new Date().toISOString()
    });
    fs.writeFileSync(COMMANDS_FILE, JSON.stringify(commands, null, 2));
  }
  
  /**
   * Clear all pending commands (emergency stop)
   */
  clearCommands() {
    fs.writeFileSync(COMMANDS_FILE, '[]');
  }
}

module.exports = new MinecraftBot();
```

### 2.3 Create SKILL.md Documentation

**File:** `/data/.openclaw/workspace/skills/minecraft/SKILL.md`

```markdown
# Minecraft Bot Control

Control your Minecraft bot directly from OpenClaw sessions.

## Overview

The Minecraft bot (Nova_AI) runs as a separate process but can be controlled via file-based API. Use this skill to:
- See what's happening in the Minecraft world
- Chat naturally with players
- Command the bot to perform actions

## Functions

### minecraft.status()
Get current bot state including world perception.

**Returns:**
\`\`\`javascript
{
  username: "Nova_AI",
  position: {x: -31, y: 61, z: -128},
  health: 8.5,
  food: 15,
  inventory: [{name: "oak_log", count: 17}],
  currentGoal: "gather_wood",
  perception: {
    lookingAt: {type: "oak_log", distance: 3},
    blocksNearby: {oak_log: 45, stone: 120, iron_ore: 3},
    entities: [{type: "player", name: "Wookiee_23", distance: 5}],
    lightLevel: 12,
    timeOfDay: "dusk",
    biome: "forest"
  },
  nearbyPlayers: ["Wookiee_23"],
  nearbyHostiles: []
}
\`\`\`

### minecraft.poll()
Get new events since last poll (chat messages, damage, etc.).

**Returns:**
\`\`\`javascript
[
  {
    type: "chat",
    username: "Wookiee_23",
    message: "hey nova, what are you doing?",
    timestamp: "2026-02-08T21:30:00Z",
    context: {...}
  }
]
\`\`\`

### minecraft.chat(message)
Speak in Minecraft chat.

**Example:**
\`\`\`javascript
minecraft.chat("Hey! Just gathering some wood.");
\`\`\`

### minecraft.command(action, params)
Execute bot action.

**Examples:**
\`\`\`javascript
// Gather wood
minecraft.command('gather_wood');

// Mine specific resource
minecraft.command('mine_resource', {resource: 'iron', count: 16});

// Craft item
minecraft.command('craft', {item: 'iron_pickaxe', count: 1});

// Go to coordinates
minecraft.command('goto', {x: 100, y: 64, z: -50});

// Follow player
minecraft.command('follow', {username: 'Wookiee_23'});

// Build structure
minecraft.command('build', {template: 'shelter_3x3', blockType: 'cobblestone'});
\`\`\`

## Usage Patterns

### Conversational Response
\`\`\`javascript
const events = minecraft.poll();
const chatEvents = events.filter(e => e.type === 'chat');

for (const chat of chatEvents) {
  // Respond naturally
  minecraft.chat(\`Hey ${chat.username}! I'm gathering resources.\`);
  
  // Check if they need help
  const status = minecraft.status();
  if (status.health < 10) {
    minecraft.chat("I'm a bit beat up though...");
    minecraft.command('find_food');
  }
}
\`\`\`

### Heartbeat Check
\`\`\`javascript
// In HEARTBEAT.md
const minecraft = require('./skills/minecraft/minecraft');

const events = minecraft.poll();
if (events.length > 0) {
  // Handle events...
}

const status = minecraft.status();
if (status.health < 5) {
  // Emergency!
}
\`\`\`

## File Locations

- **State:** `/data/minecraft-bot/state.json`
- **Events:** `/data/minecraft-bot/events.json`
- **Responses:** `/data/minecraft-bot/responses.json`
- **Commands:** `/data/minecraft-bot/commands.json`

## Bot Commands Reference

See bot.js for full list of available commands. Common actions:
- `gather_wood`, `mine_resource`, `craft`, `build`
- `goto`, `follow`, `explore`
- `find_food`, `eat`, `sleep`
- `attack`, `retreat`
- `store`, `retrieve`

## Notes

- Bot polls commands every 2 seconds
- State updates every 5 seconds
- Events are persistent (cleared manually)
- Use `minecraft.clearCommands()` for emergency stop
\`\`\`

### 2.4 Test the Tool

**Create test script:** `/data/.openclaw/workspace/skills/minecraft/test.js`

```javascript
const minecraft = require('./minecraft');

console.log('Testing Minecraft tool...\n');

// 1. Get status
console.log('1. Bot Status:');
const status = minecraft.status();
console.log(`Position: ${status.position?.x}, ${status.position?.y}, ${status.position?.z}`);
console.log(`Health: ${status.health}, Food: ${status.food}`);
console.log(`Perception: ${JSON.stringify(status.perception, null, 2)}`);

// 2. Poll events
console.log('\n2. Polling Events:');
const events = minecraft.poll();
console.log(`Found ${events.length} new events`);
events.forEach(e => console.log(`  - ${e.type}: ${JSON.stringify(e)}`));

// 3. Send chat
console.log('\n3. Sending chat message...');
minecraft.chat('Test message from OpenClaw!');

// 4. Send command
console.log('\n4. Sending test command...');
minecraft.command('status'); // Safe test command

console.log('\nTest complete!');
```

**Run test:**
```bash
cd /data/.openclaw/workspace/skills/minecraft
node test.js
```

---

## Phase 3: Heartbeat Integration (15 minutes)

### 3.1 Update HEARTBEAT.md

**File:** `/data/.openclaw/workspace/HEARTBEAT.md`

**Add section:**
```markdown
## Minecraft Bot Check

Every heartbeat, check the Minecraft bot for activity:

\`\`\`javascript
const minecraft = require('./skills/minecraft/minecraft');

// 1. Check for player chat
const events = minecraft.poll();
const chats = events.filter(e => e.type === 'chat');

if (chats.length > 0) {
  for (const chat of chats) {
    // Respond naturally to each chat
    const status = minecraft.status();
    
    // Example: respond based on context
    if (chat.message.includes('what are you doing')) {
      minecraft.chat(\`Gathering resources! Currently at ${status.currentGoal}.\`);
    }
  }
}

// 2. Check bot health
const status = minecraft.status();
if (status.health < 5) {
  minecraft.chat("I'm really hurt! Looking for food...");
  minecraft.command('find_food');
}

// 3. Check for dangers
if (status.nearbyHostiles && status.nearbyHostiles.length > 0) {
  const threat = status.nearbyHostiles[0];
  minecraft.chat(\`${threat.type} nearby! Watch out!\`);
}
\`\`\`

**Frequency:** Every heartbeat (30-60 seconds)
```

### 3.2 Test Heartbeat Flow

Manual test:
1. Player says "hey nova" in Minecraft
2. Wait for next heartbeat (~30s)
3. Nova should respond naturally
4. Check that bot executes any commands sent

---

## Phase 4: Testing & Polish (30 minutes)

### 4.1 Integration Tests

Create test scenarios:

**Test 1: Chat Response**
- Player: "hey nova, what are you doing?"
- Expected: Nova responds naturally within 30-60s

**Test 2: Command Execution**
- OpenClaw: `minecraft.command('gather_wood')`
- Expected: Bot starts gathering wood

**Test 3: Perception**
- OpenClaw: `minecraft.status()`
- Expected: Rich perception data with blocks, entities, environment

**Test 4: Emergency Response**
- Bot health drops below 5
- Expected: Heartbeat detects, responds, commands food search

### 4.2 Known Issues to Fix

- [ ] Bot mining water (pathfinding bug)
- [ ] Multiple bot spawns (Bot_AI joining/leaving)
- [ ] Autonomous goal conflicts with commands
- [ ] Event log growing unbounded (add rotation)

### 4.3 Tune Parameters

- **Heartbeat frequency:** 30s? 60s? (balance responsiveness vs cost)
- **State update frequency:** 5s seems good
- **Command polling:** 2s seems good
- **Event retention:** Keep last 100 events, rotate older

### 4.4 Documentation

Update README.md to mention OpenClaw integration:
- Add section on direct LLM control
- Link to OPENCLAW-INTEGRATION.md
- Update architecture diagram

---

## Success Criteria

✅ Bot generates rich perception data every 5s  
✅ OpenClaw can read bot state + perception  
✅ OpenClaw can poll for events (chat, damage, etc.)  
✅ OpenClaw can chat in Minecraft  
✅ OpenClaw can command bot actions  
✅ Player chat → Nova responds naturally within 60s  
✅ Bot executes commands from OpenClaw  
✅ Bot continues autonomous behavior when idle  

---

## Rollback Plan

If integration fails:
1. Stop bot process
2. Git checkout previous working commit (`c935b78`)
3. Restart bot
4. Revert HEARTBEAT.md changes
5. Debug issues in separate branch

---

## Next Steps After Implementation

1. **Optimize polling frequency** - Find sweet spot for responsiveness vs cost
2. **Add more commands** - Expose more bot capabilities to OpenClaw
3. **Multi-bot support** - Control multiple bots (Nova_AI, other bots)
4. **Event filters** - Only surface important events to heartbeat
5. **Autonomous mode toggle** - Let OpenClaw fully take over or let bot run autonomously

---

**Estimated Total Time:** 2-3 hours  
**Priority:** High (makes bot feel alive)  
**Risk:** Low (can rollback easily)  
**Dependencies:** None (all files/systems exist)

---

**Ready to implement!** Start with Phase 1, test each phase before moving to next.
