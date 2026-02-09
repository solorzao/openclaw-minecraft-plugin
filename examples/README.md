# Example Bot Controllers

This directory contains example scripts demonstrating how to control the Minecraft bot.

## autonomous-controller.js

**Pattern 2: Autonomous Subagent Controller**

A fully autonomous controller that reads `events.json`, makes decisions, and writes `commands.json` in a loop. Designed to be spawned as an OpenClaw subagent.

### Features
- ✅ Critical survival logic (health, hunger, drowning)
- ✅ Combat (attack/flee based on health)
- ✅ Resource gathering (wood → stone → iron)
- ✅ Crafting progression (wooden pickaxe → stone pickaxe → iron tools)
- ✅ Shelter building at night
- ✅ Exploration when idle
- ✅ Periodic progress reports (every 10 minutes)

### Usage from OpenClaw Agent

```javascript
// Spawn autonomous controller as subagent
await sessions_spawn({
  task: `Run the Minecraft bot autonomous controller at /path/to/autonomous-controller.js
         
         Goals:
         - Survive (health, hunger, shelter)
         - Gather resources (wood, stone, iron)
         - Build shelter when night comes
         - Progress to iron tools
         - Explore when idle
         
         Report back every 10 minutes with progress summary.
         If you die or get stuck, explain what happened and restart.`,
  label: "minecraft-controller",
  cleanup: "keep"  // Let it run indefinitely
});

// Check on it later
const history = await sessions_history("minecraft-controller");
console.log(history);
```

### Usage Standalone (Testing)

```bash
# Set file paths (optional, defaults to /data/minecraft-bot/)
export EVENTS_FILE=/path/to/events.json
export COMMANDS_FILE=/path/to/commands.json

# Run the controller
node examples/autonomous-controller.js
```

### Customization

Edit `decideAction()` function to change decision logic:
- Add new goals (e.g., farm wheat, trade with villagers)
- Change priorities (e.g., explore more, build less)
- Add custom behaviors (e.g., mine specific ores, build specific structures)

### Check-In Behavior

Controller reports progress every 10 minutes (configurable via `CHECKIN_INTERVAL_MS`):
- Current status (health, food, position, time)
- Stats (commands sent, food gathered, resources mined, shelters built)
- Inventory size
- Current goal

In a real OpenClaw subagent, uncomment the `sessions_send()` call to send reports back to parent.

---

## basic-controller.js

**Pattern 1: Simple Reactive Controller**

A simpler example that polls events and reacts to basic conditions. Good for learning the file interface.

### Features
- ✅ Basic survival (eat when hungry)
- ✅ Flee from danger
- ✅ Gather wood when idle

(See file for details)

---

## Creating Your Own Controller

### Step 1: Read Events

```javascript
const fs = require('fs');
const events = JSON.parse(fs.readFileSync('events.json', 'utf8'));
const latest = events[events.length - 1];

if (latest.type === 'perception') {
  const { health, food, position, nearbyMobs } = latest.data;
  // Make decisions...
}
```

### Step 2: Write Commands

```javascript
const commands = [
  { action: 'goto', x: 100, y: 64, z: -50 },
  { action: 'mine_resource', resource: 'iron_ore' }
];

fs.writeFileSync('commands.json', JSON.stringify(commands, null, 2));
```

### Step 3: Loop

```javascript
setInterval(() => {
  const event = readLatestEvent();
  const commands = decideAction(event);
  if (commands) sendCommands(commands);
}, 5000);  // Poll every 5 seconds
```

### Step 4: Report Back (in OpenClaw subagent)

```javascript
// Every 10 minutes
if (shouldCheckIn()) {
  await sessions_send({
    sessionKey: parentSession,
    message: `Progress: Mined 16 iron, built shelter, health 18/20`
  });
}
```

---

## Tips

### Keep State
Track progress between polls:
```javascript
let stats = {
  woodGathered: 0,
  stoneGathered: 0,
  deaths: 0
};
```

### Handle Errors
Bot might crash or get stuck:
```javascript
try {
  const event = readLatestEvent();
  // ...
} catch (err) {
  console.error('Error:', err);
  // Maybe restart bot or alert parent
}
```

### Test Locally First
Run your controller standalone before spawning as subagent:
```bash
node my-controller.js
```

### Use Environment Variables
Make file paths configurable:
```javascript
const EVENTS_FILE = process.env.EVENTS_FILE || '/default/path/events.json';
```

---

## Command Reference

See [`docs/INTERFACE.md`](../docs/INTERFACE.md) for complete command/event reference.

**Common Commands:**
- `find_food` - Hunt animals for food
- `gather_wood` - Chop trees
- `mine_resource` - Mine ore (coal, iron, diamond)
- `craft` - Craft items (pickaxe, sword, etc.)
- `smelt` - Smelt ore in furnace
- `build` - Build structures (shelter, pillar, bridge)
- `sleep` - Sleep through night
- `explore` - Wander and discover

**Common Events:**
- `perception` - Bot's current state (health, food, position, mobs)
- `chat` - Chat messages from players
- `death` - Bot died
- `goal_complete` - Bot finished a task
