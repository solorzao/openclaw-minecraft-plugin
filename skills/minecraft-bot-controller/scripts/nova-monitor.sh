#!/bin/bash
# Nova Chat Monitor - Continuously reads bot log and generates responses
# 
# Usage: ./nova-monitor.sh
# Runs indefinitely, checking for new chat every 2 seconds
# 
# Requirements:
# - /data/minecraft-bot/bot.log (readable)
# - /data/minecraft-bot/responses.json (writable)

BOT_LOG="/data/minecraft-bot/bot.log"
RESPONSES_FILE="/data/minecraft-bot/responses.json"
PROCESSED_MESSAGES_FILE="/tmp/nova-processed-messages.txt"

# Initialize processed messages tracking
touch "$PROCESSED_MESSAGES_FILE"

echo "🤖 Nova Monitor Starting..."
echo "Monitoring: $BOT_LOG"
echo "Response file: $RESPONSES_FILE"

# Main monitoring loop
while true; do
    # Get last 50 lines and look for chat from Wookiee_23
    NEW_LINES=$(tail -n 50 "$BOT_LOG" | grep -i "Wookiee_23:" | grep -iE "(nova|Nova_AI)")
    
    if [ -n "$NEW_LINES" ]; then
        # Process each new chat line
        while IFS= read -r line; do
            # Create message hash
            MSG_HASH=$(echo "$line" | md5sum | awk '{print $1}')
            
            # Check if we've already processed this message
            if ! grep -q "$MSG_HASH" "$PROCESSED_MESSAGES_FILE"; then
                # Mark as processed
                echo "$MSG_HASH" >> "$PROCESSED_MESSAGES_FILE"
                
                # Extract the message text
                MSG_TEXT=$(echo "$line" | sed 's/.*Wookiee_23:\s*//i')
                
                echo "📝 New message: $MSG_TEXT"
                
                # Generate response (this would be where Claude responds)
                # For now, just a placeholder
                RESPONSE="Got your message: $MSG_TEXT"
                
                # Write to responses.json
                echo "[{\"conversationId\": 1, \"text\": \"$RESPONSE\"}]" > "$RESPONSES_FILE"
                
                echo "✅ Response written"
            fi
        done <<< "$NEW_LINES"
    fi
    
    # Clean up old processed messages (keep only last 1000)
    LINES=$(wc -l < "$PROCESSED_MESSAGES_FILE")
    if [ "$LINES" -gt 1000 ]; then
        tail -n 1000 "$PROCESSED_MESSAGES_FILE" > "$PROCESSED_MESSAGES_FILE.tmp"
        mv "$PROCESSED_MESSAGES_FILE.tmp" "$PROCESSED_MESSAGES_FILE"
    fi
    
    sleep 2
done
