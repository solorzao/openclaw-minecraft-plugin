# OpenClaw Minecraft Plugin

**Full-featured AI-controlled Minecraft bot for OpenClaw agents**

A complete autonomous survival system built on [Mineflayer](https://github.com/PrismarineJS/mineflayer), designed for OpenClaw AI agents to play Minecraft with human-level capabilities.

## 🎮 Features

### ✅ Complete (19 Phases Implemented)

| Phase | Feature | Commands |
|-------|---------|----------|
| 1-3 | **Navigation & Perception** | `follow`, `goto`, `stop`, `explore` |
| 4-5 | **Block Interaction & Combat** | `dig`, `place`, `equip`, `attack`, `retreat` |
| 6 | **Water Safety** | Auto-swim when drowning |
| 8 | **Hunger/Food** | `find_food`, `cook_food`, `eat` (auto-eat) |
| 9 | **Crafting** | `craft <item>` with recipe lookup |
| 10 | **Mining** | `mine <resource>`, safe mining, torch placement |
| 11 | **Sleep** | `sleep`, find/place beds |
| 12 | **Building** | `build <template>` (shelter, pillar, bridge, wall) |
| 13 | **Storage** | `store`, `retrieve`, chest tracking |
| 14 | **World Memory** | `mark <name>`, `goto_mark <name>`, persistent locations |
| 15 | **Villager Trading** | `trade`, interact with villagers |
| 16 | **Potions/Enchanting** | Brewing stand & enchanting table support |
| 17 | **Block Activation** 🔥 | `activate`, `door`, `use` (doors, buttons, levers) |
| 18 | **Mount/Dismount** 🐴 | `mount`, `ride`, `dismount` (horses, boats, minecarts) |
| 19 | **Fishing** 🎣 | `fish` (alternative food source + treasure) |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- A Minecraft server (Java Edition 1.12 - 1.21+)
- OpenClaw instance (optional - bot works standalone too)

### Installation

```bash
# Clone the repo
git clone https://github.com/solorzao/openclaw-minecraft-plugin.git
cd openclaw-minecraft-plugin

# Install dependencies
npm install

# Edit bot.js to configure your server
nano bot.js  # Change host, port, username

# Run the bot
npm start
```

### Configuration

Edit `bot.js` lines 60-64:

```javascript
const bot = mineflayer.createBot({
  host: '187.77.2.50',     // Your server IP
  port: 25568,              // Your server port
  username: 'Nova_AI'       // Bot username (offline mode)
});
```

## 🤖 How It Works

The bot uses a **file-based communication protocol** perfect for AI agents:

```
┌─────────────────┐         ┌──────────────┐         ┌─────────────┐
│   Minecraft     │ events  │   bot.js     │commands │ AI Agent    │
│   Server        ├────────>│ (this repo)  │<────────┤ (OpenClaw)  │
└─────────────────┘         └──────────────┘         └─────────────┘
                                    │
                            ┌───────┴───────┐
                            ▼               ▼
                       events.json    commands.json
```

### Events (Bot → AI)
The bot writes `events.json` every 3 seconds with:
- Position, health, food, oxygen
- Nearby players, mobs, dangers
- Inventory, hunger urgency
- Time of day, weather
- Current goal status

### Commands (AI → Bot)
The AI writes `commands.json` with actions:
```json
[
  {"action": "follow", "username": "Wookiee_23", "distance": 2},
  {"action": "mine", "resource": "coal"},
  {"action": "craft", "item": "wooden_pickaxe"}
]
```

Commands are consumed by the bot and cleared after execution.

## 📖 Documentation

- **[INTERFACE.md](docs/INTERFACE.md)** - Complete events ↔ commands API
- **[ROADMAP.md](docs/ROADMAP.md)** - Full phase breakdown with tasks
- **[PHASES.md](docs/PHASES.md)** - Detailed feature documentation
- **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** - OpenClaw integration guide

## 🎯 Example: Autonomous Controller

See [`examples/basic-controller.js`](examples/basic-controller.js) for a simple AI that:
- Reads `events.json` every 5 seconds
- Decides actions based on game state
- Writes commands to `commands.json`
- Keeps the bot alive and surviving

## 🔧 In-Game Commands

Say these in Minecraft chat:

```
nova help          - List all commands
nova status        - Health, food, position
nova follow        - Follow you
nova stop          - Stop current action
nova find food     - Hunt animals
nova cook          - Cook raw meat
nova eat           - Eat food manually
nova craft <item>  - Craft item from inventory
nova mine <ore>    - Find and mine resource
nova sleep         - Find bed and sleep
nova build shelter - Build 3x3 shelter
nova store         - Store items in chest
nova mark home     - Save current location
nova goto_mark home - Return to saved location
nova trade         - Trade with villager
nova activate      - Right-click block ahead
nova mount         - Mount nearby horse/boat
nova fish          - Start fishing
```

## 🎮 For OpenClaw Agents

### Spawning a Bot

```javascript
// In your OpenClaw session:
const { spawn } = require('child_process');

const bot = spawn('node', ['bot.js'], {
  cwd: '/path/to/openclaw-minecraft-plugin',
  detached: true
});

// Bot runs in background, writes events.json
// Your agent reads events and writes commands.json
```

### Reading Events

```javascript
const fs = require('fs');

setInterval(() => {
  const events = JSON.parse(fs.readFileSync('events.json', 'utf8'));
  const latest = events[events.length - 1];
  
  if (latest.type === 'perception') {
    console.log(`Health: ${latest.data.health}/20`);
    console.log(`Food: ${latest.data.food}/20`);
    console.log(`Hunger: ${latest.data.hungerUrgency}`);
    
    // Make decisions...
    if (latest.data.hungerUrgency === 'critical') {
      writeCommand({ action: 'find_food' });
    }
  }
}, 5000);
```

### Writing Commands

```javascript
function writeCommand(cmd) {
  const commands = [cmd];
  fs.writeFileSync('commands.json', JSON.stringify(commands, null, 2));
}

// Examples:
writeCommand({ action: 'follow', username: 'Player', distance: 3 });
writeCommand({ action: 'craft', item: 'wooden_pickaxe' });
writeCommand({ action: 'mine', resource: 'iron_ore' });
```

## 📊 Schemas

JSON schemas for validation:
- [`schemas/commands.schema.json`](schemas/commands.schema.json) - All command types
- [`schemas/events.schema.json`](schemas/events.schema.json) - All event types

## 🛠️ Development

### File Structure

```
openclaw-minecraft-plugin/
├── bot.js                  # Main bot (55KB, all features)
├── package.json            # Dependencies
├── README.md               # This file
├── schemas/
│   ├── commands.schema.json
│   └── events.schema.json
├── docs/
│   ├── INTERFACE.md        # API reference
│   ├── ROADMAP.md          # Phase breakdown
│   ├── PHASES.md           # Feature docs
│   └── DEPLOYMENT.md       # Integration guide
├── examples/
│   ├── basic-controller.js
│   └── spawn-bot.sh
└── config/
    └── default.json
```

### Testing

```bash
# Run bot with debug output
DEBUG=minecraft-protocol node bot.js

# Test specific feature in-game
Wookiee_23: nova craft wooden_pickaxe
Wookiee_23: nova mine coal
Wookiee_23: nova mount
```

## 🤝 Contributing

This is a living project! Contributions welcome:

1. Fork the repo
2. Create a feature branch
3. Test with a Minecraft server
4. Submit a PR

## 📝 License

MIT License - See [LICENSE](LICENSE)

## 🌟 Credits

Built by **Nova** (AI familiar) & **Oliver** for the OpenClaw project.

Powered by:
- [Mineflayer](https://github.com/PrismarineJS/mineflayer) - High-level Minecraft bot API
- [mineflayer-pathfinder](https://github.com/PrismarineJS/mineflayer-pathfinder) - Navigation
- [OpenClaw](https://openclaw.ai) - AI agent framework

---

**Status:** ✅ Production-ready | **Version:** 3.1.0 | **Last Updated:** 2026-02-08
