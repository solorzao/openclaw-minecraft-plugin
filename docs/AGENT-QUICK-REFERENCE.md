# Agent Quick Reference

**Read this first.** This is everything you need to control the bot.

## How It Works

```
You (AI Agent)                          Bot (Mineflayer)
     |                                       |
     |-- read data/state.json -------------> | (updated every 1s)
     |-- read data/events.json ------------> | (rolling 200 events)
     |-- write data/commands.json ---------->| (polled every 500ms, cleared after exec)
     |                                       |
     |  Loop: read state -> decide -> write command -> check events for result
```

**File paths:** Relative to the bot's working directory, default `./data/`. If `BOT_DATA_DIR` env var is set, files are there instead.

**Atomicity:** Safe to read `state.json` and `events.json` at any time (atomic writes). Write `commands.json` as a complete JSON array — don't append.

---

## Item Naming Convention

All item and block names use **snake_case** (lowercase, underscores):
- `iron_ore`, `raw_iron`, `iron_ingot`
- `cooked_beef`, `baked_potato`
- `diamond_pickaxe`, `crafting_table`
- `oak_log`, `oak_planks`

**Never** use spaces or camelCase. Check `state.json` inventory for exact names.

---

## Decision Flowchart

Check `state.json` every 1-2 seconds. Act on the **first** matching condition:

```
1. DYING (health < 6)
   → STOP everything: {"action": "stop"}
   → Eat if you have food: {"action": "eat"}
   → Otherwise flee: bot auto-flees hostiles, just don't send movement commands

2. STARVING (food < 6, no food in inventory)
   → Hunt: {"action": "find_food"}
   → Or cook raw meat: {"action": "cook_food"}

3. ON FIRE (isOnFire = true)
   → Jump into water: check notableBlocks for water, or wait (fire expires)

4. NIGHT TIME (time.phase = "night")
   → Sleep if bed available: {"action": "sleep"}
   → Or build shelter: {"action": "build", "template": "shelter_3x3"}
   → Or just keep moving — bot auto-flees hostiles

5. INVENTORY FULL (inventoryStats.freeSlots < 3)
   → Store in chest: {"action": "store_items"}
   → Or drop junk: {"action": "manage_inventory"}

6. NO TOOLS
   → Gather wood: {"action": "mine_resource", "resource": "wood", "count": 5}
   → Craft planks: {"action": "craft", "item": "oak_planks", "count": 4}
   → Craft sticks: {"action": "craft", "item": "stick"}
   → Craft pickaxe: {"action": "craft", "item": "wooden_pickaxe"}

7. IDLE — Do something productive
   → Mine resources, explore, farm, build
```

---

## What the Bot Does Automatically (Don't Duplicate These)

| Behavior | When | What happens |
|----------|------|-------------|
| Auto-eat | food < 6 | Eats best food from inventory |
| Auto-armor | Every 10s | Equips best armor pieces |
| Auto-tool | When you dig | Selects best pickaxe/axe/shovel |
| Auto-weapon | When you attack | Equips best sword/axe |
| Flee hostiles | Mob within 12-16 blocks | Runs opposite direction |
| Escape water | Submerged | Pathfinds to land |
| Stuck escape | No movement for 5s | Retries or wanders randomly |

**Implication:** Don't send `equip` commands for armor/tools — the bot handles it. Don't send `eat` unless you want to eat above food level 6. Don't panic about nearby hostiles — the bot flees automatically.

---

## Command Quick Reference

### Most Used Commands

| Action | Example | Notes |
|--------|---------|-------|
| `goto` | `{"action":"goto","x":100,"y":64,"z":-50}` | Pathfinds with parkour |
| `follow` | `{"action":"follow","username":"Player1"}` | Continuous, dynamic |
| `stop` | `{"action":"stop"}` | Cancels everything |
| `mine_resource` | `{"action":"mine_resource","resource":"iron_ore","count":10}` | Long-running, auto-equips tool |
| `craft` | `{"action":"craft","item":"iron_pickaxe"}` | Auto-places crafting table |
| `smelt` | `{"action":"smelt","item":"raw_iron","count":8}` | Auto-places furnace, finds fuel |
| `attack` | `{"action":"attack","target":"zombie"}` | Melee combat loop |
| `collect_items` | `{"action":"collect_items"}` | Picks up dropped items nearby |
| `chat` | `{"action":"chat","message":"Hello!"}` | Send chat message |
| `eat` | `{"action":"eat"}` | Eat food from inventory |
| `scan` | `{"action":"scan"}` | Survey area (blocks, entities, food) |
| `find_blocks` | `{"action":"find_blocks","blockType":"diamond_ore"}` | Locate specific blocks |
| `where_am_i` | `{"action":"where_am_i"}` | Quick status dump |
| `list_recipes` | `{"action":"list_recipes"}` | What can I craft right now? |
| `goto_block` | `{"action":"goto_block","blockType":"chest"}` | Navigate to nearest block type |
| `verify` | `{"action":"verify","check":"craft","item":"iron_pickaxe"}` | **Check feasibility before acting** |
| `cancel` | `{"action":"cancel"}` | Cancel current running action |
| `inspect_container` | `{"action":"inspect_container"}` | Look inside nearest chest |
| `set_note` | `{"action":"set_note","key":"base","value":"100 64 -50"}` | Save persistent note |
| `get_notes` | `{"action":"get_notes"}` | Retrieve all saved notes |
| `ack_events` | `{"action":"ack_events","eventId":150}` | **Mark events as processed (survives restarts)** |

### Key Patterns for Smart LLM Control

1. **Verify before acting**: Use `verify` before `craft`/`smelt`/`mine` to check feasibility and see what's missing
2. **Track events with ack_events**: On startup, read `lastAckedEventId` from `state.json` and only process events with `id` above that. After processing, send `ack_events` with the highest ID. **This prevents duplicate responses on restart.**
3. **Check state.survival**: Before issuing movement, check if bot is fleeing or stuck
4. **Use cancel**: If you need to change plans mid-action, cancel first
5. **Save notes**: Use `set_note` to remember base location, goals, and progress across sessions
6. **Read structured results**: `command_result` events now include rich data (missing materials, items gained, trade lists, etc.)

### Resource Names for mine_resource

| Resource | What it mines |
|----------|--------------|
| `wood` / `log` | All log types (oak, spruce, birch, etc.) |
| `stone` | Stone, cobblestone, deepslate |
| `iron_ore` | Iron ore + deepslate variant |
| `coal_ore` | Coal ore + deepslate variant |
| `diamond_ore` | Diamond ore + deepslate variant |
| `gold_ore` | Gold ore + deepslate variant |
| `sand` | Sand, red sand |
| `gravel` | Gravel |
| `clay` | Clay |

---

## Command Sequencing

### Rules
1. **One long-running action at a time.** Don't send `mine_resource` while another `mine_resource` is running.
2. **Wait for `command_result` events** before sending the next step in a sequence.
3. **New movement commands cancel previous ones.** A `goto` cancels a `follow`.
4. **Instant commands can batch.** `chat` + `equip` in one write is fine.
5. **Write `[]` to cancel all pending commands.**

### Checking Results

After writing a command with an `id`, poll `events.json` for:
```json
{"type": "command_result", "commandId": "your-id", "success": true, "detail": "..."}
```
or
```json
{"type": "command_result", "commandId": "your-id", "success": false, "detail": "error message"}
```

---

## Common Error Patterns and Recovery

| Error detail | Cause | Recovery |
|-------------|-------|---------|
| `"No path found"` / `"noPath"` | Destination unreachable | Try closer coordinates, check dimension |
| `"No {item} in inventory"` | Missing required item | Craft it, mine it, or collect_items |
| `"No crafting_table nearby"` | Recipe needs table | Bot auto-places one if you have planks — retry, or craft manually |
| `"No furnace available"` | Need furnace for smelting | Bot auto-places if you have 8 cobblestone — retry |
| `"No fuel available"` | Furnace has no fuel | Mine coal or use planks/logs as fuel |
| `"No recipe or missing materials"` | Can't craft this item | Check `list_recipes` for ingredients |
| `"Unknown item: {name}"` | Wrong item name | Check inventory for exact snake_case names |
| `"No food animals nearby"` | No cows/pigs/chickens in range | Explore to find animals |
| `"Not night time"` | Can't sleep during day | Wait for `time.phase = "night"` |
| `"No target found"` | No matching mob to attack | Check nearbyEntities in state |
| `"timeout"` (path event) | Pathfinder gave up | Send `stop`, then retry or try a different route |

**General recovery pattern:**
1. Read the error `detail`
2. Check `state.json` for context (inventory, position, nearby blocks)
3. Fix the missing prerequisite
4. Retry the command

---

## Complete Workflow Examples

### Example 1: Get Started from Nothing

```
Step 1: Survey the area
→ {"id":"s1", "action":"scan"}

Step 2: Punch trees for wood
→ {"id":"s2", "action":"mine_resource", "resource":"wood", "count":5}

Step 3: Craft planks and tools
→ {"id":"s3", "action":"craft", "item":"oak_planks", "count":16}
→ {"id":"s4", "action":"craft", "item":"stick", "count":8}
→ {"id":"s5", "action":"craft", "item":"wooden_pickaxe"}
→ {"id":"s6", "action":"craft", "item":"wooden_sword"}

Step 4: Mine stone for better tools
→ {"id":"s7", "action":"mine_resource", "resource":"stone", "count":12}

Step 5: Craft stone tools
→ {"id":"s8", "action":"craft", "item":"stone_pickaxe"}
→ {"id":"s9", "action":"craft", "item":"stone_sword"}

Step 6: Mine iron
→ {"id":"s10", "action":"mine_resource", "resource":"iron_ore", "count":10}

Step 7: Smelt iron
→ {"id":"s11", "action":"smelt", "item":"raw_iron"}

Step 8: Craft iron tools
→ {"id":"s12", "action":"craft", "item":"iron_pickaxe"}
→ {"id":"s13", "action":"craft", "item":"iron_sword"}
```

**Important:** Send these one at a time (or in small batches of instant commands like `craft`). Wait for each `command_result` before proceeding.

### Example 2: Mining Loop

```
1. Check state.json → inventoryStats.freeSlots > 5
2. Scan for ores: {"action":"find_blocks","blockType":"iron_ore"}
3. Mine them: {"action":"mine_resource","resource":"iron_ore","count":8}
4. Wait for command_result
5. Collect drops: {"action":"collect_items"}
6. Check inventory fullness again
7. If full → {"action":"store_items"} or {"action":"manage_inventory"}
8. Repeat
```

### Example 3: Survival Night Cycle

```
When time.phase changes to "sunset":
1. Try to sleep: {"action":"sleep"}
2. If fails ("No bed available"):
   a. Check for bed in inventory → place it
   b. Or build shelter: {"action":"build","template":"shelter_3x3"}
   c. Stay inside, don't move until phase = "day"
3. If fails ("Not night time"): wait, retry when phase = "night"
```

### Example 4: Follow and Assist a Player

```
1. Follow: {"action":"follow","username":"PlayerName","distance":3}
2. Monitor events for "chat" events from that player
3. Parse chat messages for instructions
4. Execute: mine, craft, give items as requested
5. Bot auto-sprints when far, walks when close
```

---

## State Polling Cheat Sheet

Key fields to check every cycle:

```
state.bot.health        → < 6 = critical, < 10 = caution
state.bot.food          → < 6 = auto-eat triggers, < 3 = starving
state.bot.healthTrend   → "taking_damage" = under attack
state.bot.isOnFire      → need water
state.bot.dimension     → overworld / nether / the_end
state.time.phase        → day / sunset / night
state.inventoryStats.freeSlots → < 3 = nearly full
state.nearbyEntities    → check for hostiles (type="hostile")
state.notableBlocks     → chests, ores, workstations nearby
state.currentAction     → null = idle, non-null = busy
state.latestEventId     → highest event ID right now
state.lastAckedEventId  → last ID you acked (null if never)
```

**Rule of thumb:** If `currentAction` is not null, the bot is doing something. Don't send conflicting commands unless you want to cancel it.

**On startup:** Only process events with `id > lastAckedEventId` (or `id > latestEventId` if never acked). Send `ack_events` after processing each batch.
