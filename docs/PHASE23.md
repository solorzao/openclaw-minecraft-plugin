# Phase 23: Critical Survival Features

**Version:** v7  
**Status:** ✅ Implemented  
**Date:** 2026-02-08

## Overview

Phase 23 adds four critical survival features that unlock the bot's ability to progress beyond basic survival into the iron age and sustainable farming. These features are essential "showstoppers" that were blocking further autonomous development.

## Features

### 1. 🔥 Furnace Smelting (`nova smelt <item>`)

Enables ore processing to create tools and armor.

**Commands:**
- `nova smelt` - Smelt any smeltable item in inventory
- `nova smelt iron_ore` - Smelt specific item
- `nova smelt raw_iron 32` - Smelt specific count

**Supported Items:**
- Ores: `iron_ore`, `gold_ore`, `copper_ore`, `raw_iron`, `raw_gold`, `raw_copper`, `ancient_debris`
- Blocks: `cobblestone` → `stone`, `stone` → `smooth_stone`, `sand` → `glass`
- Other: `clay_ball` → `brick`, `netherrack` → `nether_brick`, `wet_sponge` → `sponge`

**Fuel Priority:**
1. Lava bucket (100 items)
2. Coal block (72 items)
3. Coal/Charcoal (8 items each)
4. Blaze rod (12 items)
5. Wood planks/logs (1.5 items each)

**Behavior:**
- Auto-finds or crafts furnace (needs 8 cobblestone)
- Auto-places furnace if none nearby
- Uses best available fuel
- Waits for smelting completion
- Collects output from furnace

**Events:**
- `smelting_started` - Begin smelting
- `fuel_added` - Fuel placed in furnace
- `smelt_output_collected` - Items collected
- `smelting_complete` - All items smelted
- `smelt_failed` - Error or missing requirements

---

### 2. 🌾 Crop Farming

Provides renewable food source for long-term survival.

**Commands:**
- `nova till` - Till dirt near water into farmland
- `nova plant <crop>` - Plant seeds on farmland
- `nova harvest` - Harvest mature crops and auto-replant
- `nova farm <crop>` - Full farming cycle
- `nova farm status` - Show farming state

**Supported Crops:**
- `wheat` (wheat_seeds → wheat)
- `carrot` (carrot → carrots)
- `potato` (potato → potatoes)
- `beetroot` (beetroot_seeds → beetroots)
- `melon` (melon_seeds → melon_stem)
- `pumpkin` (pumpkin_seeds → pumpkin_stem)
- `nether_wart` (nether_wart → nether_wart)

**Requirements:**
- Hoe (any type) for tilling
- Seeds or crop items for planting
- Water within 4 blocks for farmland

**Behavior:**
- `nova till` - Finds water, tills nearby dirt blocks
- `nova plant` - Plants seeds on available farmland
- `nova harvest` - Only harvests mature crops, auto-replants
- `nova farm` - Full cycle with periodic harvest checks

**Events:**
- `tilling_complete` - Dirt converted to farmland
- `planting_complete` - Seeds planted
- `harvest_complete` - Crops harvested

---

### 3. 🏹 Ranged Combat

Enables safe engagement of hostile mobs from distance.

**Commands:**
- `nova shoot` - Shoot nearest hostile mob
- `nova shoot zombie` - Shoot specific target type
- `nova shoot <player>` - Shoot specific player
- `nova block` / `nova shield` - Raise shield to block
- `nova stop blocking` - Lower shield
- `nova ranged status` - Check bow/arrows/shield

**Requirements:**
- Bow or crossbow in inventory
- Arrows (any type)
- Shield (for blocking)

**Combat Mechanics:**
- Maintains optimal range (15-25 blocks)
- Auto-retreats if too close (<10 blocks)
- Leads targets based on velocity
- Auto-retreats when health < 8
- Shoots every 1.5 seconds

**Shield Blocking:**
- Equips shield to off-hand
- Blocks for 5 seconds
- Reduces damage from arrows and melee

**Events:**
- `ranged_combat_started` - Combat engaged
- `arrow_shot` - Arrow fired
- `ranged_retreat` - Low health retreat
- `shield_blocking` - Shield raised/lowered

---

### 4. 📦 Inventory Management (Automatic)

Prevents inventory overflow from blocking progress.

**Commands:**
- `nova inv status` - Show inventory usage
- `nova manage inventory` - Manual inventory cleanup
- `nova dump junk` - Drop low-value items

**Auto-Trigger:**
- Activates when inventory reaches 32/36 slots
- Checks every 30 seconds

**Essential Items (kept):**
- Tools: pickaxe, axe, shovel, hoe, shears
- Weapons: sword, bow, crossbow, trident, shield
- Armor: helmet, chestplate, leggings, boots
- Food: cooked meats, bread, golden apples
- Materials: torch, crafting_table, furnace, coal, iron_ingot

**Low-Value Items (dropped if no chest):**
- dirt, cobblestone, gravel, sand
- netherrack, andesite, diorite, granite
- rotten_flesh, poisonous_potato, bone
- string, spider_eye, flint, seeds

**Behavior:**
1. If chest within 64 blocks: Navigate and deposit non-essential items
2. If no chest: Drop low-value items until space freed
3. Resume previous task after cleanup

**Events:**
- `inventory_full_warning` - Triggered at 32+ slots
- `item_deposited` - Item stored in chest
- `item_dropped_auto` - Item dropped (no chest)
- `inventory_managed` - Cleanup complete

---

## Chat Commands Summary

| Command | Action |
|---------|--------|
| `nova smelt <item>` | Smelt ores/items in furnace |
| `nova till` | Till dirt into farmland |
| `nova plant <crop>` | Plant seeds on farmland |
| `nova harvest` | Harvest mature crops |
| `nova farm <crop>` | Full farming cycle |
| `nova farm status` | Show farm state |
| `nova shoot <target>` | Ranged attack |
| `nova block` | Raise shield |
| `nova stop blocking` | Lower shield |
| `nova ranged status` | Check combat gear |
| `nova inv status` | Check inventory usage |
| `nova manage inventory` | Manual cleanup |
| `nova dump junk` | Drop low-value items |

---

## Integration

### Perception Updates

Phase 23 adds the following to perception state:

```json
{
  "phase23": {
    "smelting": {
      "hasFurnace": true,
      "hasFuel": true,
      "smeltableItems": ["raw_iron", "cobblestone"]
    },
    "farming": {
      "farmPlots": 12,
      "hasHoe": true,
      "hasSeeds": true
    },
    "rangedCombat": {
      "hasBow": true,
      "hasArrows": true,
      "hasShield": true,
      "rangedCombatActive": false,
      "shieldBlockActive": false
    },
    "inventory": {
      "usage": 28,
      "total": 36,
      "isFull": false,
      "nearbyChest": true
    }
  }
}
```

### World Memory

Farm plots are persisted in world memory:

```json
{
  "farmPlots": [
    {
      "position": { "x": 100, "y": 64, "z": 200 },
      "crop": "wheat",
      "planted": 1707422400000
    }
  ]
}
```

---

## Impact

These features unlock:
- **Iron Age**: Smelt iron ore → iron tools/armor
- **Renewable Food**: Farm wheat/carrots for sustainable food
- **Safe Combat**: Engage skeletons without melee risk
- **Unblocked Progress**: Inventory never full

## Testing Checklist

- [x] Can smelt iron ore → iron ingots
- [x] Can till dirt and plant wheat
- [x] Can harvest and auto-replant crops
- [x] Can shoot zombies with bow
- [x] Can block with shield
- [x] Auto-deposits to chest when inventory full

---

## Version History

- **v7** (Phase 23): Added smelting, farming, ranged combat, inventory management
- **v6** (Phase 22): Vehicle, entity interaction, items, look, sound, XP, books, block watch
- **v5** (Phase 21): Bot-to-bot communication
- **v4** (Phase 20): Autonomous behavior with agency
