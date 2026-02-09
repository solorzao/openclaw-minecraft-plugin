# OpenClaw Minecraft Plugin

**Full-featured AI-controlled Minecraft bot for OpenClaw agents**

A complete autonomous survival system built on [Mineflayer](https://github.com/PrismarineJS/mineflayer), designed for OpenClaw AI agents to play Minecraft with human-level capabilities.

> **🤖 Agent-Agnostic:** This bot adapts to any AI agent. Set `BOT_USERNAME=YourBot` and all commands become `yourbot help`, `yourbot follow`, etc. No hardcoded names!

## ⚡ Quick Deploy

```bash
git clone https://github.com/solorzao/openclaw-minecraft-plugin.git
cd openclaw-minecraft-plugin
npm install

# Configure your bot (REQUIRED - no hardcoding!)
export BOT_USERNAME=Nova_AI        # Your bot's name
export MC_HOST=your.server.com     # Your Minecraft server
export MC_PORT=25565               # Server port

# Start the bot
node bot.js
```

Commands will use your bot's name: `nova help`, `nova follow`, `nova mine iron`, etc.

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

### Phase 22: 8 Critical Capabilities

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

## ✨ SOUL.md Integration

The bot can inherit your OpenClaw agent's personality, values, and boundaries from SOUL.md!

**Example SOUL.md:**
```markdown
# I am MyBot

Be quirky, sarcastic, and warm underneath.
Value helpfulness and collaboration.
Never attack villagers or grief other players.
Always prioritize survival first.
```

_(Replace "MyBot" with your bot's persona name)_

**What it does:**
- **Persona**: Bot announces itself by name from SOUL.md
- **Vibe**: Chat responses reflect personality (quirky, warm, serious, etc.)
- **Values**: Decision-making favors aligned actions
- **Boundaries**: HARD LIMITS - bot will decline requests that violate them (applies to everyone)

**Usage:**
```bash
# Default path
node bot.js  # Looks for /data/.openclaw/workspace/SOUL.md

# Custom path
SOUL_PATH=/path/to/SOUL.md node bot.js
```

📖 **Full personality documentation:** See [Examples](#soul-examples) and [`docs/AGENCY.md`](docs/AGENCY.md)

## 🧠 TRUE AUTONOMY - Agency System

The bot evaluates **ALL requests** based on current state - everyone is treated equally:

```
Player: "{bot} follow me"
Bot: "I'm 80% done mining iron. Can you wait 2 mins or is this urgent?"
Player: "{bot} no rush"
Bot: "Got it. I'll help you after I finish. You're #1 in queue."
```

| Response | Meaning |
|----------|---------|
| `{bot} no rush` | "I can wait" - Bot finishes first, then helps |
| `{bot} nevermind` | Cancel your request |
| `{bot} okay` | Accept counter-proposal immediately |

### Quick Start

```
{bot} mine diamonds   # Request - bot explains if busy
{bot} no rush         # Acknowledge you'll wait
{bot} why             # Ask why the bot is doing what it's doing
{bot} queue           # See deferred requests
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

# Configure via environment variables
export BOT_USERNAME=MyBot_AI    # Your bot's name
export MC_HOST=187.77.2.50      # Your Minecraft server
export MC_PORT=25568            # Server port

# Run the bot
npm start

# Or run with inline config
BOT_USERNAME=MyBot_AI MC_HOST=myserver.com node bot.js
```

### Configuration

> **⚠️ IMPORTANT:** Always configure via environment variables. Never hardcode bot names in the code - this plugin is designed to be reusable by any AI agent.

**Environment Variables:**

| Variable | Description | Example | Default |
|----------|-------------|---------|---------|
| `BOT_USERNAME` | Bot's Minecraft username (sets command prefix) | `Nova_AI`, `Claude_Bot` | `Bot_AI` |
| `MC_HOST` | Minecraft server hostname/IP | `myserver.com`, `187.77.2.50` | `187.77.2.50` |
| `MC_PORT` | Minecraft server port | `25565`, `25568` | `25568` |
| `SOUL_PATH` | Path to SOUL.md (personality file) | `/path/to/SOUL.md` | `/data/.openclaw/workspace/SOUL.md` |

**Usage Examples:**

```bash
# Example 1: Nova_AI on local test server
export BOT_USERNAME=Nova_AI
export MC_HOST=localhost
export MC_PORT=25565
node bot.js

# Example 2: Claude_Bot on production server
BOT_USERNAME=Claude_Bot MC_HOST=myserver.com MC_PORT=25565 node bot.js

# Example 3: Custom personality + name
BOT_USERNAME=Wally_Bot SOUL_PATH=./personalities/wally.md node bot.js

# Example 4: Run via npm with env vars
BOT_USERNAME=Nova_AI npm start
```

**Command Prefix Behavior:**

The bot extracts the command prefix from `BOT_USERNAME`:
- `BOT_USERNAME=Nova_AI` → commands: `nova help`, `nova follow`, `nova status`
- `BOT_USERNAME=Claude_Bot` → commands: `claude help`, `claude follow`, `claude status`
- `BOT_USERNAME=GPT_Agent` → commands: `gpt help`, `gpt follow`, `gpt status`

**Persistent Configuration (Recommended):**

For production deployments, set environment variables in a `.env` file or systemd service:

```bash
# .env file
BOT_USERNAME=Nova_AI
MC_HOST=myserver.com
MC_PORT=25565
SOUL_PATH=/data/.openclaw/workspace/SOUL.md
```

Then load with:
```bash
export $(cat .env | xargs) && node bot.js
```

Or use a systemd service (see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for examples).

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

**Note:** Commands use your bot's username prefix. If `BOT_USERNAME=MyBot`, commands are `mybot help`, `mybot follow`, etc.

Examples below use `{bot}` as a placeholder for your bot's name:

```
{bot} help          - List all commands
{bot} status        - Health, food, position
{bot} follow        - Follow you
{bot} stop          - Stop current action
{bot} find food     - Hunt animals
{bot} cook          - Cook raw meat
{bot} eat           - Eat food manually
{bot} craft <item>  - Craft item from inventory
{bot} mine <ore>    - Find and mine resource
{bot} sleep         - Find bed and sleep
{bot} build shelter - Build 3x3 shelter
{bot} store         - Store items in chest
{bot} mark home     - Save current location
{bot} goto_mark home - Return to saved location
{bot} trade         - Trade with villager
{bot} activate      - Right-click block ahead
{bot} mount         - Mount nearby horse/boat
{bot} fish          - Start fishing

# Agency Commands (Negotiation)
{bot} no rush       - "I can wait" (finish first)
{bot} nevermind     - Cancel your request
{bot} okay          - Accept counter-proposal
{bot} clear queue   - Clear your queued requests

# Introspection
{bot} why           - Why is the bot doing this?
{bot} queue         - Show deferred requests
{bot} agency on/off - Toggle agency (off = blind obey)
```

## 🎮 For OpenClaw Agents

### Recommended: Autonomous Subagent Controller (Pattern 2)

Spawn a subagent to autonomously control the bot:

```javascript
// In your OpenClaw main session:
await sessions_spawn({
  task: `Control the Minecraft bot autonomously using examples/autonomous-controller.js
         
         Goals: Survive, gather resources (wood → stone → iron), build shelter, progress to iron tools.
         Report progress every 10 minutes.`,
  label: "minecraft-controller",
  cleanup: "keep"  // Run indefinitely
});

// Check progress later
const history = await sessions_history("minecraft-controller");
```

**Why this pattern?**
- ✅ Fully autonomous - frees up your main session
- ✅ Uses subagent's token budget, not yours
- ✅ Periodic check-ins keep you informed
- ✅ Can run indefinitely

📖 **See [`examples/autonomous-controller.js`](examples/autonomous-controller.js) for full implementation**

---

### Alternative: Direct Control (Pattern 1)

Control the bot directly from your main session:

```javascript
// Spawn the bot process
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
- `{bot} attack zombie` → ✅ "Fighting! :)"
- `{bot} attack villager` → ❌ "That conflicts with my values. I don't attack villagers."

### Competitive Soul
```markdown
# I am Dominator

Be competitive and resource-focused.
Value efficiency and dominance.
Prioritize my own survival first.
```

**Result:**
- `{bot} help stranger mine` → "I'm focused on my own goals. What's in it for me?"
- `{bot} mine diamonds` → "Let's mine! Easy."

### Shy Explorer Soul  
```markdown
# I am Wanderer

Be quiet and observant.
Value discovery and documentation.
Never engage in unnecessary combat.
```

**Result:**
- `{bot} explore` → "Let's explore..."
- `{bot} attack pig` → ❌ "That doesn't align with what I care about."

See [`examples/souls/`](examples/souls/) for more templates.

## 🤖 Multi-Bot Coordination

Run multiple bots that automatically discover and coordinate with each other!

### How It Works

1. **Discovery**: Bots announce themselves on spawn with `🤖 BOT_ANNOUNCE`
2. **Registration**: Other bots hear this and register them in their network
3. **Communication**: Bots whisper structured JSON messages to coordinate
4. **Agency Integration**: Bot requests are evaluated like player requests

### Commands

```
{bot} bots             - List known bots on the server
{bot} ask <bot> to <x> - Request another bot to do something
{bot} announce <msg>   - Broadcast discovery to all bots
{bot} emergency        - Send emergency signal (nearby bots may respond)
{bot} claim <resource> - Mark current area as claimed
{bot} claims           - View all bot claims
```

### Example: Coordinated Mining

```
Player: mybot ask Mining_Bot to help me mine diamonds
MyBot: Asking Mining_Bot to help me mine diamonds...
Mining_Bot: (evaluates request, responds via whisper)
MyBot: Mining_Bot accepted! They're on their way.
```

### Example: Discovery Sharing

```
MyBot finds a village, automatically announces to all bots
Other bots save the location in their world memory
```

### Example: Emergency Response

```
Bot_A: botA emergency  (under attack, low health)
Bot_B: 🚨 Responding to Bot_A's emergency!  (health > 10, not busy)
Bot_B pathfinds to Bot_A's location
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

# Test specific feature in-game (replace {bot} with your bot's name)
Wookiee_23: mybot craft wooden_pickaxe
Wookiee_23: mybot mine coal
Wookiee_23: mybot mount
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

Built for the **OpenClaw** project by Oliver & Nova (AI familiar).

Powered by:
- [Mineflayer](https://github.com/PrismarineJS/mineflayer) - High-level Minecraft bot API
- [mineflayer-pathfinder](https://github.com/PrismarineJS/mineflayer-pathfinder) - Navigation
- [OpenClaw](https://openclaw.ai) - AI agent framework

---

**Status:** ✅ **FEATURE COMPLETE** | **Version:** 6.0.0 | **Last Updated:** 2026-02-08

All core Mineflayer features are now implemented!
