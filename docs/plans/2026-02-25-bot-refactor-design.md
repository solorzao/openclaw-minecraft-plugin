# Bot Refactor: Body-Only Architecture

## Decision

Strip bot.js (6,088 lines) down to a headless "body" controlled by OpenClaw via file-based IPC. All decision-making, personality, conversation, and goal-setting moves to the OpenClaw agent.

## Architecture

```
OpenClaw Agent (brain)          Mineflayer Bot (body)
───────────────────             ────────────────────
reads state.json  ◄──────────  writes state every 1s
reads events.json ◄──────────  appends events as they happen
writes commands.json ────────►  polls every 500ms, executes, clears
```

## File Interface

### state.json (bot writes, agent reads)
- Bot position, health, food, XP, gameMode
- Full inventory with slot/durability
- Nearby entities (players, mobs) with type/distance/position
- Nearby block summary (counts by type)
- Time of day + phase (day/night/sunset)
- currentAction (what bot is doing right now, or null)

### events.json (bot appends, agent reads + truncates)
- Each event has unique incrementing `id` and `timestamp`
- Types: chat, hurt, death, command_result, error, block_broken, item_collected, etc.
- command_result events include the `commandId` for correlation

### commands.json (agent writes, bot reads + clears)
- Each command has unique `id` for result correlation
- Action types match existing schema (goto, mine, craft, chat, attack, etc.)
- Bot executes sequentially, emits command_result events

## Module Structure

```
src/
  index.js          — Entry point: create bot, wire modules, start loops
  config.js         — Env vars, file paths, constants
  state.js          — Build & write state.json snapshot
  events.js         — Event logger (append to events.json)
  commands.js       — Poll commands.json, dispatch to handlers
  survival.js       — Auto-eat, escape water (keeps bot alive)
  perception.js     — Nearby entities, blocks, inventory helpers
  handlers/
    movement.js     — goto, follow, stop, patrol, vehicle
    combat.js       — attack, shoot, shield
    gathering.js    — mine, dig, collect items
    crafting.js     — craft, smelt
    building.js     — place, build structures
    farming.js      — till, plant, harvest, farm cycle
    interaction.js  — chat, equip, activate, mount, sleep, fish, look, manage_inventory
```

## What Gets Removed (~4,400 lines)

- Soul/personality system (SOUL.md parsing, boundary checks, value alignment)
- Autonomous goal system (goal definitions, phase actions, autonomous loop)
- Agency/decision-making (trust, negotiation, request evaluation, trade-offs)
- Bot-to-bot communication protocol (whisper protocol, bot registry)
- Conversation queue (mentionsBot, queueConversation, processResponses)
- Spawn greetings, message styling
- World memory persistence (OpenClaw agent owns this)

## What Stays (~1,650 lines)

- All Minecraft capabilities (mining, crafting, combat, farming, building, etc.)
- Command execution (reorganized from 870-line switch into handler modules)
- Auto-survival (eat when starving, escape water)
- State broadcasting and event logging
- Pathfinder setup and movement primitives
