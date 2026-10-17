#!/bin/bash
# Start the Mindfulness Avatar App with TTS proxy
# Usage: ./start.sh

cd "$(dirname "$0")"

# Source Volcengine credentials
source ~/.zshrc 2>/dev/null

echo "============================================"
echo "  Take A Pause — Mindfulness Avatar App"
echo "============================================"
echo ""

# Check credentials
if [ -z "$VOLC_TTS_TOKEN" ]; then
    echo "WARNING: VOLC_TTS_TOKEN not set. TTS will use browser fallback."
    echo "Add to ~/.zshrc: export VOLC_TTS_TOKEN=\"your_token\""
else
    echo "TTS Token: ${VOLC_TTS_TOKEN:0:10}..."
fi

# Check for cloned voice (Erin's cloned voice is active)
export ERIN_VOICE_ID="${ERIN_VOICE_ID:-S_PLWb4DCd2}"
echo "Using cloned voice: $ERIN_VOICE_ID (cluster: volcano_icl)"

echo ""
echo "Starting TTS proxy on port 8765..."
python3 tts_proxy.py &
TTS_PID=$!

# Wait for proxy to start
sleep 2

# Test proxy
if curl -s http://localhost:8765/health > /dev/null 2>&1; then
    echo "TTS proxy: RUNNING"
else
    echo "TTS proxy: FAILED to start"
fi

echo ""
echo "Opening app in browser..."
open public/index.html

echo ""
echo "App is running. Press Ctrl+C to stop."
echo "TTS proxy PID: $TTS_PID"

# Keep running
wait $TTS_PID
