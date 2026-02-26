# OpenClaw Minecraft Bot Interface

**File-Based IPC: `state.json` + `events.json` + `commands.json` + `manifest.json`**

## Overview

The bot communicates with AI agents through JSON files in the `data/` directory:

- **`state.json`** - Bot writes every 1 second (current world snapshot)
- **`events.json`** - Bot appends game events (rolling buffer of 200)
- **`commands.json`** - Agent writes actions for bot to execute (consumed on read)
- **`manifest.json`** - Written once on startup: describes all capabilities, actions, events, and state fields
- **`notes.json`** - Persistent key-value store for agent memory

**New agents:** Read `manifest.json` first to discover all capabilities without needing documentation.

---

## State (Bot -> Agent)

Written every second to `data/state.json`. This is the primary way to observe the bot.

```json
{
  "timestamp": "2026-02-25T19:08:00.000Z",
  "bot": {
    "position": { "x": -27, "y": 67, "z": -139 },
    "health": 17.2,
    "healthTrend": "stable",
    "food": 14,
    "saturation": 3.5,
    "oxygenLevel": 20,
    "experience": { "level": 5, "points": 42, "progress": 0.35 },
    "isInWater": false,
    "isSleeping": false,
    "isOnFire": false,
    "isUsingItem": false,
    "gameMode": "survival",
    "dimension": "overworld",
    "biome": "plains",
    "weather": "clear",
    "lightLevel": 15,
    "effects": [],
    "difficulty": "normal",
    "hardcore": false,
    "spawnPoint": { "x": -30, "y": 64, "z": -140 }
  },
  "equipment": {
    "hand": { "name": "iron_pickaxe", "count": 1 },
    "offHand": null,
    "head": { "name": "iron_helmet", "count": 1 },
    "chest": { "name": "iron_chestplate", "count": 1 },
    "legs": null,
    "feet": null
  },
  "armor": {
    "pieces": ["iron_helmet", "iron_chestplate"],
    "totalProtection": 8
  },
  "inventory": [
    { "name": "iron_pickaxe", "count": 1, "slot": 36 },
    { "name": "cobblestone", "count": 64, "slot": 37 },
    { "name": "bread", "count": 12, "slot": 38 }
  ],
  "inventoryStats": {
    "usedSlots": 3,
    "totalSlots": 36,
    "freeSlots": 33,
    "totalItems": 77
  },
  "nearbyEntities": [
    { "name": "Wookiee_23", "type": "player", "distance": 5, "position": { "x": -31, "y": 67, "z": -142 } },
    { "name": "zombie", "type": "hostile", "distance": 12, "position": { "x": -15, "y": 67, "z": -140 } },
    { "name": "cow", "type": "passive", "distance": 8, "position": { "x": -20, "y": 67, "z": -135 } }
  ],
  "nearbyBlocks": {
    "grass_block": 45,
    "dirt": 32,
    "stone": 18,
    "oak_log": 3
  },
  "notableBlocks": [
    { "name": "chest", "position": { "x": -25, "y": 67, "z": -137 }, "distance": 3 },
    { "name": "crafting_table", "position": { "x": -30, "y": 67, "z": -140 }, "distance": 4 }
  ],
  "time": {
    "timeOfDay": 6000,
    "phase": "day",
    "day": 42
  },
  "players": [
    { "username": "Wookiee_23", "ping": 45, "gameMode": 0 }
  ],
  "vehicle": null,
  "currentAction": null,
  "currentGoal": {
    "goal": "mine iron and craft iron tools",
    "setAt": "2026-02-25T19:00:00.000Z",
    "positionWhenSet": { "x": -27, "y": 67, "z": -139 }
  },
  "pathfinding": {
    "active": true,
    "goalX": -50,
    "goalZ": 120,
    "distanceToGoal": 45,
    "isMoving": true
  },
  "survival": {
    "isFleeing": false,
    "isEscapingWater": false,
    "isStuck": false,
    "stuckTicks": 0,
    "nearestThreat": { "name": "zombie", "distance": 15 },
    "fleeInfo": null
  },
  "combat": null,
  "notes": {
    "base_location": { "value": "100 64 200", "updatedAt": "2026-02-25T19:00:00.000Z" }
  },
  "latestEventId": 157,
  "lastAckedEventId": 150
}
```

### Fields

| Field | Description |
|-------|-------------|
| `bot.position` | Current coordinates (floored integers) |
| `bot.velocity` | Current velocity vector (x, y, z) - useful for detecting movement |
| `bot.yaw` / `bot.pitch` | Look direction (radians) |
| `bot.health` | HP (0-20) |
| `bot.healthTrend` | `stable`, `healing`, or `taking_damage` |
| `bot.food` | Hunger bar (0-20) |
| `bot.saturation` | Saturation level (hidden hunger buffer) |
| `bot.oxygenLevel` | Breath remaining (0-20, depletes when underwater) |
| `bot.experience` | Level, points, and progress (0-1 float to next level) |
| `bot.isInWater` | Whether bot is submerged |
| `bot.isSleeping` | Whether bot is in a bed |
| `bot.isOnFire` | Whether bot is on fire |
| `bot.isUsingItem` | Whether actively using held item (eating, drawing bow, blocking with shield) |
| `bot.gameMode` | survival, creative, adventure, spectator |
| `bot.dimension` | `overworld`, `nether`, or `the_end` |
| `bot.biome` | Current biome name |
| `bot.weather` | `clear`, `rain`, or `thunder` |
| `bot.lightLevel` | Block light level at bot position |
| `bot.effects` | Active potion/status effects (name, amplifier, duration in seconds) |
| `bot.difficulty` | Server difficulty (peaceful, easy, normal, hard) |
| `bot.hardcore` | Whether hardcore mode is enabled |
| `bot.spawnPoint` | Bot's respawn coordinates (null if unset) |
| `equipment` | Currently equipped items in each slot (hand, offHand, head, chest, legs, feet) |
| `armor` | Armor pieces worn and total protection rating |
| `inventory` | All items with name, count, slot |
| `inventoryStats` | Used/free slots, total item count |
| `nearbyEntities` | Up to 20 entities within 32 blocks. Includes `entityId`, `health`, `type` (`player`/`hostile`/`passive`) |
| `nearbyBlocks` | Block type counts in a 17x9x17 area around the bot |
| `notableBlocks` | Up to 30 notable blocks within 33 blocks (chests, ores, workstations, spawners, portals) |
| `time.timeOfDay` | Game ticks (0-24000) |
| `time.phase` | `day`, `sunset`, or `night` |
| `time.day` | Current in-game day number |
| `players` | All online players with username, ping, and gameMode |
| `vehicle` | Currently mounted entity info (name, entityId, position) or null |
| `currentAction` | Current action with progress info (e.g. `{type: "mining", mined: 5, count: 16, progress: "5/16"}`) |
| `currentGoal` | Agent's persisted objective: `goal` (text), `setAt` (timestamp), `positionWhenSet`. Null if no goal set. Set via `goal` command |
| `pathfinding` | Current pathfinding status: `active`, goal coordinates, `distanceToGoal`, `isMoving`. Null if idle |
| `survival` | Survival system state: `isFleeing`, `isEscapingWater`, `isStuck`, `nearestThreat`, `fleeInfo` |
| `combat` | Active combat info: `target`, `targetHealth`, `hitsDealt`, `damageTaken`, `elapsed`. Null if not fighting |
| `notes` | Agent-saved persistent notes (key-value pairs saved via `set_note` command) |
| `latestEventId` | Highest event ID currently in `events.json`. Use to know what's new |
| `lastAckedEventId` | Last event ID acknowledged via `ack_events`. Null if never acked. Persists across bot restarts |

---

## Events (Bot -> Agent)

Appended to `data/events.json` as a rolling array (max 200 events). Each event has:

```json
{ "id": 42, "timestamp": 1770592450869, "type": "event_type", ...data }
```

Note: event data fields are flat (not nested under a `data` key).

### Event Types

| Type | Fields | Description |
|------|--------|-------------|
| `spawn` | `position`, `isRespawn` | Bot spawned in world |
| `chat` | `username`, `message` | Player sent chat message |
| `whisper` | `username`, `message` | Player whispered to bot |
| `server_message` | `message`, `type` | System/server message (death messages, advancements, etc.) |
| `player_joined` | `username` | A player joined the server |
| `player_left` | `username` | A player left the server |
| `danger` | `reason`, `health`, `food` | Low health detected (health < 10) |
| `hurt` | `health` | Bot took damage |
| `death` | `position` | Bot died (position logged for item recovery) |
| `experience_gained` | `level`, `points`, `progress` | Bot gained experience |
| `entity_gone` | `name`, `type`, `reason` | A notable entity disappeared (hostile/player) |
| `dig_completed` | `block`, `position` | Finished breaking a block |
| `dig_aborted` | `block`, `position` | Mining was interrupted |
| `item_collected` | `collector`, `item` | Bot picked up an item |
| `weather_changed` | `old`, `new` | Weather changed (clear/rain/thunder) |
| `woke_up` | _(none)_ | Bot woke from bed |
| `goal_reached` | _(none)_ | Pathfinder reached destination |
| `path_failed` | `status` | Pathfinding failed (`noPath`, `timeout`, `stuck`) |
| `error` | `message` | Bot error |
| `disconnect` | _(none)_ | Bot disconnected |
| `kicked` | `reason` | Bot was kicked |
| `command_received` | `commandId`, `action` | Command acknowledged (bot received it) |
| `command_result` | `commandId`, `success`, `detail`, ... | Result of a command execution (may include structured data) |
| `block_mined` | `block`, `mined`, `target`, `elapsed` | Progress update during mining |
| `mining_complete` | `resource`, `mined`, `target`, `elapsed`, `stopReason` | Mining operation finished |
| `tool_low_durability` | `tool`, `remaining` | Tool about to break |
| `combat_ended` | `reason`, `target`, `hitsDealt`, `elapsed` | Combat finished |
| `combat_retreat` | `health`, `reason`, `hitsDealt`, `damageTaken` | Retreating from combat |
| `arrow_shot` | `target`, `distance` | Arrow fired at target |
| `hunt_ended` | `target`, `reason`, `elapsed` | Hunting operation finished |
| `smelting_started` | `item`, `count`, `expectedOutput` | Smelting begun |
| `auto_equipped` | `item`, `slot` | Auto-equipped better armor |

### Command Result Correlation

Every command you send with an `id` field will produce:
1. A `command_received` event (immediate acknowledgment)
2. A `command_result` event (when the command completes)

```json
{ "id": 42, "type": "command_received", "commandId": "cmd-1", "action": "craft" }
{ "id": 43, "type": "command_result", "commandId": "cmd-1", "success": false,
  "detail": "Missing materials for iron_pickaxe",
  "missingMaterials": [{"item": "iron_ingot", "need": 3, "have": 1}, {"item": "stick", "need": 2, "have": 0}],
  "requiresTable": true }
```

Many commands return **structured data** alongside the `detail` string. Check for fields like `missingMaterials`, `verify`, `scan`, `blocks`, `trades`, `container`, `itemsGained`, `notes`, etc.

---

## Commands (Agent -> Bot)

Write to `data/commands.json` as a JSON array. The bot polls every 500ms, executes all commands, then clears the file.

Every command must have an `action` field. Include an `id` field to track results:

```json
[
  { "id": "cmd-1", "action": "goto", "x": 100, "y": 64, "z": -50 },
  { "id": "cmd-2", "action": "craft", "item": "wooden_pickaxe" }
]
```

### Movement

#### `goto` - Navigate to coordinates
```json
{ "action": "goto", "x": -50, "y": 64, "z": 120 }
```

#### `follow` - Follow a player
```json
{ "action": "follow", "username": "Wookiee_23", "distance": 2 }
```

#### `stop` - Stop all movement and pathfinding
```json
{ "action": "stop" }
```

#### `look_at_player` - Turn to face a player
```json
{ "action": "look_at_player", "username": "Wookiee_23" }
```

#### `look_at` - Look at coordinates
```json
{ "action": "look_at", "x": 10, "y": 64, "z": -5 }
```

#### `jump` - Jump once
```json
{ "action": "jump" }
```

#### `sneak` - Crouch for a duration
```json
{ "action": "sneak", "duration": 1000 }
```

#### `steer` - Steer a mounted vehicle
```json
{ "action": "steer", "direction": "forward", "duration": 2000 }
```
Directions: `forward`, `back`, `left`, `right`

#### `mount` - Mount a nearby entity
```json
{ "action": "mount", "entityId": 1234 }
```
Omit `entityId` to mount nearest mountable entity.

#### `dismount` - Dismount current vehicle
```json
{ "action": "dismount" }
```

### Combat

#### `attack` - Attack a mob (melee combat loop)
```json
{ "action": "attack", "target": "zombie" }
```
Omit `target` to attack nearest hostile. Auto-retreats at low health.

#### `shoot` - Ranged attack with bow
```json
{ "action": "shoot", "target": "skeleton" }
```

#### `block_shield` - Block with shield
```json
{ "action": "block_shield" }
```

### Gathering

#### `dig` - Break a block
```json
{ "action": "dig", "position": { "x": 10, "y": 64, "z": -5 } }
```
Or by direction: `{ "action": "dig", "direction": "below" }`
Directions: `front`, `back`, `left`, `right`, `above`, `below`

#### `mine_resource` - Find and mine a resource
```json
{ "action": "mine_resource", "resource": "iron_ore", "count": 10 }
```

#### `find_food` - Hunt nearby animals
```json
{ "action": "find_food" }
```

#### `collect_items` - Pick up dropped items
```json
{ "action": "collect_items", "radius": 16 }
```

#### `drop` - Drop items
```json
{ "action": "drop", "item": "cobblestone", "count": 32 }
```

#### `give` - Give items to a player
```json
{ "action": "give", "username": "Wookiee_23", "item": "bread", "count": 5 }
```

### Crafting

#### `craft` - Craft an item
```json
{ "action": "craft", "item": "wooden_pickaxe", "count": 1 }
```
Auto-places crafting table if needed.

#### `smelt` - Smelt items in furnace
```json
{ "action": "smelt", "item": "iron_ore", "count": 8 }
```
Auto-places furnace if needed, auto-finds fuel.

#### `cook_food` - Cook raw food
```json
{ "action": "cook_food" }
```

### Building

#### `place` - Place a block
```json
{ "action": "place", "blockType": "cobblestone", "position": { "x": 10, "y": 64, "z": -5 } }
```

#### `build` - Build a structure from template
```json
{ "action": "build", "template": "shelter_3x3", "material": "cobblestone" }
```
Templates: `shelter_3x3`, `pillar`, `bridge`, `wall`

### Farming

#### `till` - Till dirt near water
```json
{ "action": "till", "radius": 5 }
```

#### `plant` - Plant crops on farmland
```json
{ "action": "plant", "crop": "wheat" }
```
Crops: `wheat`, `carrot`, `potato`, `beetroot`, `melon`, `pumpkin`, `nether_wart`

#### `harvest` - Harvest mature crops
```json
{ "action": "harvest", "autoReplant": true }
```

#### `farm` - Full farming cycle (till + plant + wait + harvest)
```json
{ "action": "farm", "crop": "wheat" }
```

### Interaction

#### `chat` - Send a chat message
```json
{ "action": "chat", "message": "Hello everyone!" }
```

#### `whisper` - Send a private message to a player
```json
{ "action": "whisper", "username": "Wookiee_23", "message": "Hey, come check this out!" }
```

#### `equip` - Equip an item
```json
{ "action": "equip", "item": "iron_sword", "hand": "main" }
```
Hands: `main`, `off`

#### `unequip` - Remove equipment from a slot
```json
{ "action": "unequip", "slot": "head" }
```
Slots: `hand`, `off-hand`, `head`, `torso`, `legs`, `feet`

#### `drink_potion` - Drink a potion
```json
{ "action": "drink_potion" }
{ "action": "drink_potion", "potion": "healing" }
```

#### `eat` - Eat food from inventory
```json
{ "action": "eat" }
```

#### `sleep` - Find a bed and sleep
```json
{ "action": "sleep" }
```

#### `activate` - Right-click a block (doors, buttons, levers)
```json
{ "action": "activate", "position": { "x": 10, "y": 64, "z": -5 } }
```

#### `fish` - Start fishing
```json
{ "action": "fish" }
```

#### `use_on` - Use item on an entity
```json
{ "action": "use_on", "entityType": "cow" }
```

#### `trade` - Trade with nearby villager
```json
{ "action": "trade", "index": 0 }
```

#### `brew` - Brew potions
```json
{ "action": "brew" }
```

#### `enchant` - Enchant items
```json
{ "action": "enchant" }
```

### Creative Mode

#### `creative_fly` - Toggle creative flight
```json
{ "action": "creative_fly", "enabled": true }
{ "action": "creative_fly", "enabled": false }
```

#### `creative_fly_to` - Fly to coordinates (creative only)
```json
{ "action": "creative_fly_to", "x": 100, "y": 80, "z": -50 }
```

#### `creative_give` - Give items in creative mode
```json
{ "action": "creative_give", "item": "diamond_pickaxe", "count": 1 }
```

### Inventory Management

#### `store_items` - Deposit items in nearby chest
```json
{ "action": "store_items", "items": ["cobblestone", "dirt"] }
```

#### `retrieve_items` - Withdraw items from nearby chest
```json
{ "action": "retrieve_items", "items": ["iron_ingot"] }
```

#### `manage_inventory` - Auto-manage (deposit to chest or drop junk)
```json
{ "action": "manage_inventory" }
```

### Utility

#### `scan` - Detailed area survey
```json
{ "action": "scan", "radius": 32 }
```
Returns: top blocks, notable blocks, entities, food supply, hostile count via event.

#### `find_blocks` - Search for specific blocks
```json
{ "action": "find_blocks", "blockType": "diamond_ore", "maxDistance": 64, "count": 10 }
```
Returns: list of matching blocks with positions and distances via event.

#### `where_am_i` - Quick status check
```json
{ "action": "where_am_i" }
```
Returns: position, dimension, biome, health, food, time, weather via event.

#### `list_recipes` - Check craftable items
```json
{ "action": "list_recipes", "item": "iron_pickaxe" }
```
With `item`: shows recipe ingredients. Without: lists all currently craftable items.

#### `goto_block` - Navigate to nearest block of a type
```json
{ "action": "goto_block", "blockType": "crafting_table", "maxDistance": 64 }
```
Finds and pathfinds to the nearest matching block.

#### `verify` - Check if an action is feasible before doing it
```json
{ "action": "verify", "check": "craft", "item": "iron_pickaxe" }
{ "action": "verify", "check": "smelt", "item": "iron_ore" }
{ "action": "verify", "check": "goto", "x": 100, "y": 64, "z": -50 }
{ "action": "verify", "check": "attack", "target": "zombie" }
{ "action": "verify", "check": "sleep" }
{ "action": "verify", "check": "mine", "resource": "diamond_ore" }
```
Returns feasibility, reason, and details (missing materials, distance, target count, etc.) via event. **Use this before expensive operations to avoid wasted time.**

#### `cancel` - Cancel the currently running action
```json
{ "action": "cancel" }
```
Stops pathfinding, clears combat, and resets all control states. Returns what was cancelled.

#### `inspect_container` - Look inside a nearby container
```json
{ "action": "inspect_container" }
{ "action": "inspect_container", "position": { "x": 100, "y": 64, "z": -50 } }
```
Returns: container type, all items inside, and free slots. Does not take any items.

#### `set_note` - Save a persistent note (survives restarts)
```json
{ "action": "set_note", "key": "base_location", "value": "100 64 200" }
{ "action": "set_note", "key": "current_goal", "value": "Get diamond pickaxe" }
{ "action": "set_note", "key": "old_note", "value": "" }
```
Notes are saved to `data/notes.json` and appear in `state.json` under the `notes` field. Set value to empty string to delete a note.

#### `get_notes` - Retrieve saved notes
```json
{ "action": "get_notes" }
{ "action": "get_notes", "key": "base_location" }
```
Returns all notes or a specific note by key.

#### `ack_events` - Acknowledge processed events (persists across restarts)
```json
{ "action": "ack_events", "eventId": 150 }
```
Tells the bot "I have processed all events up to this ID." The bot saves this to `data/ack.json`, and `state.json` will include `lastAckedEventId: 150` on every update. **On startup, read `lastAckedEventId` from `state.json` and only process events with `id` greater than that value.** This prevents duplicate responses when your agent restarts.

### Goals

#### `goal` - Set persistent objective (survives restarts)
```json
{ "action": "goal", "goal": "mine iron and craft iron tools" }
{ "action": "goal", "goal": "gather_wood" }
{ "action": "goal", "goal": "explore" }
{ "action": "goal", "goal": "clear" }
```
Any string sets a persistent objective that appears in `state.json` as `currentGoal`. Built-in goals `gather_wood` and `explore` also trigger pathfinding behavior. Use `"clear"` or `"none"` to clear the goal.

---

## Manifest (Self-Describing Capabilities)

On startup the bot writes `data/manifest.json` containing:

- **actions**: Every command with its parameters, types, defaults, and description
- **events**: Every event type with its fields and description
- **stateFields**: Every field in `state.json` with its type and description
- **autonomousBehaviors**: What the bot does automatically and when
- **protocol**: How the IPC works (which files to read/write, polling intervals)

**New agents should read `manifest.json` first** to discover capabilities without needing this documentation.

---

## Timing

| Interval | Value | Description |
|----------|-------|-------------|
| State broadcast | 1000ms | Bot writes `state.json` |
| Command poll | 500ms | Bot reads `commands.json` |
| Survival tick | 1000ms | Auto-eat, water escape, threat flee, auto-equip armor |

---

## Autonomous Behaviors

The bot automatically performs these actions without commands:

| Behavior | Trigger | Description |
|----------|---------|-------------|
| Auto-eat | `food < 6` | Eats best available food from inventory |
| Water escape | `isInWater` | Pathfinds to nearest land block |
| Threat flee | Hostile mob nearby | Runs from creepers (16 blocks), other hostiles (12 blocks) |
| Auto-equip armor | Every 10s | Equips best available armor pieces |
| Stuck detection | No movement for 5s | Retries pathfinding or wanders randomly |
| Smart sprint | Following player | Sprints when far, walks when close |
| Auto-tool | Digging blocks | Selects best tool (pickaxe/axe/shovel) for the block |
| Auto-weapon | Combat | Equips best available weapon |

---

## Pathfinder Configuration

The pathfinder is configured with:
- **Parkour**: enabled (can jump gaps)
- **Digging**: disabled (won't break blocks to path)
- **1x1 towers**: enabled (can pillar up)
- **Door opening**: enabled (can open fence gates)
- **Blocks avoided**: lava, cactus, sweet berry bush, fire, soul fire, magma block, campfire, wither rose
- **Flee logic**: Uses `GoalInvert` for intelligent escape routing away from threats

---

See [`schemas/commands.schema.json`](../schemas/commands.schema.json) for JSON schema validation.
