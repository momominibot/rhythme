#!/usr/bin/env python3
"""Voice Erin's short action lines with her cloned voice (Volcengine TTS, cluster volcano_icl, voice S_PLWb4DCd2).

Usage: erin_lines.py LINES.json OUTDIR [--dry]

Guarded the way the art runs are (Jamie's batch rule): one run at a time (OUTDIR/.lock), a line whose mp3 already exists
and decodes is skipped, each line is one request with no retry, and the first failure of any kind (HTTP error, a reply
whose code is not 3000, no audio, a file that does not start like an mp3, a timeout) stops the whole run and writes
OUTDIR/BLOCKED.json. The token is read from VOLC_TTS_TOKEN (or the export line in ~/.zshrc) and is never printed."""
import base64, json, os, sys, time, urllib.request

VOICE, CLUSTER, URL, SPEED = "S_PLWb4DCd2", "volcano_icl", "https://openspeech.bytedance.com/api/v1/tts", 0.88


def creds():
    appid, token = os.environ.get("VOLC_TTS_APPID", ""), os.environ.get("VOLC_TTS_TOKEN", "")
    if not (appid and token):
        for line in open(os.path.expanduser("~/.zshrc")):
            if line.startswith("export VOLC_TTS_TOKEN=") and not token: token = line.split('"')[1]
            if line.startswith("export VOLC_TTS_APPID=") and not appid: appid = line.split('"')[1]
    return appid, token


def say(text, n, appid, token):
    body = {"app": {"appid": appid, "token": token, "cluster": CLUSTER}, "user": {"uid": "rhythme_build"},
            "audio": {"voice_type": VOICE, "encoding": "mp3", "speed_ratio": SPEED, "volume_ratio": 1.0, "pitch_ratio": 1.0},
            "request": {"reqid": "rhythme-%d-%d" % (int(time.time()), n), "text": text, "text_type": "plain", "operation": "query"}}
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "Authorization": "Bearer; " + token})
    with urllib.request.urlopen(req, timeout=45) as r:
        j = json.loads(r.read().decode())
    if j.get("code") != 3000 or not j.get("data"):
        raise RuntimeError("provider code %s: %s" % (j.get("code"), str(j.get("message"))[:160]))
    audio = base64.b64decode(j["data"])
    if not (audio[:3] == b"ID3" or audio[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2")) or len(audio) < 2000:
        raise RuntimeError("reply is not an mp3 (%d bytes)" % len(audio))
    return audio


def main():
    lines_path, out = sys.argv[1], sys.argv[2]; dry = "--dry" in sys.argv
    os.makedirs(out, exist_ok=True)
    if os.path.exists(os.path.join(out, "BLOCKED.json")): print("refused: blocked"); sys.exit(3)
    lock = os.path.join(out, ".lock")
    try: os.mkdir(lock)
    except FileExistsError: print("refused: lock held"); sys.exit(4)
    try:
        appid, token = creds()
        if not (appid and token): raise RuntimeError("no TTS credentials")
        lines = json.load(open(lines_path)); made = 0
        for n, ln in enumerate(lines):
            path = os.path.join(out, ln["id"] + ".mp3")
            if os.path.exists(path) and os.path.getsize(path) > 2000: continue
            if dry: print("dry", ln["id"], ln["text"]); continue
            try:
                audio = say(ln["text"], n, appid, token)
            except Exception as e:
                json.dump({"why": "%s: %s" % (ln["id"], str(e)[:240]), "at": time.strftime("%FT%TZ", time.gmtime())}, open(os.path.join(out, "BLOCKED.json"), "w"))
                print("STOP at", ln["id"], str(e)[:240]); sys.exit(1)
            open(path, "wb").write(audio); made += 1; print("ok", ln["id"], len(audio))
        print("ALLDONE made", made)
    finally:
        os.rmdir(lock)


if __name__ == "__main__":
    main()
