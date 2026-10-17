#!/usr/bin/env python3
"""TTS Proxy Server for Volcengine TTS.
Serves as a backend proxy so the API token isn't exposed in the frontend.
Also handles voice cloning when enabled.
"""
import json
import os
import base64
import urllib.request
import urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler

# Load credentials from environment or zshrc
VOLC_TTS_APPID = os.environ.get("VOLC_TTS_APPID", "9768801119")
VOLC_TTS_TOKEN = os.environ.get("VOLC_TTS_TOKEN", "")
VOLC_TTS_CLUSTER = os.environ.get("VOLC_TTS_CLUSTER", "volcano_tts")

# If not in env, try to source from zshrc
if not VOLC_TTS_TOKEN:
    try:
        with open(os.path.expanduser("~/.zshrc")) as f:
            for line in f:
                if "VOLC_TTS_TOKEN" in line and "export" in line:
                    VOLC_TTS_TOKEN = line.split('"')[1]
                if "VOLC_TTS_APPID" in line and "export" in line:
                    VOLC_TTS_APPID = line.split('"')[1]
    except:
        pass

TTS_URL = "https://openspeech.bytedance.com/api/v1/tts"
DEFAULT_VOICE = "BV700_streaming"  # Working female voice (volcano_tts cluster)
CLONED_VOICE = os.environ.get("ERIN_VOICE_ID", "S_PLWb4DCd2")  # Erin's cloned voice
CLONED_CLUSTER = "volcano_icl"  # Cloned voices require volcano_icl cluster
DEFAULT_CLUSTER = "volcano_tts"  # Standard voices use volcano_tts


def synthesize(text, voice=None, speed=0.9):
    """Call Volcengine TTS API and return MP3 bytes."""
    voice_type = voice or CLONED_VOICE or DEFAULT_VOICE
    # Cloned voices (S_ prefix) require volcano_icl cluster
    cluster = CLONED_CLUSTER if voice_type.startswith("S_") else DEFAULT_CLUSTER

    payload = {
        "app": {
            "appid": VOLC_TTS_APPID,
            "token": VOLC_TTS_TOKEN,
            "cluster": cluster
        },
        "user": {"uid": "mindfulness_app"},
        "audio": {
            "voice_type": voice_type,
            "encoding": "mp3",
            "speed_ratio": speed,
            "volume_ratio": 1.0,
            "pitch_ratio": 1.0
        },
        "request": {
            "reqid": f"tts_{abs(hash(text)) % 1000000}",
            "text": text,
            "text_type": "plain",
            "operation": "query"
        }
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        TTS_URL,
        data=data,
        headers={
            "Authorization": f"Bearer; {VOLC_TTS_TOKEN}",
            "Content-Type": "application/json"
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            if result.get("code") == 3000 and result.get("data"):
                return base64.b64decode(result["data"])
            else:
                raise Exception(f"TTS error: {result.get('code')} {result.get('message')}")
    except urllib.error.HTTPError as e:
        raise Exception(f"HTTP error: {e.code} {e.reason}")


class TTSHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "ok",
                "voice": CLONED_VOICE or DEFAULT_VOICE,
                "cloned": bool(CLONED_VOICE)
            }).encode())
        elif self.path.startswith("/tts?text="):
            from urllib.parse import unquote
            text = unquote(self.path.split("text=", 1)[1])
            try:
                audio = synthesize(text)
                self.send_response(200)
                self.send_header("Content-Type", "audio/mpeg")
                self.send_header("Content-Length", str(len(audio)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(audio)
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/tts":
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length))
            text = body.get("text", "")
            voice = body.get("voice")
            speed = body.get("speed", 0.9)
            try:
                audio = synthesize(text, voice, speed)
                self.send_response(200)
                self.send_header("Content-Type", "audio/mpeg")
                self.send_header("Content-Length", str(len(audio)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(audio)
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        print(f"[TTS] {args[0]}")


if __name__ == "__main__":
    port = int(os.environ.get("TTS_PORT", "8765"))
    print(f"Volcengine TTS Proxy starting on port {port}")
    print(f"Voice: {CLONED_VOICE or DEFAULT_VOICE} (cloned: {bool(CLONED_VOICE)})")
    print(f"App ID: {VOLC_TTS_APPID}")
    print(f"Token: {VOLC_TTS_TOKEN[:10]}...")
    print(f"Endpoints:")
    print(f"  GET  /health")
    print(f"  GET  /tts?text=Hello")
    print(f"  POST /tts {{text, voice, speed}}")
    server = HTTPServer(("0.0.0.0", port), TTSHandler)
    server.serve_forever()
