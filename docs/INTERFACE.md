# OpenClaw Minecraft Bot Interface

**File-Based Communication Protocol: `events.json` ↔ `commands.json`**

## Overview

The bot communicates with AI agents through two JSON files:

- **`events.json`** - Bot writes game state every 3 seconds (read by AI)
- **`commands.json`** - AI writes actions to execute (read by bot)

This design allows **any** AI agent (OpenClaw, custom scripts, etc.) to control the bot without code changes.

---

## 📥 Events (Bot → AI)

### Event Structure

```json
[
  {
    "timestamp": 1770592450869,
    "type": "perception",
    "data": { /* event-specific data */ }
  }
]
```

### Core Events

#### `perception` (every 3 seconds)

Full game state snapshot:

```json
{
  "timestamp": 1770592450869,
  "type": "perception",
  "data": {
    "position": { "x": -27, "y": 67, "z": -139 },
    "health": 17.2,
    "food": 14,
    "nearbyPlayers": [
      {
        "username": "Wookiee_23",
        "distance": 5,
        "position": { "x": -31, "y": 67, "z": -142 }
      }
    ],
    "hostileMobs": [
      {
        "type": "zombie",
        "distance": 12,
        "position": { "x": -15, "y": 67, "z": -140 }
      }
    ],
    "dangerUnderfoot": null,
    "inWater": false,
    "oxygen": 300,
    "currentGoal": { "type": "follow", "username": "Wookiee_23" },
    "inventory": [
      { "name": "dirt", "count": 1, "slot": 36 },
      { "name": "rotten_flesh", "count": 2, "slot": 37 }
    ],
    "hungerUrgency": "low",
    "foodCount": 0,
    "foodAnimals": ["cow", "pig"],
    "time": 6000,
    "isDay": true
  }
}
```

**Fields:**
- `position` - Current coordinates
- `health` - HP (0-20)
- `food` - Hunger bar (0-20)
- `nearbyPlayers` - Players within 64 blocks
- `hostileMobs` - Zombies, skeletons, creepers, etc.
- `dangerUnderfoot` - `"cliff"`, `"lava"`, `"cactus"`, or `null`
- `inWater` - Boolean
- `oxygen` - 0-300 (drowning at < 50)
- `currentGoal` - Active goal/task
- `inventory` - First 20 items
- `hungerUrgency` - `"critical"`, `"high"`, `"medium"`, `"low"`
- `foodCount` - Edible food in inventory
- `foodAnimals` - Nearby animals that can be hunted
- `time` - Game time (0-24000 ticks)
- `isDay` - Boolean (sunrise to sunset)

#### `danger`

Bot detected a threat:

```json
{
  "type": "danger",
  "data": {
    "reason": "low_health",
    "health": 3.5
  }
}
```

**Reasons:**
- `"low_health"` - Health < 10
- `"drowning_warning"` - Oxygen < 100
- `"drowning_critical"` - Oxygen < 50 (auto-swim activated)

#### `health_change`

```json
{
  "type": "health_change",
  "data": {
    "health": 15.5,
    "food": 18
  }
}
```

#### `hurt`

Bot took damage:

```json
{
  "type": "hurt",
  "data": {
    "health": 11.5,
    "attacker": "unknown"
  }
}
```

#### `combat_started`

```json
{
  "type": "attack_started",
  "data": {
    "target": "zombie",
    "distance": 28
  }
}
```

#### `combat_ended`

```json
{
  "type": "combat_ended",
  "data": {
    "reason": "target_gone",
    "target": "skeleton"
  }
}
```

**Reasons:** `"target_gone"`, `"target_died"`, `"retreated"`

#### Block Events

```json
{ "type": "block_broken", "data": { "blockType": "dirt", "position": {...} } }
{ "type": "block_placed", "data": { "blockType": "cobblestone", "position": {...} } }
{ "type": "block_activated", "data": { "blockType": "oak_door", "position": {...} } }
```

#### Item Events

```json
{ "type": "item_equipped", "data": { "item": "wooden_pickaxe", "hand": "main" } }
{ "type": "fish_caught", "data": { "item": "cod" } }
```

#### Mount Events

```json
{ "type": "mounted", "data": { "entity": "horse", "entityId": 1234 } }
{ "type": "dismounted", "data": {} }
```

---

## 📤 Commands (AI → Bot)

### Command Structure

```json
[
  {
    "action": "follow",
    "username": "Wookiee_23",
    "distance": 2
  }
]
```

Commands are **consumed** by the bot (array cleared after execution).

### Navigation Commands

#### `follow`

Follow a player:

```json
{
  "action": "follow",
  "username": "Wookiee_23",
  "distance": 2
}
```

#### `goto`

Go to coordinates:

```json
{
  "action": "goto",
  "x": -50,
  "y": 64,
  "z": 120
}
```

#### `stop`

Stop all movement:

```json
{
  "action": "stop"
}
```

### Block Interaction

#### `dig`

Mine a block:

```json
{
  "action": "dig",
  "position": { "x": 10, "y": 64, "z": -5 }
}
```

Or relative direction:

```json
{
  "action": "dig",
  "direction": "below"
}
```

**Directions:** `"front"`, `"back"`, `"left"`, `"right"`, `"above"`, `"below"`

#### `place`

Place a block:

```json
{
  "action": "place",
  "blockType": "cobblestone",
  "position": { "x": 10, "y": 64, "z": -5 }
}
```

#### `activate`

Right-click a block (doors, buttons, levers):

```json
{
  "action": "activate",
  "position": { "x": 10, "y": 64, "z": -5 }
}
```

Or block in front:

```json
{
  "action": "activate"
}
```

### Inventory

#### `equip`

Equip an item:

```json
{
  "action": "equip",
  "item": "wooden_pickaxe",
  "hand": "main"
}
```

**Hands:** `"main"`, `"off"`, `"head"`, `"torso"`, `"legs"`, `"feet"`

### Combat

#### `attack`

Attack a mob:

```json
{
  "action": "attack",
  "target": "zombie"
}
```

Or nearest hostile:

```json
{
  "action": "attack"
}
```

### Survival

#### `find_food`

Hunt nearby animals:

```json
{
  "action": "find_food"
}
```

#### `cook_food`

Smelt raw food in furnace:

```json
{
  "action": "cook_food"
}
```

#### `eat`

Eat food from inventory:

```json
{
  "action": "eat"
}
```

**Note:** Bot auto-eats when `food < 6`.

### Crafting

#### `craft`

Craft an item:

```json
{
  "action": "craft",
  "item": "wooden_pickaxe",
  "count": 1
}
```

Bot will:
1. Find recipe
2. Place crafting table if needed
3. Craft item

### Mining

#### `mine_resource`

Find and mine a resource:

```json
{
  "action": "mine_resource",
  "resource": "coal",
  "count": 10
}
```

**Resources:** `"coal"`, `"iron_ore"`, `"diamond"`, `"stone"`, etc.

### Sleep

#### `sleep`

Find bed and sleep:

```json
{
  "action": "sleep"
}
```

### Building

#### `build`

Build a structure:

```json
{
  "action": "build",
  "template": "shelter",
  "material": "cobblestone"
}
```

**Templates:**
- `"shelter"` - 3x3 enclosed room
- `"pillar"` - Vertical column
- `"bridge"` - Horizontal bridge
- `"wall"` - Defensive wall

### Storage

#### `store_items`

Store items in chest:

```json
{
  "action": "store_items",
  "itemType": "dirt",
  "count": 64
}
```

#### `retrieve_items`

Get items from chest:

```json
{
  "action": "retrieve_items",
  "itemType": "iron_ingot",
  "count": 10
}
```

### World Memory

#### `mark_location`

Save current location:

```json
{
  "action": "mark_location",
  "name": "home",
  "note": "My base"
}
```

#### `goto_landmark`

Go to saved location:

```json
{
  "action": "goto_landmark",
  "name": "home"
}
```

#### `set_home`

Set home location (spawn point):

```json
{
  "action": "set_home"
}
```

### Villager Trading

#### `trade`

Trade with villager:

```json
{
  "action": "trade",
  "index": 0
}
```

**Note:** `index: -1` lists available trades.

### Vehicles

#### `mount`

Mount nearby entity:

```json
{
  "action": "mount",
  "entityId": 1234
}
```

Or nearest mountable:

```json
{
  "action": "mount"
}
```

#### `dismount`

Dismount:

```json
{
  "action": "dismount"
}
```

### Fishing

#### `fish`

Start fishing (waits for catch):

```json
{
  "action": "fish"
}
```

---

## 💡 Example AI Controller

```javascript
const fs = require('fs');

function readEvents() {
  return JSON.parse(fs.readFileSync('events.json', 'utf8'));
}

function writeCommands(commands) {
  fs.writeFileSync('commands.json', JSON.stringify(commands, null, 2));
}

setInterval(() => {
  const events = readEvents();
  const latest = events[events.length - 1];
  
  if (latest.type === 'perception') {
    const { health, food, hungerUrgency, hostileMobs, nearbyPlayers } = latest.data;
    
    // Survival logic
    if (health < 6) {
      writeCommands([{ action: 'stop' }]);
      return;
    }
    
    if (hungerUrgency === 'critical') {
      writeCommands([{ action: 'find_food' }]);
      return;
    }
    
    if (hostileMobs.length > 0 && health > 10) {
      writeCommands([{ action: 'attack' }]);
      return;
    }
    
    // Social logic
    if (nearbyPlayers.length > 0) {
      const player = nearbyPlayers[0];
      writeCommands([
        { action: 'follow', username: player.username, distance: 2 }
      ]);
      return;
    }
    
    // Idle behavior
    writeCommands([{ action: 'goal', goal: 'explore' }]);
  }
}, 5000);
```

---

## 📊 Full Command Reference

See [`schemas/commands.schema.json`](../schemas/commands.schema.json) for complete JSON schema.

## 📊 Full Event Reference

See [`schemas/events.schema.json`](../schemas/events.schema.json) for complete JSON schema.

---

**Last Updated:** 2026-02-08
