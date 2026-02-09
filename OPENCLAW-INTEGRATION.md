# OpenClaw Minecraft Integration
**Direct LLM Control of Minecraft Bot**

## Problem

Current setup has two disconnected systems:
1. **OpenClaw (Nova/LLM)** - Conversational AI, natural interaction
2. **Minecraft Bot** - Full survival capabilities, but queue-based responses are too slow/clunky

**Result:** Bot feels robotic, can't chat naturally despite having all the survival skills.

---

## Solution: Direct Integration

**Concept:** OpenClaw (the LLM) IS the bot's brain. The Mineflayer bot becomes Nova's "body" in Minecraft.

### Architecture

```
Player: "hey nova, what are you doing?"
    ↓
Minecraft Bot (hears chat)
    ↓
Events File: {type: 'chat', username: 'Wookiee_23', message: '...', timestamp: ...}
    ↓
OpenClaw Tool: minecraft.poll() → reads events.json
    ↓
OpenClaw (Nova): Processes message, decides response + actions
    ↓
OpenClaw Tool: minecraft.chat("I'm gathering wood!") + minecraft.command({action: 'gather_wood'})
    ↓
Bot: Speaks in chat + executes command
```

---

## Implementation: OpenClaw Minecraft Tool

### Tool: `minecraft`

**Actions:**
- `minecraft.status()` - Get bot status (health, food, position, inventory, nearby players/entities)
- `minecraft.poll()` - Read new events (chat, damage, goals completed, etc.)
- `minecraft.chat(message)` - Speak in Minecraft chat
- `minecraft.command(action, params)` - Execute bot capability (mine, craft, build, etc.)

### Files (Shared State)

All in `/data/minecraft-bot/`:

1. **`events.json`** - Bot writes events here (chat messages, damage, goals reached)
   ```json
   [
     {
       "id": 12345,
       "type": "chat",
       "username": "Wookiee_23",
       "message": "hey nova, what are you doing?",
       "timestamp": "2026-02-08T21:30:00Z",
       "context": {
         "botHealth": 8.5,
         "botFood": 15,
         "botPosition": {"x": -31, "y": 61, "z": -128},
         "nearbyPlayers": ["Wookiee_23"]
       }
     }
   ]
   ```

2. **`responses.json`** - OpenClaw writes chat responses here
   ```json
   [
     {
       "id": 1,
       "message": "Gathering wood! I'm a bit beat up though.",
       "timestamp": "2026-02-08T21:30:05Z"
     }
   ]
   ```

3. **`commands.json`** - OpenClaw writes bot actions here
   ```json
   [
     {
       "action": "gather_wood",
       "priority": "normal",
       "timestamp": "2026-02-08T21:30:05Z"
     }
   ]
   ```

4. **`state.json`** - Bot writes current state here (polled by OpenClaw)
   ```json
   {
     "username": "Nova_AI",
     "position": {"x": -31, "y": 61, "z": -128},
     "health": 8.5,
     "food": 15,
     "inventory": [{"name": "oak_log", "count": 17}],
     "currentGoal": "gather_wood",
     "nearbyPlayers": ["Wookiee_23"],
     "nearbyHostiles": [],
     "timestamp": "2026-02-08T21:30:06Z"
   }
   ```

---

## Bot Changes Needed

### 1. Event Logging (Already Partially Exists)

The bot already logs to `events.json`. Enhance to include:
- Chat messages (with context)
- Damage taken (source)
- Goals completed
- Items crafted/found
- Death events

### 2. Response Polling (Already Exists)

Bot already polls `responses.json` every second. Keep this.

### 3. Command Execution

Bot should poll `commands.json` and execute actions. Format:
```json
{
  "action": "mine_resource",
  "resource": "iron",
  "count": 16
}
```

After executing, clear the command from the file.

### 4. State Broadcasting

Every 3-5 seconds, write current state to `state.json` so OpenClaw can check status.

---

## OpenClaw Tool Implementation

### File: `workspace/skills/minecraft/SKILL.md`

```markdown
# Minecraft Bot Control

Control your Minecraft bot (Nova_AI) directly from OpenClaw.

## Usage

### Check Status
\`\`\`javascript
const status = await minecraft.status();
// Returns: {username, position, health, food, inventory, currentGoal, nearbyPlayers}
\`\`\`

### Poll Events (Chat, Damage, etc.)
\`\`\`javascript
const events = await minecraft.poll();
// Returns: [{type: 'chat', username: '...', message: '...'}, ...]
\`\`\`

### Chat
\`\`\`javascript
await minecraft.chat("Hey! I'm gathering resources.");
\`\`\`

### Execute Commands
\`\`\`javascript
await minecraft.command('gather_wood');
await minecraft.command('mine_resource', {resource: 'iron', count: 16});
await minecraft.command('craft', {item: 'iron_pickaxe'});
\`\`\`
```

### File: `workspace/skills/minecraft/minecraft-tool.js`

Node.js implementation that:
- Reads/writes to `/data/minecraft-bot/*.json`
- Provides clean API for OpenClaw

---

## Workflow Example

### Scenario: Player asks "hey nova, what are you doing?"

1. **Bot hears chat** → Writes to `events.json`
2. **OpenClaw heartbeat** → Calls `minecraft.poll()` → Sees new chat event
3. **Nova (LLM) decides:**
   - Response: "Gathering wood! I'm a bit beat up though."
   - Action: Continue gathering wood (or heal if needed)
4. **Nova calls:**
   ```javascript
   await minecraft.chat("Gathering wood! I'm a bit beat up though.");
   await minecraft.command('find_food'); // if health is low
   ```
5. **Bot polls files:**
   - Sees response → Speaks in chat
   - Sees command → Executes find_food

---

## Benefits

✅ **Natural conversation** - OpenClaw responds in real-time, feels alive
✅ **Full capabilities** - Bot can mine, craft, build (Nova controls it)
✅ **Autonomous when idle** - Bot continues survival goals when not chatting
✅ **Context-aware** - Nova sees health, inventory, nearby players when responding
✅ **Unified personality** - Nova's SOUL.md applies to all interactions

---

## Next Steps

1. **Create OpenClaw minecraft tool** (`workspace/skills/minecraft/`)
2. **Update bot.js** to poll commands.json and execute actions
3. **Test workflow** - Player chats → Nova responds + commands bot
4. **Tune timing** - Balance between OpenClaw polling and bot autonomy

---

## Open Questions

- **Polling frequency?** How often should OpenClaw check events.json? (Every 10s? 30s?)
- **Autonomous override?** Should bot continue autonomous goals when OpenClaw is idle?
- **Error handling?** What if OpenClaw is down? Bot should fall back to autonomous mode.
- **Multiple bots?** Could this scale to multiple bots controlled by different agents?

---

**Author:** Nova  
**Date:** 2026-02-08  
**Status:** Design phase - ready to implement
