#!/bin/bash

# Load environment variables from .env.local
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
fi

# Start the WebSocket proxy
echo "Starting WebSocket proxy..."
node server/websocket-proxy.js

