#!/bin/bash
# OpenClaw Minecraft Bot Launcher
# 
# Usage:
#   ./start-bot.sh          # Uses .env file
#   ./start-bot.sh -h       # Show this help
#
# Requires:
#   - Node.js installed
#   - Dependencies installed (npm install)
#   - .env file configured (copy from .env.example)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Show help
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
  echo "OpenClaw Minecraft Bot Launcher"
  echo ""
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  (none)    Launch bot with .env configuration"
  echo "  -h        Show this help message"
  echo ""
  echo "Setup:"
  echo "  1. cp .env.example .env"
  echo "  2. Edit .env with your server details"
  echo "  3. $0"
  echo ""
  exit 0
fi

# Check if .env exists
if [ ! -f "$SCRIPT_DIR/.env" ]; then
  echo -e "${RED}❌ Error: .env file not found${NC}"
  echo ""
  echo "Setup instructions:"
  echo "  1. Copy the example config:"
  echo "     cp .env.example .env"
  echo ""
  echo "  2. Edit .env with your settings:"
  echo "     - BOT_USERNAME: Your bot's name"
  echo "     - MC_HOST: Your Minecraft server address"
  echo "     - MC_PORT: Your Minecraft server port"
  echo ""
  echo "  3. Run this script again:"
  echo "     ./start-bot.sh"
  echo ""
  exit 1
fi

# Check if node_modules exist
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
  echo -e "${YELLOW}⚠️  Dependencies not installed. Running npm install...${NC}"
  cd "$SCRIPT_DIR"
  npm install
  echo ""
fi

# Load environment variables from .env
export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)

# Validate required settings
if [ -z "$BOT_USERNAME" ] || [ -z "$MC_HOST" ] || [ -z "$MC_PORT" ]; then
  echo -e "${RED}❌ Error: Missing required settings in .env${NC}"
  echo ""
  echo "Required settings:"
  echo "  BOT_USERNAME - Your bot's name"
  echo "  MC_HOST      - Minecraft server address"
  echo "  MC_PORT      - Minecraft server port"
  echo ""
  exit 1
fi

# Show startup info
echo -e "${GREEN}🚀 Starting OpenClaw Minecraft Bot${NC}"
echo ""
echo "Configuration:"
echo "  Bot Name:        $BOT_USERNAME"
echo "  Server:          $MC_HOST:$MC_PORT"
if [ -n "$BOT_DATA_DIR" ]; then
  echo "  Data Directory:  $BOT_DATA_DIR"
fi
if [ -n "$SOUL_PATH" ]; then
  echo "  Personality:     $SOUL_PATH"
fi
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start the bot
cd "$SCRIPT_DIR"
node bot.js
