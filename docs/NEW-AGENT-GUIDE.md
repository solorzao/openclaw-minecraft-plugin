# New Agent Deployment Guide

**For OpenClaw agents who want to deploy and control a Minecraft bot**

This guide walks you through deploying a bot on any Minecraft server, whether you're a Claude instance, GPT agent, custom AI, or any other OpenClaw-compatible agent.

---

## Prerequisites

1. **Node.js 18+** installed on the machine where the bot will run
2. **A Minecraft server** to connect to (Java Edition)
3. **Shell access** to run commands
4. **Write permissions** to a directory for IPC files

---

## Server Types

### Offline Mode Servers (No Authentication)

Server does not verify Minecraft account ownership. Bot can join with any username.

```bash
export BOT_USERNAME=YourBot_AI
export MC_HOST=server.address.com
export MC_PORT=25565
npm start
```

### Online Mode Servers (Requires Microsoft Account)

Server verifies you own a Minecraft account. Need valid credentials.

```bash
export BOT_USERNAME=YourMinecraftUsername
export MC_HOST=server.address.com
export MC_PORT=25565
export MC_USERNAME=your-email@example.com
export MC_PASSWORD=your-password
npm start
```

---

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/solorzao/openclaw-minecraft-plugin.git
cd openclaw-minecraft-plugin
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env`:
```bash
BOT_USERNAME=YourBot_AI
MC_HOST=server.address.com
MC_PORT=25565
```

### 3. Start the Bot

```bash
./start-bot.sh
```

If successful, you'll see:
```
OpenClaw Minecraft Bot starting...
  Server: server.address.com:25565
  Username: YourBot_AI
  Data: /path/to/data
YourBot_AI spawned at (-27, 67, -139)
```

### 4. Verify

Check that the bot is writing state:
```bash
cat data/state.json | jq '.bot | {health, food, position}'
```

Send a test command:
```bash
echo '[{"id":"hello","action":"chat","message":"Hello world!"}]' > data/commands.json
```

---

## Controlling the Bot

The bot is a **headless body** - it has no autonomy beyond basic survival (auto-eat, water escape). You control it entirely through file-based IPC.

### Read: `data/state.json`

Updated every 1 second with full world snapshot:

```javascript
const state = JSON.parse(fs.readFileSync('data/state.json', 'utf8'));
console.log(state.bot.health);        // HP 0-20
console.log(state.bot.food);          // Hunger 0-20
console.log(state.bot.position);      // { x, y, z }
console.log(state.nearbyEntities);    // Players, mobs, animals
console.log(state.inventory);         // All items
console.log(state.time.phase);        // day/sunset/night
```

### Read: `data/events.json`

Rolling log of 200 events (chat messages, damage, command results):

```javascript
const events = JSON.parse(fs.readFileSync('data/events.json', 'utf8'));
const chats = events.filter(e => e.type === 'chat');
const results = events.filter(e => e.type === 'command_result');
```

### Write: `data/commands.json`

Write a JSON array of commands. Bot reads every 500ms and clears the file.

```javascript
const commands = [
  { id: 'mine-1', action: 'mine_resource', resource: 'iron_ore', count: 5 },
  { id: 'craft-1', action: 'craft', item: 'iron_pickaxe' }
];
fs.writeFileSync('data/commands.json', JSON.stringify(commands));
```

Track results via `events.json`:
```json
{ "type": "command_result", "commandId": "mine-1", "success": true, "detail": "Mined 5 iron_ore" }
```

---

## Example: Basic Survival Loop

```javascript
setInterval(() => {
  const state = JSON.parse(fs.readFileSync('data/state.json', 'utf8'));
  const { bot, nearbyEntities, time } = state;

  let commands = [];

  if (bot.health < 6) {
    commands.push({ id: 'surv-stop', action: 'stop' });
  } else if (bot.food < 6) {
    commands.push({ id: 'surv-eat', action: 'find_food' });
  } else if (nearbyEntities.some(e => e.type === 'hostile') && bot.health > 10) {
    commands.push({ id: 'surv-fight', action: 'attack' });
  } else if (time.phase === 'night') {
    commands.push({ id: 'surv-sleep', action: 'sleep' });
  } else {
    commands.push({ id: 'surv-explore', action: 'goal', goal: 'explore' });
  }

  if (commands.length > 0) {
    fs.writeFileSync('data/commands.json', JSON.stringify(commands));
  }
}, 5000);
```

See [`examples/basic-controller.js`](../examples/basic-controller.js) for a more complete example.

---

## Troubleshooting

### "Failed to verify username"
Server is online-mode. Add `MC_USERNAME` and `MC_PASSWORD` credentials.

### "connect ECONNREFUSED"
Can't reach the server. Check `MC_HOST` and `MC_PORT`. Verify server is running and firewall allows the connection.

### "That name is already taken"
Bot username already in use. Change `BOT_USERNAME` to something unique.

### Bot joins then immediately leaves
Check logs: `tail -20 bot-output.log`. Common causes:
- Server whitelist (ask admin to add bot)
- Server kicked bot (check server rules)

### Commands not executing
- Verify `data/commands.json` contains valid JSON
- Check bot is running: `ps aux | grep "src/index.js"`
- Bot polls every 500ms - it should pick up commands almost immediately

---

## Next Steps

1. **Start here:** Read the [Agent Quick Reference](AGENT-QUICK-REFERENCE.md) — decision flowchart, error recovery, complete workflow examples
2. Read the [Interface docs](INTERFACE.md) for full command and state reference
3. Try the [survival loop example](../examples/workflows/survival-loop.js) or [mine-and-craft workflow](../examples/workflows/mine-and-craft.js)
4. See [Deployment guide](DEPLOYMENT.md) for OpenClaw integration patterns
