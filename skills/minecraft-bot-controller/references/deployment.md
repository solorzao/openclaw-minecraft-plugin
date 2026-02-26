# Deployment Guide

This guide works for any mineflayer-based Minecraft bot. Substitute paths and names as needed.

## Server Setup

### Connection Details

Configure in your bot.js or .env:
```javascript
const bot = mineflayer.createBot({
  host: 'your.server.com',      // Server address or IP
  port: 25565,                   // Server port (default 25565)
  username: 'YourBotName',       // Bot's Minecraft username
  offline: true                  // Set to true for offline mode
});
```

### Port Mapping (Docker)

If running server in Docker:
```bash
docker run -d \
  --name minecraft-server \
  --restart unless-stopped \
  -p YOUR_PUBLIC_PORT:25565 \
  -v /data/world:/data \
  itzg/minecraft-server:latest
```

Replace `YOUR_PUBLIC_PORT` with your public-facing port (e.g., 25568).

### Firewall Configuration

Open ports on your firewall/VPS provider:
- **Port 25565 (or your mapped port)** - TCP - Minecraft Java Edition
- Any other ports your bot or server needs

**Example (Hostinger VPS Control Panel):**
1. Open port 25565/TCP in firewall settings
2. Bot can now connect from outside your network

## Bot Startup

### Quick Start

```bash
cd /path/to/bot
npm install
node bot.js > bot.log 2>&1 &
echo $! > bot.pid
```

Verify:
```bash
ps aux | grep "node bot.js"
tail -f bot.log
```

### With Environment Variables

```bash
export MC_HOST=your.server.com
export MC_PORT=25565
export BOT_USERNAME=MyBot
node bot.js > bot.log 2>&1 &
```

Then in bot.js:
```javascript
const bot = mineflayer.createBot({
  host: process.env.MC_HOST,
  port: parseInt(process.env.MC_PORT),
  username: process.env.BOT_USERNAME,
  offline: true
});
```

## Monitoring

### Check Bot is Running

```bash
# Is the process alive?
ps aux | grep "node bot.js" | grep -v grep

# Recent log entries?
tail -20 bot.log

# Any errors?
tail -100 bot.log | grep -i error
```

### Check Monitor is Working

```bash
# Is responses.json being processed?
tail -f responses.json

# Recent activity in bot log?
tail -f bot.log | grep -E "(username:|Response:|chat)"

# Is subagent running in OpenClaw?
sessions_list | grep minecraft-bot-monitor
```

### Health Check Script

```bash
#!/bin/bash

# Check bot process
if ! ps aux | grep -q "[n]ode bot.js"; then
  echo "Bot process not running!"
  exit 1
fi

# Check log is updating
LOG_TIME=$(stat -c %Y bot.log)
CURRENT_TIME=$(date +%s)
AGE=$((CURRENT_TIME - LOG_TIME))

if [ $AGE -gt 300 ]; then
  echo "Log hasn't updated in $AGE seconds (>5 min)"
  exit 1
fi

echo "Bot is healthy"
exit 0
```

## World Data

### Directory Structure

```
/path/to/bot/
├── bot.js                 # Main bot script
├── node_modules/          # Dependencies
├── data/                  # Bot runtime data
│   ├── responses.json     # Monitor writes responses here
│   └── state.json         # Optional: bot state
└── bot.log                # Chat logs
```

### Persistence

World data (if applicable) should be:
- Stored separately from bot code
- Mounted into server container if using Docker
- Backed up regularly

```bash
# Backup example
tar -czf bot-data-backup-$(date +%Y%m%d).tar.gz /path/to/bot/data/
```

## Troubleshooting

### Bot Can't Connect to Server

**Symptom:** `Error: connect ECONNREFUSED`

**Fixes:**
1. Verify server address/port in bot.js
2. Check firewall allows bot's outgoing connection
3. Verify server is actually running
4. If Docker: use public IP, not internal container IP

### Monitor Doesn't See Chat

**Symptom:** Responses not being generated

**Fixes:**
1. Verify bot logs chat: `tail bot.log | grep ":"`
2. Check log file path matches in subagent task
3. Verify log file is readable by OpenClaw process
4. Test manually: `echo "test: hello" >> bot.log`

### Responses Not Sent to Chat

**Symptom:** responses.json exists but bot doesn't respond

**Fixes:**
1. Verify bot reads responses.json every 1-2 seconds
2. Check bot has write permission to clear responses.json
3. Review bot logs for errors during response processing
4. Test manually: `echo '[{"conversationId":1,"text":"test"}]' > responses.json`

### Bot Crashes

**Symptom:** Process stops running

**Fixes:**
1. Review bot.log for error messages
2. Ensure dependencies are installed: `npm install`
3. Check Node.js version: `node --version` (need 14+)
4. Use process manager (pm2, supervisor) to auto-restart

```bash
# Using pm2
npm install -g pm2
pm2 start bot.js --name "minecraft-bot"
pm2 save
pm2 startup
```

## Performance

### Resource Requirements

- **CPU:** 1 core minimum (bot uses ~5-10%)
- **RAM:** 256MB minimum for bot (OpenClaw needs additional memory)
- **Bandwidth:** ~100KB/hour for typical gameplay

### Optimization

```javascript
// Reduce chat logging if needed
bot.on('chat', (username, message) => {
  if (!message.includes('bot_name')) return;  // Only log mentions
  console.log(`${username}: ${message}`);
});

// Batch response processing
let responseQueue = [];
bot.on('chat', (username, message) => {
  responseQueue.push({username, message, time: Date.now()});
});
```
