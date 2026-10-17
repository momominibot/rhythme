# Voice Cloning Setup Guide

## Current Status: ACTIVE

Erin's cloned voice is fully working via Volcengine TTS.

- **Voice ID**: `S_PLWb4DCd2`
- **Cluster**: `volcano_icl` (critical - cloned voices require this cluster, not `volcano_tts`)
- **App ID**: 9768801119
- **Status**: API returns code 3000 (Success) with valid MP3 audio
- **9 pre-generated phrases** in `public/audio/tts/` use Erin's cloned voice
- **TTS proxy** (`tts_proxy.py`) auto-detects `S_` prefixed voices and uses `volcano_icl`

## How It Was Set Up

1. Extracted 75.9 min of clean speech from 19 podcast episodes
2. Created 20s sample (`assets/voice_samples/erin_voice_20s.wav`)
3. Uploaded to Volcengine console → 声音复刻
4. Activated 豆包声音复刻模型2.0 via API 调用 → 开通模型
5. Voice ID: `S_PLWb4DCd2`
6. Discovered cloned voices need `cluster: "volcano_icl"` (not `volcano_tts`)

## API Usage

```bash
curl -X POST "https://openspeech.bytedance.com/api/v1/tts" \
  -H "Authorization: Bearer; $VOLC_TTS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "app": {"appid": "9768801119", "token": "'"$VOLC_TTS_TOKEN"'", "cluster": "volcano_icl"},
    "user": {"uid": "mindfulness_app"},
    "audio": {"voice_type": "S_PLWb4DCd2", "encoding": "mp3", "speed_ratio": 0.85},
    "request": {"reqid": "1", "text": "Welcome to Take A Pause.", "text_type": "plain", "operation": "query"}
  }'
```

## Voice Samples

- **20s sample**: `assets/voice_samples/erin_voice_20s.wav` (861 KB) - uploaded to Volcengine
- **Combined sample**: `assets/voice_samples/erin_voice_combined.wav` (5 min, 12.6 MB)
- **Raw podcasts**: `public/audio/*.mp3` (19 episodes, 225 MB, Erin's real voice)

## App Integration

- TTS proxy runs on port 8765: `python3 tts_proxy.py`
- Startup script: `./start.sh` (launches proxy + opens app)
- Chat messages have "speak" buttons that call the proxy
- Pre-generated phrases: greetings, breathing cues, meditation begin/end, closings
- Web Speech API fallback if proxy is unavailable
- Podcast player (Listen tab) plays Erin's real voice from 19 episodes

## Troubleshooting

- **3001 "resource not granted"**: Model not activated. Go to console → 声音复刻 → API 调用 → 开通模型
- **3031 "Init Engine Instance fail"**: Wrong cluster. Use `volcano_icl` for `S_` prefixed cloned voices
- **BV700_streaming works but cloned doesn't**: Standard voices use `volcano_tts`, cloned voices use `volcano_icl`
