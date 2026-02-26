---
name: minecraft-bot-controller
description: Monitor and control any mineflayer Minecraft bot with conversational responses. Spawn continuous monitoring subagents that listen to Minecraft chat, detect bot mentions, and generate contextual LLM responses based on the bot's personality file (SOUL.md). Use when you need to add conversational AI to a Minecraft bot, keep it responsive to player chat, or enable real-time interaction.
---

# Minecraft Bot Controller

Add conversational AI to any mineflayer-based Minecraft bot with responses generated from the bot's personality file.

## Quick Start

Start the bot conversation system:

```javascript
await sessions_spawn({
  task: `Monitor Minecraft bot chat and respond conversationally.

Configuration (replace with your values):
- BOT_NAME: "MyBot"                    // The bot's Minecraft username
- LOG_FILE: "/path/to/bot.log"         // Where bot logs chat
- RESPONSE_FILE: "/path/to/responses.json"  // Where bot reads responses
- SOUL_FILE: "/path/to/SOUL.md"        // Bot's personality file (optional but recommended)
- PLAYER_FILTER: "PlayerName or @all"  // Who to listen for (or all players)

Loop forever:
1. Read tail of LOG_FILE
2. Find NEW lines containing BOT_NAME mention or PLAYER_FILTER match
3. If found:
   a. Read SOUL_FILE to understand bot's personality, values, and style
   b. Generate contextual response matching bot's identity
   c. Write to RESPONSE_FILE: [{"conversationId": 1, "text": "response"}]
4. Wait 2 seconds, go to step 1

Track processed messages (by hash) to prevent duplicate responses.
Keep running indefinitely.`,
  label: "minecraft-bot-monitor",
  runTimeoutSeconds: 86400
});
```

The subagent will:
- ✅ Monitor bot logs every 2 seconds
- ✅ Detect new chat mentions of your bot
- ✅ Read bot's SOUL.md for personality and values
- ✅ Generate contextual responses matching the bot's identity
- ✅ Write to responses.json (bot reads this automatically)
- ✅ Track processed messages to prevent duplicates
- ✅ Run indefinitely until stopped

## Bot Requirements

Your mineflayer bot needs:

**File structure:**
- Bot running: Any Node.js script using mineflayer
- Log file: Must write chat to a readable log file (e.g., `bot.log`)
- Response file: Must read `responses.json` every 1-2 seconds
- SOUL.md (optional): Bot's personality definition

**Chat logging (required):**
```javascript
bot.on('chat', (username, message) => {
  console.log(`${username}: ${message}`);  // Goes to bot.log via stdout redirection
});
```

**Response processing (required):**
```javascript
setInterval(() => {
  try {
    const responses = JSON.parse(fs.readFileSync('./data/responses.json'));
    responses.forEach(r => {
      if (r.text) bot.chat(r.text);
    });
    fs.writeFileSync('./data/responses.json', '[]');
  } catch(e) {}
}, 1000);
```

## How It Works

### Response Flow

```
Player chat → bot.log → monitor reads → checks SOUL.md → generates response → writes responses.json → bot reads → chat sent
```

### Response File Format

Your bot reads this file every 1-2 seconds:

```json
[
  {
    "conversationId": 1,
    "text": "Response text here"
  }
]
```

Monitor writes responses here, bot reads and sends to chat, clears file.

### Bot Personality (via SOUL.md)

The monitor reads your bot's `SOUL.md` file and generates responses that match the bot's personality, values, and boundaries.

**SOUL.md should define:**
- Bot's name and nature
- Core personality traits and voice
- Values and boundaries
- Tone and communication style

**Example SOUL.md:**
```markdown
# SOUL.md - Who I Am

**Name:** MyBot
**Nature:** A curious Minecraft explorer
**Personality:** Friendly, witty, slightly sarcastic
**Values:** Collaboration, discovery, honesty
**Boundaries:** Won't help with griefing or stealing
```

**Monitor generates responses that match this personality:**
- "Exploring? I'm in! Where are we going?"
- "Found diamonds! Want to grab them together?"
- "Building is cool but I'd rather explore, honestly"
- "Can't help with that - goes against my values"

**No SOUL.md?** Monitor will use Claude's judgment to generate natural, context-appropriate responses based on chat context alone.

**Key principle:** The monitor reads the bot's actual personality file, keeping all responses consistent with the bot's defined identity.

## Configuration

### Paths

All paths are configurable in your subagent task:
- `LOG_FILE` - Where your bot logs chat
- `RESPONSE_FILE` - Where bot reads responses
- `SOUL_FILE` - Bot's personality file (optional)

### Bot Name

Replace `BOT_NAME` with your actual Minecraft username:
```
BOT_NAME: "MyBot"  → Monitor detects "mybot" or "MyBot" in chat
```

### Player Filter

Listen for specific players or all mentions:
```
PLAYER_FILTER: "Wookiee_23"  → Only respond to Wookiee_23's mentions
PLAYER_FILTER: "@all"        → Respond to any mention of BOT_NAME
```

### SOUL.md Location

Provide the path to your bot's personality file:
```
SOUL_FILE: "/path/to/bot/SOUL.md"
```

If SOUL.md doesn't exist, the monitor will generate generic context-aware responses.

## Deduplication

The monitor tracks processed messages by hash (`username:message`) to prevent responding to the same message twice.

This is handled internally - the subagent task should include:
```
Track processed messages (by hash) to prevent duplicate responses.
```

## Integration Points

### Files Used

- **Bot log:** Readable log file where bot writes chat (format: `username: message`)
- **Response queue:** JSON file that bot reads and processes every 1-2 seconds
- **SOUL.md:** Optional personality file that defines bot's identity and values

### Optional: Commands

Your bot.js can optionally parse commands from chat:

```javascript
bot.on('chat', (username, message) => {
  if (message.toLowerCase().startsWith(BOT_NAME.toLowerCase() + ' help')) {
    bot.chat('Available commands: help, status, follow, stop');
  }
  // Your command logic here
});
```

The monitor responds to ALL mentions with LLM responses. If you want specific command handling, implement it in bot.js.

## Deployment

See `references/deployment.md` for:
- Docker setup (if containerizing your bot)
- Port mapping and firewall configuration
- Bot startup and health monitoring

See `references/bot-commands.md` for:
- Chat log format requirements
- Response file schema
- Optional autonomous bot features

See `scripts/bot-monitor.sh` for:
- Example generic monitoring loop (bash implementation)
- How to detect new messages and track duplicates

## Troubleshooting

**Monitor not detecting chat?**
- Verify bot logs chat as `username: message` (exact format)
- Check log file is readable by subagent process
- Ensure monitor is checking correct log path

**Bot not sending responses?**
- Verify bot reads responses.json every 1-2 seconds
- Check responses.json is in correct location
- Ensure bot has write permission to clear the file

**Responses don't match bot's personality?**
- Verify SOUL.md exists and is readable
- Check SOUL.md path in subagent task is correct
- If no SOUL.md, monitor will use generic responses

**Duplicate responses?**
- Monitor tracks message hashes internally
- If duplicates occur, reset subagent: `sessions_list` → stop → restart

**Monitor not running?**
- Check subagent is still active: `sessions_list | grep minecraft-bot-monitor`
- Review agent logs for errors
- Restart if needed: `sessions_spawn` with same task

## Example Setup

For a bot at `/data/my-bot/bot.js` with SOUL.md:

```javascript
await sessions_spawn({
  task: `Monitor Minecraft bot chat and respond conversationally.

Configuration:
- BOT_NAME: "MyBot"
- LOG_FILE: "/data/my-bot/bot.log"
- RESPONSE_FILE: "/data/my-bot/responses.json"
- SOUL_FILE: "/data/my-bot/SOUL.md"
- PLAYER_FILTER: "@all"

Loop forever:
1. Read tail of LOG_FILE
2. Find NEW lines containing MyBot mention
3. Read SOUL.md to understand personality
4. Generate response matching personality
5. Write to RESPONSE_FILE: [{"conversationId": 1, "text": "response"}]
6. Wait 2 seconds, go to step 1

Track processed messages by hash to prevent duplicates.
Keep running indefinitely.`,
  label: "my-bot-monitor",
  runTimeoutSeconds: 86400
});
```
