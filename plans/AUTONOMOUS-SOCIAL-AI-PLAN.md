# Implementation Plan: Autonomous Social AI Mode

**Goal:** Transform the Minecraft bot from a command-driven tool into an autonomous social AI that pursues its own goals while interacting naturally with players and collaborating with other bots.

---

## 📋 Vision

### Current State (Command-Driven Tool)
- Players command: `nova follow me`, `nova mine iron`
- File control: `commands.json` with explicit instructions
- Bot obeys (with agency/negotiation)
- Bot is a **tool** for players/agents

### Desired State (Autonomous Social AI)
- Players converse: "Hey Nova, what are you doing?"
- No command interface (no `nova <command>`)
- No file-based control (`commands.json` ignored)
- Bot pursues own goals: gather, build, explore, survive
- Bot is an **autonomous inhabitant** of the world
- Bots collaborate with each other via whispers
- Bots respond conversationally to players

---

## 🗂️ Files to Modify

### Primary Changes
1. **`bot.js`** - Main bot logic (5 major sections to change)
2. **`README.md`** - Update to reflect autonomous mode
3. **`docs/NEW-AGENT-GUIDE.md`** - Rewrite for autonomous deployment
4. **`examples/autonomous-controller.js`** - Remove (no longer applicable)

### New Files to Create
1. **`docs/AUTONOMOUS-MODE.md`** - How autonomous mode works
2. **`examples/conversational-agent.js`** - Agent-controlled conversation handler (agent IS the LLM)
3. **`examples/PERSONALITY-EXAMPLES.md`** - Example SOUL.md personalities for different bot types

### New Data Files (Runtime)
1. **`conversations.json`** - Queue of player messages for agent to respond to
2. **`responses.json`** - Agent-generated responses for bot to speak

---

## 🔧 Detailed Implementation

### 1. Remove Command System

**File:** `bot.js` (~line 3470+)

**Changes:**

```javascript
// BEFORE: Command handlers
bot.on('chat', (username, message) => {
  const cmd = getCommandPrefix();
  
  if (msg === `${cmd} help`) { ... }
  if (msg === `${cmd} follow`) { ... }
  if (msg === `${cmd} mine iron`) { ... }
  // ... 50+ command handlers
});

// AFTER: Conversational responses
bot.on('chat', (username, message) => {
  if (username === bot.username) return;
  
  // Bot-to-bot whisper coordination (keep this)
  if (isWhisper && isBotMessage(message)) {
    handleBotWhisper(username, message);
    return;
  }
  
  // Conversational responses to players
  if (mentionsBot(message)) {
    respondConversationally(username, message);
  }
});
```

**Specific removals:**
- Remove ALL `if (msg === \`${cmd} <command>\`)` blocks (~100 lines, line 3500-3900)
- Remove `getCommandPrefix()` function (no longer needed)
- Keep bot-to-bot whisper handlers (Phase 21 coordination)

---

### 2. Add Agent-Controlled Conversational System

**Architecture:** The OpenClaw agent (which IS an LLM like Claude/GPT) generates conversation responses. No hardcoded if/else patterns - the agent uses its own intelligence.

**File:** `bot.js` (new functions and file interface)

**Add conversation queue system:**

```javascript
const CONVERSATIONS_FILE = '/data/minecraft-bot/conversations.json';
const RESPONSES_FILE = '/data/minecraft-bot/responses.json';

let pendingConversations = [];
let conversationIdCounter = Date.now();

/**
 * Check if message mentions or is directed at this bot
 */
function mentionsBot(message) {
  const msg = message.toLowerCase();
  const botName = bot.username.toLowerCase().replace(/_/g, ' ');
  
  return msg.includes(botName) || 
         msg.includes(bot.username.toLowerCase()) ||
         msg.includes('@' + bot.username);
}

/**
 * Queue conversation for agent to respond
 */
function queueConversation(username, message) {
  const conversation = {
    id: conversationIdCounter++,
    username: username,
    message: message,
    timestamp: new Date().toISOString(),
    context: {
      botName: bot.username,
      botGoal: currentAutonomousGoal?.action || 'idle',
      position: bot.entity.position,
      health: bot.health,
      food: bot.food,
      inventory: bot.inventory.items().map(i => ({ name: i.name, count: i.count })),
      nearbyPlayers: Object.keys(bot.players).filter(p => p !== bot.username)
    }
  };
  
  pendingConversations.push(conversation);
  saveConversations();
  
  console.log(`[Conversation] Queued from ${username}: "${message}"`);
}

/**
 * Save conversations to file for agent
 */
function saveConversations() {
  try {
    fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(pendingConversations, null, 2));
  } catch (err) {
    console.error('Failed to save conversations:', err.message);
  }
}

/**
 * Read and speak responses from agent
 */
function processResponses() {
  try {
    if (!fs.existsSync(RESPONSES_FILE)) return;
    
    const responsesData = fs.readFileSync(RESPONSES_FILE, 'utf8');
    if (!responsesData.trim()) return;
    
    const responses = JSON.parse(responsesData);
    
    responses.forEach(resp => {
      // Find and remove the conversation this responds to
      pendingConversations = pendingConversations.filter(c => c.id !== resp.conversationId);
      
      // Speak the response
      bot.chat(resp.text);
      console.log(`[Conversation] Response: "${resp.text}"`);
    });
    
    // Clear responses file and update conversations
    fs.writeFileSync(RESPONSES_FILE, '[]');
    saveConversations();
    
  } catch (err) {
    console.error('Failed to process responses:', err.message);
  }
}

/**
 * Check if message is from a bot (for whisper coordination)
 */
function isBotMessage(message) {
  try {
    const parsed = JSON.parse(message);
    return parsed.type && parsed.message;
  } catch {
    return false;
  }
}

// Poll for agent responses every second
setInterval(processResponses, 1000);
```

**Update chat handler:**

```javascript
bot.on('chat', (username, message) => {
  if (username === bot.username) return;
  
  // Bot-to-bot whisper coordination (keep this)
  if (isWhisper && isBotMessage(message)) {
    handleBotWhisper(username, message);
    return;
  }
  
  // Queue conversation for agent if bot is mentioned
  if (mentionsBot(message)) {
    queueConversation(username, message);
  }
});
```

**Agent reads and responds** (in separate controller - see `examples/conversational-agent.js`):

The OpenClaw agent (Claude/GPT/etc) IS the LLM - it generates responses directly:

```javascript
// Agent loop (runs in OpenClaw agent session)
setInterval(() => {
  const convos = JSON.parse(fs.readFileSync('conversations.json'));
  const responses = [];
  
  for (const convo of convos) {
    // Agent IS the LLM - directly generates response using own intelligence
    const response = generateResponse(convo);
    
    responses.push({
      conversationId: convo.id,
      text: response
    });
  }
  
  // Write responses for bot to speak
  fs.writeFileSync('responses.json', JSON.stringify(responses, null, 2));
}, 2000);

// Agent uses its own LLM capabilities to understand and respond
function generateResponse(convo) {
  const { username, message, context } = convo;
  
  // Agent (Claude/GPT) understands message naturally and responds
  // Uses personality from SOUL.md, current context, etc.
  // This is where the LLM's intelligence comes in - no hardcoded patterns
  
  // Example: Agent sees "what are you doing?" and responds based on context
  // The agent can use its full language understanding, personality, goals, etc.
}

---

### 3. Remove File-Based Control System

**File:** `bot.js` (~line 3200+)

**Changes:**

```javascript
// BEFORE: Reads and processes commands.json
function processCommands() {
  const commands = readCommands();
  commands.forEach(cmd => executeCommand(cmd));
}

setInterval(processCommands, 750);

// AFTER: Remove entirely
// (delete processCommands function)
// (delete readCommands function)
// (delete setInterval for command processing)
```

**Specific removals:**
- Remove `processCommands()` function (~line 3200)
- Remove `readCommands()` function (~line 3100)
- Remove `setInterval(processCommands, 750)` (~line 1620)
- Keep `executeCommand()` - still used for autonomous actions

**Note:** Keep `events.json` writing - agents can still OBSERVE, just not control.

---

### 4. Fix Autonomous Behavior System

**File:** `bot.js` (~line 3210+)

**Critical Bug Fix (from Supernova agent):**

The autonomous system currently has an infinite loop bug. Changes needed:

```javascript
// Add goal state tracking
let currentAutonomousAction = null;
let lastAutonomousCheck = 0;

async function autonomousBehaviorLoop() {
  // Don't check too frequently
  const now = Date.now();
  if (now - lastAutonomousCheck < 5000) return; // 5 second minimum cooldown
  lastAutonomousCheck = now;
  
  // Don't spawn new goal if one is active
  if (currentAutonomousAction && currentAutonomousAction.inProgress) {
    return;
  }
  
  // Decide next autonomous action
  const action = decideAutonomousAction();
  
  if (action) {
    currentAutonomousAction = { ...action, inProgress: true };
    await executeAutonomousAction(action);
    currentAutonomousAction.inProgress = false;
  }
}

function executeAutonomousAction(action) {
  console.log(`[Autonomous] Starting: ${action.action}`);
  
  // Execute the action
  executeCommand(action);
  
  // Set completion timeout
  setTimeout(() => {
    if (currentAutonomousAction?.inProgress) {
      console.log(`[Autonomous] Completed: ${action.action}`);
      currentAutonomousAction = null;
    }
  }, 30000); // 30 second timeout for any action
}
```

**Changes:**
1. Add `currentAutonomousAction` state variable
2. Add cooldown between autonomous checks (5 seconds minimum)
3. Track when actions start/complete
4. Prevent multiple simultaneous autonomous goals
5. Add timeout to prevent infinite goals

**Re-enable autonomous mode:**
```javascript
const AUTONOMOUS_CONFIG = {
  enabled: true,  // Was disabled due to bug - now fixed
  ...
}
```

---

### 5. Enhance Bot-to-Bot Collaboration

**File:** `bot.js` (~line 800+)

**Keep and enhance Phase 21 whisper system:**

Current bot-to-bot features (KEEP):
- Discovery via username patterns
- Whispered coordination (JSON messages)
- Emergency signals
- Resource claims
- Discovery sharing

**Add new social behaviors:**

```javascript
/**
 * Bots form relationships over time
 */
let botRelationships = {
  // botUsername: { lastInteraction: timestamp, helpCount: number, friendly: boolean }
};

function updateBotRelationship(botName, interactionType) {
  if (!botRelationships[botName]) {
    botRelationships[botName] = { lastInteraction: 0, helpCount: 0, friendly: true };
  }
  
  const rel = botRelationships[botName];
  rel.lastInteraction = Date.now();
  
  if (interactionType === 'help') {
    rel.helpCount++;
  }
  
  // Save to world memory
  worldMemory.botRelationships = botRelationships;
  saveWorldMemory();
}

/**
 * More likely to help bots we've worked with before
 */
function shouldHelpBot(botName, request) {
  const rel = botRelationships[botName];
  
  if (!rel) return 0.5; // 50% chance for unknown bots
  
  // Bots who've helped us = higher priority
  return Math.min(0.9, 0.5 + (rel.helpCount * 0.1));
}
```

**Result:** Bots form social networks and are more likely to help bots they've collaborated with before.

---

### 6. Update Autonomous Goal System

**File:** `bot.js` (~line 500+)

**Expand autonomous goals to be more diverse:**

```javascript
const AUTONOMOUS_GOALS = {
  survival: {
    weight: 10,
    conditions: (bot) => bot.health < 15 || bot.food < 10,
    actions: ['find_food', 'seek_shelter', 'flee_danger']
  },
  
  gathering: {
    weight: 5,
    conditions: (bot) => needsResources(bot),
    actions: ['gather_wood', 'mine_stone', 'mine_iron', 'fish']
  },
  
  building: {
    weight: 3,
    conditions: (bot) => hasResources(bot) && !worldMemory.home,
    actions: ['build_shelter', 'craft_tools', 'place_chest']
  },
  
  exploration: {
    weight: 2,
    conditions: () => true, // Always an option
    actions: ['explore', 'mark_location', 'find_village']
  },
  
  social: {
    weight: 1,
    conditions: (bot) => nearbyPlayers(bot).length > 0,
    actions: ['greet_player', 'follow_at_distance', 'observe']
  }
};

function decideAutonomousAction() {
  // Weighted random selection based on conditions
  const validGoals = Object.entries(AUTONOMOUS_GOALS)
    .filter(([name, goal]) => goal.conditions(bot))
    .map(([name, goal]) => ({ name, ...goal }));
  
  const totalWeight = validGoals.reduce((sum, g) => sum + g.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const goal of validGoals) {
    random -= goal.weight;
    if (random <= 0) {
      const action = pickRandom(goal.actions);
      return { action, goal: goal.name };
    }
  }
  
  return { action: 'explore', goal: 'exploration' };
}
```

**Result:** Bots have more varied behavior - not just "gather wood" in a loop.

---

### 7. Spawn Greeting Personality

**File:** `bot.js` (~line 1595)

**Current:** `bot.chat('Hello World!');`

**Enhanced:**

```javascript
function generateSpawnGreeting() {
  const greetings = [
    "Hello World!",
    "Hey everyone!",
    "Greetings from the new arrival!",
    "*waves*",
    "Another day, another adventure!",
    "What's everyone up to?"
  ];
  
  // Personality-based greeting
  if (soul.vibe && soul.vibe.includes('shy')) {
    return "*quietly joins the server*";
  }
  
  if (soul.vibe && soul.vibe.includes('quirky')) {
    return "I have arrived! :)";
  }
  
  if (soul.vibe && soul.vibe.includes('competitive')) {
    return "Let's see what we can build today.";
  }
  
  return pickRandom(greetings);
}

// In spawn handler:
setTimeout(() => {
  const otherPlayers = Object.values(bot.players).filter(p => p.username !== bot.username);
  if (otherPlayers.length > 0) {
    bot.chat(generateSpawnGreeting());
  }
}, 5000);
```

---

### 8. Create Conversational Agent Example

**New File:** `examples/conversational-agent.js`

This example shows how an OpenClaw agent (which IS an LLM) handles bot conversations:

```javascript
/**
 * Conversational Agent - Bot's "Mind"
 * 
 * The OpenClaw agent IS an LLM (Claude/GPT/etc).
 * It reads conversations.json and generates responses using its own intelligence.
 * 
 * USAGE from OpenClaw agent:
 * await sessions_spawn({
 *   task: `Control ${bot.username}'s conversations using your LLM intelligence.`,
 *   label: "minecraft-conversations"
 * });
 */

const fs = require('fs');
const CONVERSATIONS_FILE = '/data/minecraft-bot/conversations.json';
const RESPONSES_FILE = '/data/minecraft-bot/responses.json';

// Agent loop - read conversations, generate responses
setInterval(() => {
  const conversations = JSON.parse(fs.readFileSync(CONVERSATIONS_FILE));
  const responses = [];
  
  for (const convo of conversations) {
    // Agent IS the LLM - directly generates response
    const response = generateNaturalResponse(convo);
    responses.push({ conversationId: convo.id, text: response });
  }
  
  fs.writeFileSync(RESPONSES_FILE, JSON.stringify(responses));
}, 2000);

/**
 * Agent uses its own LLM intelligence to understand and respond
 * No hardcoded patterns - the agent naturally understands language
 */
function generateNaturalResponse(convo) {
  const { username, message, context } = convo;
  
  // In a real OpenClaw agent (Claude/GPT), THIS is where the LLM comes in
  // The agent understands the message naturally and responds based on:
  // - Bot's personality (SOUL.md)
  // - Current context (what bot is doing)
  // - Conversation history
  // - Social awareness
  
  // Agent generates contextually appropriate response using its intelligence
  // Example: if message is "what are you doing?", agent understands and responds
  // based on context.botGoal, personality, and social relationship
  
  return /* agent's natural language response */;
}
```

**Key difference from old approach:**
- ❌ Old: Hardcoded `if (msg.includes('hello'))` patterns
- ✅ New: Agent (which IS an LLM) naturally understands and responds

The agent doesn't need to "call an LLM" - it IS the LLM. It reads the conversation, understands it naturally, and generates an appropriate response based on personality, context, and its own intelligence.

---

## 📖 Documentation Updates

### Update README.md

**Section to Add (after Features):**

```markdown
## 🤖 Autonomous Mode

This bot operates in **Autonomous Social AI mode** - it pursues its own goals while interacting naturally with the world.

### What This Means

**The bot is NOT a command-driven tool.** It's an autonomous inhabitant of the Minecraft world that:

- ✅ Pursues own goals (gather, build, explore, survive)
- ✅ Chats conversationally with players
- ✅ Collaborates with other bots via whispers
- ✅ Forms social relationships over time
- ✅ Has personality via SOUL.md
- ❌ Does NOT take commands from players
- ❌ Does NOT accept file-based control

### Interacting with the Bot

**Natural conversation:**
```
You: hey nova what are you doing?
Nova: I'm gathering wood. Just doing my thing!

You: there's diamonds at -100 64 50
Nova: Thanks for the tip! I'll check it out later.

You: can you help me mine?
Nova: I'm busy with my own projects right now.
```

**Observing the bot:**
- Agents can READ `events.json` to observe bot behavior
- Players can watch bot pursue goals and interact
- Multiple bots form emergent social behaviors

### Deploying an Autonomous Bot

1. Configure identity and personality
2. Deploy to Minecraft server
3. Observe behavior via `events.json`
4. Watch bots interact with each other

See [`docs/AUTONOMOUS-MODE.md`](docs/AUTONOMOUS-MODE.md) for details.
```

---

### Create docs/AUTONOMOUS-MODE.md

**New file explaining the autonomous mode design:**

```markdown
# Autonomous Social AI Mode

This document explains how the bot operates in autonomous mode and how to customize its behavior.

## Philosophy

The bot is designed as an **autonomous social AI** - not a tool to be commanded, but an independent agent that:
- Has its own goals and motivations
- Interacts naturally with players and other bots
- Forms emergent behaviors through collaboration
- Can be observed but not controlled

Think of it like deploying an AI villager or NPC that has agency.

## How It Works

### Autonomous Goal Pursuit

The bot uses a weighted goal system:
- **Survival** (high priority): Find food, flee danger, seek shelter
- **Gathering** (medium): Collect resources (wood, stone, iron)
- **Building** (medium): Craft tools, build shelters
- **Exploration** (low): Wander, discover, mark locations
- **Social** (low): Interact with nearby players

Goals are selected based on:
1. Current needs (health, hunger, resources)
2. Environmental context (night, nearby players, danger)
3. Weighted randomness (creates behavioral variety)

### Conversational Responses

Players can chat with the bot naturally:
- Bot responds to mentions of its name
- Understands context (greetings, questions, requests)
- Personality influences tone (via SOUL.md)
- Can decline requests politely

### Bot-to-Bot Collaboration

Bots discover and coordinate with each other:
- Whispered JSON messages (no public spam)
- Emergency signals (request help when in danger)
- Resource sharing (tell each other about discoveries)
- Relationship tracking (more likely to help familiar bots)

## Customization

### 1. Personality (SOUL.md)

Create a personality file to customize bot behavior:

```markdown
# I am ExplorerBot

Be curious and adventurous.
Value discovery and knowledge.
Always share interesting findings.
Never harm passive mobs.
```

Configure:
```bash
export SOUL_PATH=/path/to/personality.md
```

### 2. Goal Weights

Edit `AUTONOMOUS_GOALS` in `bot.js` to change behavior priorities:

```javascript
const AUTONOMOUS_GOALS = {
  survival: { weight: 10, ... },
  gathering: { weight: 5, ... },
  building: { weight: 3, ... },
  exploration: { weight: 8, ... },  // Increase for more exploration
  social: { weight: 5, ... }        // Increase for more social behavior
};
```

### 3. Conversational Responses

Edit `respondConversationally()` to customize how bot talks:

```javascript
function respondConversationally(username, message) {
  // Add custom response patterns
  if (msg.includes('your favorite')) {
    bot.chat("I love exploring new areas!");
    return;
  }
  
  // Personality-specific responses
  if (soul.values.includes('helpful')) {
    // More likely to offer assistance
  }
}
```

## Observing Behavior

### events.json

Agents can observe bot behavior in real-time:

```javascript
const events = JSON.parse(fs.readFileSync('events.json'));
const latest = events[events.length - 1];

console.log('Bot position:', latest.data.position);
console.log('Bot health:', latest.data.health);
console.log('Current goal:', latest.data.currentGoal);
```

### World Memory

Bot's persistent state:

```javascript
const memory = JSON.parse(fs.readFileSync('world-memory.json'));
console.log('Landmarks:', memory.landmarks);
console.log('Known bots:', memory.knownBots);
console.log('Bot relationships:', memory.botRelationships);
```

## Multi-Bot Experiments

Deploy multiple bots to observe emergent behavior:

```bash
# Bot 1: Gatherer personality
BOT_USERNAME=GathererBot SOUL_PATH=./personalities/gatherer.md node bot.js &

# Bot 2: Builder personality
BOT_USERNAME=BuilderBot SOUL_PATH=./personalities/builder.md node bot.js &

# Bot 3: Explorer personality
BOT_USERNAME=ExplorerBot SOUL_PATH=./personalities/explorer.md node bot.js &
```

Watch them:
- Discover each other
- Share information
- Help each other in emergencies
- Form specialization patterns

## Debugging

### Verbose Logging

Enable detailed autonomous behavior logs:

```javascript
const AUTONOMOUS_CONFIG = {
  ...
  verbose: true,  // Logs every decision
  logInterval: 5000  // Log state every 5 seconds
};
```

### Manual Goals (Testing)

Temporarily set a goal for testing:

```javascript
// In bot.js, temporarily:
currentAutonomousAction = { action: 'explore', goal: 'testing' };
```

## FAQ

**Q: Can I ever command the bot?**
A: No - that's the point. It's autonomous. But you can observe and interact conversationally.

**Q: What if the bot does something I don't want?**
A: Adjust its personality (SOUL.md) or goal weights. Or accept it as emergent behavior!

**Q: Can bots fight each other?**
A: Only if their SOUL.md allows it. Most personalities will cooperate, not compete.

**Q: Will bots steal from players?**
A: No - bots respect other players' items/builds (unless personality says otherwise).

**Q: How do I stop a runaway bot?**
A: Shut down the process or use server commands. There's no "pause" button - it's autonomous!
```

---

## ✅ Testing Checklist

After implementation, verify:

### Autonomous Behavior
- [ ] Bot spawns and says greeting
- [ ] Bot pursues goals when idle (gather wood, explore, etc.)
- [ ] Bot switches goals based on needs (hunger, night, etc.)
- [ ] Bot doesn't spam infinite gather_wood loops
- [ ] Bot's goals are diverse (not stuck on one action)

### Conversational Interaction
- [ ] Bot responds to "hey nova what are you doing?"
- [ ] Bot responds to greetings ("hi", "hello")
- [ ] Bot declines requests politely ("can you help me?")
- [ ] Bot shares location when asked
- [ ] Bot ignores non-mention messages (doesn't respond to everything)

### Bot-to-Bot Collaboration
- [ ] Bots discover each other (by username pattern)
- [ ] Bots whisper coordination messages (no public spam)
- [ ] Bot responds to emergency signal from another bot
- [ ] Bots form relationships over time (help count tracked)
- [ ] Bot-to-bot whispers don't interfere with player chat

### Removal of Command System
- [ ] `nova follow` does nothing (or responds conversationally)
- [ ] `nova mine iron` does nothing
- [ ] `nova help` does nothing (no command list)
- [ ] `commands.json` file is ignored
- [ ] Bot still writes `events.json` (observation)

### Personality Integration
- [ ] SOUL.md personality affects conversation tone
- [ ] Shy bot is quieter, quirky bot is playful
- [ ] Bot boundaries are respected (won't attack villagers if SOUL says no)
- [ ] Greeting reflects personality

### Multi-Bot Scenario
- [ ] Deploy 2+ bots with different personalities
- [ ] Bots discover each other
- [ ] Bots have different behavioral patterns
- [ ] Bots help each other when needed
- [ ] No infinite chat loops between bots

---

## 🚀 Deployment Steps

1. **Implement changes** (all sections above)
2. **Test locally** with one bot (verify autonomous loop works)
3. **Test multi-bot** (2-3 bots with different personalities)
4. **Update documentation** (README, AUTONOMOUS-MODE.md)
5. **Remove obsolete files** (autonomous-controller.js no longer relevant)
6. **Push to GitHub**
7. **Deploy to production** (update /data/minecraft-bot/bot.js)
8. **Restart bot** with autonomous mode enabled
9. **Observe** emergent behavior!

---

## 📊 Success Metrics

After deployment, the bot should:
- ✅ Operate independently for 24+ hours without manual intervention
- ✅ Pursue varied goals (not stuck in loops)
- ✅ Interact naturally with players
- ✅ Collaborate with other bots
- ✅ Form emergent social behaviors
- ✅ Reflect personality from SOUL.md
- ✅ Never hang/crash from command queue issues

---

## 🎯 Vision Realized

When complete, you'll have:
- **Autonomous AI inhabitants** of a Minecraft world
- **Social agents** that chat and collaborate
- **Emergent behavior** from bot-bot interactions
- **Observable AI society** (like a sim/experiment)
- **True autonomy** - no commands, just life

It's like running an AI civilization experiment in Minecraft! 🤖🌍

---

**Ready for implementation!**
