# OpenClaw Minecraft Plugin

**Headless Minecraft bot body for OpenClaw agents - file-based IPC for commands, state, and events**

A Minecraft bot built on [Mineflayer](https://github.com/PrismarineJS/mineflayer) that acts as a "body" controlled by an external AI agent (the "brain"). The bot exposes all Minecraft capabilities through a simple file-based interface: the agent reads `state.json` and `events.json` to observe the world, and writes `commands.json` to act.

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/solorzao/openclaw-minecraft-plugin.git
cd openclaw-minecraft-plugin
npm install

# 2. Configure
cp .env.example .env
# Edit .env: BOT_USERNAME, MC_HOST, MC_PORT

# 3. Start the bot
./start-bot.sh
```

The bot connects to the Minecraft server and starts writing `data/state.json` every second. Write commands to `data/commands.json` to control it.

## Architecture

```
                    file-based IPC
                         |
    +-----------+   +---------+   +----------------+
    | Minecraft |<->| Bot     |<->| AI Agent       |
    | Server    |   | (body)  |   | (brain/OpenClaw)|
    +-----------+   +---------+   +----------------+
                         |
                  +------+------+
                  |      |      |
              state  events  commands
              .json  .json   .json
```

- **state.json** - Bot writes every 1s: position, health, food, inventory, nearby entities/blocks, time
- **events.json** - Bot appends: chat, damage, death, command results (rolling 200 events)
- **commands.json** - Agent writes: actions for the bot to execute (consumed on read)

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `BOT_USERNAME` | Bot's Minecraft username | `Bot_AI` |
| `MC_HOST` | Minecraft server address | `localhost` |
| `MC_PORT` | Minecraft server port | `25565` |
| `BOT_DATA_DIR` | Directory for IPC files | `./data/` |
| `MC_USERNAME` | Microsoft account email (online-mode servers only) | - |
| `MC_PASSWORD` | Microsoft account password (online-mode servers only) | - |

## Controlling the Bot

### Reading State

```javascript
const state = JSON.parse(fs.readFileSync('data/state.json', 'utf8'));
console.log(state.bot.health);         // 20
console.log(state.bot.position);       // { x: -27, y: 67, z: -139 }
console.log(state.nearbyEntities);     // [{ name: "zombie", type: "hostile", distance: 12, ... }]
console.log(state.inventory);          // [{ name: "iron_pickaxe", count: 1, slot: 36 }]
console.log(state.time.phase);         // "day" | "sunset" | "night"
```

### Writing Commands

```javascript
const commands = [
  { id: "cmd-1", action: "goto", x: 100, y: 64, z: -50 },
  { id: "cmd-2", action: "craft", item: "wooden_pickaxe" }
];
fs.writeFileSync('data/commands.json', JSON.stringify(commands));
```

Commands are consumed immediately. Results appear in `events.json`:
```json
{ "id": 42, "timestamp": 1770592450869, "type": "command_result", "commandId": "cmd-1", "success": true, "detail": "Arrived" }
```

### Available Commands

| Category | Commands |
|----------|----------|
| **Movement** | `goto`, `follow`, `stop`, `look_at_player`, `look_at`, `jump`, `sneak`, `steer`, `mount`, `dismount` |
| **Combat** | `attack`, `shoot`, `block_shield` |
| **Gathering** | `dig`, `mine_resource`, `find_food`, `collect_items`, `drop`, `give` |
| **Crafting** | `craft`, `smelt`, `cook_food` |
| **Building** | `place`, `build` (shelter, pillar, bridge, wall) |
| **Farming** | `till`, `plant`, `harvest`, `farm` |
| **Interaction** | `chat`, `equip`, `eat`, `sleep`, `activate`, `fish`, `use_on`, `trade`, `brew`, `enchant` |
| **Inventory** | `store_items`, `retrieve_items`, `manage_inventory` |

See [docs/INTERFACE.md](docs/INTERFACE.md) for full command reference with parameters.

## Auto-Survival

The bot has minimal autonomous behavior to stay alive:
- **Auto-eat** when food drops below 6
- **Escape water** when submerged (pathfinds to land)

Everything else is controlled by the agent.

## File Structure

```
openclaw-minecraft-plugin/
├── src/
│   ├── index.js              # Entry point, event wiring
│   ├── config.js             # Environment variables, paths
│   ├── events.js             # Event logging, atomic writes
│   ├── state.js              # State snapshot builder
│   ├── perception.js         # Nearby entities, blocks, inventory
│   ├── survival.js           # Auto-eat, water escape
│   ├── commands.js           # Command dispatcher
│   └── handlers/
│       ├── movement.js       # goto, follow, stop, look, mount
│       ├── combat.js         # attack, shoot, shield
│       ├── gathering.js      # dig, mine, collect, drop, give
│       ├── crafting.js       # craft, smelt, cook
│       ├── building.js       # place, build templates
│       ├── farming.js        # till, plant, harvest, farm cycle
│       └── interaction.js    # chat, equip, eat, sleep, trade, brew, enchant
├── data/                     # IPC files (created at runtime)
│   ├── state.json
│   ├── events.json
│   └── commands.json
├── schemas/
│   ├── commands.schema.json
│   └── events.schema.json
├── docs/
│   ├── INTERFACE.md          # Full API reference
│   ├── DEPLOYMENT.md         # Integration guide
│   └── NEW-AGENT-GUIDE.md    # Step-by-step setup
├── examples/
│   ├── basic-controller.js   # Example agent controller
│   └── spawn-bot.sh          # Quick launcher
├── package.json
├── start-bot.sh              # Launcher with .env support
└── .env.example              # Configuration template
```

## Documentation

- [INTERFACE.md](docs/INTERFACE.md) - Complete state, events, and commands API reference
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) - OpenClaw integration patterns
- [NEW-AGENT-GUIDE.md](docs/NEW-AGENT-GUIDE.md) - Step-by-step deployment guide

## License

MIT License - See [LICENSE](LICENSE)

## Credits

Built for the [OpenClaw](https://openclaw.ai) project.

Powered by:
- [Mineflayer](https://github.com/PrismarineJS/mineflayer) - High-level Minecraft bot API
- [mineflayer-pathfinder](https://github.com/PrismarineJS/mineflayer-pathfinder) - Navigation

---

**Version:** 4.0.0
