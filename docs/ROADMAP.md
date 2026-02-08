# Minecraft AI Bot - Development Roadmap

**Project:** Autonomous AI-controlled Minecraft bot (Nova_AI)  
**Started:** 2026-02-08  
**Goal:** Enable AI agents to join Minecraft server and act autonomously

---

## ✅ Phase 1: Core Infrastructure (COMPLETE)

- [x] **Bot connection** - Mineflayer bot connects to server
- [x] **Event logging** - All game events written to JSON file
- [x] **Command system** - Bot reads commands from JSON file and executes
- [x] **Basic actions** - Chat, jump, sneak, look at player
- [x] **AI control bridge** - Subagent monitors events and writes commands

**Status:** ✅ Complete (2026-02-08)

---

## ✅ Phase 2: Navigation (COMPLETE)

- [x] **Pathfinding** - mineflayer-pathfinder plugin integrated
- [x] **Follow player** - Bot can follow players autonomously
- [x] **Go to coordinates** - Navigate to specific X,Y,Z
- [x] **Stop command** - Halt all movement

**Status:** ✅ Complete (2026-02-08)

---

## ✅ Phase 3: Perception & Safety (COMPLETE)

- [x] **Player detection** - Track nearby players with distance/position
- [x] **Mob detection** - Detect hostile mobs (zombies, skeletons, creepers, etc.)
- [x] **Terrain scanning** - Detect dangerous terrain (cliffs, lava, cactus)
- [x] **Health monitoring** - React to low health and damage
- [x] **Safety behaviors** - Back away from danger, avoid falls

**Status:** ✅ Complete (2026-02-08)

---

## ✅ Phase 4: Basic Goals (COMPLETE)

- [x] **Gather wood** - Find and navigate to nearest tree
- [x] **Explore** - Pick random direction and explore
- [x] **Idle behaviors** - Jump around when nothing to do
- [x] **Social awareness** - Greet players, offer to follow

**Status:** ✅ Complete (2026-02-08)

---

## 🔨 Phase 5: Block Interaction (IN PROGRESS)

**Priority:** HIGH - Core gameplay unlock

- [ ] **Break blocks** - Dig dirt, chop trees, mine stone
- [ ] **Place blocks** - Build simple structures
- [ ] **Collect items** - Pick up dropped items after breaking blocks
- [ ] **Inventory management** - Track what bot is carrying
- [ ] **Tool selection** - Use right tool for the job (axe for wood, pickaxe for stone)

**Commands to add:**
```json
{"action":"dig","position":{"x":int,"y":int,"z":int}}
{"action":"place","blockType":"cobblestone","position":{}}
{"action":"equip","item":"wooden_pickaxe","hand":"main"}
```

**Estimated time:** 30-45 minutes

---

## 🔨 Phase 6: Combat (IN PROGRESS)

**Priority:** HIGH - Survival essential

- [ ] **Attack entity** - Fight hostile mobs
- [ ] **Defend self** - Auto-attack when attacked
- [ ] **Combat tactics** - Strafe, retreat when low health
- [ ] **Target prioritization** - Focus nearest/most dangerous mob
- [ ] **Weapon selection** - Use sword when available

**Commands to add:**
```json
{"action":"attack","target":"mob_id"}
{"action":"defend","mode":"aggressive|defensive"}
```

**Estimated time:** 20-30 minutes

---

## 📦 Phase 7: Crafting System

**Priority:** MEDIUM - Required for progression

- [ ] **Craft items** - Use crafting table
- [ ] **Recipe knowledge** - Know how to craft tools, blocks, etc.
- [ ] **Resource gathering chains** - Gather wood → craft planks → craft sticks → craft tools
- [ ] **Crafting table placement** - Place and use crafting tables
- [ ] **Furnace usage** - Smelt ores

**Commands to add:**
```json
{"action":"craft","recipe":"wooden_pickaxe","count":1}
{"action":"smelt","item":"iron_ore","fuel":"coal"}
```

**Estimated time:** 45-60 minutes

---

## 🧠 Phase 8: Memory & Knowledge

**Priority:** MEDIUM - Intelligence boost

- [ ] **Location memory** - Remember coordinates of important places
  - Player bases
  - Resource deposits (coal, iron, diamonds)
  - Death locations
  - Spawn point
- [ ] **Event history** - Remember past interactions
- [ ] **Learning from deaths** - Avoid locations that killed the bot
- [ ] **Knowledge graph** - Build map of world relationships

**Storage:** `/data/minecraft-bot/memory.json`

```json
{
  "locations": {
    "player_base_wookiee": {"x":100,"y":64,"z":200},
    "iron_deposit_1": {"x":-50,"y":12,"z":150},
    "death_cactus_cave": {"x":-25,"y":50,"z":-140}
  },
  "learned_dangers": ["underground_cactus"],
  "player_preferences": {
    "Wookiee_23": {"likes_following": true}
  }
}
```

**Estimated time:** 30-45 minutes

---

## 🗣️ Phase 9: Natural Language Understanding

**Priority:** LOW - Nice to have

- [ ] **Complex commands** - "Help me build a house"
- [ ] **Context awareness** - Understand pronouns ("go there", "follow him")
- [ ] **Multi-step tasks** - Break complex requests into subtasks
- [ ] **Clarification questions** - Ask for details when ambiguous

**Examples:**
- "Nova, help me build a house" → gather wood, craft planks, build structure
- "Find diamonds" → go deep mining
- "Protect me" → follow + attack hostile mobs

**Estimated time:** 60+ minutes

---

## 👥 Phase 10: Multi-Agent Coordination

**Priority:** LOW - Research/experimental

- [ ] **Multiple bots** - Deploy Claude_AI, GPT_AI, etc.
- [ ] **Shared goals** - Bots work together on tasks
- [ ] **Role assignment** - One gathers, one builds, one defends
- [ ] **Communication** - Bots chat with each other
- [ ] **Conflict resolution** - Avoid fighting over resources

**Architecture:**
- Each bot has own event/command files
- Shared knowledge file for coordination
- Leader-follower patterns

**Estimated time:** 90+ minutes

---

## 🎯 Current Sprint: Phase 5 & 6 (Block Interaction + Combat)

**Next Session Goals:**

1. **Block breaking** (30 min)
   - Add dig command
   - Implement wood chopping goal (find tree → pathfind → dig blocks)
   - Collect dropped items

2. **Combat** (20 min)
   - Add attack command
   - Auto-defend when attacked
   - Retreat when health < 30%

3. **Test scenarios:**
   - "Nova gather wood" → should chop down entire tree
   - Spawn zombie near bot → should fight back
   - Health drops to 5 → should flee

---

## 📊 Metrics & Success Criteria

**Phase 5 Complete When:**
- Bot can chop down a tree and collect all wood blocks
- Bot can mine stone with a pickaxe
- Bot maintains inventory of collected items

**Phase 6 Complete When:**
- Bot successfully kills a zombie
- Bot retreats when health < 30%
- Bot can defend Oliver from hostile mobs

**Overall Project Success:**
- Multiple AI agents can coexist in server
- Bots complete complex tasks autonomously ("build a house", "find diamonds")
- Bots learn from experience and adapt behavior

---

## 🐛 Known Issues

- **Death loop:** Bot repeatedly falls into cactus caves (mitigated with safety behaviors)
- **Paper 1.21 bug:** Config parsing error, using vanilla instead
- **Mineflayer version:** Only supports up to MC 1.21, not 1.21.11

---

## 💡 Future Ideas (Backlog)

- **Voice communication** - Bot responds to voice commands
- **Redstone engineering** - Build automated farms, doors, etc.
- **Trading** - Interact with villagers
- **Dimension travel** - Nether, End portals
- **PvP mode** - Bot fights other players (with consent)
- **Creative mode** - Build elaborate structures
- **Modded Minecraft** - Support for modpacks (if mineflayer compatible)

---

*Last updated: 2026-02-08 17:46 EST*
