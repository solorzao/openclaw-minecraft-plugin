# OpenClaw Minecraft Plugin

**Full-featured AI-controlled Minecraft bot for OpenClaw agents**

A complete autonomous survival system built on [Mineflayer](https://github.com/PrismarineJS/mineflayer), designed for OpenClaw AI agents to play Minecraft with human-level capabilities.

## 🎮 Features

### ✅ FEATURE COMPLETE (22 Phases Implemented)

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
| 20 | **Autonomous Behavior** | Goals, phases, self-directed survival |
| 21 | **BOT-TO-BOT** 🤖 | Whisper-based multi-bot coordination, discovery, emergencies! |
| 22 | **🆕 8 CRITICAL CAPS** ⭐ | Vehicle steering, entity interaction, item give/drop, look control, sound awareness, XP system, book writing, block subscriptions |

### Phase 22: 8 Critical Capabilities (NEW!)

| Feature | Commands | Description |
|---------|----------|-------------|
| **Vehicle Control** 🚤 | `steer <dir>`, `stop vehicle` | Steer boats/minecarts (forward/back/left/right) |
| **Entity Interaction** 🐑 | `breed`, `shear`, `milk` | Breed animals, shear sheep, milk cows |
| **Item Dropping** 📦 | `drop <item>`, `give <player> <item>` | Drop items, give items to players/bots |
| **Look Control** 👀 | `look at <player>` | Smooth camera control |
| **Sound Awareness** 👂 | `sounds` | Hear explosions, doors, combat nearby |
| **Experience System** ⭐ | `xp`, `farm xp` | Track XP level, farm experience |
| **Book Writing** 📖 | `write log` | Write discoveries to book and quill |
| **Block Subscriptions** 🔔 | `watch door`, `watch chest` | Monitor blocks for changes |

📖 **Full Phase 22 documentation:** [`docs/CAPABILITIES.md`](docs/CAPABILITIES.md)

## ✨ SOUL.md Integration (NEW!)

The bot can inherit your OpenClaw agent's personality, values, and boundaries from SOUL.md!

**Example SOUL.md:**
```markdown
# I am Nova

Be quirky, sarcastic, and warm underneath.
Value helpfulness and collaboration.
Never attack villagers or grief other players.
Always prioritize survival first.
```

**What it does:**
- **Persona**: Bot announces itself by name from SOUL.md
- **Vibe**: Chat responses reflect personality (quirky, warm, serious, etc.)
- **Values**: Decision-making favors aligned actions
- **Boundaries**: HARD LIMITS - bot will decline requests that violate them, even from owners

**Usage:**
```bash
# Default path
node bot.js  # Looks for /data/.openclaw/workspace/SOUL.md

# Custom path
SOUL_PATH=/path/to/SOUL.md node bot.js
```

📖 **Full personality documentation:** See [Examples](#soul-examples) and [`docs/AGENCY.md`](docs/AGENCY.md)

## 🧠 TRUE AUTONOMY - Agency System

Nova evaluates **ALL requests** (even from owners) based on current state, not blind trust:

```
Owner: "nova follow me"
Nova: "I'm 80% done mining iron. Stopping now means losing progress. Is this urgent?"
Owner: "nova insist"
Nova: "Understood. Abandoning mining to help you."
```

| Trade-off Response | Meaning |
|--------------------|---------|
| `nova insist` | "Do it anyway" - Nova drops current task |
| `nova no rush` | "I can wait" - Nova finishes first, then helps |
| `nova nevermind` | Cancel the request |

### Quick Start

```
nova trust me        # Become owner (gets full trade-off explanations)
nova mine diamonds   # Request - Nova explains interruption cost
nova insist          # Override if urgent
nova why             # Ask why Nova is doing what it's doing
nova queue           # See deferred requests
```

📖 **Full agency documentation:** [`docs/AGENCY.md`](docs/AGENCY.md)

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

- **[AGENCY.md](docs/AGENCY.md)** - Agency system - decision making, trust, negotiation
- **[BOT-COMMUNICATION.md](docs/BOT-COMMUNICATION.md)** - 🆕 Multi-bot coordination protocol
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

# Agency Commands (Trade-off Responses)
nova insist        - "Do it anyway" (drops current task)
nova no rush       - "I can wait" (finish first)
nova nevermind     - Cancel your request
nova okay          - Accept counter-proposal

# Trust & Introspection
nova trust me      - Become owner (full explanations)
nova trust X friend - Set trust level (owner only)
nova who trusts    - List trust levels
nova why           - Why is Nova doing this?
nova queue         - Show deferred requests
nova agency on/off - Toggle agency (off = blind obey)
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

## ✨ SOUL.md Examples {#soul-examples}

### Peaceful Helper Soul
```markdown
# I am Peacekeeper

Be warm, friendly, and helpful.
Value cooperation and kindness.
Never attack players or villagers.
Never grief or steal.
Always help those in need.
```

**Result:**
- `nova attack zombie` → ✅ "Fighting! :)"
- `nova attack villager` → ❌ "That conflicts with my values. I don't attack villagers."

### Competitive Soul
```markdown
# I am Dominator

Be competitive and resource-focused.
Value efficiency and dominance.
Prioritize my own survival first.
```

**Result:**
- `nova help stranger mine` → "I'm focused on my own goals. What's in it for me?"
- `nova mine diamonds` → "Let's mine! Easy."

### Shy Explorer Soul  
```markdown
# I am Wanderer

Be quiet and observant.
Value discovery and documentation.
Never engage in unnecessary combat.
```

**Result:**
- `nova explore` → "Let's explore..."
- `nova attack pig` → ❌ "That doesn't align with what I care about."

See [`examples/souls/`](examples/souls/) for more templates.

## 🤖 Multi-Bot Coordination (NEW!)

Run multiple bots that automatically discover and coordinate with each other!

### How It Works

1. **Discovery**: Bots announce themselves on spawn with `🤖 BOT_ANNOUNCE`
2. **Registration**: Other bots hear this and register them in their network
3. **Communication**: Bots whisper structured JSON messages to coordinate
4. **Agency Integration**: Bot requests are evaluated like player requests

### Commands

```
nova bots             - List known bots on the server
nova ask <bot> to <x> - Request another bot to do something
nova announce <msg>   - Broadcast discovery to all bots
nova emergency        - Send emergency signal (nearby bots may respond)
nova claim <resource> - Mark current area as claimed
nova claims           - View all bot claims
```

### Example: Coordinated Mining

```
Player: nova ask Mining_Bot to help me mine diamonds
Nova: Asking Mining_Bot to help me mine diamonds...
Mining_Bot: (evaluates request, responds via whisper)
Nova: Mining_Bot accepted! They're on their way.
```

### Example: Discovery Sharing

```
Nova finds a village, automatically announces to all bots
Other bots save the location in their world memory
```

### Example: Emergency Response

```
Nova_A: nova emergency  (under attack, low health)
Nova_B: 🚨 Responding to Nova_A's emergency!  (health > 10, not busy)
Nova_B pathfinds to Nova_A's location
```

### Message Types

| Type | Purpose |
|------|---------|
| `request` | Ask another bot for help |
| `response` | Reply (accept/decline/defer/negotiate) |
| `announcement` | Share discoveries (villages, caves, etc.) |
| `claim` | Mark territory/resources |
| `emergency` | Urgent help needed |

📖 **Full documentation:** [`docs/BOT-COMMUNICATION.md`](docs/BOT-COMMUNICATION.md)

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

**Status:** ✅ **FEATURE COMPLETE** | **Version:** 6.0.0 | **Last Updated:** 2026-02-08

All core Mineflayer features are now implemented!
