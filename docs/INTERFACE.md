# OpenClaw Minecraft Bot Interface

**File-Based IPC: `state.json` + `events.json` + `commands.json`**

## Overview

The bot communicates with AI agents through three JSON files in the `data/` directory:

- **`state.json`** - Bot writes every 1 second (current world snapshot)
- **`events.json`** - Bot appends game events (rolling buffer of 200)
- **`commands.json`** - Agent writes actions for bot to execute (consumed on read)

All file writes use atomic write-to-temp-then-rename to prevent partial reads.

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
    "experience": { "level": 5, "points": 42 },
    "isInWater": false,
    "isSleeping": false,
    "isOnFire": false,
    "gameMode": "survival",
    "dimension": "overworld",
    "biome": "plains",
    "weather": "clear",
    "lightLevel": 15
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
    "phase": "day"
  },
  "currentAction": null
}
```

### Fields

| Field | Description |
|-------|-------------|
| `bot.position` | Current coordinates (floored integers) |
| `bot.health` | HP (0-20) |
| `bot.healthTrend` | `stable`, `healing`, or `taking_damage` |
| `bot.food` | Hunger bar (0-20) |
| `bot.saturation` | Saturation level (hidden hunger buffer) |
| `bot.experience` | Level and points |
| `bot.isInWater` | Whether bot is submerged |
| `bot.isSleeping` | Whether bot is in a bed |
| `bot.isOnFire` | Whether bot is on fire |
| `bot.gameMode` | survival, creative, adventure, spectator |
| `bot.dimension` | `overworld`, `nether`, or `the_end` |
| `bot.biome` | Current biome name |
| `bot.weather` | `clear`, `rain`, or `thunder` |
| `bot.lightLevel` | Block light level at bot position |
| `equipment` | Currently equipped items in each slot (hand, offHand, head, chest, legs, feet) |
| `armor` | Armor pieces worn and total protection rating |
| `inventory` | All items with name, count, slot |
| `inventoryStats` | Used/free slots, total item count |
| `nearbyEntities` | Up to 20 entities within 32 blocks, sorted by distance. Type is `player`, `hostile`, or `passive` |
| `nearbyBlocks` | Block type counts in a 17x9x17 area around the bot |
| `notableBlocks` | Up to 30 notable blocks within 33 blocks (chests, ores, workstations, spawners, portals) |
| `time.timeOfDay` | Game ticks (0-24000) |
| `time.phase` | `day`, `sunset`, or `night` |
| `currentAction` | Current action the bot is performing, or null |

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
| `spawn` | `position` | Bot spawned in world |
| `chat` | `username`, `message` | Player sent chat message |
| `whisper` | `username`, `message` | Player whispered to bot |
| `danger` | `reason`, `health`, `food` | Low health detected (health < 10) |
| `hurt` | `health` | Bot took damage |
| `death` | `position` | Bot died (position logged for item recovery) |
| `woke_up` | _(none)_ | Bot woke from bed |
| `goal_reached` | _(none)_ | Pathfinder reached destination |
| `path_failed` | `status` | Pathfinding failed (`noPath`, `timeout`, `stuck`) |
| `error` | `message` | Bot error |
| `disconnect` | _(none)_ | Bot disconnected |
| `kicked` | `reason` | Bot was kicked |
| `command_result` | `commandId`, `success`, `detail` | Result of a command execution |

### Command Result Correlation

Every command you send with an `id` field will produce a `command_result` event:

```json
{ "id": 42, "timestamp": 1770592451200, "type": "command_result", "commandId": "cmd-1", "success": true, "detail": "Arrived at -50, 64, 120" }
{ "id": 43, "timestamp": 1770592452300, "type": "command_result", "commandId": "cmd-2", "success": false, "detail": "No iron_ore in inventory" }
```

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

#### `equip` - Equip an item
```json
{ "action": "equip", "item": "iron_sword", "hand": "main" }
```
Hands: `main`, `off`

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

### Goals

#### `goal` - High-level goal shortcuts
```json
{ "action": "goal", "goal": "gather_wood" }
```
Goals: `gather_wood`, `explore`

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

See [`schemas/commands.schema.json`](../schemas/commands.schema.json) for JSON schema validation.
