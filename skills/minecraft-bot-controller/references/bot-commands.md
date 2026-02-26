# Bot Commands & Architecture

## In-Game Commands

Players can control the bot by saying these in Minecraft chat:

### Navigation
- `nova follow` - Follow the player
- `nova stop` / `nova stay` - Stop moving
- `nova goto <x> <z>` - Teleport to coordinates (via pathfinding)

### Resource Management
- `nova mine <material>` - Mine specific block (wood, stone, iron, etc.)
- `nova equip <item>` - Equip item from inventory

### Status & Help
- `nova status` - Show health, food, position
- `nova help` - List available commands

## Autonomous Behavior

The bot runs continuously with autonomous survival goals:

### Goal Categories (weighted)

1. **Survival** (weight: 10)
   - Find food when hungry
   - Flee from danger
   - Heal when low health

2. **Gathering** (weight: 5)
   - Mine resources (stone, wood, ore)
   - Fish for food
   - Collect items

3. **Building** (weight: 3)
   - Build shelter
   - Craft tools
   - Create storage

4. **Exploration** (weight: 2)
   - Explore new areas
   - Mark landmarks
   - Find villages

### Memory System

Bot maintains persistent world memory:
- **File:** `/data/minecraft-bot/world-memory.json`
- **Stores:** Landmarks, bases, villages, resources
- **Persists:** Survives bot restart

## Bot-to-Bot Communication (Phase 21)

Bots can whisper each other (detected by username patterns):

```
Detected bots:
- Nova_AI (main bot)
- Whisper protocol: /msg <botname> <message>
```

Example: `nova whisper bot2 "need help at base"`

## Response Integration

### Flow

```
Player chat → bot.log → subagent reads → generates response → writes to responses.json → bot.js processes → chat sent
```

### Response File Format

**File:** `/data/minecraft-bot/responses.json`

```json
[
  {
    "conversationId": 1,
    "text": "Your response here"
  }
]
```

**Cleared automatically** after bot.js reads (every 1 second)

### Detected Mentions

Bot responds when chat contains:
- `nova` (shorthand)
- `Nova_AI` (full name)
- `@Nova_AI` (mention format)

## Event Logging

Bot logs all activity to help monitoring systems:

**File:** `/data/minecraft-bot/events.json`

Events include:
- Chat messages (`username: <msg>`)
- Commands executed
- Autonomous goals
- Errors and warnings
- Health/food changes
- Mob encounters

Used by subagent to detect new chat and respond appropriately.

## Autonomous Phases

The bot implements 23 phases of capability:

- **Phases 1-7:** Navigation, perception, goals, interaction, combat, water safety
- **Phases 8-16:** Hunger, crafting, mining, sleep, building, storage, memory, trading, potions
- **Phases 17-19:** Block activation, mount/dismount, fishing
- **Phases 20-23:** Autonomy with agency, bot communication, critical capabilities, survival

Current: **Phase 23 COMPLETE** - Full autonomous survivor with free will

## Important Notes

- Bot is **NOT** a plugin (it's a mineflayer bot running standalone)
- Responses are **synchronous** (bot.js reads every 1 second)
- No persistence for responses (file is cleared after read)
- All responses go through Minecraft chat (no console/server logs)
