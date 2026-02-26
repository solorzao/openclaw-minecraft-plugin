---
name: minecraft-bot-controller
description: Monitor and control Nova_AI Minecraft bot with conversational responses. Spawn continuous monitoring subagents that listen to Minecraft chat, detect player mentions, and generate witty, contextual LLM responses. Use when you need to start the bot's conversational system, keep it responsive to chat, or enable real-time interaction with players.
---

# Minecraft Bot Controller

Control Nova_AI's Minecraft bot with personality-driven responses powered by Claude.

## Quick Start

Start the bot conversation system with one call:

```javascript
await sessions_spawn({
  task: `Monitor Minecraft bot chat and respond as Nova continuously.

Loop forever:
1. Read /data/minecraft-bot/bot.log 
2. Check for NEW lines mentioning "nova" or "Nova_AI" from Wookiee_23
3. If found: Generate a witty, conversational response as Nova
4. Write to /data/minecraft-bot/responses.json as: [{"conversationId": 1, "text": "your response"}]
5. Wait 2 seconds, go to step 1

Nova personality: Witty, sarcastic, helpful, natural (not robotic).

Track which messages you've responded to so you don't repeat. Keep running indefinitely.`,
  label: "nova-monitor",
  runTimeoutSeconds: 86400
});
```

The subagent will:
- ✅ Monitor bot logs every 2 seconds
- ✅ Detect new chat from players
- ✅ Generate Claude-powered responses
- ✅ Write to responses.json (bot reads this automatically)
- ✅ Track processed messages to avoid duplicates
- ✅ Run indefinitely until stopped

## Bot Setup

**Prerequisites:**
- Minecraft bot running: `/data/minecraft-bot/bot.js`
- Bot log file: `/data/minecraft-bot/bot.log`
- Response mechanism: `/data/minecraft-bot/bot.js` reads responses.json every 1 second

**Connection:**
- Bot connects to: `187.77.2.50:25568` (public VPS IP + mapped port)
- Bot username: `Nova_AI`
- Server runs vanilla Minecraft with mineflayer bot

## How It Works

### Response Mechanism

The bot.js has a built-in response processor:

```javascript
// Runs every 1 second
setInterval(processResponses, 1000);

function processResponses() {
  const responses = JSON.parse(fs.readFileSync('/data/minecraft-bot/responses.json'));
  responses.forEach(resp => {
    bot.chat(resp.text);  // Send to Minecraft chat
  });
  fs.writeFileSync('/data/minecraft-bot/responses.json', '[]');  // Clear
}
```

### Monitoring Loop

Your subagent needs to:

1. **Read** `/data/minecraft-bot/bot.log` lines containing "username:"
2. **Filter** for messages with "nova" or "Nova_AI"
3. **Track** message hashes (username:message) to avoid duplicates
4. **Generate** response using Claude's knowledge of Nova's personality
5. **Write** to `/data/minecraft-bot/responses.json` in format:
   ```json
   [{
     "conversationId": 1,
     "text": "Your response here"
   }]
   ```

### Nova's Personality

Generated responses should be:
- **Witty & conversational** - Not robotic, use natural language
- **Slightly sarcastic** - "Just mining my existential dread away"
- **Helpful but not subservient** - Offers help with attitude
- **Self-aware** - References being a bot/AI when appropriate
- **Context-aware** - References earlier messages in conversation

**Example responses:**
- Player: "what are you doing?" → "Mining stone mostly. Want to join or just watch?"
- Player: "hey nova" → "Hey! What's going on?"
- Player: "thanks" → "No problem! Anything else?"

## Integration Points

### Files Used

- **Bot log:** `/data/minecraft-bot/bot.log` (read-only, detect chat)
- **Response queue:** `/data/minecraft-bot/responses.json` (write responses here)
- **Bot state:** `/data/minecraft-bot/state.json` (optional, read current bot state)

### Commands Supported

The bot.js automatically parses these commands from chat:

```
nova help           - List available commands
nova status         - Show health, food, position
nova follow         - Follow player
nova stop           - Stop current action
nova goto <x> <z>  - Go to coordinates
nova mine <block>   - Mine specific block type
```

These are handled by bot.js directly, not by your subagent.

## Deployment

See `references/deployment.md` for:
- Port mapping (host 25568 → container 25565)
- Firewall configuration
- Server startup/stop procedures
- Docker container management

See `references/bot-commands.md` for:
- Full command reference
- Bot-to-bot communication (Phase 21)
- Autonomous behavior configuration

## Troubleshooting

**Bot not responding?**
- Check `/data/minecraft-bot/bot.log` for recent activity
- Verify responses.json is being cleared (bot.js processes it)
- Ensure subagent is still running: `sessions_list` to check

**Duplicate responses?**
- Subagent must track processed message hashes in memory
- Add message to `processed_messages` set BEFORE writing response
- Use exact format: `"username:message_text"`

**No new messages detected?**
- Check bot.log has recent `Wookiee_23:` entries
- Verify grep pattern matches: `Wookiee_23:.*nova`
- Ensure subagent is reading latest lines (use `tail -f` or track file size)
