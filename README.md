# OpenClaw Minecraft Bot

**A headless Minecraft bot body controlled entirely through JSON files.**

The bot connects to a Minecraft server, stays alive, and does nothing else. **You are the brain.** You observe the world by reading JSON files, make decisions, and control the bot by writing commands to a JSON file.

---

## Your Role

```
You (the brain)                         Bot (the body)
     |                                       |
     |-- read data/state.json -------------> | updated every 1s
     |-- read data/events.json ------------> | rolling 200 events
     |-- write data/commands.json ---------->| polled every 500ms
     |                                       |
     |  Your loop: read state → decide → write command → check result → repeat
```

**Three files. That's the entire interface.**

- **`data/state.json`** — Read this. Updated every 1 second. Contains the bot's position, health, food, inventory, nearby entities, nearby blocks, time of day, and current action status.
- **`data/events.json`** — Read this. Rolling buffer of 200 events. Chat messages, damage taken, deaths, command results, mining progress, combat updates.
- **`data/commands.json`** — Write this. The bot polls every 500ms, executes all commands in the array, then clears the file.

---

## Controlling the Bot

Write a JSON array to `data/commands.json`. Every command needs an `action` field. Include an `id` to track results:

```json
[{"id": "eat-1", "action": "eat"}]
```

Then check `data/events.json` for the result:

```json
{"type": "command_result", "commandId": "eat-1", "success": true, "detail": "Ate bread"}
```

### Quick Command Reference

**Movement:**
```json
{"id": "go-1", "action": "goto", "x": 100, "y": 64, "z": -50}
{"id": "fol-1", "action": "follow", "username": "PlayerName", "distance": 3}
{"id": "stp-1", "action": "stop"}
```

**Survival:**
```json
{"id": "eat-1", "action": "eat"}
{"id": "hunt-1", "action": "find_food"}
{"id": "atk-1", "action": "attack", "target": "zombie"}
```

**Gathering:**
```json
{"id": "mine-1", "action": "mine_resource", "resource": "iron_ore", "count": 10}
{"id": "col-1", "action": "collect_items"}
```

**Crafting:**
```json
{"id": "cft-1", "action": "craft", "item": "wooden_pickaxe"}
{"id": "sml-1", "action": "smelt", "item": "raw_iron", "count": 8}
```

**Communication:**
```json
{"id": "say-1", "action": "chat", "message": "Hello!"}
```

**Awareness:**
```json
{"id": "scn-1", "action": "scan"}
{"id": "loc-1", "action": "where_am_i"}
{"id": "chk-1", "action": "verify", "check": "craft", "item": "iron_pickaxe"}
```

For all 40+ commands with full parameters, read [docs/INTERFACE.md](docs/INTERFACE.md).

### Command Rules

1. **One long-running action at a time.** Don't send `mine_resource` while another is running.
2. **Wait for `command_result` events** before sending the next step in a sequence.
3. **New movement commands cancel previous ones.** A `goto` cancels a `follow`.
4. **Instant commands can batch.** `chat` + `equip` in one write is fine.
5. **Check `currentAction` in state.json.** If it's not null, the bot is busy.

---

## Reading the World

### State (`data/state.json`)

Key fields to check every cycle:

| Field | What it tells you |
|-------|-------------------|
| `bot.health` | HP 0-20. Below 6 is critical. |
| `bot.healthTrend` | `"stable"`, `"healing"`, or `"taking_damage"` (under attack) |
| `bot.food` | Hunger 0-20. Below 6 triggers auto-eat. |
| `bot.position` | `{x, y, z}` coordinates |
| `bot.isOnFire` | Need water |
| `bot.dimension` | `"overworld"`, `"nether"`, or `"the_end"` |
| `time.phase` | `"day"`, `"sunset"`, or `"night"` |
| `inventory` | Array of `{name, count, slot}` |
| `inventoryStats.freeSlots` | Below 3 means nearly full |
| `nearbyEntities` | Players, hostiles, animals with distance and position |
| `nearbyBlocks` | Block type counts in a 17x9x17 area |
| `notableBlocks` | Chests, ores, workstations with positions |
| `currentAction` | What the bot is doing right now (null = idle) |
| `currentGoal` | Your persisted objective (null if none set) |
| `notes` | Your persisted key-value memory |
| `survival.isFleeing` | Bot is running from a threat |
| `latestEventId` | Highest event ID in events.json right now |
| `lastAckedEventId` | Last event ID you acknowledged (null if never acked) |

Full state schema with all fields: [docs/INTERFACE.md#state](docs/INTERFACE.md).

### Events (`data/events.json`)

Events you should watch for:

| Event type | What happened |
|------------|---------------|
| `chat` | A player said something (`username`, `message`) |
| `whisper` | A player whispered to the bot (`username`, `message`) |
| `hurt` | Bot took damage (`health`) |
| `death` | Bot died (`position` — for item recovery) |
| `danger` | Health dropped below 10 (`reason`, `health`, `food`) |
| `command_result` | A command finished (`commandId`, `success`, `detail`) |
| `block_mined` | Mining progress (`block`, `mined`, `target`) |
| `combat_ended` | Fight over (`reason`, `target`, `hitsDealt`) |

Full event reference: [docs/INTERFACE.md#events](docs/INTERFACE.md).

### Tracking Events (Don't Reprocess Old Events)

**On startup**, read `state.json` and note `latestEventId`. Only process events with `id` greater than that value. This prevents responding to old chat messages or events that happened before your session started.

**After processing a batch of events**, acknowledge the highest ID so it persists across restarts:

```json
[{"id": "ack-1", "action": "ack_events", "eventId": 150}]
```

The bot saves this to disk. On your next startup, `state.json` will include `lastAckedEventId: 150` — skip all events with `id <= 150`.

**Without this, restarting your agent will re-trigger responses to every event still in the buffer.**

---

## What the Bot Handles Automatically

**Don't duplicate these — the bot already does them:**

| Behavior | Trigger | What happens |
|----------|---------|--------------|
| Auto-eat | food < 6 | Eats best food from inventory |
| Flee hostiles | Mob within 12-16 blocks | Runs away automatically |
| Escape water | Submerged | Pathfinds to land |
| Auto-equip armor | Every 10s | Puts on best available armor |
| Auto-select tool | When digging | Picks best pickaxe/axe/shovel |
| Auto-select weapon | When attacking | Equips best sword/axe |
| Stuck detection | No movement for 5s | Retries or wanders |

**What this means for you:** Don't send `eat` commands unless food is above 6 and you want to top off. Don't panic about nearby hostiles — the bot flees on its own. Don't send `equip` for armor or tools — it's automatic. **Focus your decisions on higher-level goals:** where to go, what to mine, what to craft, who to talk to, and how to respond to chat.

---

## Decision Priority

When reading `state.json`, act on the **first** matching condition:

1. **Health critical** (health < 6) → `stop`, eat if you have food
2. **Under attack** (healthTrend = `"taking_damage"`) → `attack` nearest hostile if health > 10, otherwise `stop` and let the bot flee
3. **Starving** (food < 6, no food in inventory) → `find_food`
4. **Night time** (time.phase = `"night"`) → `sleep`, or build shelter
5. **Currently busy** (currentAction is not null) → wait, don't send conflicting commands
6. **Inventory full** (freeSlots < 3) → `store_items` or `manage_inventory`
7. **No tools** → gather wood, craft planks, craft pickaxe
8. **Idle** → mine resources, explore, craft, build — your choice

This is a suggested skeleton. Adapt it to your goals.

For error recovery patterns, complete workflow examples, and a detailed decision flowchart, read [docs/AGENT-QUICK-REFERENCE.md](docs/AGENT-QUICK-REFERENCE.md).

---

## Maintaining Context Across Cycles

Your brain runs in a loop. Between cycles, you lose memory. Use these tools to maintain continuity.

### Goals

Set your current objective so it persists across restarts:

```json
[{"id": "g-1", "action": "goal", "goal": "mine iron and craft iron tools"}]
```

The goal appears in `state.json` as `currentGoal`:

```json
{
  "currentGoal": {
    "goal": "mine iron and craft iron tools",
    "setAt": "2025-01-15T10:30:00Z",
    "positionWhenSet": {"x": -19, "y": 72, "z": -139}
  }
}
```

Built-in goals `gather_wood` and `explore` also trigger pathfinding. Any other string is tracked as a freeform objective. Clear with:

```json
[{"id": "g-2", "action": "goal", "goal": "clear"}]
```

### Notes (Persistent Memory)

Store anything you need to remember:

```json
[
  {"id": "n-1", "action": "set_note", "key": "base_location", "value": "-19 72 -139 (crafting table)"},
  {"id": "n-2", "action": "set_note", "key": "plan", "value": "1. Get 4 logs 2. Craft planks 3. Craft pickaxe"},
  {"id": "n-3", "action": "set_note", "key": "conversation", "value": "Wookiee asked me to help mine iron"}
]
```

Notes appear in `state.json` under the `notes` field every cycle. They persist across bot and agent restarts.

### Recommended Note Keys

| Key | Purpose |
|-----|---------|
| `plan` | Current step-by-step plan |
| `base_location` | Coordinates of home/stash |
| `conversation` | Summary of recent chat context |
| `discoveries` | Resources, structures, locations found |
| `inventory_goal` | Items you're trying to collect |

### The Full Decision Cycle

Each iteration of your loop should:

1. **Read `state.json`** — check health, food, position, `currentGoal`, `notes`, `currentAction`
2. **Read `events.json`** — check for new events (id > `lastAckedEventId`)
3. **React to urgent events** — respond to chat, handle danger
4. **Check decision priority** — health, combat, hunger, night, busy, idle
5. **Advance your goal** — take the next step in your plan
6. **Update notes** — save progress, update plan, log discoveries
7. **Acknowledge events** — `ack_events` with highest processed event ID
8. **Wait** — 3-5 seconds for commands to execute before next cycle

---

## Documentation Index

| Document | What's in it |
|----------|-------------|
| **[docs/AGENT-QUICK-REFERENCE.md](docs/AGENT-QUICK-REFERENCE.md)** | Decision flowchart, command cheat sheet, error recovery table, complete workflow examples (mining loop, night cycle, tool progression) |
| **[docs/INTERFACE.md](docs/INTERFACE.md)** | Full API reference — every state field, every event type, all 40+ commands with parameters |
| **[docs/NEW-AGENT-GUIDE.md](docs/NEW-AGENT-GUIDE.md)** | Step-by-step deployment: installing, configuring, starting the bot, verifying it works |
| **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** | OpenClaw integration patterns |
| **[schemas/commands.schema.json](schemas/commands.schema.json)** | JSON schema for validating commands before writing them |
| **[examples/](examples/)** | Working example scripts — basic controller, survival loop, mine-and-craft workflow |

---

## Setup

### Quick Start

```bash
# 1. Clone and install
git clone https://github.com/solorzao/openclaw-minecraft-plugin.git
cd openclaw-minecraft-plugin
npm install

# 2. Configure
cp .env.example .env
# Edit .env with your server details
```

Edit `.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `BOT_USERNAME` | Bot's Minecraft username | `Bot_AI` |
| `MC_HOST` | Minecraft server address | `localhost` |
| `MC_PORT` | Minecraft server port | `25565` |
| `BOT_DATA_DIR` | Directory for IPC files | `./data/` |
| `MC_USERNAME` | Microsoft account email (online-mode servers only) | - |
| `MC_PASSWORD` | Microsoft account password (online-mode servers only) | - |

```bash
# 3. Start the bot
./start-bot.sh
```

The bot connects, creates `data/state.json`, and waits for your commands.

For detailed setup instructions and troubleshooting, read [docs/NEW-AGENT-GUIDE.md](docs/NEW-AGENT-GUIDE.md).

---

## File Structure

```
openclaw-minecraft-plugin/
├── data/                     # IPC files (created at runtime)
│   ├── state.json            # READ  - world snapshot, updated every 1s
│   ├── events.json           # READ  - rolling 200 events
│   └── commands.json         # WRITE - your commands go here
├── src/
│   ├── index.js              # Entry point, event wiring
│   ├── config.js             # Environment variables, paths
│   ├── events.js             # Event logging
│   ├── state.js              # State snapshot builder
│   ├── perception.js         # Nearby entities, blocks, inventory
│   ├── survival.js           # Auto-eat, water escape, flee
│   ├── commands.js           # Command dispatcher
│   └── handlers/             # Command implementations
├── docs/                     # Documentation (read these!)
├── schemas/                  # JSON schemas for validation
├── examples/                 # Example agent scripts
└── .env.example              # Configuration template
```

---

## License

MIT License - See [LICENSE](LICENSE)

## Credits

Built for the [OpenClaw](https://openclaw.ai) project. Powered by [Mineflayer](https://github.com/PrismarineJS/mineflayer) and [mineflayer-pathfinder](https://github.com/PrismarineJS/mineflayer-pathfinder).
