# Conversational AI Mode

The bot responds naturally to any chat that mentions it - no command prefix required.

## How It Works

```
                                    ┌─────────────────────┐
                                    │  Minecraft Server   │
                                    └─────────┬───────────┘
                                              │ chat
                                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          bot.js                                      │
│                                                                      │
│  1. Player says "hey nova, what are you doing?"                     │
│  2. mentionsBot() detects bot name in message                        │
│  3. queueConversation() saves to conversations.json with context     │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │  conversations.json   │
                        │  (pending messages)   │
                        └───────────┬───────────┘
                                    │ reads
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    OpenClaw Agent (Claude/GPT)                       │
│                                                                      │
│  1. Agent reads conversations.json                                   │
│  2. Agent understands message using its LLM intelligence            │
│  3. Agent considers: context, personality, current goal, etc.        │
│  4. Agent generates natural response                                 │
│  5. Agent writes to responses.json                                   │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │    responses.json     │
                        │  (agent responses)    │
                        └───────────┬───────────┘
                                    │ reads
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          bot.js                                      │
│                                                                      │
│  1. processResponses() reads responses.json every 1 second          │
│  2. bot.chat() speaks the response                                   │
│  3. Response cleared from file                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## File Locations

| File | Location | Purpose |
|------|----------|---------|
| `conversations.json` | `/data/minecraft-bot/conversations.json` | Queue of player messages awaiting response |
| `responses.json` | `/data/minecraft-bot/responses.json` | Agent-generated responses for bot to speak |

## Conversation Format

### conversations.json

```json
[
  {
    "id": 1707432123456,
    "username": "Player",
    "message": "hey nova, what are you doing?",
    "timestamp": "2026-02-08T21:00:00.000Z",
    "context": {
      "botName": "Bot_AI",
      "botGoal": "gather_wood",
      "position": { "x": 100, "y": 64, "z": -200 },
      "health": 20,
      "food": 18,
      "inventory": [
        { "name": "oak_log", "count": 12 },
        { "name": "wooden_pickaxe", "count": 1 }
      ],
      "nearbyPlayers": ["Player", "OtherPlayer"],
      "isNight": false,
      "soul": {
        "persona": "Nova",
        "vibe": "quirky, sarcastic, warm underneath",
        "values": ["helpfulness", "collaboration"]
      }
    }
  }
]
```

### responses.json

```json
[
  {
    "conversationId": 1707432123456,
    "text": "Gathering some wood! Gotta keep the supplies up~"
  }
]
```

## OpenClaw Agent Integration

The agent (which IS an LLM) can process conversations in several ways:

### Option 1: Direct Processing in Main Session

```javascript
// In your OpenClaw agent session:
const fs = require('fs');

function processMinecraftConversations() {
  const convos = JSON.parse(fs.readFileSync('/data/minecraft-bot/conversations.json'));
  if (convos.length === 0) return;
  
  const responses = [];
  for (const convo of convos) {
    // Use your LLM intelligence to generate a response
    // Consider: convo.context, personality, what the player said
    
    const response = generateResponse(convo); // You ARE the LLM
    responses.push({
      conversationId: convo.id,
      text: response
    });
  }
  
  fs.writeFileSync('/data/minecraft-bot/responses.json', JSON.stringify(responses));
}

// Check every few seconds
setInterval(processMinecraftConversations, 3000);
```

### Option 2: Spawn a Dedicated Subagent

```javascript
// In your main session:
await sessions_spawn({
  task: `Control Nova's Minecraft conversations.
         
         Read /data/minecraft-bot/conversations.json for pending messages.
         Generate natural responses based on context and personality.
         Write responses to /data/minecraft-bot/responses.json.
         
         Bot personality: Quirky, warm, independent. Pursues own goals.
         Current phase: Survival/gathering.`,
  label: "minecraft-conversations"
});
```

### Option 3: Use the Example Script

```bash
node examples/conversational-agent.js
```

This provides a simple fallback that generates basic responses for testing.

## What the Agent Knows (Context)

When processing a conversation, the agent has access to:

| Field | Description |
|-------|-------------|
| `username` | Who said the message |
| `message` | What they said |
| `botName` | Bot's username |
| `botGoal` | Current autonomous goal (gather_wood, explore, idle, etc.) |
| `position` | Bot's x, y, z coordinates |
| `health` | Bot's health (0-20) |
| `food` | Bot's food level (0-20) |
| `inventory` | First 10 items in inventory |
| `nearbyPlayers` | List of nearby player names |
| `isNight` | Whether it's nighttime |
| `soul` | Bot's personality (persona, vibe, values) |

## Response Guidelines

The agent should generate responses that:

1. **Match personality** - Use the `soul.vibe` to style responses
2. **Are context-aware** - Reference what the bot is doing (`botGoal`)
3. **Are natural** - Sound like a person, not a bot
4. **Respect boundaries** - If soul has boundaries, honor them
5. **Stay brief** - Minecraft chat has character limits (~100 chars)

### Example Responses

| Message | Context | Good Response |
|---------|---------|---------------|
| "hey nova what are you doing?" | botGoal: "gather_wood" | "Gathering some wood! Just doing my thing~" |
| "can you help me?" | botGoal: "mine_resource" | "I'm busy mining right now. Maybe later?" |
| "where are you?" | position: {x:100, y:64, z:-200} | "I'm at 100, 64, -200. Come find me!" |
| "hello!" | (any) | "Hey! What's up?" |
| "are you okay?" | health: 8 | "Been better... took some damage. But I'll survive!" |

## Differences from Command Mode

| Aspect | Command Mode (Old) | Conversational AI (Current) |
|--------|-------------------|----------------------------|
| Prefix | Required (`nova follow`) | Not required |
| Response | Immediate, hardcoded | Agent-generated, natural |
| Control | Player commands bot | Bot is autonomous |
| Tone | Functional | Personality-driven |
| Intelligence | Pattern matching | LLM understanding |

## Troubleshooting

### Bot not responding to chat?

1. Check if `mentionsBot()` detects the message:
   - Bot username variations are checked
   - "hey nova", "hi nova", "@nova" all work
   
2. Check `conversations.json` is being written:
   ```bash
   cat /data/minecraft-bot/conversations.json
   ```

3. Check if agent is writing responses:
   ```bash
   cat /data/minecraft-bot/responses.json
   ```

4. Check bot logs for errors:
   ```bash
   tail -f /data/minecraft-bot/bot.log
   ```

### Responses not being spoken?

1. Ensure `processResponses()` is running (check bot.log for errors)
2. Verify `responses.json` format is correct
3. Check `conversationId` matches a pending conversation
