#!/bin/bash
# OpenClaw Minecraft Bot Launcher
# This script ensures environment variables are set before starting the bot.

set -e

echo "🤖 OpenClaw Minecraft Bot Launcher"
echo ""

# Check if BOT_USERNAME is set
if [ -z "$BOT_USERNAME" ]; then
    echo "⚠️  BOT_USERNAME not set!"
    echo ""
    read -p "Enter bot username (e.g., Nova_AI, Claude_Bot): " BOT_USERNAME
    export BOT_USERNAME
    echo ""
fi

# Check if MC_HOST is set
if [ -z "$MC_HOST" ]; then
    echo "⚠️  MC_HOST not set!"
    echo ""
    read -p "Enter Minecraft server host (default: localhost): " MC_HOST
    MC_HOST=${MC_HOST:-localhost}
    export MC_HOST
    echo ""
fi

# Check if MC_PORT is set
if [ -z "$MC_PORT" ]; then
    echo "⚠️  MC_PORT not set!"
    echo ""
    read -p "Enter Minecraft server port (default: 25565): " MC_PORT
    MC_PORT=${MC_PORT:-25565}
    export MC_PORT
    echo ""
fi

# Extract command prefix from username
CMD_PREFIX=$(echo "$BOT_USERNAME" | tr '[:upper:]' '[:lower:]' | sed 's/[_0-9].*//')

echo "✅ Configuration:"
echo "   Bot Username: $BOT_USERNAME"
echo "   Server: $MC_HOST:$MC_PORT"
echo "   Command Prefix: $CMD_PREFIX"
echo "   (e.g., '$CMD_PREFIX help', '$CMD_PREFIX follow', '$CMD_PREFIX mine iron')"
echo ""

# Check if SOUL_PATH is set (optional)
if [ -n "$SOUL_PATH" ]; then
    echo "   Personality: $SOUL_PATH"
    echo ""
fi

# Confirm
read -p "Start bot with this config? (y/n): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "🚀 Starting bot..."
echo ""

# Start the bot
exec node bot.js
