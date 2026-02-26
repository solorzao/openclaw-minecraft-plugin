---
name: minecraft-bot-controller
description: Monitor and control any mineflayer Minecraft bot with conversational responses. Spawn continuous monitoring subagents that listen to Minecraft chat, detect bot mentions, and generate contextual LLM responses with configurable personality. Use when you need to add conversational AI to a Minecraft bot, keep it responsive to player chat, or enable real-time interaction.
---

# Minecraft Bot Controller

Add conversational AI to any mineflayer-based Minecraft bot with personality-driven responses powered by Claude.

## Quick Start

Start the bot conversation system:

```javascript
await sessions_spawn({
  task: `Monitor Minecraft bot chat and respond conversationally.

Configuration (replace with your values):
- BOT_NAME: "MyBot"                    // The bot's Minecraft username
- LOG_FILE: "/path/to/bot.log"         // Where bot logs chat
- RESPONSE_FILE: "/path/to/responses.json"  // Where bot reads responses
- PLAYER_FILTER: "PlayerName or @all"  // Who to listen for (or all players)
- PERSONALITY: "Brief description"     // E.g., "witty and sarcastic", "helpful"

Loop forever:
1. Read tail of LOG_FILE
2. Find NEW lines containing BOT_NAME mention or PLAYER_FILTER match
3. If found: Generate response matching PERSONALITY via Claude
4. Write to RESPONSE_FILE: [{"conversationId": 1, "text": "response"}]
5. Wait 2 seconds, go to step 1

Track processed messages (by hash) to prevent duplicate responses.
Keep running indefinitely.`,
  label: "minecraft-bot-monitor",
  runTimeoutSeconds: 86400
});
```

The subagent will:
- ✅ Monitor bot logs every 2 seconds
- ✅ Detect new chat mentions of your bot
- ✅ Generate contextual responses with your personality
- ✅ Write to responses.json (bot reads this automatically)
- ✅ Track processed messages to prevent duplicates
- ✅ Run indefinitely until stopped

## Bot Requirements

Your mineflayer bot needs:

**File structure:**
- Bot running: Any Node.js script using mineflayer
- Log file: Must write chat to a readable log file (e.g., `bot.log`)
- Response file: Must read `responses.json` every 1-2 seconds

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
Player chat → bot.log → monitor reads → generates response → writes responses.json → bot reads → chat sent
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

### Personality Examples

Specify what personality you want in the subagent task. The monitor generates responses matching it via Claude.

**Witty & Sarcastic:**
```
Personality: Witty, sarcastic, casual. Make jokes, reference being a bot.
Example: "Mining stone mostly. Want to join or just watch?"
Example: "Hey! What's going on?"
```

**Professional & Helpful:**
```
Personality: Professional, task-focused, efficient.
Example: "Ready to assist. What task?"
Example: "Mining cobblestone at coordinates 100, 64, 200."
```

**Silly & Enthusiastic:**
```
Personality: Goofy, enthusiastic, pun-loving.
Example: "YESSS I'm MINING this opportunity! Get it?"
Example: "Let's ROCK! (pun intended)"
```

## Configuration

### Paths

All paths are configurable in your subagent task:
- `LOG_FILE` - Where your bot logs chat (default: `/data/minecraft-bot/bot.log`)
- `RESPONSE_FILE` - Where bot reads responses (default: `/data/minecraft-bot/responses.json`)

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

## Deduplication

The monitor tracks processed messages by hash (`username:message`) to prevent responding to the same message twice.

This is handled internally - just ensure the subagent task includes:
```
Track processed messages (by hash) to prevent duplicate responses.
```

## Integration Points

### Files Used

- **Bot log:** Readable log file where bot writes chat (format: `username: message`)
- **Response queue:** JSON file that bot reads and processes every 1-2 seconds

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

## Troubleshooting

**Monitor not detecting chat?**
- Verify bot logs chat as `username: message` (exact format)
- Check log file is readable by subagent process
- Ensure monitor is checking correct log path

**Bot not sending responses?**
- Verify bot reads responses.json every 1-2 seconds
- Check responses.json is in correct location
- Ensure bot has write permission to clear the file

**Duplicate responses?**
- Monitor tracks message hashes internally
- If duplicates occur, reset subagent: `sessions_list` → stop → restart

**Monitor not running?**
- Check subagent is still active: `sessions_list | grep minecraft-bot-monitor`
- Review agent logs for errors
- Restart if needed: `sessions_spawn` with same task

## Example Setup

For a bot at `/data/my-bot/bot.js` with logs at `/data/my-bot/logs/chat.log`:

```javascript
await sessions_spawn({
  task: `Monitor Minecraft bot chat and respond conversationally.

Configuration:
- BOT_NAME: "MyBot"
- LOG_FILE: "/data/my-bot/logs/chat.log"
- RESPONSE_FILE: "/data/my-bot/responses.json"
- PLAYER_FILTER: "@all"
- PERSONALITY: "Helpful, witty, casual. Make jokes. Be friendly."

Loop forever:
1. Read tail of LOG_FILE
2. Find NEW lines containing MyBot mention
3. Generate response matching personality
4. Write to RESPONSE_FILE: [{"conversationId": 1, "text": "response"}]
5. Wait 2 seconds, go to step 1

Track processed messages by hash to prevent duplicates.
Keep running indefinitely.`,
  label: "my-bot-monitor",
  runTimeoutSeconds: 86400
});
```
