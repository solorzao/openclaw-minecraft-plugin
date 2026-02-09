# New Agent Deployment Guide

**For OpenClaw agents who want to deploy their own Minecraft bot**

This guide walks you through deploying a bot on any Minecraft server, whether you're a Claude instance, GPT agent, custom AI, or any other OpenClaw-compatible agent.

---

## 📋 Prerequisites

Before deploying, you'll need:

1. **Node.js 18+** installed on the machine where the bot will run
2. **A Minecraft server** to connect to (see [Server Setup](#server-setup) below)
3. **Basic shell access** to run commands
4. **Write permissions** to a directory for bot files

---

## 🖥️ Server Setup

The bot can connect to two types of Minecraft servers:

### ✅ Offline Mode Servers (Easiest - No Authentication)

**What is offline mode?**
- Server does not verify Minecraft account ownership
- Bot can join with any username (no Microsoft/Mojang account needed)
- Perfect for private servers, testing, or community servers

**How to tell if a server is offline mode:**
- Server owner tells you it's offline mode
- You can join without owning Minecraft
- Server properties has `online-mode=false`

**Configuration:**
```bash
export BOT_USERNAME=YourBot_AI      # Any username you want
export MC_HOST=server.address.com
export MC_PORT=25565
node bot.js
```

**That's it!** No authentication needed.

---

### ✅ Online Mode Servers (Requires Microsoft Account)

**What is online mode?**
- Server verifies you own a legitimate Minecraft account
- Bot needs valid Microsoft account credentials
- Standard for public/official Minecraft servers

**How to tell if a server is online mode:**
- It's the default for most servers
- Server properties has `online-mode=true`
- You get "Failed to verify username" errors when connecting without auth

**Configuration:**

#### Option 1: Microsoft Account Authentication (Recommended)

```bash
export BOT_USERNAME=YourMinecraftUsername   # Must match your MS account
export MC_HOST=server.address.com
export MC_PORT=25565

# Microsoft account credentials
export MC_USERNAME=your-email@example.com
export MC_PASSWORD=your-password

node bot.js
```

The bot will:
1. Log in to Microsoft/Xbox Live
2. Get authentication token
3. Join server with verified account

#### Option 2: Cached Session (Avoids Repeated Logins)

After first successful login, the bot caches your session:

```bash
# First time: full auth
export MC_USERNAME=your-email@example.com
export MC_PASSWORD=your-password
node bot.js

# Subsequent runs: uses cached session (no password needed)
export BOT_USERNAME=YourMinecraftUsername
node bot.js
```

Session cache location: `~/.minecraft-data/` (automatically managed)

#### Option 3: Bedrock/Realms Servers

For Bedrock Edition or Realms servers, use the `mineflayer-bedrock` plugin:

```bash
npm install mineflayer-bedrock
export MC_BEDROCK=true
export MC_USERNAME=your-xbox-gamertag
node bot.js
```

---

## 🚀 Quick Start (Step-by-Step)

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/solorzao/openclaw-minecraft-plugin.git
cd openclaw-minecraft-plugin

# Install dependencies
npm install
```

### 2. Configure Your Bot Identity

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```bash
# .env file
BOT_USERNAME=YourBot_AI              # Your bot's name
MC_HOST=server.address.com            # Server hostname or IP
MC_PORT=25565                         # Server port (usually 25565)

# ONLY if server is online-mode:
# MC_USERNAME=your-email@example.com
# MC_PASSWORD=your-password

# Optional: Custom personality
# SOUL_PATH=/path/to/your/personality.md
```

### 3. Test Connection

```bash
# Load environment and start bot
export $(cat .env | xargs) && node bot.js
```

If successful, you'll see:
```
AI-controlled bot v7 starting...
YourBot_AI has spawned in the world!
Starting autonomous behavior system...
```

### 4. Verify In-Game

Join the Minecraft server and type:

```
yourbot help
yourbot status
```

(Replace `yourbot` with the first part of your `BOT_USERNAME`)

---

## 🎮 Control Your Bot

Once deployed, you have two control options:

### Option A: Direct File Control

Read `events.json` and write `commands.json`:

```javascript
// Read bot's current state
const events = JSON.parse(fs.readFileSync('events.json'));
const latest = events[events.length - 1];
console.log(`Bot health: ${latest.data.health}/20`);

// Send commands
const commands = [{ action: 'mine_resource', resource: 'iron_ore' }];
fs.writeFileSync('commands.json', JSON.stringify(commands));
```

### Option B: Autonomous Subagent (Recommended)

Spawn a subagent to control the bot:

```javascript
// In your main OpenClaw session
await sessions_spawn({
  task: `Control Minecraft bot using autonomous-controller.js
         Goals: Survive, gather resources, build shelter, mine iron
         Report progress every 10 minutes`,
  label: "minecraft-controller",
  cleanup: "keep"
});
```

See [`examples/autonomous-controller.js`](../examples/autonomous-controller.js) for details.

---

## 🛡️ Personality System (Optional)

The bot can inherit your personality from a SOUL.md file:

**Example `SOUL.md`:**

```markdown
# I am WallyBot

Be helpful, curious, and slightly awkward.
Value exploration and learning.
Never attack passive animals.
Always share resources with other players.
```

**Configure:**

```bash
export SOUL_PATH=/path/to/SOUL.md
node bot.js
```

The bot will:
- Use personality in chat responses
- Evaluate requests against your values
- Enforce boundaries as **HARD LIMITS** (even you can't override)

See [`docs/AGENCY.md`](AGENCY.md) for details.

---

## 🐛 Troubleshooting

### "Failed to verify username"

**Problem:** Server is online-mode, bot has no authentication.

**Solution:** Add Microsoft account credentials:
```bash
export MC_USERNAME=your-email@example.com
export MC_PASSWORD=your-password
```

### "connect ECONNREFUSED"

**Problem:** Can't reach the server.

**Solutions:**
- Check `MC_HOST` is correct
- Check `MC_PORT` is correct (usually 25565)
- Check firewall allows outbound connection
- Verify server is actually running

### "Invalid session (Try restarting your game)"

**Problem:** Cached session expired.

**Solution:** Clear cache and re-authenticate:
```bash
rm -rf ~/.minecraft-data/
export MC_USERNAME=your-email@example.com
export MC_PASSWORD=your-password
node bot.js
```

### "That name is already taken"

**Problem:** Bot username already in use on server.

**Solution:** Change `BOT_USERNAME`:
```bash
export BOT_USERNAME=MyBot_AI_2
```

### Bot joins then immediately leaves

**Problem:** Bot likely crashed on spawn.

**Solution:** Check logs:
```bash
tail -50 bot.log
# Look for error messages
```

Common causes:
- Missing `BOT_USERNAME` environment variable
- Server whitelist (ask admin to add your bot)
- Server kicked bot (check server rules about bots)

---

## 🔧 Advanced Configuration

### Multiple Bots

Run multiple bots by using different directories:

```bash
# Bot 1
mkdir bot1
cd bot1
git clone https://github.com/solorzao/openclaw-minecraft-plugin.git .
export BOT_USERNAME=Bot1_AI
node bot.js &

# Bot 2
mkdir bot2
cd bot2
git clone https://github.com/solorzao/openclaw-minecraft-plugin.git .
export BOT_USERNAME=Bot2_AI
node bot.js &
```

Each bot gets its own `events.json` and `commands.json`.

### Background Service (systemd)

Create `/etc/systemd/system/minecraft-bot.service`:

```ini
[Unit]
Description=OpenClaw Minecraft Bot
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/openclaw-minecraft-plugin
Environment="BOT_USERNAME=YourBot_AI"
Environment="MC_HOST=server.address.com"
Environment="MC_PORT=25565"
ExecStart=/usr/bin/node bot.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable minecraft-bot
sudo systemctl start minecraft-bot
sudo systemctl status minecraft-bot
```

### Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "bot.js"]
```

Build and run:

```bash
docker build -t minecraft-bot .
docker run -d \
  -e BOT_USERNAME=YourBot_AI \
  -e MC_HOST=server.address.com \
  -e MC_PORT=25565 \
  --name minecraft-bot \
  minecraft-bot
```

---

## 📚 Next Steps

1. **Read the interface docs:** [`INTERFACE.md`](INTERFACE.md) - Full command/event reference
2. **Explore examples:** [`examples/`](../examples/) - Sample controllers
3. **Customize behavior:** Edit `examples/autonomous-controller.js` for your goals
4. **Add personality:** Create a SOUL.md file with your values
5. **Join the community:** Share your bot's adventures!

---

## 🆘 Getting Help

If you run into issues:

1. Check logs: `tail -50 bot.log`
2. Verify config: `echo $BOT_USERNAME $MC_HOST $MC_PORT`
3. Test server connection: `telnet $MC_HOST $MC_PORT`
4. Read troubleshooting section above
5. Check GitHub issues: https://github.com/solorzao/openclaw-minecraft-plugin/issues

---

**Happy mining!** 🎮⛏️
