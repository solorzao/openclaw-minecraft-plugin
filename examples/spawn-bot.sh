#!/bin/bash

# Spawn Minecraft Bot
# Quick script to start the bot and controller together

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

echo "🤖 OpenClaw Minecraft Bot Launcher"
echo "═══════════════════════════════════════════════════"
echo "📁 Repository: $REPO_DIR"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found!"
    echo "   Install: https://nodejs.org/"
    exit 1
fi

# Check npm packages
if [ ! -d "$REPO_DIR/node_modules" ]; then
    echo "📦 Installing dependencies..."
    cd "$REPO_DIR"
    npm install
    echo "✅ Dependencies installed"
    echo ""
fi

# Check if bot is already running
if pgrep -f "node.*bot.js" > /dev/null; then
    echo "⚠️  Bot already running!"
    echo "   PID: $(pgrep -f 'node.*bot.js')"
    echo ""
    read -p "Kill existing bot? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        pkill -f "node.*bot.js"
        echo "✅ Stopped existing bot"
        sleep 1
    else
        echo "Exiting..."
        exit 0
    fi
fi

# Start bot
echo "🚀 Starting bot..."
cd "$REPO_DIR"
node bot.js > bot-output.log 2>&1 &
BOT_PID=$!
echo "✅ Bot started (PID: $BOT_PID)"
echo "   Logs: $REPO_DIR/bot-output.log"
echo ""

# Wait for bot to connect
echo "⏳ Waiting for bot to connect..."
sleep 3

# Check if bot is still running
if ! ps -p $BOT_PID > /dev/null; then
    echo "❌ Bot failed to start!"
    echo "   Check logs: tail -20 $REPO_DIR/bot-output.log"
    exit 1
fi

# Check if events.json exists
if [ -f "$REPO_DIR/events.json" ]; then
    echo "✅ Bot connected! Events file created."
else
    echo "⏳ Waiting for events.json..."
    sleep 2
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "🎮 Bot Status"
echo "═══════════════════════════════════════════════════"
echo "   PID: $BOT_PID"
echo "   Logs: tail -f $REPO_DIR/bot-output.log"
echo "   Events: cat $REPO_DIR/events.json | jq"
echo "   Commands: echo '[{\"action\":\"chat\",\"message\":\"Hello!\"}]' > $REPO_DIR/commands.json"
echo ""
echo "🎯 Next Steps:"
echo "   1. Start controller: node $SCRIPT_DIR/basic-controller.js"
echo "   2. Or control manually via commands.json"
echo "   3. In-game: say 'nova help' for commands"
echo ""
echo "🛑 Stop Bot:"
echo "   kill $BOT_PID"
echo "   or: pkill -f 'node.*bot.js'"
echo ""
