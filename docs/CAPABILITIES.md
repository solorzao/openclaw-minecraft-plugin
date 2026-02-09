# Nova Bot Capabilities Guide

## Phase 22: 8 Critical Capabilities (FEATURE COMPLETE!)

This document describes all 8 critical Mineflayer capabilities added in Phase 22, completing the bot's sensory and interaction capabilities.

---

## 1. Vehicle Control 🚤

**Problem Solved:** Bot could mount boats/minecarts but couldn't steer them.

### Commands
- `nova steer forward` - Move vehicle forward
- `nova steer backward` - Reverse the vehicle
- `nova steer left` - Turn left while moving forward
- `nova steer right` - Turn right while moving forward
- `nova stop vehicle` - Stop vehicle movement

### Programmatic API
```javascript
enqueueCommands([{ action: 'steer', direction: 'forward' }]);
enqueueCommands([{ action: 'steer', direction: 'left' }]);
enqueueCommands([{ action: 'steer', direction: 'stop' }]);
```

### Use Cases
- Navigate rivers and oceans in boats
- Travel via minecart systems
- Escape dangerous situations faster

---

## 2. Entity Interaction 🐑

**Problem Solved:** Couldn't breed animals, shear sheep, leash, or milk cows.

### Commands
- `nova breed` - Breed nearest cows (default)
- `nova breed <animal>` - Breed specific animal type (cow, sheep, pig, chicken, horse, rabbit)
- `nova shear` / `nova shear sheep` - Shear a nearby sheep
- `nova milk` / `nova milk cow` - Milk a nearby cow

### Programmatic API
```javascript
// Generic use-on (right-click entity)
enqueueCommands([{ action: 'use_on', entityType: 'sheep' }]);

// Breed specific animal
enqueueCommands([{ action: 'breed', animal: 'pig' }]);

// Shear/milk helpers
enqueueCommands([{ action: 'shear' }]);
enqueueCommands([{ action: 'milk' }]);
```

### Breeding Food Requirements
| Animal | Food Needed |
|--------|-------------|
| Cow/Mooshroom | Wheat |
| Sheep | Wheat |
| Pig | Carrot |
| Chicken | Wheat Seeds |
| Horse | Golden Apple |
| Rabbit | Carrot |
| Wolf | Beef |
| Cat | Cod |
| Turtle | Seagrass |

### Use Cases
- Sustainable food farming
- Wool collection
- Animal husbandry automation

---

## 3. Item Dropping 📦

**Problem Solved:** Couldn't give items to other bots/players.

### Commands
- `nova drop <item>` - Drop 1 of the item
- `nova drop <item> <count>` - Drop specific amount
- `nova give <player> <item>` - Walk to player and drop 1 item
- `nova give <player> <item> <count>` - Walk to player and drop specific amount

### Programmatic API
```javascript
// Drop items at current location
enqueueCommands([{ action: 'drop', item: 'iron_ingot', count: 5 }]);

// Give items to specific player
enqueueCommands([{ action: 'give', target: 'Wookiee_23', item: 'diamond', count: 3 }]);
```

### Use Cases
- Trading with players/bots
- Sharing resources
- Dropping unwanted items

---

## 4. Smooth Look Control 👀

**Problem Solved:** No programmatic control over where the bot looks.

### Commands
- `nova look at <player>` - Look at a specific player

### Programmatic API
```javascript
// Look at player
enqueueCommands([{ action: 'look_at', player: 'Wookiee_23' }]);

// Look at coordinates
enqueueCommands([{ action: 'look_at', position: { x: 100, y: 64, z: -200 } }]);

// Look at entity by ID
enqueueCommands([{ action: 'look_at', entity: 12345 }]);

// Look at block
enqueueCommands([{ action: 'look_at', block: { x: 100, y: 64, z: -200 } }]);
```

### Use Cases
- Social interaction (facing who you're talking to)
- Aiming before attacking
- Photo/screenshot composition
- Precise block placement

---

## 5. Sound Awareness 👂

**Problem Solved:** Bot was deaf to environmental sounds.

### Commands
- `nova sounds` - List recent sounds heard (last 30 seconds)

### Automatic Reactions
The bot automatically:
- Logs all sounds heard
- Detects explosions and logs danger
- Detects player hurt sounds nearby
- Detects door/chest activity

### Perception Integration
Sound data is included in perception updates:
```json
{
  "recentSounds": [
    {
      "name": "entity.zombie.ambient",
      "position": { "x": 100, "y": 64, "z": -50 },
      "ago": 5
    }
  ]
}
```

### Use Cases
- Detecting nearby threats (explosions, combat)
- Security monitoring (door/chest activity)
- Environmental awareness

---

## 6. Experience System ⭐

**Problem Solved:** No awareness of XP level or ability to farm it.

### Commands
- `nova xp` / `nova level` / `nova experience` - Report current XP level
- `nova farm xp` - Start farming XP by hunting hostile mobs

### Programmatic API
```javascript
enqueueCommands([{ action: 'farm_xp' }]);
```

### Perception Integration
XP data is included in perception updates:
```json
{
  "experience": {
    "level": 15,
    "points": 280,
    "progress": 0.45
  }
}
```

### Use Cases
- Enchanting preparation (need level 30)
- Tracking progress
- Autonomous XP farming when needed

---

## 7. Book Writing 📖

**Problem Solved:** Couldn't write to books and quills.

### Commands
- `nova write log` / `nova write book` - Write all discovered landmarks to a book

### Programmatic API
```javascript
// Write discovery log automatically
enqueueCommands([{ action: 'write_log' }]);

// Write custom pages
enqueueCommands([{ 
  action: 'write_book', 
  slot: 5,  // Book slot in inventory
  pages: ['Page 1 content', 'Page 2 content'] 
}]);
```

### Use Cases
- Creating discovery logs
- Leaving notes for other players
- Documenting builds/coordinates
- Communication via written books

---

## 8. Block Update Subscriptions 🔔

**Problem Solved:** No way to monitor specific blocks for changes.

### Commands
- `nova watch door` - Monitor nearest door for open/close events
- `nova watch chest` - Monitor nearest chest for access events
- `nova unwatch` / `nova stop watching` - Stop all block monitoring
- `nova watching` - List currently monitored blocks

### Programmatic API
```javascript
// Watch a specific door position
enqueueCommands([{ 
  action: 'watch_door', 
  position: { x: 100, y: 64, z: -50 } 
}]);

// Watch a chest
enqueueCommands([{ 
  action: 'watch_chest', 
  position: { x: 100, y: 64, z: -55 } 
}]);

// Stop watching all blocks
enqueueCommands([{ action: 'unwatch' }]);

// Stop watching specific block
enqueueCommands([{ 
  action: 'unwatch', 
  position: { x: 100, y: 64, z: -50 } 
}]);
```

### Use Cases
- Security monitoring (detect intruders)
- Automation triggers
- Activity logging
- Base protection

---

## Perception Update Summary

All new capabilities add data to the periodic perception updates:

```json
{
  "position": { "x": 100, "y": 64, "z": -50 },
  "health": 20,
  "food": 18,
  
  "experience": {
    "level": 15,
    "points": 280,
    "progress": 0.45
  },
  
  "recentSounds": [
    { "name": "entity.door.open", "position": {...}, "ago": 3 }
  ],
  
  "vehicle": {
    "mounted": true,
    "vehicleName": "boat",
    "vehicleId": 12345
  },
  
  "watchedBlocks": 2
}
```

---

## Complete Feature List

Nova bot now implements ALL core Mineflayer features:

| Phase | Features |
|-------|----------|
| 1-7 | Basic movement, pathfinding, combat, inventory |
| 8 | Hunger management, auto-eat, food hunting |
| 9 | Crafting system |
| 10 | Strategic mining |
| 11 | Sleep/bed mechanics |
| 12 | Building/construction |
| 13 | Chest/storage management |
| 14 | World memory (landmarks, home) |
| 15 | Villager trading |
| 16 | Potions/enchanting |
| 17 | Block activation (doors, buttons) |
| 18 | Mount/dismount |
| 19 | Fishing |
| 20 | Autonomous behavior + agency |
| 21 | Bot-to-bot communication |
| **22** | **Vehicle control, entity interaction, item dropping, look control, sound awareness, experience system, book writing, block subscriptions** |

**🎉 FEATURE COMPLETE!**
