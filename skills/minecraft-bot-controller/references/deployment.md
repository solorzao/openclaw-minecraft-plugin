# Deployment Guide

## Server Setup

### Port Mapping
- **Host port:** 25568 (public-facing)
- **Container port:** 25565 (internal Minecraft server)
- **Mapping:** `25568:25565` (docker run -p)

### Firewall (Hostinger VPS)
Must be opened in Hostinger control panel:
- Port 25568 (TCP) - Minecraft Java Edition
- Port 27015 (UDP) - Palworld (if co-hosted)

### Docker Container

Start the vanilla Minecraft server:
```bash
sudo docker run -d \
  --name minecraft-vanilla \
  --restart unless-stopped \
  -p 25568:25565 \
  -v /data/minecraft-vanilla:/data \
  -e EULA=TRUE \
  -e TYPE=VANILLA \
  -e VERSION=LATEST \
  -e MEMORY=4G \
  itzg/minecraft-server:latest
```

### Starting the Bot

```bash
cd /data/minecraft-bot
node bot.js > bot.log 2>&1 &
```

Verify bot is running:
```bash
ps aux | grep "node bot.js" | grep -v grep
tail -20 /data/minecraft-bot/bot.log
```

## Bot Configuration

**File:** `/data/minecraft-bot/bot.js` (lines 1676-1680)

```javascript
const botConfig = {
  host: '187.77.2.50',     // PUBLIC VPS IP (not container IP!)
  port: 25568,              // Mapped port
  username: 'Nova_AI',
  offline: true             // Offline mode (no auth needed)
};
```

**Critical:** Use public VPS IP (187.77.2.50), NOT container IP (172.17.0.2).
The bot runs on the host and must connect via the publicly-mapped port.

## Bot Data

**World directory:** `/data/minecraft-vanilla/`
**Persists:** Yes, survives container restart

Backup world:
```bash
tar -czf minecraft-vanilla-backup-$(date +%Y%m%d).tar.gz /data/minecraft-vanilla/world*
```

## Monitoring

Check server status:
```bash
sudo docker ps | grep minecraft-vanilla
sudo docker logs minecraft-vanilla --tail 50
```

Check bot status:
```bash
tail -f /data/minecraft-bot/bot.log
ps aux | grep "node bot.js"
```

Check responses being processed:
```bash
cat /data/minecraft-bot/responses.json
```
