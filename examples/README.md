# Example Bot Controllers

This directory contains example scripts demonstrating how to control the Minecraft bot via the file-based IPC interface.

## basic-controller.js

A simple reactive controller that polls `state.json` and writes `commands.json` in a loop.

### Features
- Basic survival (eat when hungry, flee danger)
- Combat (attack nearby hostiles)
- Social (follow nearby players)
- Sleep at night
- Explore when idle

### Usage

```bash
# Start the bot first
cd ..
npm start &

# Run the controller
node basic-controller.js
```

### Customization

Edit the `decide()` function to change decision logic:
- Add new priorities (e.g., mine resources, farm crops)
- Change thresholds (e.g., eat at food < 10 instead of < 6)
- Add long-term goals (e.g., craft iron tools, build shelter)

## spawn-bot.sh

Quick launcher script that starts the bot process in the background and shows status.

```bash
./spawn-bot.sh
```

## Creating Your Own Controller

### Step 1: Read State

```javascript
const fs = require('fs');
const state = JSON.parse(fs.readFileSync('data/state.json', 'utf8'));
console.log(`Health: ${state.bot.health}/20`);
console.log(`Position: ${JSON.stringify(state.bot.position)}`);
console.log(`Nearby: ${state.nearbyEntities.length} entities`);
```

### Step 2: Write Commands

Every command needs a unique `id` for result tracking:

```javascript
const commands = [
  { id: 'cmd-1', action: 'goto', x: 100, y: 64, z: -50 },
  { id: 'cmd-2', action: 'mine_resource', resource: 'iron_ore', count: 5 }
];
fs.writeFileSync('data/commands.json', JSON.stringify(commands, null, 2));
```

### Step 3: Check Results

Command results appear in `events.json` with type `command_result`:

```javascript
const events = JSON.parse(fs.readFileSync('data/events.json', 'utf8'));
const results = events.filter(e => e.type === 'command_result');
// { id: 42, timestamp: ..., type: "command_result", commandId: "cmd-1", success: true, detail: "..." }
```

### Step 4: Loop

```javascript
setInterval(() => {
  const state = readState();
  const commands = decide(state);
  if (commands.length > 0) writeCommands(commands);
}, 5000);
```

## Command Reference

See [docs/INTERFACE.md](../docs/INTERFACE.md) for complete state/event/command reference.

**Common Commands:**
- `goto` - Navigate to coordinates
- `follow` - Follow a player
- `stop` - Stop all movement
- `attack` - Attack a mob
- `mine_resource` - Find and mine ore
- `craft` - Craft items
- `eat` - Eat food
- `sleep` - Sleep through night
- `build` - Build structures (shelter, pillar, bridge, wall)
- `farm` - Full farming cycle
